import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { differenceInMinutes, parseISO, startOfWeek, endOfWeek, format } from 'date-fns';

const AdminReportsPage = () => {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);

    // We'll just default to viewing the current week
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 })); // Monday

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            const startStr = format(weekStart, 'yyyy-MM-dd');
            const endStr = format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');

            // Fetch all shifts in this week that are assigned
            const { data: shifts } = await supabase
                .from('shifts')
                .select('*, users(id, full_name, email)')
                .gte('date', startStr)
                .lte('date', endStr)
                .not('assigned_to', 'is', null);

            if (shifts) {
                // Aggregate hours by user
                const aggregation = {};

                shifts.forEach(shift => {
                    const caregiver = shift.users;
                    if (!caregiver) return;

                    if (!aggregation[caregiver.id]) {
                        aggregation[caregiver.id] = {
                            user: caregiver,
                            totalMinutes: 0,
                            shiftCount: 0
                        };
                    }

                    const start = parseISO(shift.start_time);
                    const end = parseISO(shift.end_time);
                    const mins = differenceInMinutes(end, start);

                    aggregation[caregiver.id].totalMinutes += mins;
                    aggregation[caregiver.id].shiftCount += 1;
                });

                // Convert to array and calculate hours
                const finalReport = Object.values(aggregation).map(item => ({
                    ...item,
                    totalHours: (item.totalMinutes / 60).toFixed(2)
                })).sort((a, b) => b.totalMinutes - a.totalMinutes);

                setReportData(finalReport);
            }
            setLoading(false);
        };

        fetchReport();
    }, [weekStart]);

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Hours Report</h2>

            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 className="text-sm text-neutral-muted">Current Week</h3>
                    <p style={{ fontWeight: 600 }}>
                        {format(weekStart, 'MMM d')} - {format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                    </p>
                </div>
            </div>

            {loading ? (
                <p>Calculating hours...</p>
            ) : reportData.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No assigned shifts found for this week.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {reportData.map(row => (
                        <div key={row.user.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontWeight: 600 }}>{row.user.full_name || 'Unnamed Caregiver'}</p>
                                <p className="text-sm text-neutral-muted">{row.shiftCount} shifts</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-600)' }}>{row.totalHours} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-500)' }}>hrs</span></p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminReportsPage;
