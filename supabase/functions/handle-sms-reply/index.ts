import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Inline service-role client so this function never depends on the shared file being
// separately deployed. SERVICE_ROLE_JWT is a 3-part eyJ… JWT that PostgREST accepts;
// the new sb_secret_… format is not a JWT and is rejected ("Expected 3 parts in JWT").
const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_JWT') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
)

// "Trade Shifts" message_topics row
const TRADE_SHIFTS_TOPIC_ID = '03638cf4-dfb4-4dec-9407-6c27e937ec6a';

serve(async (req) => {
    try {
        // 1. Twilio sends data as URL Encoded Form Data, not JSON
        const formData = await req.formData()

        const fromNumber = formData.get('From') // The caregiver's phone number
        const messageBody = (formData.get('Body') ?? '').toString() // may be empty for a photo-only MMS
        const numMediaTop = parseInt((formData.get('NumMedia') || '0').toString(), 10) || 0;

        // A photo-only MMS has an empty Body — allow it through as long as media is attached.
        if (!fromNumber || (!messageBody && numMediaTop === 0)) {
            return new Response("Missing required fields", { status: 400 })
        }

        console.log(`Received SMS from ${fromNumber}: ${messageBody}`)

        // 2. Identify the user by phone, tolerant of formatting.
        // Compare by the last 10 digits so +15125551234, 15125551234,
        // 512-555-1234, (512) 555-1234, etc. all match.
        const onlyDigits = (s: unknown) => (s ?? '').toString().replace(/\D/g, '');
        const fromDigits = onlyDigits(fromNumber).slice(-10);

        let user: { id: string; first_name?: string | null; full_name?: string | null } | null = null;
        if (fromDigits.length === 10) {
            const { data: candidates } = await supabaseClient
                .from('users')
                .select('id, phone, first_name, full_name')
                .not('phone', 'is', null);
            user = (candidates || []).find((u: any) => onlyDigits(u.phone).slice(-10) === fromDigits) || null;
        }

        if (!user) {
            // We received a text from an unrecognized number. Ignore it.
            console.error(`Received SMS from unknown number: ${fromNumber}`)
            return new Response("User not found", { status: 200 }) // Return 200 so Twilio doesn't retry
        }

        const firstName = (user.first_name || (user.full_name ?? '').split(' ')[0] || 'there').toString().trim();

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
                // Only allow pending trades to be accepted via SMS replies
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
                        content: `I have replied YES via SMS to accept the shift trade request.`,
                        topic_id: TRADE_SHIFTS_TOPIC_ID
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
            // Prefer a $-prefixed amount (e.g. $20.00) so a stray number in the description
            // isn't misread; otherwise fall back to the first number in the message.
            const amountMatch = rawBody.match(/\$\s*(\d+(?:\.\d{1,2})?)/) || rawBody.match(/(\d+(?:\.\d{1,2})?)/);
            const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
            // Is this user mid-"EXPENSE" workflow (they texted EXPENSE and we asked for details)?
            const { data: session } = await supabaseClient
                .from('sms_expense_sessions')
                .select('created_at, awaiting_receipt, pending_amount, pending_description')
                .eq('user_id', user.id)
                .maybeSingle();
            const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
            const inWorkflow = !!session && (Date.now() - new Date(session.created_at).getTime() < SESSION_TTL_MS);

            // Parse the description (strip the EXPENSE keyword and the amount token).
            let description = rawBody;
            if (isExpenseKeyword) description = description.replace(/^expense\b/i, '');
            if (amountMatch) description = description.replace(amountMatch[0], '');
            description = description.replace(/\s+/g, ' ').trim();

            const hasAmount = !!amount && amount > 0;
            const isSkip = /^(no\b|no receipt|skip|file\b|without|submit)/i.test(rawBody);
            const prompt = `${firstName}, let's file your expense. In one message, reply with what it was for and the total amount, and attach a photo of the receipt (or a short note if you don't have one). Example: Parking Doctors Appointment $5.00`;
            const declineNote = " Note: expenses without a receipt may be declined for reimbursement at payroll review.";

            // Upload an MMS receipt to storage and return its path.
            const uploadReceipt = async () => {
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
                const path = `${user.id}/sms_${Date.now()}.${ext}`;
                const { error: upErr } = await supabaseClient.storage
                    .from('receipts')
                    .upload(path, mediaBytes, { contentType: mediaType });
                if (upErr) throw upErr;
                return path;
            };

            // Insert the expense and clear the workflow session.
            const fileExpense = async (amt: number, desc: string, receiptPath: string | null) => {
                const { error: insErr } = await supabaseClient.from('expenses').insert({
                    user_id: user.id,
                    amount: amt,
                    description: desc || 'Expense submitted via text',
                    receipt_url: receiptPath,
                    no_receipt_reason: receiptPath ? null : (desc || 'No receipt provided'),
                    source: 'sms'
                });
                if (insErr) throw insErr;
                await supabaseClient.from('sms_expense_sessions').delete().eq('user_id', user.id);
            };

            if (inWorkflow && session?.awaiting_receipt) {
                // A pending expense is waiting for a receipt decision. Block new submissions
                // until it's resolved (photo, NO, or CANCEL).
                const amt = Number(session.pending_amount);
                const desc = session.pending_description ?? '';
                const isDiscard = /^(discard|void)\b/i.test(rawBody);
                try {
                    if (hasMedia) {
                        const path = await uploadReceipt();
                        await fileExpense(amt, desc, path);
                        replyText = `Got it, ${firstName} — $${amt.toFixed(2)} expense recorded with your receipt. It will be reviewed at the next payroll close.`;
                    } else if (isSkip) {
                        await fileExpense(amt, desc, null);
                        replyText = `Got it, ${firstName} — $${amt.toFixed(2)} expense recorded without a receipt.${declineNote}`;
                    } else if (isDiscard) {
                        await supabaseClient.from('sms_expense_sessions').delete().eq('user_id', user.id);
                        replyText = `Discarded your pending expense ($${amt.toFixed(2)} for ${desc}). Text EXPENSE to start a new one.`;
                    } else {
                        replyText = `You have a pending expense: $${amt.toFixed(2)} for ${desc}. Reply with a photo of the receipt to attach it, reply NO to file it without a receipt, or reply DISCARD to discard it.`;
                    }
                } catch (expErr) {
                    console.error('Failed to record SMS expense:', expErr);
                    replyText = "Sorry, we couldn't save your expense. Please try again or submit it in the app.";
                }
            } else {
                const isExpenseInteraction = isExpenseKeyword || inWorkflow || (hasMedia && hasAmount);
                if (isExpenseInteraction) {
                    if (!hasAmount) {
                        // Not enough to file yet — start/continue the guided workflow.
                        await supabaseClient.from('sms_expense_sessions')
                            .upsert({ user_id: user.id, created_at: new Date().toISOString(), awaiting_receipt: false, pending_amount: null, pending_description: null });
                        replyText = prompt;
                    } else if (hasMedia) {
                        // One-shot with a photo — file immediately.
                        try {
                            const path = await uploadReceipt();
                            await fileExpense(amount as number, description, path);
                            replyText = `Got it, ${firstName} — $${(amount as number).toFixed(2)} expense recorded with your receipt. It will be reviewed at the next payroll close.`;
                        } catch (expErr) {
                            console.error('Failed to record SMS expense:', expErr);
                            replyText = "Sorry, we couldn't save your expense. Please try again or submit it in the app.";
                        }
                    } else if (!description) {
                        // Amount only — ask for a note + optional photo.
                        await supabaseClient.from('sms_expense_sessions')
                            .upsert({ user_id: user.id, created_at: new Date().toISOString(), awaiting_receipt: false, pending_amount: null, pending_description: null });
                        replyText = "Got the amount. Please also reply with a short note of what it was for, and a photo of the receipt if you have one.";
                    } else {
                        // Amount + description, no photo — hold it and offer to attach a receipt.
                        await supabaseClient.from('sms_expense_sessions')
                            .upsert({ user_id: user.id, created_at: new Date().toISOString(), awaiting_receipt: true, pending_amount: amount, pending_description: description });
                        replyText = `Almost there — this expense is NOT filed yet. $${(amount as number).toFixed(2)} for ${description}. To finish, reply with a photo of the receipt to attach it, reply NO to file it without a receipt, or reply DISCARD to discard it.${declineNote}`;
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
