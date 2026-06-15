import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, subDays, addDays, parseISO, startOfDay } from 'date-fns';
import { Calendar, FileText, CheckCircle, Mail, ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { getHolidaysForYear } from '../lib/timeUtils';

// ─────────────────────────────────────────────
// Helper: Get the Saturday that starts the week containing `date`
// Week: Saturday → Friday
// ─────────────────────────────────────────────
const getWeekStart = (date) => {
    const d = startOfDay(new Date(date));
    // getDay(): 0=Sun,1=Mon,...,6=Sat
    // Days since last Saturday
    const dayOfWeek = d.getDay(); // 0-6
    const daysSinceSat = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
    return subDays(d, daysSinceSat);
};

const getWeekEnd = (weekStart) => addDays(weekStart, 6); // Friday

// ─────────────────────────────────────────────
// HOURS VIEW
// ─────────────────────────────────────────────
const HoursView = () => {
    const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const weekEnd = getWeekEnd(weekStart);
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');

    const fetchHours = useCallback(async () => {
        setLoading(true);

        // Fetch all active caregivers
        const { data: users } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('is_caregiver', true)
            .eq('status', 'active');

        // Fetch all shifts in this week range
        const { data: shifts } = await supabase
            .from('shifts')
            .select('*')
            .gte('date', startStr)
            .lte('date', endStr)
            .not('assigned_to', 'is', null);

        const startYear = new Date(startStr).getFullYear();
        const endYear = new Date(endStr).getFullYear();
        const holidaySet = new Set([
            ...getHolidaysForYear(startYear),
            ...(endYear !== startYear ? getHolidaysForYear(endYear) : [])
        ]);

        const result = (users || []).map(u => {
            const userShifts = (shifts || []).filter(s => s.assigned_to === u.id);
            let regularHours = 0;
            let holidayHours = 0;
            userShifts.forEach(shift => {
                try {
                    const start = parseISO(shift.start_time);
                    const end = parseISO(shift.end_time);
                    let duration = (end - start) / (1000 * 60 * 60);
                    if (duration < 0) duration += 24;
                    if (holidaySet.has(shift.date)) {
                        holidayHours += duration;
                    } else {
                        regularHours += duration;
                    }
                } catch (_) { }
            });
            return {
                id: u.id,
                full_name: u.full_name || 'Unnamed',
                shifts: userShifts.length,
                hours: Number((regularHours + holidayHours).toFixed(2)),
                regular_hours: Number(regularHours.toFixed(2)),
                holiday_hours: Number(holidayHours.toFixed(2))
            };
        }).sort((a, b) => b.hours - a.hours);

        setRows(result);
        setLoading(false);
    }, [startStr, endStr]);

    useEffect(() => {
        fetchHours();
    }, [fetchHours]);

    const prevWeek = () => setWeekStart(prev => subDays(prev, 7));
    const nextWeek = () => setWeekStart(prev => addDays(prev, 7));
    const isCurrentWeek = format(getWeekStart(new Date()), 'yyyy-MM-dd') === startStr;

    const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
    const activeRows = rows.filter(r => r.hours > 0);

    return (
        <div>
            {/* Week Navigator */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', marginBottom: '1.5rem', borderTop: '4px solid var(--primary-500)' }}>
                <button onClick={prevWeek} className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ChevronLeft size={18} /> Prev
                </button>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs text-neutral-muted" style={{ marginTop: '0.15rem' }}>
                        {isCurrentWeek ? '✦ Current Week' : 'Sat → Fri'}
                    </div>
                </div>
                <button onClick={nextWeek} className="btn btn-outline" style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} disabled={isCurrentWeek}>
                    Next <ChevronRight size={18} />
                </button>
            </div>

            {/* Summary Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1rem', margin: 0 }}>
                    <Clock size={24} className="text-primary" style={{ marginBottom: '0.25rem' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalHours.toFixed(1)}</div>
                    <div className="text-xs text-neutral-muted">Total Hours</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem', margin: 0 }}>
                    <Users size={24} className="text-secondary" style={{ marginBottom: '0.25rem' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activeRows.length}</div>
                    <div className="text-xs text-neutral-muted">Caregivers Worked</div>
                </div>
            </div>

            {/* Hours Table */}
            {loading ? (
                <p className="text-neutral-muted text-sm">Loading hours...</p>
            ) : rows.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No caregivers found.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--neutral-100)', textAlign: 'left', borderBottom: '1px solid var(--neutral-200)' }}>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)' }}>Caregiver</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)', textAlign: 'center' }}>Shifts</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)', textAlign: 'right' }}>Hours</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--neutral-100)', opacity: row.hours === 0 ? 0.45 : 1 }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{row.full_name}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--neutral-600)' }}>{row.shifts}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <span style={{
                                            fontWeight: 700,
                                            color: row.hours > 0 ? 'var(--primary-700)' : 'var(--neutral-400)'
                                        }}>
                                            {row.hours > 0 ? `${row.hours} hrs` : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ backgroundColor: 'var(--neutral-50)', borderTop: '2px solid var(--neutral-200)' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Total</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>{rows.reduce((s, r) => s + r.shifts, 0)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-700)' }}>{totalHours.toFixed(2)} hrs</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// PAYROLL REPORT VIEW (existing logic preserved)
// ─────────────────────────────────────────────
const PayrollReportView = () => {
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState([]);
    const [weekEnd, setWeekEnd] = useState(new Date());
    const [previewData, setPreviewData] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('payroll_reports')
            .select('*')
            .order('start_date', { ascending: false });
        if (data) setReports(data);
        setLoading(false);
    };

    useEffect(() => {
        // Default to most recent Friday
        let d = new Date();
        while (d.getDay() !== 5) d = subDays(d, 1);
        setWeekEnd(d);
        fetchHistory();
    }, []);

    const generatePreview = async () => {
        setIsGenerating(true);
        setPreviewData(null);
        try {
            const endDateStr = format(weekEnd, 'yyyy-MM-dd');
            const startDate = subDays(weekEnd, 6);
            const startDateStr = format(startDate, 'yyyy-MM-dd');

            const { data: users, error: uError } = await supabase
                .from('users').select('id, full_name, payroll_enabled')
                .eq('is_caregiver', true).eq('status', 'active');
            if (uError) throw uError;

            const { data: shifts, error: sError } = await supabase
                .from('shifts').select('*')
                .gte('date', startDateStr).lte('date', endDateStr)
                .not('assigned_to', 'is', null);
            if (sError) throw sError;

            const startYear = new Date(startDate).getFullYear();
            const endYear = new Date(weekEnd).getFullYear();
            const holidaySet = new Set([
                ...getHolidaysForYear(startYear),
                ...(endYear !== startYear ? getHolidaysForYear(endYear) : [])
            ]);

            // Fetch submitted expenses whose submission date falls within the payroll week.
            // submitted_at is timestamptz; bound to [start 00:00, end+1 00:00) (UTC).
            const { data: expenses, error: eError } = await supabase
                .from('expenses')
                .select('id, user_id, amount, description, receipt_url, no_receipt_reason, user:users!expenses_user_id_fkey(full_name, payroll_enabled)')
                .eq('status', 'submitted')
                .gte('submitted_at', startDateStr)
                .lt('submitted_at', format(addDays(weekEnd, 1), 'yyyy-MM-dd'));
            if (eError) throw eError;

            const expensesByUser = {};
            (expenses || []).forEach(x => {
                (expensesByUser[x.user_id] = expensesByUser[x.user_id] || []).push(x);
            });

            const buildItems = (items) => items.map(x => ({
                id: x.id,
                amount: Number(x.amount),
                description: x.description,
                receipt_url: x.receipt_url,
                no_receipt_reason: x.no_receipt_reason,
                declined: false,
                rejection_reason: ''
            }));
            const sumItems = (items) =>
                Number(items.reduce((s, x) => s + Number(x.amount), 0).toFixed(2));

            const reportRows = (users || []).map(u => {
                const userShifts = (shifts || []).filter(s => s.assigned_to === u.id);
                let regularHours = 0;
                let holidayHours = 0;
                userShifts.forEach(shift => {
                    try {
                        let duration = (parseISO(shift.end_time) - parseISO(shift.start_time)) / (1000 * 60 * 60);
                        if (duration < 0) duration += 24;
                        if (holidaySet.has(shift.date)) {
                            holidayHours += duration;
                        } else {
                            regularHours += duration;
                        }
                    } catch (_) { }
                });
                const userExpenses = expensesByUser[u.id] || [];
                return {
                    caregiver_id: u.id,
                    full_name: u.full_name || 'Unnamed',
                    regular_hours: Number(regularHours.toFixed(2)),
                    holiday_hours: Number(holidayHours.toFixed(2)),
                    total_hours: Number((regularHours + holidayHours).toFixed(2)),
                    payroll_enabled: u.payroll_enabled,
                    expenses: buildItems(userExpenses),
                    expense_total: sumItems(userExpenses)
                };
            }).filter(r => r.total_hours > 0 || r.expense_total > 0);

            // Include caregivers who submitted expenses this week but are not in the
            // active-caregiver list (e.g. now inactive), so their reimbursement isn't dropped.
            const includedIds = new Set(reportRows.map(r => r.caregiver_id));
            Object.keys(expensesByUser).forEach(uid => {
                if (includedIds.has(uid)) return;
                const userExpenses = expensesByUser[uid];
                reportRows.push({
                    caregiver_id: uid,
                    full_name: userExpenses[0]?.user?.full_name || 'Unnamed',
                    regular_hours: 0,
                    holiday_hours: 0,
                    total_hours: 0,
                    payroll_enabled: userExpenses[0]?.user?.payroll_enabled ?? false,
                    expenses: buildItems(userExpenses),
                    expense_total: sumItems(userExpenses)
                });
            });

            setPreviewData({ start_date: startDateStr, end_date: endDateStr, rows: reportRows });
        } catch (err) {
            alert('Error generating report: ' + err.message);
        }
        setIsGenerating(false);
    };

    const handleHourEdit = (userId, newHours) => {
        if (!previewData) return;
        setPreviewData({ ...previewData, rows: previewData.rows.map(r => r.caregiver_id === userId ? { ...r, total_hours: Number(newHours) } : r) });
    };

    const toggleDeclineExpense = (caregiverId, expenseId) => {
        setPreviewData(prev => ({
            ...prev,
            rows: prev.rows.map(r => r.caregiver_id !== caregiverId ? r : {
                ...r,
                expenses: r.expenses.map(x => x.id !== expenseId ? x : { ...x, declined: !x.declined })
            })
        }));
    };

    const setExpenseReason = (caregiverId, expenseId, reason) => {
        setPreviewData(prev => ({
            ...prev,
            rows: prev.rows.map(r => r.caregiver_id !== caregiverId ? r : {
                ...r,
                expenses: r.expenses.map(x => x.id !== expenseId ? x : { ...x, rejection_reason: reason })
            })
        }));
    };

    const viewReceipt = async (path) => {
        const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60);
        if (error) { alert(error.message); return; }
        window.open(data.signedUrl, '_blank');
    };

    const handleReinstate = async (report) => {
        if (!window.confirm('Reinstate this report as a draft? It will be removed from the confirmed list and loaded for editing.')) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('payroll_reports').delete().eq('id', report.id);
            if (error) throw error;
            // Load the old data back into the preview form
            setPreviewData({
                start_date: report.start_date,
                end_date: report.end_date,
                rows: report.report_data || []
            });
            fetchHistory();
        } catch (err) {
            alert('Error reinstating report: ' + err.message);
        }
        setLoading(false);
    };

    const confirmAndSend = async () => {
        if (!previewData || previewData.rows.length === 0) return;

        // Prevent duplicate: block if a confirmed report for this week-ending already exists
        const duplicate = reports.find(r => r.end_date === previewData.end_date);
        if (duplicate) {
            alert(`A confirmed payroll report for week ending ${previewData.end_date} already exists.\n\nTo submit a new one, an admin must first "Reinstate" the existing report from the history list below.`);
            return;
        }

        if (!window.confirm(`Are you sure you want to finalize this payroll? This will lock the hours and send a text report to Lenke Taylor.`)) return;
        setLoading(true);
        try {
            // Build a clean report snapshot: each row keeps only its INCLUDED (non-declined)
            // expense items, and expense_total reflects only those.
            const cleanRows = previewData.rows.map(r => {
                const included = (r.expenses || []).filter(x => !x.declined);
                return {
                    caregiver_id: r.caregiver_id,
                    full_name: r.full_name,
                    regular_hours: r.regular_hours,
                    holiday_hours: r.holiday_hours,
                    total_hours: r.total_hours,
                    payroll_enabled: r.payroll_enabled,
                    expense_total: Number(included.reduce((s, x) => s + Number(x.amount), 0).toFixed(2)),
                    expenses: included.map(x => ({ id: x.id, amount: Number(x.amount), description: x.description, receipt_url: x.receipt_url, no_receipt_reason: x.no_receipt_reason }))
                };
            });

            const reimbursedIds = [];
            const declined = [];
            previewData.rows.forEach(r => (r.expenses || []).forEach(x => {
                if (x.declined) declined.push({ id: x.id, reason: x.rejection_reason || '' });
                else reimbursedIds.push(x.id);
            }));

            // Atomic close: report insert + expense settlement run in one DB transaction.
            const { error } = await supabase.rpc('close_payroll_report', {
                p_start_date: previewData.start_date,
                p_end_date: previewData.end_date,
                p_report_data: cleanRows,
                p_reimbursed_ids: reimbursedIds,
                p_declined: declined
            });
            if (error) throw error;

            const enabledRows = previewData.rows.filter(r => r.payroll_enabled);
            const disabledRows = previewData.rows.filter(r => !r.payroll_enabled);

            const weDate = format(parseISO(previewData.end_date), 'MM-dd');
            let smsBodyEnabled = '';
            let smsBodyDisabled = '';
            
            if (enabledRows.length > 0) {
                const lines = enabledRows.map(r => {
                    const firstName = r.full_name.split(' ')[0];
                    const reimb = (r.expenses || []).filter(x => !x.declined).reduce((s, x) => s + Number(x.amount), 0);
                    const expLine = reimb > 0 ? `\n+ $${reimb.toFixed(2)} expenses` : '';
                    if (r.holiday_hours === 0) {
                        return `${firstName}\n${r.total_hours} Hours${expLine}`;
                    }
                    return `${firstName}\n${r.holiday_hours} holiday hrs | ${r.regular_hours} regular hrs | ${r.total_hours} total hrs${expLine}`;
                }).join('\n\n');
                smsBodyEnabled = `WE ${weDate}\n\n${lines}`;
            }

            if (disabledRows.length > 0) {
                const lines = disabledRows.map(r => {
                    const firstName = r.full_name.split(' ')[0];
                    const amount = ((r.regular_hours * 30) + (r.holiday_hours * 45)).toFixed(0);
                    const reimb = (r.expenses || []).filter(x => !x.declined).reduce((s, x) => s + Number(x.amount), 0);
                    const expLine = reimb > 0 ? `\n+ $${reimb.toFixed(2)} expenses` : '';
                    return `${firstName}\n${r.total_hours} hours\n$${amount}${expLine}`;
                }).join('\n\n');
                smsBodyDisabled = `WE ${weDate}\n\n${lines}`;
            }

            // Fetch Lenke Taylor's user record
            const { data: lenkeUser, error: lenkeError } = await supabase
                .from('users')
                .select('id, phone')
                .ilike('full_name', '%Lenke Taylor%')
                .single();

            // Fetch Jed's user record
            const { data: jedUser, error: jedError } = await supabase
                .from('users')
                .select('id, phone')
                .ilike('full_name', '%Jed%')
                .limit(1)
                .single();

            const formatPhone = (phone) => {
                if (!phone) return null;
                let f = phone.replace(/\D/g, '');
                if (f.length === 10) return `+1${f}`;
                if (f.length === 11 && f.startsWith('1')) return `+${f}`;
                return null;
            };

            const lenkePhone = lenkeUser ? formatPhone(lenkeUser.phone) : null;
            const jedPhone = jedUser ? formatPhone(jedUser.phone) : null;

            if (!lenkePhone) {
                alert("Could not retrieve Lenke Taylor's phone number.");
            }
            if (disabledRows.length > 0 && !jedPhone) {
                alert("Could not retrieve Jed's phone number to send the independent caregivers report.");
            }

            const sendSms = async (to, body) => {
                if (!to) return;
                const { data: smsData, error: smsError } = await supabase.functions.invoke('send-sms', {
                    body: { to, messageBody: body }
                });
                if (smsError || smsData?.error) {
                    alert(`Failed to send SMS to ${to}: ` + (smsError?.message || smsData?.error));
                }
            };

            if (smsBodyEnabled && lenkePhone) {
                await sendSms(lenkePhone, smsBodyEnabled);
            }

            if (smsBodyDisabled) {
                if (lenkePhone) await sendSms(lenkePhone, smsBodyDisabled);
                if (jedPhone) await sendSms(jedPhone, smsBodyDisabled);
            }

            // Notify each caregiver whose expense(s) were declined this period.
            // send-sms resolves the phone by userId and respects the caregiver's sms_enabled setting.
            for (const r of previewData.rows) {
                const declinedForUser = (r.expenses || []).filter(x => x.declined);
                if (declinedForUser.length === 0) continue;
                const itemLines = declinedForUser.map(x => {
                    const reason = (x.rejection_reason || '').trim();
                    return `- $${Number(x.amount).toFixed(2)} ${x.description}${reason ? ` (${reason})` : ''}`;
                }).join('\n');
                const declineBody = `Hi ${r.full_name.split(' ')[0]}, an expense you submitted was not approved this pay period:\n${itemLines}\n\nContact your manager with any questions.`;
                try {
                    await supabase.functions.invoke('send-sms', { body: { userId: r.caregiver_id, messageBody: declineBody } });
                } catch (smsErr) {
                    console.warn(`Failed to send decline SMS to ${r.full_name}:`, smsErr);
                }
            }

            alert('Payroll report has been finalized and text messages have been sent.');

            setPreviewData(null);
            fetchHistory();
        } catch (err) {
            alert('Error saving report: ' + err.message);
        }
        setLoading(false);
    };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="card" style={{ borderTop: '4px solid var(--primary-500)', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Generate New Report</h3>
                <p className="text-sm text-neutral-muted" style={{ marginBottom: '1rem' }}>Includes all active caregivers with hours. Messages sent will depend on their payroll-enabled status.</p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label text-sm">Week Ending (Friday)</label>
                        <input type="date" className="form-input"
                            value={format(weekEnd, 'yyyy-MM-dd')}
                            onChange={e => {
                                const d = parseISO(e.target.value);
                                if (d.getDay() !== 5) { alert('Please select a Friday.'); return; }
                                setWeekEnd(d);
                            }}
                        />
                    </div>
                    <button onClick={generatePreview} className="btn btn-primary" disabled={isGenerating} style={{ height: '42px' }}>
                        {isGenerating ? 'Calculating...' : 'Generate Preview'}
                    </button>
                </div>

                {previewData && (
                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--neutral-200)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ color: 'var(--neutral-800)' }}>
                                Period: {format(parseISO(previewData.start_date), 'MMM d')} – {format(parseISO(previewData.end_date), 'MMM d, yyyy')}
                            </h4>
                            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--warning-100)', color: 'var(--warning-700)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>Unsaved Draft</span>
                        </div>

                        {previewData.rows.length === 0 ? (
                            <p className="text-neutral-muted text-sm text-center" style={{ padding: '1rem' }}>No shifts found for caregivers in this period.</p>
                        ) : (
                            <>
                                <div style={{ backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--neutral-200)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--neutral-100)', textAlign: 'left', borderBottom: '1px solid var(--neutral-200)' }}>
                                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)' }}>Caregiver</th>
                                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)', width: '140px' }}>Total Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.rows.map(row => (
                                                <React.Fragment key={row.caregiver_id}>
                                                <tr style={{ borderBottom: (row.expenses && row.expenses.length) ? 'none' : '1px solid var(--neutral-200)' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{row.full_name}</td>
                                                    <td style={{ padding: '0.5rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <input type="number" step="0.25" min="0" className="form-input"
                                                                style={{ width: '80px', padding: '0.4rem' }}
                                                                value={row.total_hours}
                                                                onChange={e => handleHourEdit(row.caregiver_id, e.target.value)}
                                                            />
                                                            <span className="text-xs text-neutral-500">hrs</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {row.expenses && row.expenses.length > 0 && (
                                                <tr style={{ borderBottom: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
                                                    <td colSpan={2} style={{ padding: '0.5rem 1rem 0.75rem' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', marginBottom: '0.5rem' }}>Expense reimbursements</div>
                                                        {row.expenses.map(item => (
                                                            <div key={item.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', opacity: item.declined ? 0.6 : 1 }}>
                                                                <span style={{ fontWeight: 600, minWidth: '70px' }}>${item.amount.toFixed(2)}</span>
                                                                <span style={{ flex: 1, minWidth: '120px' }}>{item.description}</span>
                                                                {item.receipt_url ? (
                                                                    <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => viewReceipt(item.receipt_url)}>Receipt</button>
                                                                ) : (
                                                                    <span className="text-sm text-danger" style={{ flexBasis: '100%' }}>No receipt — {item.no_receipt_reason || 'no explanation given'}</span>
                                                                )}
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                                                                    <input type="checkbox" checked={item.declined} onChange={() => toggleDeclineExpense(row.caregiver_id, item.id)} /> Decline
                                                                </label>
                                                                {item.declined && (
                                                                    <input type="text" className="form-input" placeholder="Reason (optional — sent to caregiver)" style={{ flexBasis: '100%', padding: '0.4rem', fontSize: '0.8rem' }} value={item.rejection_reason} onChange={e => setExpenseReason(row.caregiver_id, item.id, e.target.value)} />
                                                                )}
                                                            </div>
                                                        ))}
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem' }}>
                                                            Reimbursement total: ${row.expenses.filter(i => !i.declined).reduce((s, i) => s + i.amount, 0).toFixed(2)}
                                                        </div>
                                                    </td>
                                                </tr>
                                                )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Live SMS Preview */}
                                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--neutral-100)', borderRadius: 'var(--radius-md)' }}>
                                    <h5 style={{ marginBottom: '1rem', color: 'var(--neutral-700)', fontSize: '0.9rem' }}>Live Message Preview</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', marginBottom: '0.5rem' }}>
                                                TO LENKE (Payroll Enabled)
                                            </div>
                                            <pre style={{ fontSize: '0.8rem', backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-200)', whiteSpace: 'pre-wrap', minHeight: '100px', margin: 0 }}>
                                                {(() => {
                                                     const enabledRows = previewData.rows.filter(r => r.payroll_enabled);
                                                     if (enabledRows.length === 0) return 'No caregivers in this group.';
                                                     const weDate = format(parseISO(previewData.end_date), 'MM-dd');
                                                     const lines = enabledRows.map(r => {
                                                         const firstName = r.full_name.split(' ')[0];
                                                         const reimb = (r.expenses || []).filter(x => !x.declined).reduce((s, x) => s + Number(x.amount), 0);
                                                         const expLine = reimb > 0 ? `\n+ $${reimb.toFixed(2)} expenses` : '';
                                                         if (r.holiday_hours === 0) {
                                                             return `${firstName}\n${r.total_hours} Hours${expLine}`;
                                                         }
                                                         return `${firstName}\n${r.holiday_hours} holiday hrs | ${r.regular_hours} regular hrs | ${r.total_hours} total hrs${expLine}`;
                                                     }).join('\n\n');
                                                     return `WE ${weDate}\n\n${lines}`;
                                                 })()}
                                            </pre>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', marginBottom: '0.5rem' }}>
                                                TO LENKE & JED (Independent)
                                            </div>
                                            <pre style={{ fontSize: '0.8rem', backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-200)', whiteSpace: 'pre-wrap', minHeight: '100px', margin: 0 }}>
                                                {(() => {
                                                     const disabledRows = previewData.rows.filter(r => !r.payroll_enabled);
                                                     if (disabledRows.length === 0) return 'No caregivers in this group.';
                                                     const weDate = format(parseISO(previewData.end_date), 'MM-dd');
                                                     const lines = disabledRows.map(r => {
                                                         const reimb = (r.expenses || []).filter(x => !x.declined).reduce((s, x) => s + Number(x.amount), 0);
                                                         const expLine = reimb > 0 ? `\n+ $${reimb.toFixed(2)} expenses` : '';
                                                         return `${r.full_name.split(' ')[0]}\n${r.total_hours} hours\n$${((r.regular_hours * 30) + (r.holiday_hours * 45)).toFixed(0)}${expLine}`;
                                                     }).join('\n\n');
                                                     return `WE ${weDate}\n\n${lines}`;
                                                 })()}
                                            </pre>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={confirmAndSend} className="btn btn-primary"
                                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--success-600)' }}
                                        disabled={loading}>
                                        <CheckCircle size={16} /> Confirm & Send to Lenke & Jed
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
            {/* History */}
            <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Previous Reports</h3>
                {loading && !previewData ? (
                    <p className="text-sm text-neutral-muted">Loading history...</p>
                ) : reports.length === 0 ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <p className="text-neutral-muted">No finalized payroll reports yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reports.map(report => (
                            <div key={report.id} className="card" style={{ padding: '1rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>
                                        {format(parseISO(report.start_date), 'MMM d')} – {format(parseISO(report.end_date), 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-sm text-neutral-muted" style={{ marginTop: '0.2rem' }}>
                                        Generated on {format(parseISO(report.generated_at), 'MMM d, h:mm a')} • {report.report_data?.length || 0} Caregivers
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--success-50)', color: 'var(--success-700)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <CheckCircle size={12} /> Confirmed
                                    </span>
                                    <button
                                        onClick={() => handleReinstate(report)}
                                        disabled={loading}
                                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--warning-300)', backgroundColor: 'var(--warning-50)', color: 'var(--warning-700)', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Reinstate
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// MAIN PAGE — two tabs
// ─────────────────────────────────────────────
const AdminPayrollPage = () => {
    const [activeTab, setActiveTab] = useState('hours');

    const tabStyle = (tab) => ({
        padding: '0.6rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.875rem',
        backgroundColor: activeTab === tab ? 'var(--primary-600)' : 'transparent',
        color: activeTab === tab ? 'white' : 'var(--neutral-600)',
        transition: 'all 0.15s'
    });

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Page Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText className="text-primary" /> Hours Reporting
                </h2>
                <p className="text-neutral-muted" style={{ marginTop: '0.2rem' }}>Track caregiver hours week by week.</p>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--neutral-100)', padding: '0.25rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', width: 'fit-content' }}>
                <button style={tabStyle('hours')} onClick={() => setActiveTab('hours')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={15} /> Hours View</span>
                </button>
                <button style={tabStyle('payroll')} onClick={() => setActiveTab('payroll')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Mail size={15} /> Payroll Report</span>
                </button>
            </div>

            {activeTab === 'hours' ? <HoursView /> : <PayrollReportView />}
        </div>
    );
};

export default AdminPayrollPage;
