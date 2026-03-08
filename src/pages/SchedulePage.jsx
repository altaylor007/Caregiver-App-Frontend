import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarCheck, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SchedulePage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [incomingTrades, setIncomingTrades] = useState([]);
    const [outgoingTrades, setOutgoingTrades] = useState([]);
    const [caregivers, setCaregivers] = useState([]);

    // Trade Modal state
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [shiftToTrade, setShiftToTrade] = useState(null);
    const [selectedCaregiverForTrade, setSelectedCaregiverForTrade] = useState('');
    const [tradeSubmitting, setTradeSubmitting] = useState(false);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [showOnlyMyShifts, setShowOnlyMyShifts] = useState(false);
    const [printMode, setPrintMode] = useState(false); // 'full' | 'mine' | false

    const fetchSchedule = async () => {
        setLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);

        // Use startOfWeek and endOfWeek to fetch full calendar grid range
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

        const startDateStr = format(calendarStart, 'yyyy-MM-dd');
        const endDateStr = format(calendarEnd, 'yyyy-MM-dd');

        // Fetch ALL shifts so caregivers can see the full schedule
        const { data, error } = await supabase
            .from('shifts')
            .select('*, users(full_name, first_name)')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .or(`assigned_to.eq.${user?.id},is_open.eq.true`)
            .is('custom_assigned_name', null)
            .order('start_time', { ascending: true });

        if (data) setShifts(data);
        if (error) console.error("Error fetching shifts:", error);

        const cgRes = await supabase.from('users').select('id, full_name, first_name').eq('is_caregiver', true).eq('status', 'active');
        if (cgRes.data) setCaregivers(cgRes.data.filter(c => c.id !== user?.id));

        // Fetch incoming pending trades
        const tradesRes = await supabase
            .from('shift_trades')
            .select('*, shifts(*)')
            .eq('proposed_to', user?.id)
            .eq('status', 'pending');

        if (tradesRes.data && tradesRes.data.length > 0) {
            const requesterIds = [...new Set(tradesRes.data.map(t => t.requested_by))];
            const { data: requesters } = await supabase.from('users').select('id, full_name, first_name').in('id', requesterIds);
            const enrichedTrades = tradesRes.data.map(t => ({
                ...t,
                requester_name: requesters?.find(r => r.id === t.requested_by)?.first_name || requesters?.find(r => r.id === t.requested_by)?.full_name || 'Unknown Caregiver'
            }));
            setIncomingTrades(enrichedTrades);
        } else {
            setIncomingTrades([]);
        }

        // Fetch outgoing pending trades (shifts I requested to trade away)
        const outgoingRes = await supabase
            .from('shift_trades')
            .select('*')
            .eq('requested_by', user?.id)
            .eq('status', 'pending');

        if (outgoingRes.data && outgoingRes.data.length > 0) {
            const proposedToIds = [...new Set(outgoingRes.data.map(t => t.proposed_to))];
            const { data: proposedToUsers } = await supabase.from('users').select('id, full_name, first_name').in('id', proposedToIds);
            const enrichedOutgoing = outgoingRes.data.map(t => ({
                ...t,
                proposed_to_name: proposedToUsers?.find(u => u.id === t.proposed_to)?.first_name || proposedToUsers?.find(u => u.id === t.proposed_to)?.full_name || 'a caregiver'
            }));
            setOutgoingTrades(enrichedOutgoing);
        } else {
            setOutgoingTrades([]);
        }

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
        setShiftToTrade(shift);
        setSelectedCaregiverForTrade('');
        setTradeModalOpen(true);
    };

    const submitTradeRequest = async () => {
        if (!selectedCaregiverForTrade) return;
        setTradeSubmitting(true);
        try {
            const { error: tradeErr } = await supabase.from('shift_trades').insert({
                shift_id: shiftToTrade.id,
                requested_by: user.id,
                proposed_to: selectedCaregiverForTrade,
                status: 'pending'
            });
            if (tradeErr) throw tradeErr;

            // Notify proposed caregiver
            await supabase.from('notifications').insert({
                user_id: selectedCaregiverForTrade,
                actor_id: user.id,
                type: 'trade_request',
                reference_id: shiftToTrade.id
            });

            alert('Trade request sent!');
            setTradeModalOpen(false);
        } catch (error) {
            alert("Error sending trade request: " + error.message);
        }
        setTradeSubmitting(false);
    };

    const handleAcceptTrade = async (trade) => {
        if (!window.confirm("Accept this shift trade? You will be assigned to this shift.")) return;
        try {
            const { error } = await supabase.rpc('accept_shift_trade', { trade_id: trade.id });
            if (error) throw error;

            // Notify original requester
            await supabase.from('notifications').insert({
                user_id: trade.requested_by,
                actor_id: user.id,
                type: 'trade_accepted',
                reference_id: trade.shift_id
            });

            fetchSchedule();
        } catch (error) {
            alert("Error accepting trade: " + error.message);
        }
    };

    const handleRejectTrade = async (trade) => {
        if (!window.confirm("Reject this shift trade?")) return;
        try {
            const { error } = await supabase.from('shift_trades').update({ status: 'denied' }).eq('id', trade.id);
            if (error) throw error;

            // Notify original requester
            await supabase.from('notifications').insert({
                user_id: trade.requested_by,
                actor_id: user.id,
                type: 'trade_rejected',
                reference_id: trade.shift_id
            });

            fetchSchedule();
        } catch (error) {
            alert("Error rejecting trade: " + error.message);
        }
    };

    const handlePrint = (myShiftsOnly) => {
        setShowOnlyMyShifts(myShiftsOnly);
        setPrintMode(myShiftsOnly ? 'mine' : 'full');
    };

    useEffect(() => {
        if (printMode) {
            // Small delay to allow React to re-render with the new filter state
            const timer = setTimeout(() => {
                window.print();
                setPrintMode(false);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [printMode]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
        <div style={{ paddingBottom: '2rem' }}>
            {/* Print-only branded header */}
            <div className="print-only-header" style={{ display: 'none' }}>
                <img src="/tulip.svg" alt="ACT Logo" style={{ width: '32px', height: '32px' }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>ACT</span>
                <span style={{ fontSize: '1rem', fontWeight: 500, color: '#555', marginLeft: '0.5rem' }}>
                    — My Schedule: {format(currentDate, 'MMMM yyyy')}
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Top Row: Title + Month Nav */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
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

                {/* Bottom Row: Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }} className="no-print">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={() => navigate('/availability')}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                        >
                            <CalendarCheck size={16} /> Set Availability
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: showOnlyMyShifts ? 'var(--primary-100)' : 'white', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: showOnlyMyShifts ? '1px solid var(--primary-200)' : '1px solid var(--neutral-200)', transition: 'all 0.2s' }}>
                            <input
                                type="checkbox"
                                id="myScheduleToggle"
                                checked={showOnlyMyShifts}
                                onChange={(e) => setShowOnlyMyShifts(e.target.checked)}
                                style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary-600)', cursor: 'pointer' }}
                            />
                            <label htmlFor="myScheduleToggle" style={{ fontSize: '0.875rem', fontWeight: showOnlyMyShifts ? 600 : 400, color: showOnlyMyShifts ? 'var(--primary-700)' : 'var(--neutral-700)', cursor: 'pointer', margin: 0 }}>
                                My schedule only
                            </label>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => handlePrint(false)}
                            className="btn btn-outline text-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'white' }}
                            title="Print the full schedule for this month"
                        >
                            <Printer size={16} /> Print Full Schedule
                        </button>
                        <button
                            onClick={() => handlePrint(true)}
                            className="btn btn-outline text-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'white' }}
                            title="Print only your assigned shifts"
                        >
                            <Printer size={16} /> Print My Shifts
                        </button>
                    </div>
                </div>
            </div>

            {incomingTrades.length > 0 && (
                <div className="no-print" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--warning-50)', border: '1px solid var(--warning-200)', borderRadius: 'var(--radius-md)' }}>
                    <h3 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--warning-700)', fontSize: '1rem' }}>Incoming Trade Requests</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {incomingTrades.map(trade => (
                            <div key={trade.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{trade.shifts?.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-600)' }}>
                                        {format(parseISO(trade.shifts?.date), 'EEEE, MMM do')} | {format(parseISO(trade.shifts?.start_time), 'h:mma').toLowerCase()} - {format(parseISO(trade.shifts?.end_time), 'h:mma').toLowerCase()}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: '0.2rem' }}>
                                        Requested by: <strong>{trade.requester_name}</strong>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleAcceptTrade(trade)} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Accept</button>
                                    <button onClick={() => handleRejectTrade(trade)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger-600)' }}>Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Trade Shift Modal */}
            {tradeModalOpen && shiftToTrade && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', margin: 'auto' }}>
                        <h3 style={{ marginBottom: '1rem', marginTop: 0 }}>Trade Shift</h3>
                        <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                            <div style={{ fontWeight: 600 }}>{shiftToTrade.title}</div>
                            <div style={{ color: 'var(--neutral-600)' }}>{format(parseISO(shiftToTrade.date), 'EEEE, MMMM d, yyyy')}</div>
                            <div style={{ color: 'var(--neutral-600)' }}>{format(parseISO(shiftToTrade.start_time), 'h:mma')} - {format(parseISO(shiftToTrade.end_time), 'h:mma')}</div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Select Caregiver to trade with:</label>
                            <select
                                className="form-input"
                                value={selectedCaregiverForTrade}
                                onChange={(e) => setSelectedCaregiverForTrade(e.target.value)}
                            >
                                <option value="">-- Select Caregiver --</option>
                                {caregivers.map(cg => (
                                    <option key={cg.id} value={cg.id}>{cg.first_name || cg.full_name}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: '0.5rem' }}>
                                A notification will be sent to the selected caregiver. If they accept, the shift will be reassigned to them.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button
                                onClick={submitTradeRequest}
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={!selectedCaregiverForTrade || tradeSubmitting}
                            >
                                {tradeSubmitting ? 'Sending Request...' : 'Send Trade Request'}
                            </button>
                            <button onClick={() => setTradeModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--primary-500)' }}></span> My Shifts</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--warning-500)' }}></span> Open (Available to Pick Up)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--neutral-300)' }}></span> Assigned to Others (View Only)</div>
            </div>

            <div className={`calendar-container ${showOnlyMyShifts ? 'is-my-schedule-mode' : ''}`} style={showOnlyMyShifts ? { border: '2px solid var(--primary-300)', backgroundColor: '#fafcff' } : {}}>
                <div className="calendar-wrapper">
                    <div className="calendar-row" style={showOnlyMyShifts ? { backgroundColor: 'var(--primary-50)' } : {}}>
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
                            {calendarDays.map(day => {
                                const dayStr = format(day, 'yyyy-MM-dd');
                                let dayShifts = shifts.filter(s => s.date === dayStr);

                                if (showOnlyMyShifts) {
                                    dayShifts = dayShifts.filter(s => s.assigned_to === user.id);
                                }

                                const isTodayDay = isSameDay(day, new Date());
                                const isCurrentMonthDay = isSameMonth(day, currentDate);

                                return (
                                    <div key={dayStr} className={`calendar-day-cell ${isTodayDay ? 'is-today' : ''} ${!isCurrentMonthDay ? 'is-outside-month' : ''}`} style={{ gridColumn: 'auto', backgroundColor: !isCurrentMonthDay ? 'var(--neutral-50)' : 'transparent', opacity: !isCurrentMonthDay ? 0.7 : 1 }}>
                                        <div className="calendar-date-label">
                                            <span>{format(day, 'd')}</span>
                                            {isTodayDay && <span style={{ fontSize: '0.7rem', color: 'var(--primary-600)', backgroundColor: 'var(--primary-100)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Today</span>}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {dayShifts.map(shift => {
                                                const isMine = shift.assigned_to === user.id;
                                                const isOpen = !shift.assigned_to && !shift.custom_assigned_name;
                                                const isOtherCaregiver = !isMine && !isOpen;

                                                let cardClass = 'shift-open'; // amber = open
                                                if (isMine) cardClass = 'shift-mine'; // teal = mine
                                                if (isOtherCaregiver) cardClass = 'shift-other'; // grey = other

                                                const assigneeName = shift.custom_assigned_name || shift.users?.first_name || shift.users?.full_name || null;

                                                return (
                                                    <div key={shift.id} className={`shift-card-mini ${cardClass}`}>
                                                        <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>{shift.title}</div>
                                                        <div style={{ color: 'var(--neutral-600)', marginBottom: isOtherCaregiver || isMine ? '0.25rem' : '0.5rem', fontSize: '0.7rem' }}>
                                                            {format(parseISO(shift.start_time), 'h:mma').toLowerCase()} - {format(parseISO(shift.end_time), 'h:mma').toLowerCase()}
                                                        </div>

                                                        {/* Show assigned name for non-open shifts */}
                                                        {assigneeName && (
                                                            <div style={{ fontSize: '0.68rem', color: isMine ? 'var(--primary-700)' : 'var(--neutral-500)', fontWeight: 500, marginBottom: isOtherCaregiver ? 0 : '0.3rem' }}>
                                                                {isMine ? '👤 You' : `👤 ${assigneeName}`}
                                                            </div>
                                                        )}

                                                        {/* Action buttons — only for mine or open */}
                                                        {!printMode && isMine && (() => {
                                                            const pendingTrade = outgoingTrades.find(t => t.shift_id === shift.id);
                                                            return pendingTrade ? (
                                                                <div style={{ marginTop: '0.25rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--warning-700)', backgroundColor: 'var(--warning-50)', border: '1px solid var(--warning-300)', borderRadius: '4px', padding: '0.25rem 0.4rem', textAlign: 'center', lineHeight: 1.3 }}>
                                                                    ⏳ Pending trade with {pendingTrade.proposed_to_name}
                                                                </div>
                                                            ) : (
                                                                <button onClick={(e) => { e.stopPropagation(); handleTradeShift(shift); }} className="btn btn-primary no-print" style={{ fontSize: '0.7rem', padding: '0.2rem', width: '100%', backgroundColor: 'var(--primary-600)', color: 'white', marginTop: '0.25rem' }}>
                                                                    Trade Shift
                                                                </button>
                                                            );
                                                        })()}
                                                        {!printMode && isOpen && (
                                                            <button onClick={(e) => { e.stopPropagation(); handlePickUpShift(shift); }} className="btn btn-primary no-print" style={{ fontSize: '0.7rem', padding: '0.2rem', width: '100%', backgroundColor: 'var(--warning-500)', color: 'white', marginTop: '0.25rem' }}>
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
