import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Send, Check } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, eachDayOfInterval, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const AdminSchedulePage = () => {
    const [shifts, setShifts] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [availabilityResponses, setAvailabilityResponses] = useState([]);
    const [shiftTemplates, setShiftTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'availability'

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [currentShift, setCurrentShift] = useState(null);
    const [applyToWeek, setApplyToWeek] = useState(false);

    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');
    const [assignedTo, setAssignedTo] = useState(''); // UUID, 'custom', or empty string for Open Shift
    const [customAssignedName, setCustomAssignedName] = useState(''); // Holds the text for one-off caregiver

    const [formError, setFormError] = useState('');

    // Request Availability State
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [reqStartDate, setReqStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [reqEndDate, setReqEndDate] = useState(format(addWeeks(new Date(), 1), 'yyyy-MM-dd'));
    const [reqMessage, setReqMessage] = useState('Please submit your availability for next week.');
    const [requesting, setRequesting] = useState(false);

    const fetchData = async () => {
        setLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDateStr = format(monthStart, 'yyyy-MM-dd');
        const endDateStr = format(monthEnd, 'yyyy-MM-dd');

        // Fetch shifts for this week
        const shiftsData = await supabase
            .from('shifts')
            .select('*, users(full_name)')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('start_time', { ascending: true });

        // Fetch active caregivers for assignment dropdown
        const caregiversData = await supabase
            .from('users')
            .select('id, full_name')
            .eq('role', 'caregiver')
            .eq('status', 'active');

        // Fetch availability responses for this entire month (all statuses for full picture)
        const availabilityData = await supabase
            .from('availability_responses')
            .select('user_id, date, status')
            .gte('date', startDateStr)
            .lte('date', endDateStr);

        // Fetch shift templates
        const templatesData = await supabase
            .from('shift_templates')
            .select('*')
            .order('created_at', { ascending: true });

        if (shiftsData.data) setShifts(shiftsData.data);
        if (caregiversData.data) setCaregivers(caregiversData.data);
        if (availabilityData.data) setAvailabilityResponses(availabilityData.data);
        if (templatesData.data) setShiftTemplates(templatesData.data);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const openNewForm = () => {
        setIsFormOpen(true);
        setCurrentId(null);
        setCurrentShift(null);
        setTitle('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setStartTime('09:30');
        setEndTime('15:30');
        setAssignedTo('');
        setApplyToWeek(false);
    };

    const openEditForm = (shift) => {
        setIsFormOpen(true);
        setCurrentId(shift.id);
        setCurrentShift(shift);
        setTitle(shift.title);
        setDate(shift.date);
        // Extract HH:mm from ISO
        setStartTime(format(parseISO(shift.start_time), 'HH:mm'));
        setEndTime(format(parseISO(shift.end_time), 'HH:mm'));

        if (shift.custom_assigned_name) {
            setAssignedTo('custom');
            setCustomAssignedName(shift.custom_assigned_name);
        } else {
            setAssignedTo(shift.assigned_to || '');
            setCustomAssignedName('');
        }

        setApplyToWeek(false);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setFormError('');
        setCurrentShift(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        let error;

        const finalAssignedTo = assignedTo === 'custom' ? null : (assignedTo || null);
        const finalCustomName = assignedTo === 'custom' && customAssignedName.trim() !== '' ? customAssignedName.trim() : null;
        const isOpen = !finalAssignedTo && !finalCustomName;

        if (currentId) {
            // Update single existing shift
            const startIso = new Date(`${date}T${startTime}:00`).toISOString();
            const endIso = new Date(`${date}T${endTime}:00`).toISOString();
            const payload = {
                title,
                date,
                start_time: startIso,
                end_time: endIso,
                assigned_to: finalAssignedTo,
                custom_assigned_name: finalCustomName,
                is_open: isOpen
            };

            const res = await supabase.from('shifts').update(payload).eq('id', currentId);
            error = res.error;
        } else {
            // Create new shift(s)
            if (applyToWeek) {
                // Generate Mon-Sun for the week of the selected date
                const baseDate = parseISO(date);
                // get day 1 (Monday) as start of week. 0 is Sunday.
                const dayOfWeek = baseDate.getDay();
                const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

                const monday = new Date(baseDate);
                monday.setDate(baseDate.getDate() + diffToMonday);

                const shiftsToCreate = [];
                for (let i = 0; i < 7; i++) {
                    const shiftDate = new Date(monday);
                    shiftDate.setDate(monday.getDate() + i);
                    const shiftDateStr = format(shiftDate, 'yyyy-MM-dd');

                    shiftsToCreate.push({
                        title,
                        date: shiftDateStr,
                        start_time: new Date(`${shiftDateStr}T${startTime}:00`).toISOString(),
                        end_time: new Date(`${shiftDateStr}T${endTime}:00`).toISOString(),
                        assigned_to: finalAssignedTo,
                        custom_assigned_name: finalCustomName,
                        is_open: isOpen
                    });
                }
                const res = await supabase.from('shifts').insert(shiftsToCreate);
                error = res.error;
            } else {
                const startIso = new Date(`${date}T${startTime}:00`).toISOString();
                const endIso = new Date(`${date}T${endTime}:00`).toISOString();
                const payload = {
                    title,
                    date,
                    start_time: startIso,
                    end_time: endIso,
                    assigned_to: finalAssignedTo,
                    custom_assigned_name: finalCustomName,
                    is_open: isOpen
                };

                const res = await supabase.from('shifts').insert([payload]);
                error = res.error;
            }
        }

        if (error) {
            setFormError(error.message);
        } else {
            closeForm();
            fetchData();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this shift?")) return;
        const { error } = await supabase.from('shifts').delete().eq('id', id);
        if (!error) fetchData();
    };

    const handleSaveAsTemplate = async () => {
        if (!title.trim() || !startTime || !endTime) {
            setFormError('Please provide a Title, Start Time, and End Time to save a template.');
            return;
        }

        const payload = {
            title: title.trim(),
            start_time: startTime + ':00',
            end_time: endTime + ':00'
        };

        const { error } = await supabase.from('shift_templates').insert([payload]);
        if (error) {
            setFormError('Failed to save template: ' + error.message);
        } else {
            // Refresh templates without closing the form
            const templatesData = await supabase
                .from('shift_templates')
                .select('*')
                .order('created_at', { ascending: true });
            if (templatesData.data) setShiftTemplates(templatesData.data);
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm("Delete this template?")) return;
        const { error } = await supabase.from('shift_templates').delete().eq('id', id);
        if (!error) {
            setShiftTemplates(prev => prev.filter(t => t.id !== id));
        } else {
            setFormError('Failed to delete template: ' + error.message);
        }
    };

    const handleSendRequest = async (e) => {
        e.preventDefault();
        setRequesting(true);
        const { error } = await supabase.from('availability_requests').insert([{
            start_date: reqStartDate,
            end_date: reqEndDate,
            message: reqMessage,
            created_by: (await supabase.auth.getUser()).data.user.id
        }]);

        if (error) {
            alert("Error sending request: " + error.message);
        } else {
            alert("Availability request sent to all caregivers!");
            setIsRequestModalOpen(false);
        }
        setRequesting(false);
    };

    const quickAssignCaregiver = async (caregiverId, dayStr) => {
        // Find the first open shift on that day
        const openShift = shifts.find(s => s.date === dayStr && !s.assigned_to && !s.custom_assigned_name);
        if (openShift) {
            openEditForm(openShift);
            // Pre-select the caregiver
            setAssignedTo(caregiverId);
        } else {
            // No open shift: open a new shift form for that date with the caregiver pre-selected
            openNewForm();
            setDate(dayStr);
            setAssignedTo(caregiverId);
        }
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
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2>Master Schedule</h2>
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
                    {/* View toggle */}
                    <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--primary-300)', marginLeft: '0.5rem' }}>
                        <button
                            onClick={() => setViewMode('calendar')}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: viewMode === 'calendar' ? 'var(--primary-600)' : 'transparent', color: viewMode === 'calendar' ? 'white' : 'var(--primary-600)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >📅 Schedule</button>
                        <button
                            onClick={() => setViewMode('availability')}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: viewMode === 'availability' ? 'var(--primary-600)' : 'transparent', color: viewMode === 'availability' ? 'white' : 'var(--primary-600)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >👥 Availability</button>
                    </div>
                    {viewMode === 'calendar' && (
                        <>
                            <button onClick={openNewForm} className="btn btn-primary text-sm" style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                <Plus size={16} /> New Shift
                            </button>
                            <button onClick={() => setIsRequestModalOpen(true)} className="btn btn-secondary text-sm" style={{ display: 'flex', gap: '0.25rem' }}>
                                <CalendarIcon size={16} /> Request Availability
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>

            {/* Shift Edit Modal */ }
    {
        isFormOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
                <div className="card" style={{ width: '100%', maxWidth: '600px', margin: 'auto', maxHeight: 'max-content', border: '2px solid var(--primary-500)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>{currentId ? 'Edit Shift Details' : 'Create New Shift'}</h3>
                        <button type="button" onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: 'var(--neutral-500)' }}>&times;</button>
                    </div>

                    {formError && (
                        <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {formError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="text-sm font-semibold" style={{ marginRight: '0.5rem', color: 'var(--neutral-600)' }}>Templates:</span>
                            {shiftTemplates.length === 0 && <span className="text-xs text-neutral-500 italic">No templates saved yet.</span>}
                            {shiftTemplates.map(template => (
                                <div key={template.id} style={{ display: 'inline-flex', alignItems: 'center' }} className="btn btn-outline text-xs">
                                    <button
                                        type="button"
                                        style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'inherit' }}
                                        onClick={() => {
                                            setTitle(template.title);
                                            // Handle cases where time has seconds
                                            setStartTime(template.start_time.substring(0, 5));
                                            setEndTime(template.end_time.substring(0, 5));
                                        }}
                                        title={`Use template: ${template.title}`}
                                    >
                                        {template.title} ({format(parseISO(`1970-01-01T${template.start_time}`), 'h:mma').toLowerCase()} - {format(parseISO(`1970-01-01T${template.end_time}`), 'h:mma').toLowerCase()})
                                    </button>
                                    <button
                                        type="button"
                                        title={`Delete ${template.title} template`}
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        style={{ background: 'none', border: 'none', marginLeft: '0.5rem', cursor: 'pointer', padding: '0.1rem', display: 'flex', alignItems: 'center', color: 'var(--neutral-400)' }}
                                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger-500)'}
                                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--neutral-400)'}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Shift Title / Type</label>
                            <input type="text" className="form-input" placeholder="e.g. Morning Shift" value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Start Time</label>
                                <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} step="900" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">End Time</label>
                                <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} step="900" required />
                            </div>
                        </div>

                        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: assignedTo === 'custom' ? '1fr 1fr' : '1fr', gap: '1rem', alignItems: 'end' }}>
                            <div>
                                <label className="form-label">Assign To</label>
                                <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                                    <option value="">-- Open Shift (Unassigned) --</option>
                                    <option value="custom">-- 📍 Other (Manual Entry) --</option>
                                    {currentShift?.users && assignedTo === currentShift.assigned_to && !caregivers.find(c => c.id === assignedTo) && (
                                        <option value={assignedTo}>{currentShift.users.full_name || 'Caregiver'} (Currently Assigned)</option>
                                    )}
                                    {caregivers.map(cg => {
                                        const availRecord = availabilityResponses.find(r => r.user_id === cg.id && r.date === date);
                                        let availLabel = '';
                                        if (availRecord?.status === 'available') availLabel = '✓ (All Day)';
                                        else if (availRecord?.status === 'available_morning') availLabel = '✓ (Morning)';
                                        else if (availRecord?.status === 'available_evening') availLabel = '✓ (Evening)';

                                        return (
                                            <option key={cg.id} value={cg.id}>
                                                {cg.full_name || 'Unnamed Caregiver'} {availLabel}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {assignedTo === 'custom' && (
                                <div>
                                    <label className="form-label">Caregiver Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter name (e.g. John Smith)"
                                        value={customAssignedName}
                                        onChange={e => setCustomAssignedName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        {!currentId && (
                            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                                <input
                                    type="checkbox"
                                    id="applyWeek"
                                    checked={applyToWeek}
                                    onChange={e => setApplyToWeek(e.target.checked)}
                                    style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary-600)' }}
                                />
                                <label htmlFor="applyWeek" className="form-label" style={{ margin: 0, marginLeft: '0.5rem', cursor: 'pointer' }}>
                                    Create this shift for Monday-Sunday of the selected week (7 days)
                                </label>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1, minWidth: '150px' }}>Save Shift</button>
                            <button type="button" onClick={handleSaveAsTemplate} className="btn btn-secondary" style={{ flex: 1, minWidth: '150px' }}>Save Template</button>
                            <button type="button" onClick={closeForm} className="btn btn-outline" style={{ flex: 1, minWidth: '100px' }}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    {/* Request Availability Modal */ }
    {
        isRequestModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div className="card" style={{ width: '100%', maxWidth: '500px', margin: 0 }}>
                    <h3 style={{ marginBottom: '1rem' }}>Request Availability</h3>
                    <p className="text-sm text-neutral-muted" style={{ marginBottom: '1.5rem' }}>
                        Send a notification to all caregivers asking them to submit their availability for a specific date range.
                    </p>
                    <form onSubmit={handleSendRequest}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">From Date</label>
                                <input type="date" className="form-input" value={reqStartDate} onChange={e => setReqStartDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">To Date</label>
                                <input type="date" className="form-input" value={reqEndDate} onChange={e => setReqEndDate(e.target.value)} required />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label className="form-label">Notification Message</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                value={reqMessage}
                                onChange={e => setReqMessage(e.target.value)}
                                placeholder="Optional message to include..."
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={requesting}>
                                {requesting ? 'Sending...' : 'Send Request'}
                            </button>
                            <button type="button" onClick={() => setIsRequestModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    {
        viewMode === 'availability' ? (
            /* ========== AVAILABILITY MATRIX VIEW ========== */
            <div style={{ overflowX: 'auto' }}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--success-500)', display: 'inline-block' }}></span> All Day</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#60a5fa', display: 'inline-block' }}></span> Morning Only</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#a78bfa', display: 'inline-block' }}></span> Evening Only</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--danger-300)', display: 'inline-block' }}></span> Unavailable</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--neutral-200)', display: 'inline-block' }}></span> No Response</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--warning-300)', border: '2px solid var(--warning-600)', display: 'inline-block' }}></span> Open Shift</div>
                </div>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-500)' }}>Loading availability...</div>
                ) : caregivers.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-500)' }}>No active caregivers found.</div>
                ) : (
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.75rem' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 2, borderBottom: '2px solid var(--neutral-200)', minWidth: '120px', whiteSpace: 'nowrap' }}>Caregiver</th>
                                {daysInMonth.map(day => {
                                    const isToday = isSameDay(day, new Date());
                                    return (
                                        <th key={format(day, 'd')} style={{ padding: '0.25rem 0.1rem', textAlign: 'center', borderBottom: '2px solid var(--neutral-200)', minWidth: '28px', color: isToday ? 'var(--primary-600)' : 'var(--neutral-600)', fontWeight: isToday ? 700 : 500 }}>
                                            <div>{format(day, 'EEE').charAt(0)}</div>
                                            <div>{format(day, 'd')}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {caregivers.map((cg, idx) => (
                                <tr key={cg.id} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--neutral-50)' }}>
                                    <td style={{ padding: '0.4rem 0.75rem', position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--neutral-50)', zIndex: 1, fontWeight: 600, color: 'var(--neutral-700)', whiteSpace: 'nowrap', borderRight: '2px solid var(--neutral-200)' }}>
                                        {cg.full_name || 'Unnamed'}
                                    </td>
                                    {daysInMonth.map(day => {
                                        const dayStr = format(day, 'yyyy-MM-dd');
                                        const avail = availabilityResponses.find(r => r.user_id === cg.id && r.date === dayStr);
                                        const openShiftsOnDay = shifts.filter(s => s.date === dayStr && !s.assigned_to && !s.custom_assigned_name);
                                        const isToday = isSameDay(day, new Date());

                                        let bgColor = 'var(--neutral-100)';
                                        let title = 'No response';
                                        let emoji = '';
                                        if (avail?.status === 'available') { bgColor = 'var(--success-200)'; title = 'Available all day'; emoji = '✓'; }
                                        else if (avail?.status === 'available_morning') { bgColor = '#bfdbfe'; title = 'Available morning only'; emoji = 'AM'; }
                                        else if (avail?.status === 'available_evening') { bgColor = '#ddd6fe'; title = 'Available evening only'; emoji = 'PM'; }
                                        else if (avail?.status === 'unavailable') { bgColor = 'var(--danger-100)'; title = 'Unavailable'; emoji = '✗'; }

                                        const hasOpenShift = openShiftsOnDay.length > 0;
                                        const canAssign = avail && avail.status !== 'unavailable';

                                        return (
                                            <td key={dayStr} style={{ padding: '0.15rem 0.1rem', textAlign: 'center' }}>
                                                <div
                                                    title={`${cg.full_name}: ${title}${hasOpenShift ? ` | ${openShiftsOnDay.length} open shift(s)` : ''}`}
                                                    onClick={() => canAssign && hasOpenShift ? quickAssignCaregiver(cg.id, dayStr) : undefined}
                                                    style={{
                                                        width: '100%',
                                                        minWidth: '24px',
                                                        height: '28px',
                                                        borderRadius: '4px',
                                                        backgroundColor: bgColor,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        cursor: canAssign && hasOpenShift ? 'pointer' : 'default',
                                                        border: hasOpenShift ? '2px solid var(--warning-500)' : (isToday ? '2px solid var(--primary-400)' : '1px solid transparent'),
                                                        transition: 'transform 0.1s',
                                                        color: avail?.status === 'unavailable' ? 'var(--danger-700)' : 'var(--neutral-700)',
                                                    }}
                                                    onMouseEnter={e => { if (canAssign && hasOpenShift) e.currentTarget.style.transform = 'scale(1.15)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                >
                                                    {emoji}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', marginTop: '0.75rem' }}>
                    💡 Cells with an orange border have open shifts. Click on an available caregiver cell with an open shift to quickly assign them.
                </p>
            </div>
        ) : (
            /* ========== CALENDAR VIEW ========== */
            <>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--success-500)' }}></span> Assigned Shift</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--warning-500)' }}></span> Open Shift</div>
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
                                                    const isAssigned = !!shift.assigned_to || !!shift.custom_assigned_name;
                                                    const cardClass = isAssigned ? 'shift-assigned' : 'shift-open';

                                                    return (
                                                        <div key={shift.id} className={`shift-card-mini ${cardClass}`} onClick={() => openEditForm(shift)}>
                                                            <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <span>{shift.title}</span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(shift.id); }}
                                                                    style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: '0.1rem' }}
                                                                    title="Delete Shift"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                            <div style={{ color: 'var(--neutral-600)', marginBottom: '0.2rem', marginTop: '0.2rem', fontSize: '0.7rem' }}>
                                                                {format(parseISO(shift.start_time), 'h:mma').toLowerCase()} - {format(parseISO(shift.end_time), 'h:mma').toLowerCase()}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: isAssigned ? 'var(--success-700)' : 'var(--warning-700)', fontWeight: 600 }}>
                                                                {isAssigned ? (shift.users?.full_name || shift.custom_assigned_name || 'Caregiver') : 'Open Shift'}
                                                            </div>
                                                            {!isAssigned && (
                                                                <div style={{ marginTop: '0.2rem', fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                                                                    {availabilityResponses.filter(r => r.date === dayStr).length} available
                                                                </div>
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
            </>
            )}
        </div>
    );
};

export default AdminSchedulePage;
