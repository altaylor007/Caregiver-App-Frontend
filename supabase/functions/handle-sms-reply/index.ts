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
            .eq('phone', fromNumber)
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

        let replyText = '';

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

        // 4b. Otherwise, see if this is an expense submission (EXPENSE keyword OR photo + amount).
        if (!isYesReply) {
            const numMedia = parseInt((formData.get('NumMedia') || '0').toString(), 10) || 0;
            const hasMedia = numMedia > 0;
            const rawBody = messageBody.toString().trim();
            const isExpenseKeyword = /^expense\b/i.test(rawBody);
            const amountMatch = rawBody.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
            const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
            const looksLikeExpense = isExpenseKeyword || (hasMedia && !!amount && amount > 0);

            if (looksLikeExpense) {
                const formatHelp = "To submit an expense, text the amount and a short description, and attach a photo of the receipt if you have one. Example: EXPENSE 25.00 gas for client visit.";

                // Parse the description by stripping the keyword and the amount token.
                let description = rawBody;
                if (isExpenseKeyword) description = description.replace(/^expense\b/i, '');
                if (amountMatch) description = description.replace(amountMatch[0], '');
                description = description.replace(/\s+/g, ' ').trim();

                if (!amount || amount <= 0) {
                    replyText = `We couldn't find an amount in your message. ${formatHelp}`;
                } else if (!hasMedia && !description) {
                    replyText = `Please attach a photo of the receipt, or include a note explaining why there's no receipt. ${formatHelp}`;
                } else {
                    try {
                        let receiptPath = null;
                        let noReceiptReason = null;

                        if (hasMedia) {
                            const mediaUrl = formData.get('MediaUrl0')?.toString();
                            const mediaType = (formData.get('MediaContentType0') || 'image/jpeg').toString();
                            const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
                            const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
                            const mediaRes = await fetch(mediaUrl, {
                                headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`) }
                            });
                            if (!mediaRes.ok) throw new Error(`Media fetch failed: ${mediaRes.status}`);
                            const mediaBytes = new Uint8Array(await mediaRes.arrayBuffer());
                            const ext = (mediaType.split('/')[1] || 'jpg').split(';')[0];
                            receiptPath = `${user.id}/sms_${Date.now()}.${ext}`;
                            const { error: upErr } = await supabaseClient.storage
                                .from('receipts')
                                .upload(receiptPath, mediaBytes, { contentType: mediaType });
                            if (upErr) throw upErr;
                        } else {
                            // No photo: the caregiver's text serves as the no-receipt explanation.
                            noReceiptReason = description;
                        }

                        const { error: insErr } = await supabaseClient.from('expenses').insert({
                            user_id: user.id,
                            amount,
                            description: description || 'Expense submitted via text',
                            receipt_url: receiptPath,
                            no_receipt_reason: noReceiptReason,
                            source: 'sms'
                        });
                        if (insErr) throw insErr;

                        replyText = receiptPath
                            ? `Got it — $${amount.toFixed(2)} expense recorded. It will be reviewed at the next payroll close.`
                            : `Got it — $${amount.toFixed(2)} expense recorded without a receipt. It will be reviewed at the next payroll close.`;
                    } catch (expErr) {
                        console.error('Failed to record SMS expense:', expErr);
                        replyText = "Sorry, we couldn't save your expense. Please try again or submit it in the app.";
                    }
                }
            }
        }

        // 5. Respond to Twilio (Empty TwiML response means "don't reply back with anything immediately")
        const twiml = replyText
            ? `<Response><Message>${replyText}</Message></Response>`
            : '<Response></Response>';
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
