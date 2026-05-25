import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Validate authorization and extract user session
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("Missing Authorization header")
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser()
    if (authError || !authUser) {
      console.error("Auth error:", authError)
      return new Response(JSON.stringify({ error: "Invalid token or not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Verify caller is admin or manager
    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('id, role')
      .eq('id', authUser.id)
      .single()

    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) {
      console.error("User is not authorized (role check failed):", profileError, profile)
      return new Response(JSON.stringify({ error: "Forbidden: user role must be admin or manager" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Verify Twilio environment variables
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Missing Twilio configuration")
      return new Response(JSON.stringify({ error: "Server misconfiguration: Twilio credentials missing" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Parse and validate request body
    let bodyData
    try {
      bodyData = await req.json()
    } catch (e) {
      console.error("Failed to parse request JSON:", e)
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { title, message, period_start, period_end } = bodyData
    if (!title || !message || !period_start || !period_end) {
      console.error("Missing required fields in request body:", bodyData)
      return new Response(JSON.stringify({ error: "Missing required fields: title, message, period_start, and period_end are required." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 5. Initialize service role client for privileged database queries
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 6. Insert schedule broadcast
    const { data: broadcast, error: insertError } = await supabaseAdmin
      .from('schedule_broadcasts')
      .insert({
        created_by: authUser.id,
        title,
        message,
        period_start,
        period_end
      })
      .select('id')
      .single()

    if (insertError || !broadcast) {
      console.error("Failed to insert broadcast into DB:", insertError)
      return new Response(JSON.stringify({ error: "Failed to create schedule broadcast record" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const broadcastId = broadcast.id

    // 7. Fetch active caregivers (caregiver role or dual-role admin/manager) excluding caller
    const { data: caregivers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, first_name, phone, sms_enabled, sms_only_mentions')
      .eq('status', 'active')
      .or('role.eq.caregiver,is_caregiver.eq.true')
      .neq('id', authUser.id)

    if (fetchError) {
      console.error("Failed to fetch active caregivers:", fetchError)
      return new Response(JSON.stringify({ error: "Failed to fetch caregivers list" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const caregiverList = caregivers ?? []
    let notifiedCount = 0

    // 8. Insert in-app notifications
    if (caregiverList.length > 0) {
      const notificationsToInsert = caregiverList.map((cg) => ({
        user_id: cg.id,
        actor_id: authUser.id,
        type: 'schedule_broadcast',
        reference_id: broadcastId,
        is_read: false
      }))

      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert(notificationsToInsert)

      if (notificationError) {
        console.error("Failed to insert notifications:", notificationError)
        return new Response(JSON.stringify({ error: "Failed to create in-app notifications" }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      notifiedCount = caregiverList.length
    }

    // 9. Send SMS to opted-in caregivers and log the results
    const smsRecipients = caregiverList.filter((cg) => cg.sms_enabled && cg.phone)
    const smsBody = `${title}: ${message} Open the app to review your shifts and acknowledge.`

    const sendSmsAndLog = async (cg: any): Promise<boolean> => {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
        const twilioRequestBody = new URLSearchParams({
          To: cg.phone,
          From: twilioPhoneNumber,
          Body: smsBody
        })

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
          },
          body: twilioRequestBody.toString()
        })

        const twilioData = await response.json()

        if (!response.ok) {
          console.error(`Twilio send failed for user ${cg.id}:`, twilioData)
          await supabaseAdmin.from('sms_logs').insert({
            user_id: cg.id,
            phone_number: cg.phone,
            direction: 'outbound',
            message_body: smsBody,
            status: 'failed',
            error_message: twilioData.message || "Twilio failed to send SMS"
          })
          return false
        }

        await supabaseAdmin.from('sms_logs').insert({
          user_id: cg.id,
          phone_number: cg.phone,
          direction: 'outbound',
          message_body: smsBody,
          status: 'sent',
          provider_id: twilioData.sid
        })
        return true
      } catch (err: any) {
        console.error(`Error sending SMS to user ${cg.id}:`, err)
        try {
          await supabaseAdmin.from('sms_logs').insert({
            user_id: cg.id,
            phone_number: cg.phone,
            direction: 'outbound',
            message_body: smsBody,
            status: 'failed',
            error_message: err.message || "Network error sending SMS"
          })
        } catch (dbErr) {
          console.error("Failed to write failed sms log to database:", dbErr)
        }
        return false
      }
    }

    const smsResults = await Promise.all(smsRecipients.map(sendSmsAndLog))
    const smsSentCount = smsResults.filter(r => r === true).length
    const smsFailedCount = smsResults.filter(r => r === false).length

    // 10. Return success status and broadcast statistics
    return new Response(
      JSON.stringify({
        success: true,
        broadcast_id: broadcastId,
        notified: notifiedCount,
        sms_sent: smsSentCount,
        sms_failed: smsFailedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (err: any) {
    console.error("Unhandled error in edge function:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
