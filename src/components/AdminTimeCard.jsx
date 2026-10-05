import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays, addDays, parse } from 'date-fns';

export const getWeekEndingFriday = (dateInput) => {
    const d = typeof dateInput === 'string'
        ? parse(dateInput, 'yyyy-MM-dd', new Date())
        : new Date(dateInput);
    const day = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const daysUntilFriday = (5 - day + 7) % 7;
    return addDays(d, daysUntilFriday);
};

const AdminTimeCard = () => {
    const { user, profile } = useAuth();
    const currentUserId = user?.id || profile?.id;

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const [workDate, setWorkDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [hours, setHours] = useState('');
    const [note, setNote] = useState('');
    const [confirmingVoidId, setConfirmingVoidId] = useState(null);
    const [voidingId, setVoidingId] = useState(null);

    const fetchEntries = useCallback(async () => {
        if (!currentUserId) return;
        setLoading(true);
        setError('');
        const startDate = format(subDays(new Date(), 28), 'yyyy-MM-dd');
        const { data, error: fetchErr } = await supabase
            .from('admin_time_entries')
            .select('id, work_date, hours, note, voided_at')
            .eq('user_id', currentUserId)
            .is('voided_at', null)
            .gte('work_date', startDate)
            .order('work_date', { ascending: false });

        if (fetchErr) {
            setError(fetchErr.message || 'Error loading admin time entries.');
        } else {
            setEntries(data || []);
        }
        setLoading(false);
    }, [currentUserId]);

    useEffect(() => {
        if (currentUserId) {
            fetchEntries();
        }
    }, [currentUserId, fetchEntries]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!workDate) {
            setError('Please select a date.');
            return;
        }

        const numHours = Number(hours);
        if (!numHours || numHours < 0.25 || numHours > 24 || (numHours * 4) % 1 !== 0) {
            setError('Hours must be between 0.25 and 24 in quarter-hour steps.');
            return;
        }

        if (!note.trim()) {
            setError('Please enter a note describing what you worked on.');
            return;
        }

        setSaving(true);
        const { error: rpcErr } = await supabase.rpc('log_admin_time', {
            p_work_date: workDate,
            p_hours: numHours,
            p_note: note.trim()
        });
        setSaving(false);

        if (rpcErr) {
            setError(rpcErr.message || 'Error logging admin time.');
            return;
        }

        setHours('');
        setNote('');
        setMessage('Admin time logged successfully.');
        setConfirmingVoidId(null);
        await fetchEntries();
    };

    const handleVoid = async (id) => {
        setError('');
        setMessage('');
        setVoidingId(id);
        const { error: vErr } = await supabase.rpc('void_admin_time', { p_id: id });
        setVoidingId(null);
        setConfirmingVoidId(null);

        if (vErr) {
            setError(vErr.message || 'Error voiding admin time.');
            return;
        }

        setMessage('Admin time voided.');
        await fetchEntries();
    };

    const groups = useMemo(() => {
        const map = new Map();
        for (const entry of entries) {
            const friday = getWeekEndingFriday(entry.work_date);
            const key = format(friday, 'yyyy-MM-dd');
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    friday,
                    label: `Week ending ${format(friday, 'MMM d')}`,
                    totalHours: 0,
                    entries: []
                });
            }
            const g = map.get(key);
            g.entries.push(entry);
            g.totalHours = Number((g.totalHours + Number(entry.hours)).toFixed(2));
        }
        return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
    }, [entries]);

    if (!currentUserId) return null;

    return (
        <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Admin Time</h3>
            <p className="text-sm text-neutral-muted" style={{ marginTop: '0.25rem', marginBottom: '1rem' }}>
                Hours you worked outside a scheduled shift, such as recruitment. Included in your payroll text.
            </p>

            {error && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                    {error}
                </div>
            )}

            {message && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--success-50)', color: 'var(--success-700)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: '0 0 160px' }}>
                        <label className="form-label text-sm">Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={workDate}
                            onChange={e => setWorkDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: '0 0 110px' }}>
                        <label className="form-label text-sm">Hours</label>
                        <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            max="24"
                            className="form-input"
                            placeholder="e.g. 1.5"
                            value={hours}
                            onChange={e => setHours(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
                        <label className="form-label text-sm">Note</label>
                        <input
                            type="text"
                            maxLength={200}
                            className="form-input"
                            placeholder="What did you work on?"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                        style={{ height: '42px', padding: '0 1.25rem', whiteSpace: 'nowrap' }}
                    >
                        {saving ? 'Logging...' : 'Log time'}
                    </button>
                </div>
            </form>

            <div style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-700)', marginBottom: '0.75rem' }}>
                    Recent Admin Time
                </h4>

                {loading ? (
                    <p className="text-neutral-muted text-sm">Loading admin time entries...</p>
                ) : entries.length === 0 ? (
                    <p className="text-neutral-muted text-sm" style={{ margin: 0 }}>
                        No admin time logged in the last 4 weeks.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {groups.map(group => (
                            <div key={group.key} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--neutral-200)' }}>
                                <div style={{ backgroundColor: 'var(--neutral-100)', padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-700)' }}>
                                    <span>{group.label}</span>
                                    <span style={{ color: 'var(--primary-700)' }}>{group.totalHours} hrs</span>
                                </div>
                                <div>
                                    {group.entries.map((entry, idx) => (
                                        <div
                                            key={entry.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '0.6rem 0.75rem',
                                                borderTop: idx > 0 ? '1px solid var(--neutral-100)' : 'none',
                                                fontSize: '0.875rem',
                                                backgroundColor: 'white'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                                                <span style={{ fontWeight: 500, minWidth: '95px' }}>
                                                    {format(parse(entry.work_date, 'yyyy-MM-dd', new Date()), 'EEE, MMM d')}
                                                </span>
                                                <span style={{ fontWeight: 600, color: 'var(--primary-700)', minWidth: '65px' }}>
                                                    {Number(entry.hours).toFixed(2)} hrs
                                                </span>
                                                <span style={{ color: 'var(--neutral-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.note}>
                                                    {entry.note}
                                                </span>
                                            </div>
                                            <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                                                {confirmingVoidId === entry.id ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                                                        <span style={{ color: 'var(--danger-600)', fontWeight: 500 }}>Void?</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger-300)', color: 'var(--danger-700)' }}
                                                            onClick={() => handleVoid(entry.id)}
                                                            disabled={voidingId === entry.id}
                                                        >
                                                            {voidingId === entry.id ? 'Voiding...' : 'Yes'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                            onClick={() => setConfirmingVoidId(null)}
                                                        >
                                                            No
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline"
                                                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                                        onClick={() => setConfirmingVoidId(entry.id)}
                                                    >
                                                        Void
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminTimeCard;
