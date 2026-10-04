import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { formatShift } from '../lib/timeUtils';

const num = (n) => Number(Number(n).toFixed(2));

const shiftHours = (s) => {
    let d = (parseISO(s.end_time) - parseISO(s.start_time)) / (1000 * 60 * 60);
    if (d < 0) d += 24;
    return num(d);
};

const emptyLog = { user_id: '', used_on: '', shift_id: '', hours: '', release: false, note: '' };

const SickTimePanel = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [caregivers, setCaregivers] = useState([]);
    const [settings, setSettings] = useState({});
    const [balances, setBalances] = useState({});
    const [entries, setEntries] = useState([]);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const [setupFor, setSetupFor] = useState(null);
    const [setupForm, setSetupForm] = useState({ as_of_date: '', opening_balance: '', opening_ytd_hours: '' });

    const [logOpen, setLogOpen] = useState(false);
    const [logForm, setLogForm] = useState(emptyLog);
    const [dayShifts, setDayShifts] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const { data: users, error: uErr } = await supabase
                .from('users')
                .select('id, full_name, status')
                .eq('is_caregiver', true)
                .eq('payroll_enabled', true)
                .order('full_name');
            if (uErr) throw uErr;

            const { data: setRows, error: sErr } = await supabase.from('sick_time_settings').select('*');
            if (sErr) throw sErr;
            const byUser = {};
            (setRows || []).forEach(r => { byUser[r.user_id] = r; });

            const balPairs = await Promise.all(
                (users || []).filter(u => byUser[u.id]).map(async (u) => {
                    const { data, error: bErr } = await supabase.rpc('get_sick_time_balance', { p_user: u.id });
                    if (bErr) throw bErr;
                    return [u.id, data];
                })
            );
            const balMap = {};
            balPairs.forEach(([id, b]) => { balMap[id] = b; });

            const { data: ent, error: eErr } = await supabase
                .from('sick_time_entries')
                .select('id, user_id, used_on, hours, absent_hours, shift_id, note, created_at, voided_at, user:users!sick_time_entries_user_id_fkey(full_name), enterer:users!sick_time_entries_entered_by_fkey(full_name)')
                .order('used_on', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50);
            if (eErr) throw eErr;

            setCaregivers(users || []);
            setSettings(byUser);
            setBalances(balMap);
            setEntries(ent || []);
        } catch (err) {
            setError(err.message || 'Could not load sick time.');
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!logForm.user_id || !logForm.used_on) { setDayShifts([]); return; }
        let cancelled = false;
        supabase
            .from('shifts')
            .select('id, title, start_time, end_time, date')
            .eq('assigned_to', logForm.user_id)
            .eq('date', logForm.used_on)
            .order('start_time')
            .then(({ data }) => { if (!cancelled) setDayShifts(data || []); });
        return () => { cancelled = true; };
    }, [logForm.user_id, logForm.used_on]);

    const openSetup = (cg) => {
        const existing = settings[cg.id];
        setSetupFor(cg);
        setSetupForm({
            as_of_date: existing ? existing.as_of_date : '',
            opening_balance: existing ? String(existing.opening_balance) : '',
            opening_ytd_hours: existing ? String(existing.opening_ytd_hours) : ''
        });
        setError('');
        setMessage('');
    };

    const saveSetup = async () => {
        setError('');
        const d = setupForm.as_of_date ? parseISO(setupForm.as_of_date) : null;
        if (!d || d.getDay() !== 5) { setError('The as-of date must be a Friday (a finalized pay week end).'); return; }
        const bal = Number(setupForm.opening_balance);
        const ytd = Number(setupForm.opening_ytd_hours);
        if (setupForm.opening_balance === '' || Number.isNaN(bal) || bal < 0 || bal > 80) { setError('Opening balance must be between 0 and 80.'); return; }
        if (setupForm.opening_ytd_hours === '' || Number.isNaN(ytd) || ytd < 0) { setError('Opening year-to-date hours must be 0 or more.'); return; }
        if (settings[setupFor.id] && !window.confirm('Changing opening values changes this caregiver\'s balance. Continue?')) return;
        setSaving(true);
        const { error: upErr } = await supabase.from('sick_time_settings').upsert({
            user_id: setupFor.id,
            as_of_date: setupForm.as_of_date,
            opening_balance: bal,
            opening_ytd_hours: ytd,
            updated_at: new Date().toISOString(),
            updated_by: user?.id || null
        }, { onConflict: 'user_id' });
        setSaving(false);
        if (upErr) { setError(upErr.message); return; }
        setSetupFor(null);
        setMessage('Saved.');
        load();
    };

    const chosenShift = dayShifts.find(s => s.id === logForm.shift_id) || null;
    const chosenShiftHours = chosenShift ? shiftHours(chosenShift) : null;
    const canRelease = !!chosenShift && Number(logForm.hours) >= chosenShiftHours;

    const onShiftChange = (shiftId) => {
        const s = dayShifts.find(x => x.id === shiftId);
        setLogForm(prev => ({
            ...prev,
            shift_id: shiftId,
            hours: s ? String(shiftHours(s)) : prev.hours,
            release: !!s
        }));
    };

    const submitLog = async () => {
        setError('');
        setMessage('');
        const hours = Number(logForm.hours);
        if (!logForm.user_id) { setError('Choose a caregiver.'); return; }
        if (!logForm.used_on) { setError('Choose a date.'); return; }
        if (!hours || hours <= 0 || (hours * 4) % 1 !== 0) { setError('Hours must be in quarter-hour steps.'); return; }
        setSaving(true);
        const { data, error: rpcErr } = await supabase.rpc('log_sick_time', {
            p_user: logForm.user_id,
            p_used_on: logForm.used_on,
            p_hours: hours,
            p_shift_id: logForm.shift_id || null,
            p_release_shift: !!(logForm.shift_id && logForm.release && canRelease),
            p_note: logForm.note || null
        });
        setSaving(false);
        if (rpcErr) { setError(rpcErr.message); return; }
        const unpaid = Number(data?.unpaid_hours || 0);
        let msg = `Logged ${num(data?.paid_hours)} paid sick hrs.`;
        if (unpaid > 0) msg += ` ${num(unpaid)} hrs were beyond the available balance and are unpaid.`;
        if (logForm.shift_id && logForm.release && canRelease) msg += ' The shift is now open on the schedule.';
        setMessage(msg);
        setLogForm(emptyLog);
        setLogOpen(false);
        load();
    };

    const voidEntry = async (entry) => {
        if (!window.confirm('Void this sick time entry? The hours go back to the balance. A shift that was opened stays open.')) return;
        setError('');
        const { error: vErr } = await supabase.rpc('void_sick_time', { p_entry_id: entry.id });
        if (vErr) { setError(vErr.message); return; }
        load();
    };

    const setUpCaregivers = caregivers.filter(c => settings[c.id]);

    return (
        <div>
            {error && (
                <div className="card" style={{ borderLeft: '4px solid var(--danger-500)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                    <p className="text-sm text-danger" style={{ margin: 0 }}>{error}</p>
                </div>
            )}
            {message && (
                <div className="card" style={{ borderLeft: '4px solid var(--success-500)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                    <p className="text-sm" style={{ margin: 0 }}>{message}</p>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>Sick time balances</h4>
                <button className="btn btn-primary" disabled={setUpCaregivers.length === 0} onClick={() => { setLogOpen(o => !o); setLogForm(emptyLog); setError(''); setMessage(''); }}>
                    {logOpen ? 'Close' : 'Log sick time'}
                </button>
            </div>

            {logOpen && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Caregiver</label>
                            <select className="form-input" value={logForm.user_id} onChange={e => setLogForm({ ...emptyLog, user_id: e.target.value, used_on: logForm.used_on })}>
                                <option value="">Select...</option>
                                {setUpCaregivers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Date</label>
                            <input type="date" className="form-input" value={logForm.used_on} onChange={e => setLogForm({ ...logForm, used_on: e.target.value, shift_id: '', release: false })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Shift (optional)</label>
                            <select className="form-input" value={logForm.shift_id} onChange={e => onShiftChange(e.target.value)} disabled={dayShifts.length === 0}>
                                <option value="">{dayShifts.length === 0 ? 'No shifts that day' : 'Not tied to a shift'}</option>
                                {dayShifts.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.title} {formatShift(s.start_time, 'h:mma')} - {formatShift(s.end_time, 'h:mma')} ({shiftHours(s)} hrs)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Hours missed</label>
                            <input type="number" step="0.25" min="0.25" className="form-input" value={logForm.hours} onChange={e => setLogForm({ ...logForm, hours: e.target.value })} />
                        </div>
                    </div>
                    {chosenShift && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontSize: '0.875rem', opacity: canRelease ? 1 : 0.5 }}>
                            <input type="checkbox" checked={logForm.release && canRelease} disabled={!canRelease} onChange={e => setLogForm({ ...logForm, release: e.target.checked })} />
                            Open this shift so someone else can cover it (only when the whole shift is missed)
                        </label>
                    )}
                    <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                        <label className="form-label text-sm">Note (optional, managers only)</label>
                        <input type="text" className="form-input" value={logForm.note} onChange={e => setLogForm({ ...logForm, note: e.target.value })} />
                    </div>
                    <p className="text-xs text-neutral-500" style={{ marginTop: '0.75rem' }}>
                        If the caregiver has less balance than the hours missed, the available hours are paid and the rest is unpaid.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={submitLog} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            )}

            {setupFor && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', borderTop: '4px solid var(--primary-500)' }}>
                    <h5 style={{ marginBottom: '0.75rem' }}>Opening values for {setupFor.full_name}</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">As of (a finalized Friday)</label>
                            <input type="date" className="form-input" value={setupForm.as_of_date} onChange={e => setSetupForm({ ...setupForm, as_of_date: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Sick hours available</label>
                            <input type="number" step="0.01" min="0" max="80" className="form-input" value={setupForm.opening_balance} onChange={e => setSetupForm({ ...setupForm, opening_balance: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label text-sm">Hours worked this year to date</label>
                            <input type="number" step="0.01" min="0" className="form-input" value={setupForm.opening_ytd_hours} onChange={e => setSetupForm({ ...setupForm, opening_ytd_hours: e.target.value })} />
                        </div>
                    </div>
                    <p className="text-xs text-neutral-500" style={{ marginTop: '0.75rem' }}>
                        Hours earned from finalized pay weeks after this date are added automatically. Sick time used before this date is already reflected in the balance.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn btn-outline" onClick={() => setSetupFor(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={saveSetup} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="text-neutral-muted text-sm">Loading...</p>
            ) : caregivers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No caregivers are on formal payroll.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--neutral-100)', textAlign: 'left', borderBottom: '1px solid var(--neutral-200)' }}>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)' }}>Caregiver</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)', textAlign: 'right' }}>Available</th>
                                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-600)', textAlign: 'right' }}>Year-to-date hours</th>
                                <th style={{ padding: '0.75rem 1rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {caregivers.map(cg => {
                                const bal = balances[cg.id];
                                return (
                                    <tr key={cg.id} style={{ borderBottom: '1px solid var(--neutral-100)' }}>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                                            {cg.full_name}
                                            {cg.status !== 'active' && <span className="text-xs text-neutral-500"> (inactive)</span>}
                                        </td>
                                        {settings[cg.id] && bal ? (
                                            <>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary-700)' }}>{num(bal.available)} hrs</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--neutral-600)' }}>{num(bal.ytd_hours)}</td>
                                            </>
                                        ) : (
                                            <td colSpan={2} style={{ padding: '0.75rem 1rem', textAlign: 'right' }} className="text-neutral-muted">Not set up</td>
                                        )}
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                            <button className="btn btn-outline" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => openSetup(cg)}>
                                                {settings[cg.id] ? 'Edit opening values' : 'Set up'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <h4 style={{ margin: '2rem 0 1rem' }}>Recent entries</h4>
            {entries.length === 0 ? (
                <p className="text-neutral-muted text-sm">No sick time has been logged.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {entries.map(en => (
                        <div key={en.id} className="card" style={{ padding: '0.75rem 1rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', opacity: en.voided_at ? 0.5 : 1 }}>
                            <div>
                                <div style={{ fontWeight: 600, textDecoration: en.voided_at ? 'line-through' : 'none' }}>
                                    {en.user?.full_name || 'Unknown'} - {format(parseISO(en.used_on), 'MMM d, yyyy')}
                                </div>
                                <div className="text-sm text-neutral-muted">
                                    {num(en.hours)} paid hrs
                                    {Number(en.absent_hours) > Number(en.hours) ? `, ${num(Number(en.absent_hours) - Number(en.hours))} unpaid` : ''}
                                    {en.shift_id ? ' - tied to a shift' : ''}
                                    {en.enterer?.full_name ? ` - entered by ${en.enterer.full_name}` : ''}
                                    {en.voided_at ? ' - voided' : ''}
                                </div>
                                {en.note && <div className="text-xs text-neutral-500">{en.note}</div>}
                            </div>
                            {!en.voided_at && (
                                <button className="btn btn-outline" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => voidEntry(en)}>Void</button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SickTimePanel;
