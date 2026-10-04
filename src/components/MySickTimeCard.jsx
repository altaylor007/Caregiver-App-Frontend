import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { formatShift, getTodayInCentral } from '../lib/timeUtils';

const num = (n) => Number(Number(n).toFixed(2));

const shiftHours = (s) => {
    let d = (parseISO(s.end_time) - parseISO(s.start_time)) / (1000 * 60 * 60);
    if (d < 0) d += 24;
    return num(d);
};

const MySickTimeCard = () => {
    const { profile } = useAuth();
    const [balance, setBalance] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [entries, setEntries] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [open, setOpen] = useState(false);
    const [shiftId, setShiftId] = useState('');
    const [otherDate, setOtherDate] = useState('');
    const [hours, setHours] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!profile?.id || !profile?.payroll_enabled) return;
        try {
            const { data: bal, error: bErr } = await supabase.rpc('get_sick_time_balance', { p_user: profile.id });
            if (bErr) throw bErr;
            setBalance(bal);
            if (bal) {
                const today = format(getTodayInCentral(), 'yyyy-MM-dd');
                const [entRes, shiftRes] = await Promise.all([
                    supabase
                        .from('sick_time_entries')
                        .select('id, used_on, hours, absent_hours')
                        .eq('user_id', profile.id)
                        .is('voided_at', null)
                        .order('used_on', { ascending: false })
                        .limit(8),
                    supabase
                        .from('shifts')
                        .select('id, title, date, start_time, end_time')
                        .eq('assigned_to', profile.id)
                        .gte('date', today)
                        .order('date')
                        .order('start_time')
                        .limit(20)
                ]);
                setEntries(entRes.data || []);
                setShifts(shiftRes.data || []);
            }
        } catch (err) {
            console.error('MySickTimeCard load error:', err);
        }
        setLoaded(true);
    }, [profile?.id, profile?.payroll_enabled]);

    useEffect(() => { load(); }, [load]);

    if (!profile?.payroll_enabled || !loaded || !balance) return null;

    const chosen = shifts.find(s => s.id === shiftId) || null;
    const chosenHours = chosen ? shiftHours(chosen) : null;

    const onShiftChange = (id) => {
        setShiftId(id);
        const s = shifts.find(x => x.id === id);
        setHours(s ? String(shiftHours(s)) : '');
        setError('');
    };

    const submit = async () => {
        setError('');
        setMessage('');
        const h = Number(hours);
        const dateStr = chosen ? chosen.date : otherDate;
        if (!dateStr) { setError('Please choose a shift or a date.'); return; }
        if (!h || h <= 0 || (h * 4) % 1 !== 0) { setError('Hours must be in quarter-hour steps, like 2 or 3.5.'); return; }
        const wholeShift = !!chosen && h >= chosenHours;
        setSaving(true);
        const { data, error: rpcErr } = await supabase.rpc('log_sick_time', {
            p_user: profile.id,
            p_used_on: dateStr,
            p_hours: h,
            p_shift_id: chosen ? chosen.id : null,
            p_release_shift: wholeShift,
            p_note: null
        });
        setSaving(false);
        if (rpcErr) { setError(rpcErr.message); return; }
        const unpaid = Number(data?.unpaid_hours || 0);
        let msg = `Recorded ${num(data?.paid_hours)} paid sick hours.`;
        if (unpaid > 0) msg += ` You had fewer sick hours available than you needed, so ${num(unpaid)} hours are unpaid.`;
        if (wholeShift) msg += ' Your shift is now open so someone else can pick it up.';
        setMessage(msg);
        setOpen(false);
        setShiftId('');
        setOtherDate('');
        setHours('');
        load();
    };

    return (
        <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>Sick Time</h3>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-700)' }}>{num(balance.available)} hrs</div>
                    <div className="text-xs text-neutral-500">available</div>
                </div>
            </div>

            {message && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--success-50)', color: 'var(--success-700)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                    {message}
                </div>
            )}

            {!open ? (
                <button
                    type="button"
                    className="btn btn-outline"
                    style={{ width: '100%', minHeight: '44px', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={() => { setOpen(true); setMessage(''); setError(''); }}
                >
                    Use sick time
                </button>
            ) : (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label text-sm">Which shift?</label>
                        <select className="form-input" style={{ minHeight: '44px' }} value={shiftId} onChange={e => onShiftChange(e.target.value)}>
                            <option value="">Another day or time (not a scheduled shift)</option>
                            {shifts.map(s => (
                                <option key={s.id} value={s.id}>
                                    {format(parseISO(s.date), 'EEE MMM d')}, {formatShift(s.start_time, 'h:mma')} - {formatShift(s.end_time, 'h:mma')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {!chosen && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Date</label>
                            <input type="date" className="form-input" style={{ minHeight: '44px' }} value={otherDate} onChange={e => setOtherDate(e.target.value)} />
                        </div>
                    )}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label text-sm">Hours you will miss</label>
                        <input type="number" inputMode="decimal" step="0.25" min="0.25" className="form-input" style={{ minHeight: '44px' }} value={hours} onChange={e => setHours(e.target.value)} />
                    </div>
                    <p className="text-xs text-neutral-500" style={{ margin: 0 }}>
                        If you need more hours than you have available, your available hours are paid and the rest is unpaid. Missing a whole shift opens it so someone else can cover it.
                    </p>
                    {error && (
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                            {error}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-outline" style={{ flex: 1, minHeight: '44px' }} onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
                        <button type="button" className="btn btn-primary" style={{ flex: 1, minHeight: '44px' }} onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            )}

            {entries.length > 0 && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--neutral-200)' }}>
                    <div className="text-xs text-neutral-500" style={{ marginBottom: '0.5rem' }}>Recent</div>
                    {entries.map(en => (
                        <div key={en.id} className="text-sm" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                            <span>{format(parseISO(en.used_on), 'MMM d, yyyy')}</span>
                            <span>
                                {num(en.hours)} hrs paid
                                {Number(en.absent_hours) > Number(en.hours) ? `, ${num(Number(en.absent_hours) - Number(en.hours))} unpaid` : ''}
                            </span>
                        </div>
                    ))}
                    <p className="text-xs text-neutral-500" style={{ marginTop: '0.5rem', marginBottom: 0 }}>To correct an entry, contact a manager.</p>
                </div>
            )}
        </div>
    );
};

export default MySickTimeCard;
