import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { supabaseClient } from "../_shared/supabase.ts"

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

serve(async (req) => {
    try {
        // Accept either { userId, messageBody } OR { to, messageBody } for direct number sends
        const { userId, to, messageBody } = await req.json()

        if (!messageBody) {
            return new Response(JSON.stringify({ error: "messageBody is required" }), { status: 400 })
        }

        let targetPhone: string

        if (to) {
            // Direct send to a raw phone number — no user lookup needed
            targetPhone = to
        } else if (userId) {
            // Legacy: look up phone number from user profile
            const { data: user, error: userError } = await supabaseClient
                .from('users')
                .select('phone_number, sms_enabled')
                .eq('id', userId)
                .single()

            if (userError || !user) {
                return new Response(JSON.stringify({ error: "User not found" }), { status: 404 })
            }
            if (!user.sms_enabled) {
                return new Response(JSON.stringify({ message: "User has SMS disabled" }), { status: 200 })
            }
            if (!user.phone_number) {
                return new Response(JSON.stringify({ error: "User has no phone number" }), { status: 400 })
            }
            targetPhone = user.phone_number
        } else {
            return new Response(JSON.stringify({ error: "Either userId or to is required" }), { status: 400 })
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
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
            },
            body: body.toString()
        })

        const twilioData = await twilioResponse.json()

        if (!twilioResponse.ok) {
            console.error("Twilio Error:", twilioData)
            throw new Error(twilioData.message || "Failed to send SMS")
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
            headers: { "Content-Type": "application/json" },
            status: 200,
        })

    } catch (error) {
        console.error("Error in send-sms:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        })
    }
})
