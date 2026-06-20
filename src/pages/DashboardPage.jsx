import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, isAfter, startOfDay } from 'date-fns';
import { TIMEZONE, getTodayInCentral, createShiftIso, formatShift } from '../lib/timeUtils';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ChevronRight } from 'lucide-react';

const DashboardPage = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const [nextShift, setNextShift] = useState(null);
    const [openShiftsCount, setOpenShiftsCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Schedule acknowledgment states
    const [activeBroadcast, setActiveBroadcast] = useState(null);
    const [pendingShifts, setPendingShifts] = useState([]);
    const [hasAcknowledged, setHasAcknowledged] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            const today = startOfDay(getTodayInCentral()).toISOString();

            try {
                // Fetch User's next shift
                if (user) {
                    const { data: myShifts } = await supabase
                        .from('shifts')
                        .select('*')
                        .eq('assigned_to', user.id)
                        .gte('start_time', today)
                        .order('start_time', { ascending: true })
                        .limit(1);

                    if (myShifts && myShifts.length > 0) {
                        setNextShift(myShifts[0]);
                    }
                }

                // Fetch count of open shifts
                const { count } = await supabase
                    .from('shifts')
                    .select('*', { count: 'exact', head: true })
                    .is('assigned_to', null)
                    .is('custom_assigned_name', null)
                    .gte('start_time', today);

                setOpenShiftsCount(count || 0);

                // Fetch schedule broadcast and acknowledgment details
                if (profile?.id) {
                    const { data: broadcasts, error: broadcastErr } = await supabase
                        .from('schedule_broadcasts')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (broadcastErr) throw broadcastErr;

                    const latest = broadcasts && broadcasts.length > 0 ? broadcasts[0] : null;

                    if (latest && latest.status === 'active') {
                        // Check if acknowledged
                        const { data: acks, error: ackErr } = await supabase
                            .from('schedule_acknowledgments')
                            .select('*')
                            .eq('broadcast_id', latest.id)
                            .eq('user_id', profile.id)
                            .limit(1);

                        if (ackErr) throw ackErr;

                        const acknowledged = acks && acks.length > 0;
                        setHasAcknowledged(acknowledged);
                        setActiveBroadcast(latest);

                        if (!acknowledged) {
                            // Fetch user's shifts for the broadcast period
                            const { data: shiftsInPeriod, error: shiftsErr } = await supabase
                                .from('shifts')
                                .select('*')
                                .eq('assigned_to', profile.id)
                                .gte('date', latest.period_start)
                                .lte('date', latest.period_end)
                                .order('date', { ascending: true });

                            if (shiftsErr) throw shiftsErr;
                            setPendingShifts(shiftsInPeriod || []);
                        }
                    } else {
                        setActiveBroadcast(null);
                        setPendingShifts([]);
                        setHasAcknowledged(true);
                    }
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, profile]);

    const handleAcknowledgeAll = async () => {
        setActionLoading(true);
        setActionError('');

        try {
            const { error } = await supabase
                .from('schedule_acknowledgments')
                .insert({
                    broadcast_id: activeBroadcast.id,
                    user_id: profile.id,
                    status: 'acknowledged'
                });

            if (error) throw error;
            setHasAcknowledged(true);
        } catch (err) {
            console.error("Error acknowledging schedule:", err);
            setActionError(err.message || "Failed to acknowledge schedule.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleFlagShift = async (shift) => {
        setActionLoading(true);
        setActionError('');

        try {
            // 1. Insert schedule_acknowledgment row with status 'flagged'
            const { error: ackError } = await supabase
                .from('schedule_acknowledgments')
                .insert({
                    broadcast_id: activeBroadcast.id,
                    user_id: profile.id,
                    status: 'flagged'
                });

            if (ackError) throw ackError;

            // 2. Check if a pending broadcast shift trade already exists for this shift
            const { data: existingTrades, error: checkError } = await supabase
                .from('shift_trades')
                .select('id')
                .eq('shift_id', shift.id)
                .is('proposed_to', null)
                .eq('status', 'pending');

            if (checkError) throw checkError;

            if (!existingTrades || existingTrades.length === 0) {
                // Insert shift_trade request
                const { error: tradeError } = await supabase
                    .from('shift_trades')
                    .insert({
                        shift_id: shift.id,
                        requested_by: profile.id,
                        proposed_to: null,
                        status: 'pending'
                    });

                if (tradeError) throw tradeError;
            }

            // 3. Post a message to the public message board
            const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'Caregiver';
            const formattedDate = formatShift(shift.start_time, 'EEEE, MMM do');
            const messageContent = `${firstName} is looking for coverage for their ${shift.title} shift on ${formattedDate}. Tap the Schedule to volunteer.`;

            const { error: messageError } = await supabase
                .from('messages')
                .insert({
                    author_id: profile.id,
                    content: messageContent
                });

            if (messageError) throw messageError;

            setHasAcknowledged(true);
        } catch (err) {
            console.error("Error flagging shift:", err);
            setActionError(err.message || "Failed to flag shift.");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Dashboard</h2>

            {/* Schedule Acknowledgment Prompt Card */}
            {activeBroadcast && !hasAcknowledged && (
                <div className="card" style={{ border: '2px solid var(--primary-500)', backgroundColor: 'var(--primary-50)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--primary-900)' }}>{activeBroadcast.title}</h2>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--neutral-700)', lineHeight: 1.4 }}>
                        {activeBroadcast.message}
                    </p>

                    {actionError && (
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                            ⚠️ {actionError}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h4 style={{ margin: 0, color: 'var(--neutral-800)', fontSize: '0.95rem', fontWeight: 600 }}>Your Shifts for this Period:</h4>
                        {pendingShifts.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--neutral-500)', fontStyle: 'italic' }}>
                                No shifts assigned for this period.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {pendingShifts.map(shift => (
                                    <div key={shift.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-app)', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--neutral-800)' }}>{shift.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--neutral-600)', marginTop: '0.1rem' }}>
                                                {formatShift(shift.start_time, 'EEEE, MMM do')}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                                                {formatShift(shift.start_time, 'h:mm a')} - {formatShift(shift.end_time, 'h:mm a')}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleFlagShift(shift)}
                                            className="btn btn-secondary text-sm"
                                            style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                            disabled={actionLoading}
                                        >
                                            I can't do this shift
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleAcknowledgeAll}
                        className="btn btn-primary"
                        style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}
                        disabled={actionLoading}
                    >
                        {actionLoading ? 'Saving...' : 'All looks good ✓'}
                    </button>
                </div>
            )}

            <div className="card">
                <h3>Welcome Back, {profile?.full_name?.split(' ')[0] || 'Caregiver'}!</h3>
                <p className="text-neutral-muted" style={{ marginTop: '0.5rem' }}>
                    Here is an overview of your schedule.
                </p>
            </div>

            <div
                className="card hover-card"
                onClick={() => navigate('/availability')}
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--primary-50)',
                    border: '1px solid var(--primary-200)',
                    marginBottom: '1rem'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.75rem', borderRadius: '50%' }}>
                        <CalendarCheck size={24} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-800)' }}>Set My Availability</h3>
                        <p className="text-sm text-neutral-600" style={{ margin: 0, marginTop: '0.2rem' }}>Update when you can work</p>
                    </div>
                </div>
                <ChevronRight className="text-primary-400" />
            </div>

            <div className="card">
                <h3>Your Next Shift</h3>
                {loading ? (
                    <p className="text-sm text-neutral-muted mt-2" style={{ marginTop: '1rem' }}>Loading...</p>
                ) : nextShift ? (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary-500)' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{nextShift.title}</p>
                        <p className="text-sm font-medium">
                            {formatShift(nextShift.start_time, 'EEEE, MMM do')}
                        </p>
                        <p className="text-sm text-neutral-muted">
                            {formatShift(nextShift.start_time, 'h:mm a')} - {formatShift(nextShift.end_time, 'h:mm a')}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-neutral-muted" style={{ marginTop: '1rem' }}>You have no upcoming shifts scheduled right now.</p>
                )}
            </div>

            <div
                className="card hover-card"
                onClick={() => navigate('/schedule')}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginTop: '1rem' }}
            >
                <div>
                    <h3 style={{ margin: 0 }}>Open Shifts</h3>
                    <p className="text-sm text-neutral-muted" style={{ margin: 0, marginTop: '0.25rem' }}>Pick up extra hours</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        backgroundColor: openShiftsCount > 0 ? 'var(--warning-100)' : 'var(--neutral-100)',
                        color: openShiftsCount > 0 ? 'var(--warning-600)' : 'var(--neutral-500)',
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-xl)',
                        fontWeight: 'bold',
                        fontSize: '1.25rem'
                    }}>
                        {openShiftsCount}
                    </div>
                    <ChevronRight className="text-neutral-400" />
                </div>
            </div>

        </div>
    );
};

export default DashboardPage;
