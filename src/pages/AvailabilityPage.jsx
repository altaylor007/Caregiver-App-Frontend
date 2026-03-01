import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AvailabilityPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState(''); // inline saving indicator

    // Context for the grid
    const [currentDate, setCurrentDate] = useState(new Date());

    // Admin Requests
    const [activeRequests, setActiveRequests] = useState([]);

    // The user's selections: { '2023-10-01': 'available', '2023-10-02': 'unavailable' }
    const [availabilityMap, setAvailabilityMap] = useState({});

    const fetchData = async () => {
        setLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateStr = format(monthStart, 'yyyy-MM-dd');
        const endDateStr = format(monthEnd, 'yyyy-MM-dd');

        try {
            // 1. Fetch Admin Requests targeting this period (or just generic active ones)
            const { data: reqData, error: reqError } = await supabase
                .from('availability_requests')
                .select('*')
                .gte('end_date', format(new Date(), 'yyyy-MM-dd')) // Only show requests that haven't expired
                .order('created_at', { ascending: false });

            if (reqError) throw reqError;
            if (reqData) setActiveRequests(reqData);

            // 2. Fetch User's existing responses
            const { data: respData, error: respError } = await supabase
                .from('availability_responses')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startDateStr)
                .lte('date', endDateStr);

            if (respError) throw respError;

            if (respData) {
                const map = {};
                respData.forEach(r => {
                    map[r.date] = r.status;
                });
                setAvailabilityMap(map); // Replace map for the new month view
            }
        } catch (err) {
            console.error(err);
        }

        setLoading(false);
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user, currentDate]);

    // The active tool selected by the user to "paint" onto the calendar
    const [selectedTool, setSelectedTool] = useState('available');

    const handleApplyTool = async (dateStr) => {
        let isClear = false;
        let appliedTool = selectedTool;

        // Optimistic UI update
        setAvailabilityMap(prev => {
            const newMap = { ...prev };
            if (newMap[dateStr] === selectedTool || selectedTool === 'clear') {
                delete newMap[dateStr];
                isClear = true;
            } else {
                newMap[dateStr] = selectedTool;
            }
            return newMap;
        });

        // Fire & Forget DB operation
        setSaveStatus('Saving...');
        try {
            if (isClear) {
                await supabase
                    .from('availability_responses')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('date', dateStr);
            } else {
                await supabase
                    .from('availability_responses')
                    .upsert({
                        user_id: user.id,
                        date: dateStr,
                        status: appliedTool,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id,date' });
            }
            setSaveStatus('Saved');
            setTimeout(() => setSaveStatus(''), 2000);
        } catch (error) {
            console.error("DB Auto-Save Error:", error);
            setSaveStatus('Error');
        }
    };

    const nextMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    const prevMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };

    // Calendar Grid Setup
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // 0 is Sunday, map to Monday-start by shifting standard JS days (Optional, UI choice)
    const firstDayIndex = monthStart.getDay();

    return (
        <div style={{ paddingBottom: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}>
                    <ChevronLeft size={24} />
                </button>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarIcon className="text-primary" /> My Availability
                </h2>
            </div>

            {/* Admin Requests Banner */}
            {activeRequests.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ padding: '1rem', backgroundColor: 'var(--primary-50)', borderLeft: '4px solid var(--primary-500)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--primary-800)' }}>
                            <Info size={18} /> Schedule Requests from Admin
                        </h4>
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {activeRequests.map(req => (
                                <div key={req.id} style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                                    <strong>Period:</strong> {format(parseISO(req.start_date), 'MMM d')} to {format(parseISO(req.end_date), 'MMM d')}
                                    {req.message && <p style={{ margin: '0.2rem 0 0 0', color: 'var(--neutral-600)' }}>"{req.message}"</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--neutral-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={prevMonth} className="btn btn-outline" style={{ padding: '0.4rem' }}><ChevronLeft size={20} /></button>
                        <h3 style={{ margin: 0, minWidth: '150px', textAlign: 'center' }}>{format(currentDate, 'MMMM yyyy')}</h3>
                        <button onClick={nextMonth} className="btn btn-outline" style={{ padding: '0.4rem' }}><ChevronRight size={20} /></button>
                    </div>
                    {saveStatus && (
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: saveStatus === 'Error' ? 'var(--danger-600)' : 'var(--neutral-500)', transition: 'opacity 0.2s' }}>
                            {saveStatus}
                        </span>
                    )}
                </div>

                <div style={{ padding: '1.5rem', backgroundColor: 'var(--primary-50)', borderBottom: '1px solid var(--neutral-100)' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <p className="text-sm text-neutral-800" style={{ margin: 0, fontWeight: 500 }}>
                            1. Select a status below <br />
                            2. Tap days on the calendar to apply it
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {[
                            { id: 'available', label: 'All Day', color: 'success' },
                            { id: 'available_morning', label: 'Morning', color: 'success' },
                            { id: 'available_evening', label: 'Evening', color: 'success' },
                            { id: 'unavailable', label: 'Unavailable', color: 'danger' },
                            { id: 'clear', label: 'Clear', color: 'neutral' }
                        ].map(tool => (
                            <button
                                key={tool.id}
                                onClick={() => setSelectedTool(tool.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '50px',
                                    border: tool.id === 'clear' ? `1px dashed var(--neutral-400)` : `1px solid var(--${tool.color}-300)`,
                                    backgroundColor: selectedTool === tool.id ? (tool.id === 'clear' ? 'var(--neutral-600)' : `var(--${tool.color}-500)`) : 'white',
                                    color: selectedTool === tool.id ? 'white' : `var(--${tool.color}-700)`,
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {tool.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginTop: '1.5rem' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--neutral-500)', marginBottom: '0.5rem' }}>
                            {day}
                        </div>
                    ))}

                    {/* Empty padding days for alignment */}
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                        <div key={`empty-${i}`} style={{ padding: '1rem', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--neutral-200)', opacity: 0.5 }}></div>
                    ))}

                    {/* Actual Month Days */}
                    {daysInMonth.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const status = availabilityMap[dateStr];

                        let bgColor = 'var(--neutral-50)';
                        let borderColor = 'var(--neutral-200)';
                        let dot = null;
                        let statusLabel = '';

                        if (status === 'available') {
                            bgColor = 'var(--success-50)';
                            borderColor = 'var(--success-500)';
                            dot = <CheckCircle size={14} color="var(--success-600)" />;
                            statusLabel = 'All Day';
                        } else if (status === 'available_morning') {
                            bgColor = 'var(--success-50)';
                            borderColor = 'var(--success-300)';
                            dot = <div style={{ width: 14, height: 14, borderRadius: '2px', backgroundColor: 'var(--success-400)', borderTopRightRadius: '14px' }} title="Morning Only" />;
                            statusLabel = 'Morning';
                        } else if (status === 'available_evening') {
                            bgColor = 'var(--success-50)';
                            borderColor = 'var(--success-300)';
                            dot = <div style={{ width: 14, height: 14, borderRadius: '2px', backgroundColor: 'var(--success-400)', borderBottomLeftRadius: '14px' }} title="Evening Only" />;
                            statusLabel = 'Evening';
                        } else if (status === 'unavailable') {
                            bgColor = 'var(--danger-50)';
                            borderColor = 'var(--danger-400)';
                            dot = <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--danger-500)' }} />;
                            statusLabel = 'No / Off';
                        }

                        return (
                            <div
                                key={dateStr}
                                onClick={() => handleApplyTool(dateStr)}
                                style={{
                                    padding: '1rem 0.5rem',
                                    backgroundColor: bgColor,
                                    border: `2px solid ${borderColor}`,
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s ease',
                                    minHeight: '80px',
                                    justifyContent: 'center'
                                }}
                            >
                                <span style={{ fontWeight: 600, fontSize: '1rem', color: status === 'unavailable' ? 'var(--danger-700)' : status?.startsWith('available') ? 'var(--success-700)' : 'var(--neutral-700)' }}>
                                    {format(day, 'd')}
                                </span>
                                {status && (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                                        <div style={{ height: '14px' }}>{dot}</div>
                                        <span style={{ fontSize: '0.55rem', fontWeight: 600, color: status === 'unavailable' ? 'var(--danger-600)' : 'var(--success-600)', textTransform: 'uppercase' }}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AvailabilityPage;
