import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SchedulePage = () => {
    const { user } = useAuth();
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());

    const fetchSchedule = async () => {
        setLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateStr = format(monthStart, 'yyyy-MM-dd');
        const endDateStr = format(monthEnd, 'yyyy-MM-dd');

        // Fetch user's assigned shifts AND open shifts for this week
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .or(`assigned_to.eq.${user?.id},is_open.eq.true`)
            .is('custom_assigned_name', null)
            .order('start_time', { ascending: true });

        if (data) setShifts(data);
        if (error) console.error("Error fetching shifts:", error);

        setLoading(false);
    };

    useEffect(() => {
        if (user) fetchSchedule();
    }, [user, currentDate]);

    const handlePickUpShift = async (shift) => {
        if (!window.confirm(`Pick up the ${shift.title} shift on ${format(parseISO(shift.date), 'MMM do')}?`)) return;

        const { error } = await supabase
            .from('shifts')
            .update({ assigned_to: user.id, is_open: false })
            .eq('id', shift.id);

        if (error) {
            alert("Error picking up shift: " + error.message);
        } else {
            fetchSchedule();
        }
    };

    const handleTradeShift = async (shift) => {
        alert("Shift trading functionality will be implemented in the next module!");
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // 0 is Sunday. We'll start calendar on Sunday.
    const firstDayIndex = monthStart.getDay();

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>My Schedule</h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={prevMonth} className="btn btn-outline" style={{ padding: '0.4rem' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h3 style={{ margin: 0, minWidth: '150px', textAlign: 'center', fontSize: '1.2rem' }}>
                        {format(currentDate, 'MMMM yyyy')}
                    </h3>
                    <button onClick={goToToday} className="btn btn-outline text-sm" style={{ padding: '0.4rem 0.75rem' }}>
                        Today
                    </button>
                    <button onClick={nextMonth} className="btn btn-outline" style={{ padding: '0.4rem' }}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--primary-500)' }}></span> My Shifts</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--warning-500)' }}></span> Open (Available)</div>
            </div>

            <div className="calendar-container">
                <div className="calendar-wrapper">
                    <div className="calendar-row">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="calendar-header-cell">
                                {day}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-500)' }}>Loading calendar...</div>
                    ) : (
                        <div className="calendar-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                            {/* Empty padding days for alignment */}
                            {Array.from({ length: firstDayIndex }).map((_, i) => (
                                <div key={`empty-${i}`} className="calendar-day-cell" style={{ backgroundColor: 'var(--neutral-50)', opacity: 0.5 }}></div>
                            ))}

                            {daysInMonth.map(day => {
                                const dayStr = format(day, 'yyyy-MM-dd');
                                const dayShifts = shifts.filter(s => s.date === dayStr);
                                const isTodayDay = isSameDay(day, new Date());

                                return (
                                    <div key={dayStr} className={`calendar-day-cell ${isTodayDay ? 'is-today' : ''}`} style={{ gridColumn: 'auto' }}>
                                        <div className="calendar-date-label">
                                            <span>{format(day, 'd')}</span>
                                            {isTodayDay && <span style={{ fontSize: '0.7rem', color: 'var(--primary-600)', backgroundColor: 'var(--primary-100)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Today</span>}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {dayShifts.map(shift => {
                                                const isMine = shift.assigned_to === user.id;
                                                const cardClass = isMine ? 'shift-mine' : 'shift-open';

                                                return (
                                                    <div key={shift.id} className={`shift-card-mini ${cardClass}`}>
                                                        <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{shift.title}</div>
                                                        <div style={{ color: 'var(--neutral-600)', marginBottom: '0.5rem' }}>
                                                            {format(parseISO(shift.start_time), 'h:mma').toLowerCase()} - {format(parseISO(shift.end_time), 'h:mma').toLowerCase()}
                                                        </div>

                                                        {isMine ? (
                                                            <button onClick={(e) => { e.stopPropagation(); handleTradeShift(shift); }} className="btn btn-outline" style={{ fontSize: '0.7rem', padding: '0.2rem', width: '100%', border: 'none', backgroundColor: 'white' }}>
                                                                Trade Shift
                                                            </button>
                                                        ) : (
                                                            <button onClick={(e) => { e.stopPropagation(); handlePickUpShift(shift); }} className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.2rem', width: '100%', backgroundColor: 'var(--secondary-600)' }}>
                                                                Pick Up
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {dayShifts.length === 0 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', textAlign: 'center', marginTop: '1rem', display: 'none' }}>
                                                    No shifts
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SchedulePage;
