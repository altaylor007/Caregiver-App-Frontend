import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { format, subDays, addDays, parseISO, startOfDay } from 'date-fns';
import { Calendar, FileText, CheckCircle, Mail, ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';

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
            .eq('role', 'caregiver')
            .eq('status', 'active');

        // Fetch all shifts in this week range
        const { data: shifts } = await supabase
            .from('shifts')
            .select('*')
            .gte('date', startStr)
            .lte('date', endStr)
            .not('assigned_to', 'is', null);

        const result = (users || []).map(u => {
            const userShifts = (shifts || []).filter(s => s.assigned_to === u.id);
            let totalHours = 0;
            userShifts.forEach(shift => {
                try {
                    const start = parseISO(shift.start_time);
                    const end = parseISO(shift.end_time);
                    totalHours += (end - start) / (1000 * 60 * 60);
                } catch (_) { }
            });
            return {
                id: u.id,
                full_name: u.full_name || 'Unnamed',
                shifts: userShifts.length,
                hours: Number(totalHours.toFixed(2))
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
                .from('users').select('id, full_name')
                .eq('role', 'caregiver').eq('status', 'active').eq('payroll_enabled', true);
            if (uError) throw uError;

            const { data: shifts, error: sError } = await supabase
                .from('shifts').select('*')
                .gte('date', startDateStr).lte('date', endDateStr)
                .not('assigned_to', 'is', null);
            if (sError) throw sError;

            const reportRows = (users || []).map(u => {
                const userShifts = (shifts || []).filter(s => s.assigned_to === u.id);
                let totalHours = 0;
                userShifts.forEach(shift => {
                    try { totalHours += (parseISO(shift.end_time) - parseISO(shift.start_time)) / (1000 * 60 * 60); } catch (_) { }
                });
                return { caregiver_id: u.id, full_name: u.full_name || 'Unnamed', total_hours: Number(totalHours.toFixed(2)) };
            }).filter(r => r.total_hours > 0);

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
        if (!window.confirm('Are you sure you want to finalize this payroll and send via SMS? This will lock the hours.')) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('payroll_reports').insert([{
                start_date: previewData.start_date, end_date: previewData.end_date,
                report_data: previewData.rows, status: 'confirmed'
            }]);
            if (error) throw error;

            const smsLines = previewData.rows.map(r => {
                const firstName = r.full_name.split(' ')[0];
                return `${firstName}\nHours ${r.total_hours}`;
            }).join('\n\n');
            const weDate = format(parseISO(previewData.end_date), 'MM-dd');
            const smsBody = `WE ${weDate}\n\n${smsLines}`;
            window.location.href = `sms:+14125123099?body=${encodeURIComponent(smsBody)}`;

            setPreviewData(null);
            fetchHistory();
            alert('Report saved successfully! Your SMS app should now open.');
        } catch (err) {
            alert('Error saving report: ' + err.message);
        }
        setLoading(false);
    };

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div className="card" style={{ borderTop: '4px solid var(--primary-500)', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Generate New Report</h3>
                <p className="text-sm text-neutral-muted" style={{ marginBottom: '1rem' }}>Only caregivers with payroll reporting enabled are included.</p>
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
                            <p className="text-neutral-muted text-sm text-center" style={{ padding: '1rem' }}>No shifts found for payroll-enabled caregivers in this period.</p>
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
                                                            <input type="number" step="0.25" min="0" className="form-input"
                                                                style={{ width: '80px', padding: '0.4rem' }}
                                                                value={row.total_hours}
                                                                onChange={e => handleHourEdit(row.caregiver_id, e.target.value)}
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
                                    <button onClick={confirmAndSend} className="btn btn-primary"
                                        style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--success-600)' }}
                                        disabled={loading}>
                                        <CheckCircle size={16} /> Confirm & Send SMS
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
