import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatDate(dateStr: string): { month: string; day: number } {
  const parts = dateStr.split(/[-T]/)
  let date: Date
  if (parts.length >= 3) {
    const year = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const day = parseInt(parts[2])
    date = new Date(Date.UTC(year, month, day))
  } else {
    date = new Date(dateStr)
  }

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
  return {
    month: months[date.getUTCMonth()] || months[0],
    day: date.getUTCDate()
  }
}

function getWeekLabel(startStr: string, endStr: string): string {
  const start = formatDate(startStr)
  const end = formatDate(endStr)
  return `${start.month} ${start.day} – ${end.month} ${end.day}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser()
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Invalid token or not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: user role must be admin or manager" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }


    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!twilioAccountSid || !twilioPhoneNumber) {
      return new Response(JSON.stringify({ error: "Twilio credentials missing" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { broadcastId, periodStart, periodEnd } = await req.json()

    if (!periodStart || !periodEnd) {
      return new Response(JSON.stringify({ error: "Missing periodStart or periodEnd" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const weekLabel = getWeekLabel(periodStart, periodEnd)
    const messageBody = `Agnes Care Team: Your schedule for ${weekLabel} has been published. View and acknowledge it here: https://radiant-yeot-a82a87.netlify.app/`


    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_JWT') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Query active caregivers with SMS enabled and phone numbers
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, phone')
      .eq('sms_enabled', true)
      .eq('status', 'active')
      .not('phone', 'is', null)
      .or('role.eq.caregiver,is_caregiver.eq.true')

    if (usersError) {
      console.error("Error querying users:", usersError)
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let sent = 0
    let failed = 0

    if (users && users.length > 0) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`

      const smsResults = await Promise.all(users.map(async (user) => {
        let status: 'sent' | 'failed' = 'failed'
        let providerId: string | null = null
        let errorMessage: string | null = null

        try {
          const body = new URLSearchParams({
            To: user.phone,
            From: twilioPhoneNumber,
            Body: messageBody
          })

          const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + btoa(`${Deno.env.get('TWILIO_API_KEY_SID')}:${Deno.env.get('TWILIO_API_KEY_SECRET')}`)
            },
            body: body.toString()
          })

          const twilioData = await twilioResponse.json()

          if (twilioResponse.ok) {
            status = 'sent'
            providerId = twilioData.sid
          } else {
            errorMessage = twilioData.message || "Twilio error"
          }
        } catch (err) {
          errorMessage = (err as Error).message || "Network error"
        }

        // Log the SMS attempt
        try {
          await supabaseClient.from('sms_logs').insert({
            user_id: user.id,
            phone_number: user.phone,
            direction: 'outbound',
            message_body: messageBody,
            status: status,
            provider_id: providerId,
            error_message: errorMessage
          })
        } catch (logErr) {
          console.error(`Failed to log SMS for user ${user.id}:`, logErr)
        }

        return status === 'sent'
      }))

      sent = smsResults.filter(Boolean).length
      failed = smsResults.length - sent
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    console.error("Unhandled error in send-schedule-broadcast:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
