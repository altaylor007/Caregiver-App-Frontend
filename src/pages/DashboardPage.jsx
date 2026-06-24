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

    // Coverage request modal states
    const [coverageModalOpen, setCoverageModalOpen] = useState(false);
    const [shiftForCoverage, setShiftForCoverage] = useState(null);
    const [modalStep, setModalStep] = useState(1);
    const [rangeOption, setRangeOption] = useState('full'); // 'full', 'from_now', 'custom'
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [caregiversList, setCaregiversList] = useState([]);
    const [nextShiftCaregiverId, setNextShiftCaregiverId] = useState(null);
    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const [modalError, setModalError] = useState('');
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [loadingCaregivers, setLoadingCaregivers] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Helpers
    const getRoundedNowIso = () => {
        const now = new Date();
        const minutes = now.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const roundedDate = new Date(now);
        roundedDate.setMinutes(roundedMinutes);
        roundedDate.setSeconds(0);
        roundedDate.setMilliseconds(0);
        return roundedDate.toISOString();
    };

    const formatTimeStr = (timeStr) => {
        if (!timeStr || !shiftForCoverage) return '';
        const iso = createShiftIso(shiftForCoverage.date, timeStr);
        return formatShift(iso, 'h:mm a').toLowerCase();
    };

    const getCgDisplayName = (cg) => {
        if (!cg) return '';
        return cg.first_name && cg.last_name ? `${cg.first_name} ${cg.last_name}` : (cg.full_name || 'Caregiver');
    };

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
                } else {
                    setNextShift(null);
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

    useEffect(() => {
        fetchDashboardData();
    }, [user, profile]);

    const handleRequestCoverage = (shift) => {
        setShiftForCoverage(shift);
        const now = new Date();
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        const isWithinWindow = now >= shiftStart && now <= shiftEnd;
        
        setRangeOption(isWithinWindow ? 'from_now' : 'full');
        setCustomStart(formatShift(shift.start_time, 'HH:mm'));
        setCustomEnd(formatShift(shift.end_time, 'HH:mm'));
        
        setModalStep(1);
        setCoverageModalOpen(true);
        setModalError('');
        setSelectedRecipient(null);
    };

    const goToStep2 = async () => {
        if (rangeOption === 'custom' && customEnd <= customStart) {
            setModalError('End time must be after start time.');
            return;
        }
        setLoadingCaregivers(true);
        setModalError('');
        try {
            // Fetch active caregivers
            const { data: cgs, error: cgsErr } = await supabase
                .from('users')
                .select('id, full_name, first_name, last_name, avatar_url, phone, sms_enabled')
                .eq('status', 'active')
                .or('role.eq.caregiver,is_caregiver.eq.true')
                .neq('id', profile.id);
            
            if (cgsErr) throw cgsErr;
            
            // Fetch subsequent caregiver (next shift starting after this shift's end_time)
            const { data: subsequentShifts, error: subErr } = await supabase
                .from('shifts')
                .select('assigned_to')
                .gt('start_time', shiftForCoverage.end_time)
                .not('assigned_to', 'is', null)
                .neq('assigned_to', profile.id)
                .order('start_time', { ascending: true })
                .limit(1);
                
            if (subErr) throw subErr;
            
            const nextId = subsequentShifts && subsequentShifts.length > 0 ? subsequentShifts[0].assigned_to : null;
            
            setCaregiversList(cgs || []);
            setNextShiftCaregiverId(nextId);
            setModalStep(2);
        } catch (err) {
            console.error("Error loading caregivers:", err);
            setModalError("Failed to load caregivers list.");
        } finally {
            setLoadingCaregivers(false);
        }
    };

    const submitCoverageRequest = async () => {
        setModalSubmitting(true);
        setModalError('');
        
        try {
            const roundedNowIso = getRoundedNowIso();
            const dateStr = formatShift(shiftForCoverage.start_time, 'EEEE, MMM do');
            const requesterFirstName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'Caregiver';
            
            let coverageStart = null;
            let coverageEnd = null;
            let startText = '';
            let endText = '';
            
            if (rangeOption === 'from_now') {
                coverageStart = roundedNowIso;
                coverageEnd = shiftForCoverage.end_time;
                startText = formatShift(coverageStart, 'h:mma').toLowerCase();
                endText = formatShift(coverageEnd, 'h:mma').toLowerCase();
            } else if (rangeOption === 'custom') {
                coverageStart = createShiftIso(shiftForCoverage.date, customStart);
                coverageEnd = createShiftIso(shiftForCoverage.date, customEnd);
                startText = formatShift(coverageStart, 'h:mma').toLowerCase();
                endText = formatShift(coverageEnd, 'h:mma').toLowerCase();
            } else {
                startText = formatShift(shiftForCoverage.start_time, 'h:mma').toLowerCase();
                endText = formatShift(shiftForCoverage.end_time, 'h:mma').toLowerCase();
            }
            
            // 1. Insert into public.shift_trades
            const { data: tradeData, error: tradeErr } = await supabase
                .from('shift_trades')
                .insert({
                    shift_id: shiftForCoverage.id,
                    requested_by: profile.id,
                    proposed_to: selectedRecipient?.id || null,
                    coverage_start: coverageStart,
                    coverage_end: coverageEnd
                })
                .select('sms_code');
                
            if (tradeErr) throw tradeErr;
            
            const smsCode = tradeData && tradeData.length > 0 ? tradeData[0].sms_code : null;
            if (!smsCode) {
                throw new Error("Failed to retrieve generated SMS code.");
            }
            
            // 2. Build SMS message
            const isPartial = rangeOption !== 'full';
            const smsMessage = isPartial
                ? `${requesterFirstName} needs coverage for their ${shiftForCoverage.title} on ${dateStr} from ${startText}–${endText}. Can you help? Reply YES ${smsCode} to accept.`
                : `${requesterFirstName} needs someone to cover their ${shiftForCoverage.title} on ${dateStr} (${startText}–${endText}). Reply YES ${smsCode} to accept.`;
                
            // 3. Call the send-sms Edge Function
            if (selectedRecipient) {
                // Single recipient
                const { data: smsRes, error: smsErr } = await supabase.functions.invoke('send-sms', {
                    body: {
                        userId: selectedRecipient.id,
                        messageBody: smsMessage
                    }
                });
                if (smsErr) throw smsErr;
                if (smsRes?.error) throw new Error(smsRes.error);
            } else {
                // Broadcast (proposed_to is null)
                // Fetch active, sms_enabled caregivers with a phone number (excluding current user)
                const { data: activeSmsCaregivers, error: fetchErr } = await supabase
                    .from('users')
                    .select('id')
                    .eq('status', 'active')
                    .eq('sms_enabled', true)
                    .or('role.eq.caregiver,is_caregiver.eq.true')
                    .neq('id', profile.id)
                    .not('phone', 'is', null)
                    .neq('phone', '');
                    
                if (fetchErr) throw fetchErr;
                
                if (activeSmsCaregivers && activeSmsCaregivers.length > 0) {
                    for (const recipient of activeSmsCaregivers) {
                        const { data: broadcastRes, error: broadcastErr } = await supabase.functions.invoke('send-sms', {
                            body: {
                                userId: recipient.id,
                                messageBody: smsMessage
                            }
                        });
                        if (broadcastErr) {
                            console.error(`Failed to send broadcast SMS to ${recipient.id}:`, broadcastErr);
                        }
                        if (broadcastRes?.error) {
                            console.error(`Failed to send broadcast SMS to ${recipient.id} (res):`, broadcastRes.error);
                        }
                    }
                }
            }
            
            // Success
            setCoverageModalOpen(false);
            setToastMessage('Request sent!');
            setTimeout(() => setToastMessage(''), 3000);
            
            // Refresh dashboard data
            fetchDashboardData();
            
        } catch (err) {
            console.error("Error in submitCoverageRequest:", err);
            setModalError(err.message || "An error occurred while submitting the request.");
        } finally {
            setModalSubmitting(false);
        }
    };

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
                        {nextShift.assigned_to === profile?.id && isAfter(new Date(nextShift.start_time), new Date()) && (
                            <button
                                type="button"
                                onClick={() => handleRequestCoverage(nextShift)}
                                className="btn btn-outline text-sm"
                                style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem' }}
                            >
                                Request Coverage
                            </button>
                        )}
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

            {/* Request Coverage Modal */}
            {coverageModalOpen && shiftForCoverage && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <style>{`
                        .cg-row:hover { background-color: var(--neutral-50); }
                        .range-opt:hover { border-color: var(--primary-400); }
                    `}</style>
                    <div className="card" style={{ width: '100%', maxWidth: '400px', margin: 'auto', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {modalStep === 1 && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>Request Coverage (Step 1 of 3)</h3>
                                    <button 
                                        onClick={() => setCoverageModalOpen(false)}
                                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--neutral-500)', padding: '0.25rem' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                                
                                <div style={{ padding: '0.75rem', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{shiftForCoverage.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--neutral-600)', marginTop: '0.1rem' }}>
                                        {formatShift(shiftForCoverage.start_time, 'EEEE, MMM do')}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>
                                        {formatShift(shiftForCoverage.start_time, 'h:mm a').toLowerCase()} – {formatShift(shiftForCoverage.end_time, 'h:mm a').toLowerCase()}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-700)' }}>Select Time Range</span>
                                    
                                    <div 
                                        onClick={() => setRangeOption('full')}
                                        className="range-opt"
                                        style={{
                                            minHeight: '48px',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: rangeOption === 'full' ? '2px solid var(--primary-500)' : '1px solid var(--neutral-300)',
                                            backgroundColor: rangeOption === 'full' ? 'var(--primary-50)' : 'var(--bg-app)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--neutral-800)' }}>Full shift</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>No time range modification</span>
                                    </div>

                                    <div 
                                        onClick={() => setRangeOption('from_now')}
                                        className="range-opt"
                                        style={{
                                            minHeight: '48px',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: rangeOption === 'from_now' ? '2px solid var(--primary-500)' : '1px solid var(--neutral-300)',
                                            backgroundColor: rangeOption === 'from_now' ? 'var(--primary-50)' : 'var(--bg-app)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--neutral-800)' }}>From now</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                                            Coverage starts at {formatShift(getRoundedNowIso(), 'h:mm a').toLowerCase()}
                                        </span>
                                    </div>

                                    <div 
                                        onClick={() => setRangeOption('custom')}
                                        className="range-opt"
                                        style={{
                                            minHeight: '48px',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            border: rangeOption === 'custom' ? '2px solid var(--primary-500)' : '1px solid var(--neutral-300)',
                                            backgroundColor: rangeOption === 'custom' ? 'var(--primary-50)' : 'var(--bg-app)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--neutral-800)' }}>Custom</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Specify custom start & end times</span>
                                    </div>
                                </div>

                                {rangeOption === 'custom' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Start Time</label>
                                            <input 
                                                type="time" 
                                                className="form-input" 
                                                value={customStart} 
                                                onChange={(e) => setCustomStart(e.target.value)} 
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">End Time</label>
                                            <input 
                                                type="time" 
                                                className="form-input" 
                                                value={customEnd} 
                                                onChange={(e) => setCustomEnd(e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button 
                                        onClick={goToStep2}
                                        className="btn btn-primary"
                                        style={{ flex: 1, minHeight: '44px' }}
                                    >
                                        Next
                                    </button>
                                    <button 
                                        onClick={() => setCoverageModalOpen(false)}
                                        className="btn btn-outline"
                                        style={{ flex: 1, minHeight: '44px' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}

                        {modalStep === 2 && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>Who to ask (Step 2 of 3)</h3>
                                    <button 
                                        onClick={() => setCoverageModalOpen(false)}
                                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--neutral-500)', padding: '0.25rem' }}
                                    >
                                        &times;
                                    </button>
                                </div>

                                {loadingCaregivers ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-500)' }}>
                                        Loading caregivers...
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column' }}>
                                        {(() => {
                                            const nextCg = caregiversList.find(cg => cg.id === nextShiftCaregiverId);
                                            return nextCg ? (
                                                <div 
                                                    key={nextCg.id}
                                                    onClick={() => { setSelectedRecipient(nextCg); setModalStep(3); }}
                                                    className="cg-row"
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        padding: '0.75rem 1rem',
                                                        borderBottom: '1px solid var(--neutral-200)',
                                                        cursor: 'pointer',
                                                        minHeight: '48px',
                                                        backgroundColor: 'var(--primary-50)'
                                                    }}
                                                >
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                                        {nextCg.avatar_url ? (
                                                            <img src={nextCg.avatar_url} alt={nextCg.first_name || nextCg.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 'bold', color: 'var(--neutral-500)', fontSize: '0.875rem' }}>
                                                                {(nextCg.first_name || nextCg.full_name)?.charAt(0).toUpperCase() || '?'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                                        <span style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--neutral-800)' }}>
                                                            {getCgDisplayName(nextCg)}
                                                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                                                Next Shift
                                                            </span>
                                                        </span>
                                                        {nextCg.phone && (
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>
                                                                📞 {nextCg.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}

                                        {caregiversList
                                            .filter(cg => cg.id !== nextShiftCaregiverId)
                                            .sort((a, b) => (a.first_name || a.full_name || '').localeCompare(b.first_name || b.full_name || '', undefined, { sensitivity: 'base' }))
                                            .map(cg => (
                                                <div 
                                                    key={cg.id}
                                                    onClick={() => { setSelectedRecipient(cg); setModalStep(3); }}
                                                    className="cg-row"
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.75rem',
                                                        padding: '0.75rem 1rem',
                                                        borderBottom: '1px solid var(--neutral-100)',
                                                        cursor: 'pointer',
                                                        minHeight: '48px'
                                                    }}
                                                >
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                                        {cg.avatar_url ? (
                                                            <img src={cg.avatar_url} alt={cg.first_name || cg.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <span style={{ fontWeight: 'bold', color: 'var(--neutral-500)', fontSize: '0.875rem' }}>
                                                                {(cg.first_name || cg.full_name)?.charAt(0).toUpperCase() || '?'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                                        <span style={{ fontWeight: 500, fontSize: '0.95rem', color: 'var(--neutral-800)' }}>
                                                            {getCgDisplayName(cg)}
                                                        </span>
                                                        {cg.phone && (
                                                            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-500)' }}>
                                                                📞 {cg.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                        <div 
                                            onClick={() => { setSelectedRecipient(null); setModalStep(3); }}
                                            className="cg-row"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                cursor: 'pointer',
                                                minHeight: '48px',
                                                backgroundColor: 'var(--primary-50)',
                                                borderTop: '1px solid var(--primary-100)'
                                            }}
                                        >
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                📢
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--primary-700)' }}>
                                                    Broadcast to everyone
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--primary-600)' }}>
                                                    Send to all active, text-enabled caregivers
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button 
                                        onClick={() => setModalStep(1)}
                                        className="btn btn-outline"
                                        style={{ width: '100%', minHeight: '44px' }}
                                    >
                                        Back
                                    </button>
                                </div>
                            </>
                        )}

                        {modalStep === 3 && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>Confirm Request (Step 3 of 3)</h3>
                                    <button 
                                        onClick={() => setCoverageModalOpen(false)}
                                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--neutral-500)', padding: '0.25rem' }}
                                    >
                                        &times;
                                    </button>
                                </div>

                                <div className="card" style={{ backgroundColor: 'var(--neutral-50)', border: '1px solid var(--neutral-200)', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', margin: 0 }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', display: 'block', textTransform: 'uppercase' }}>Shift</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--neutral-800)' }}>{shiftForCoverage.title}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--neutral-600)', display: 'block', marginTop: '0.1rem' }}>
                                            {formatShift(shiftForCoverage.start_time, 'EEEE, MMM do')}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', display: 'block', textTransform: 'uppercase' }}>Time Requested</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--neutral-800)' }}>
                                            {rangeOption === 'full' && 'Full shift'}
                                            {rangeOption === 'from_now' && `From now (${formatShift(getRoundedNowIso(), 'h:mm a').toLowerCase()} – ${formatShift(shiftForCoverage.end_time, 'h:mm a').toLowerCase()})`}
                                            {rangeOption === 'custom' && `${formatTimeStr(customStart)} – ${formatTimeStr(customEnd)}`}
                                        </span>
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', display: 'block', textTransform: 'uppercase' }}>Proposed To</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--neutral-800)' }}>
                                            {selectedRecipient ? getCgDisplayName(selectedRecipient) : 'All caregivers (Broadcast)'}
                                        </span>
                                    </div>
                                </div>

                                {modalError && (
                                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                        ⚠️ {modalError}
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button 
                                        onClick={submitCoverageRequest}
                                        className="btn btn-primary"
                                        style={{ width: '100%', minHeight: '44px', fontWeight: 'bold' }}
                                        disabled={modalSubmitting}
                                    >
                                        {modalSubmitting ? 'Sending Request...' : 'Send Request'}
                                    </button>
                                    <button
                                        onClick={() => setModalStep(2)}
                                        className="btn btn-link"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--neutral-600)',
                                            textDecoration: 'underline',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            display: 'block',
                                            width: '100%',
                                            textAlign: 'center',
                                            padding: '0.5rem 0'
                                        }}
                                    >
                                        Back
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Toast message alert */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'var(--success-600)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    fontWeight: 500,
                    fontSize: '0.9rem',
                }}>
                    {toastMessage}
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
