import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { supabaseClient } from "../_shared/supabase.ts"

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

serve(async (req) => {
    try {
        // 1. Parse the request payload
        const { userId, messageBody } = await req.json()

        if (!userId || !messageBody) {
            return new Response(JSON.stringify({ error: "userId and messageBody are required" }), { status: 400 })
        }

        // 2. Fetch the user's phone number and SMS preferences from Supabase
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

        // 3. Send the SMS via Twilio API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`

        const body = new URLSearchParams({
            To: user.phone_number,
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

        // 4. (Optional) Log the successful message to the sms_logs table
        await supabaseClient.from('sms_logs').insert({
            user_id: userId,
            phone_number: user.phone_number,
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
