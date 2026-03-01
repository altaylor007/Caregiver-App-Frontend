import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format, subDays, startOfWeek, endOfWeek, isAfter, parseISO } from 'date-fns';
import { Calendar, FileText, CheckCircle, Mail } from 'lucide-react';

const AdminPayrollPage = () => {
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState([]);

    // Generator State
    const [weekEnd, setWeekEnd] = useState(new Date()); // Default to today/most recent Friday
    const [previewData, setPreviewData] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('payroll_reports')
            .select('*')
            .order('start_date', { ascending: false });

        if (data) setReports(data);
        setLoading(false);
    };

    useEffect(() => {
        // Find the most recent Friday
        let d = new Date();
        while (d.getDay() !== 5) {
            d = subDays(d, 1);
        }
        setWeekEnd(d);
        fetchHistory();
    }, []);

    const generatePreview = async () => {
        setIsGenerating(true);
        setPreviewData(null);

        try {
            // End date is the selected Friday
            const endDateStr = format(weekEnd, 'yyyy-MM-dd');
            // Start date is the Saturday 6 days prior
            const startDate = subDays(weekEnd, 6);
            const startDateStr = format(startDate, 'yyyy-MM-dd');

            // 1. Get all caregivers with payroll enabled
            const { data: users, error: uError } = await supabase
                .from('users')
                .select('id, full_name')
                .eq('role', 'caregiver')
                .eq('status', 'active')
                .eq('payroll_enabled', true);

            if (uError) throw uError;

            // 2. Fetch all shifts in this date range
            const { data: shifts, error: sError } = await supabase
                .from('shifts')
                .select('*')
                .gte('date', startDateStr)
                .lte('date', endDateStr)
                .not('assigned_to', 'is', null);

            if (sError) throw sError;

            // 3. Tally up hours per user
            const reportRows = users.map(u => {
                const userShifts = shifts.filter(s => s.assigned_to === u.id);

                let totalHours = 0;
                userShifts.forEach(shift => {
                    const start = parseISO(shift.start_time);
                    const end = parseISO(shift.end_time);
                    const diffMs = end - start;
                    const diffHrs = diffMs / (1000 * 60 * 60);
                    // Add shift duration unless it crosses midnight awkwardly, simple calc here
                    totalHours += diffHrs;
                });

                return {
                    caregiver_id: u.id,
                    full_name: u.full_name || 'Unnamed',
                    total_hours: Number(totalHours.toFixed(2))
                };
            }).filter(row => row.total_hours > 0); // Only show people who worked

            setPreviewData({
                start_date: startDateStr,
                end_date: endDateStr,
                rows: reportRows
            });

        } catch (err) {
            alert("Error generating report: " + err.message);
        }

        setIsGenerating(false);
    };

    const handleHourEdit = (userId, newHours) => {
        if (!previewData) return;
        const newRows = previewData.rows.map(row =>
            row.caregiver_id === userId ? { ...row, total_hours: Number(newHours) } : row
        );
        setPreviewData({ ...previewData, rows: newRows });
    };

    const confirmAndSend = async () => {
        if (!previewData || previewData.rows.length === 0) return;
        if (!window.confirm("Are you sure you want to finalize this payroll and send the email? This will lock the hours.")) return;

        setLoading(true);

        try {
            // 1. Save to DB
            const payload = {
                start_date: previewData.start_date,
                end_date: previewData.end_date,
                report_data: previewData.rows,
                status: 'confirmed'
            };

            const { data, error } = await supabase
                .from('payroll_reports')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            // 2. Send Email (Simulated for this MVP)
            let emailBody = `Payroll Report for period: ${previewData.start_date} to ${previewData.end_date}\n\n`;
            previewData.rows.forEach(r => {
                emailBody += `${r.full_name}: ${r.total_hours} hrs\n`;
            });
            emailBody += `\n\nTotal Caregivers: ${previewData.rows.length}`;

            // Create mailto link as a simple substitute for a full backend emailer
            const mailto = `mailto:lenke.taylor@gmail.com?subject=ACT Payroll Report (${previewData.start_date})&body=${encodeURIComponent(emailBody)}`;
            window.location.href = mailto;

            // Cleanup
            setPreviewData(null);
            fetchHistory();
            alert("Report saved successfully! Your email client should now open.");

        } catch (err) {
            alert("Error saving report: " + err.message);
        }

        setLoading(false);
    };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText className="text-primary" /> Payroll Management
                </h2>
                <p className="text-neutral-muted" style={{ marginTop: '0.2rem' }}>Generate Saturday-to-Friday reports for payroll-enabled caregivers.</p>
            </div>

            {/* Generator Card */}
            <div className="card" style={{ borderTop: '4px solid var(--primary-500)', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Generate New Report</h3>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <label className="form-label text-sm">Week Ending (Friday)</label>
                        <input
                            type="date"
                            className="form-input"
                            value={format(weekEnd, 'yyyy-MM-dd')}
                            onChange={e => {
                                const d = parseISO(e.target.value);
                                if (d.getDay() !== 5) {
                                    alert("Please select a Friday.");
                                    return;
                                }
                                setWeekEnd(d);
                            }}
                        />
                    </div>
                    <button
                        onClick={generatePreview}
                        className="btn btn-primary"
                        disabled={isGenerating}
                        style={{ height: '42px' }}
                    >
                        {isGenerating ? 'Calculating...' : 'Generate Preview'}
                    </button>
                </div>

                {previewData && (
                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--neutral-200)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ color: 'var(--neutral-800)' }}>
                                Period: {format(parseISO(previewData.start_date), 'MMM d')} - {format(parseISO(previewData.end_date), 'MMM d, yyyy')}
                            </h4>
                            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--warning-100)', color: 'var(--warning-700)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>Unsaved Draft</span>
                        </div>

                        {previewData.rows.length === 0 ? (
                            <p className="text-neutral-muted text-sm text-center" style={{ padding: '1rem' }}>
                                No shifts found for payroll-enabled caregivers in this period.
                            </p>
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
                                                <tr key={row.caregiver_id} style={{ borderBottom: '1px solid var(--neutral-200)' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{row.full_name}</td>
                                                    <td style={{ padding: '0.5rem 1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <input
                                                                type="number"
                                                                step="0.25"
                                                                min="0"
                                                                className="form-input"
                                                                style={{ width: '80px', padding: '0.4rem' }}
                                                                value={row.total_hours}
                                                                onChange={(e) => handleHourEdit(row.caregiver_id, e.target.value)}
                                                            />
                                                            <span className="text-xs text-neutral-500">hrs</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={confirmAndSend}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--success-600)' }}
                                        disabled={loading}
                                    >
                                        <Mail size={16} /> Confirm & Email lenke.taylor@gmail.com
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* History List */}
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
                        {reports.map((report) => (
                            <div key={report.id} className="card" style={{ padding: '1rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>
                                        {format(parseISO(report.start_date), 'MMM d')} - {format(parseISO(report.end_date), 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-sm text-neutral-muted" style={{ marginTop: '0.2rem' }}>
                                        Generated on {format(parseISO(report.generated_at), 'MMM d, h:mm a')} • {report.report_data?.length || 0} Caregivers
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--success-50)', color: 'var(--success-700)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <CheckCircle size={12} /> Confirmed
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPayrollPage;
