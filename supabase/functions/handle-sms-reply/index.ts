import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { supabaseClient } from "../_shared/supabase.ts"

serve(async (req) => {
    try {
        // 1. Twilio sends data as URL Encoded Form Data, not JSON
        const formData = await req.formData()

        const fromNumber = formData.get('From') // The caregiver's phone number
        const messageBody = formData.get('Body') // e.g. "YES"

        if (!fromNumber || !messageBody) {
            return new Response("Missing required fields", { status: 400 })
        }

        console.log(`Received SMS from ${fromNumber}: ${messageBody}`)

        // 2. Identify the user by their phone number
        const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('id')
            .eq('phone_number', fromNumber)
            .single()

        if (userError || !user) {
            // We received a text from an unknown number. We should just ignore it.
            console.error(`Received SMS from unknown number: ${fromNumber}`)
            return new Response("User not found", { status: 200 }) // Return 200 so Twilio doesn't retry
        }

        // 3. Log the incoming message
        await supabaseClient.from('sms_logs').insert({
            user_id: user.id,
            phone_number: fromNumber,
            direction: 'inbound',
            message_body: messageBody,
            status: 'received'
        })

        // 4. Process the reply (e.g., checking if they sent "YES 1A2B" to accept a shift trade)
        const normalizedReply = messageBody.toString().trim().toUpperCase();

        // Check if the reply starts with YES
        const isYesReply = normalizedReply.startsWith('YES');
        const replyParts = normalizedReply.split(/\s+/);

        if (isYesReply) {
            let tradeQuery = supabaseClient
                .from('shift_trades')
                .select('*')
                .eq('proposed_to', user.id)
                .eq('status', 'pending');

            // Find the precise shift trade via the unique SMS code
            if (replyParts.length >= 2) {
                const smsCode = replyParts[1];
                tradeQuery = tradeQuery.eq('sms_code', smsCode);
            } else {
                // Fallback: if they just replied "YES", still take the most recent request
                tradeQuery = tradeQuery.order('created_at', { ascending: false }).limit(1);
            }

            const { data: trades, error: tradeError } = await tradeQuery;
            const trade = trades && trades.length > 0 ? trades[0] : null;

            if (trade && !tradeError) {
                console.log(`Approving shift trade ${trade.id} for user ${user.id}`)
                const { error: updateError } = await supabaseClient
                    .from('shift_trades')
                    .update({ status: 'approved' })
                    .eq('id', trade.id)

                if (updateError) {
                    console.error("Failed to approve trade:", updateError)
                } else {
                    // The shift trade is approved!
                    // In a full implementation, you'd also want to re-assign the shift to this caregiver
                    // in the `shifts` table, and potentially send a confirmation SMS back to them.

                    // You might also insert a record into the `messages` table so the manager sees it in real-time
                    await supabaseClient.from('messages').insert({
                        author_id: user.id, // Caregiver who accepted
                        content: `I have replied YES via SMS to accept the shift trade request.`
                    })
                }
            } else {
                console.log(`User ${user.id} replied YES but has no pending shift trades.`)
            }
        }

        // 5. Respond to Twilio (Empty TwiML response means "don't reply back with anything immediately")
        const twiml = '<Response></Response>'
        return new Response(twiml, {
            headers: { "Content-Type": "text/xml" },
            status: 200,
        })

    } catch (err) {
        const error = err as Error;
        console.error("Error handling SMS reply:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})
