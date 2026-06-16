import { createClient } from 'jsr:@supabase/supabase-js@2'

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIMEZONE = 'America/Chicago'

const dayOfWeekFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long'
})

const monDFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric'
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
})

const formatTime = (date: Date) => {
    const formatted = timeFormatter.format(date)
    return formatted.replace(/\s+/g, ' ')
}

function buildSmsBody(firstName: string, tomorrowShifts: any[], upcomingShifts: any[]) {
    const tomorrowLines = tomorrowShifts.map(shift => {
        const start = new Date(shift.start_time)
        const end = new Date(shift.end_time)
        const dayOfWeek = dayOfWeekFormatter.format(start)
        const monD = monDFormatter.format(start)
        const startStr = formatTime(start)
        const endStr = formatTime(end)
        return `${dayOfWeek}, ${monD} • ${startStr} – ${endStr}`
    }).join('\n')

    let body = `Hi ${firstName ?? 'there'}! A reminder from Agnes Care Team. You have a shift tomorrow:\n${tomorrowLines}`

    if (upcomingShifts && upcomingShifts.length > 0) {
        const upcomingLines = upcomingShifts.map(shift => {
            const start = new Date(shift.start_time)
            const end = new Date(shift.end_time)
            const dayOfWeek = dayOfWeekFormatter.format(start)
            const monD = monDFormatter.format(start)
            const startStr = formatTime(start)
            const endStr = formatTime(end)
            return `${monD} ${dayOfWeek}  ${startStr} – ${endStr}`
        }).join('\n')

        body += `\n\nUpcoming shifts (next 7 days):\n${upcomingLines}`
    }

    return body
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.error("Twilio credentials or phone number are missing in environment variables.")
        return new Response(JSON.stringify({ error: "Twilio credentials or phone number missing" }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_JWT') ?? ''
        )

        // Query active users with SMS notifications enabled
        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, first_name, phone')
            .eq('sms_enabled', true)
            .eq('sms_shift_reminders', true)
            .not('phone', 'is', null)
            .eq('status', 'active')

        if (usersError) {
            console.error("Error fetching users:", usersError)
            return new Response(JSON.stringify({ error: usersError.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Compute tomorrow and sevenDaysOut in UTC
        const now = new Date()
        const tomorrowDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
        const tomorrow = tomorrowDate.toISOString().split('T')[0]

        const sevenDaysOutDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7))
        const sevenDaysOut = sevenDaysOutDate.toISOString().split('T')[0]

        let sent = 0
        let skipped = 0
        let failed = 0

        if (users && users.length > 0) {
            for (const user of users) {
                // Query tomorrow's shifts
                const { data: tomorrowShifts, error: tomorrowError } = await supabaseClient
                    .from('shifts')
                    .select('start_time, end_time, date')
                    .eq('assigned_to', user.id)
                    .eq('date', tomorrow)
                    .order('start_time', { ascending: true })

                if (tomorrowError) {
                    console.error(`Error querying tomorrow shifts for user ${user.id}:`, tomorrowError)
                    failed++
                    continue
                }

                if (!tomorrowShifts || tomorrowShifts.length === 0) {
                    skipped++
                    continue
                }

                // Query upcoming shifts (next 7 days)
                const { data: upcomingShifts, error: upcomingError } = await supabaseClient
                    .from('shifts')
                    .select('start_time, end_time, date')
                    .eq('assigned_to', user.id)
                    .gt('date', tomorrow)
                    .lte('date', sevenDaysOut)
                    .order('date', { ascending: true })
                    .order('start_time', { ascending: true })

                if (upcomingError) {
                    console.error(`Error querying upcoming shifts for user ${user.id}:`, upcomingError)
                    failed++
                    continue
                }

                const messageBody = buildSmsBody(user.first_name, tomorrowShifts, upcomingShifts)

                // Send via Twilio
                let twilioSid: string | null = null
                let errorMessage: string | null = null
                let status: 'sent' | 'failed' = 'sent'

                try {
                    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
                    const body = new URLSearchParams({
                        To: user.phone,
                        From: twilioPhoneNumber,
                        Body: messageBody
                    })

                    const twilioResponse = await fetch(twilioUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
                        },
                        body: body.toString()
                    })

                    const twilioData = await twilioResponse.json()

                    if (!twilioResponse.ok) {
                        console.error(`Twilio Error sending to ${user.phone}:`, twilioData)
                        status = 'failed'
                        errorMessage = twilioData.message || "Twilio failed to send SMS"
                        failed++
                    } else {
                        twilioSid = twilioData.sid
                        sent++
                    }
                } catch (e) {
                    console.error(`Fetch error sending to ${user.phone}:`, e)
                    status = 'failed'
                    errorMessage = (e as Error).message || "Unknown fetch error"
                    failed++
                }

                // Log the attempt
                const { error: logError } = await supabaseClient
                    .from('sms_logs')
                    .insert({
                        user_id: user.id,
                        phone_number: user.phone,
                        direction: 'outbound',
                        message_body: messageBody,
                        status,
                        provider_id: twilioSid,
                        error_message: errorMessage
                    })

                if (logError) {
                    console.error(`Error inserting sms_log for user ${user.id}:`, logError)
                }
            }
        }

        return new Response(JSON.stringify({ sent, skipped, failed }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error("Critical error in send-shift-reminders:", error)
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
