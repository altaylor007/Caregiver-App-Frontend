import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')
const twilioApiKeySid = Deno.env.get('TWILIO_API_KEY_SID')
const twilioApiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (!twilioAccountSid || !twilioPhoneNumber || !twilioApiKeySid || !twilioApiKeySecret) {
        return new Response(JSON.stringify({ error: "Twilio credentials missing" }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: {
                headers: { Authorization: authHeader || `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` }
            }
        }
    )

    try {
        // Accept either { userId, messageBody } OR { to, messageBody } for direct number sends
        const { userId, to, messageBody } = await req.json()

        if (!messageBody) {
            return new Response(JSON.stringify({ error: "messageBody is required" }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let targetPhone: string

        if (to) {
            // Direct send to a raw phone number — no user lookup needed
            targetPhone = to
        } else if (userId) {
            // Legacy: look up phone number from user profile
            const { data: user, error: userError } = await supabaseClient
                .from('users')
                .select('phone, sms_enabled')
                .eq('id', userId)
                .single()

            if (userError || !user) {
                console.error("User query error:", userError, "for userId:", userId)
                return new Response(JSON.stringify({ error: userError ? userError.message : "User not found", details: userError, userId }), {
                    status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            if (!user.sms_enabled) {
                return new Response(JSON.stringify({ message: "User has SMS disabled" }), {
                    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            if (!user.phone) {
                return new Response(JSON.stringify({ error: "User has no phone number" }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            targetPhone = user.phone
        } else {
            return new Response(JSON.stringify({ error: "Either userId or to is required" }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Send via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`

        const body = new URLSearchParams({
            To: targetPhone,
            From: twilioPhoneNumber!,
            Body: messageBody
        })

        const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(`${twilioApiKeySid}:${twilioApiKeySecret}`)
            },
            body: body.toString()
        })

        const twilioData = await twilioResponse.json()

        if (!twilioResponse.ok) {
            console.error("Twilio Error:", twilioData)
            // Return 200 with an error field so the Supabase client can read the body
            return new Response(JSON.stringify({ error: twilioData.message || "Twilio failed to send SMS", twilioCode: twilioData.code }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            })
        }

        // Log the outbound message
        await supabaseClient.from('sms_logs').insert({
            user_id: userId || null,
            phone_number: targetPhone,
            direction: 'outbound',
            message_body: messageBody,
            status: 'sent',
            provider_id: twilioData.sid
        })

        return new Response(JSON.stringify({ success: true, sid: twilioData.sid }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error("Error in send-sms:", error)
        // Return 200 with error field so client can read the actual message
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        })
    }
})
