import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Send, Check, MessageSquare, Printer, Lock } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, subDays, isSameDay, eachDayOfInterval, addWeeks, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const AdminSchedulePage = () => {
    // Generate time options in 15-minute increments (00:00 - 23:45)
    const timeOptions = [];
    for (let h = 0; h < 24; h++) {
        for (let m of [0, 15, 30, 45]) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const val = `${hh}:${mm}`;
            const label = new Date(`1970-01-01T${val}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            timeOptions.push({ val, label });
        }
    }
    const [shifts, setShifts] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [availabilityResponses, setAvailabilityResponses] = useState([]);
    const [shiftTemplates, setShiftTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    const [currentDate, setCurrentDate] = useState(new Date());

    // Initialize view mode from URL to persist across reloads
    const [viewMode, setViewModeState] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('view') === 'availability' ? 'availability' : 'calendar';
    });

    // Helper to update both state and URL
    const setViewMode = (mode) => {
        setViewModeState(mode);
        const params = new URLSearchParams(window.location.search);
        params.set('view', mode);
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    };

    const [filterCaregiverId, setFilterCaregiverId] = useState(''); // Specific caregiver or empty for all

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

    // Request Availability Modal State
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [reqStartDate, setReqStartDate] = useState('');
    const [reqEndDate, setReqEndDate] = useState('');
    const [reqMessage, setReqMessage] = useState('');
    const [reqTargetUsers, setReqTargetUsers] = useState([]); // [] = all caregivers
    const [requesting, setRequesting] = useState(false);

    // Cell hover state (availability matrix popup)
    const [hoveredShiftId, setHoveredShiftId] = useState(null);
    const [hoveredAvailCell, setHoveredAvailCell] = useState(null);

    // Payroll lock state: array of { startStr, endStr } locked date ranges
    const [lockedRanges, setLockedRanges] = useState([]);

    // Bulk Operations State
    const [selectedShiftIds, setSelectedShiftIds] = useState([]);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [bulkAssignedTo, setBulkAssignedTo] = useState('');
    const [bulkCustomName, setBulkCustomName] = useState('');
    const [bulkSubmitting, setBulkSubmitting] = useState(false);

    const toggleShiftSelection = (e, shiftId, locked) => {
        e.stopPropagation();
        if (locked) return;
        setSelectedShiftIds(prev =>
            prev.includes(shiftId) ? prev.filter(id => id !== shiftId) : [...prev, shiftId]
        );
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedShiftIds.length} selected shift(s)?`)) return;
        const { error } = await supabase.from('shifts').delete().in('id', selectedShiftIds);
        if (!error) {
            setSelectedShiftIds([]);
            fetchData();
        } else {
            alert('Error deleting shifts: ' + error.message);
        }
    };

    const handleBulkAssignSubmit = async (e) => {
        e.preventDefault();
        setBulkSubmitting(true);

        const finalAssignedTo = bulkAssignedTo === 'custom' ? null : (bulkAssignedTo || null);
        const finalCustomName = bulkAssignedTo === 'custom' && bulkCustomName.trim() !== '' ? bulkCustomName.trim() : null;
        const isOpen = !finalAssignedTo && !finalCustomName;

        const payload = {
            assigned_to: finalAssignedTo,
            custom_assigned_name: finalCustomName,
            is_open: isOpen
        };

        const { error } = await supabase.from('shifts').update(payload).in('id', selectedShiftIds);

        setBulkSubmitting(false);
        if (!error) {
            setIsBulkAssignModalOpen(false);
            setSelectedShiftIds([]);
            fetchData();
        } else {
            alert('Error assigning shifts: ' + error.message);
        }
    };

    const fetchData = async () => {
        setLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);

        // Fetch boundaries that cover the full calendar weeks
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

        const startDateStr = format(calendarStart, 'yyyy-MM-dd');
        const endDateStr = format(calendarEnd, 'yyyy-MM-dd');

        // Fetch shifts for this range
        const shiftsData = await supabase
            .from('shifts')
            .select('*, users(full_name, first_name)')
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('start_time', { ascending: true });

        // Fetch active caregivers for assignment dropdown
        const caregiversData = await supabase
            .from('users')
            .select('id, full_name, first_name, last_name')
            .eq('is_caregiver', true)
            .eq('status', 'active');

        // Fetch availability responses for this entire month (all statuses for full picture)
        const availabilityData = await supabase
            .from('availability_responses')
            .select('user_id, date, status, notes')
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

        // Fetch confirmed payroll reports and derive locked date ranges
        const { data: payrollData } = await supabase
            .from('payroll_reports')
            .select('end_date')
            .eq('status', 'confirmed');

        if (payrollData) {
            const ranges = payrollData.map(r => ({
                // Lock range: prior Friday (end_date - 7) through Thursday (end_date - 1)
                startStr: format(subDays(parseISO(r.end_date), 7), 'yyyy-MM-dd'),
                endStr: format(subDays(parseISO(r.end_date), 1), 'yyyy-MM-dd')
            }));
            setLockedRanges(ranges);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    // Helper: check if a date string falls within any confirmed payroll lock range
    const isDateLocked = (dateStr) =>
        lockedRanges.some(r => dateStr >= r.startStr && dateStr <= r.endStr);

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
        if (isDateLocked(shift.date)) {
            alert(`This shift on ${shift.date} is locked because it falls within a confirmed payroll period.\n\nTo edit it, an admin must first reinstate the payroll report from the Payroll page.`);
            return;
        }
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

        // Warn if assigning someone who marked themselves unavailable
        if (finalAssignedTo) {
            const availRecord = availabilityResponses.find(r => r.user_id === finalAssignedTo && r.date === date);
            if (availRecord?.status === 'unavailable') {
                const caregiverName = caregivers.find(c => c.id === finalAssignedTo)?.full_name || 'This caregiver';
                const confirmed = window.confirm(
                    `⚠️ Availability conflict\n\n${caregiverName} has marked themselves UNAVAILABLE on ${date}.\n\nDo you want to save this shift anyway ? `
                );
                if (!confirmed) return;
            }
        }

        if (currentId) {
            const startIso = new Date(`${date}T${startTime}:00`).toISOString();
            const endIso = new Date(`${date}T${endTime}:00`).toISOString();

            // Check for overlaps (excluding current shift)
            const overlappingShift = shifts.find(s => {
                if (s.id === currentId) return false;
                if (s.date !== date) return false;
                return (startIso < s.end_time && endIso > s.start_time);
            });

            if (overlappingShift) {
                const confirmed = window.confirm(
                    `⚠️ Shift Overlap Detected\n\nThere is already a shift scheduled on ${date} that overlaps with this time.\n\nDo you want to create/update this shift anyway and allow them to overlap?`
                );
                if (!confirmed) return;
            }

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
                // Generate Sun-Sat for the week of the selected date
                const baseDate = parseISO(date);
                const dayOfWeek = baseDate.getDay();
                const sunday = new Date(baseDate);
                sunday.setDate(baseDate.getDate() - dayOfWeek);

                const shiftsToCreate = [];
                let hasOverlap = false;

                for (let i = 0; i < 7; i++) {
                    const shiftDate = new Date(sunday);
                    shiftDate.setDate(sunday.getDate() + i);
                    const shiftDateStr = format(shiftDate, 'yyyy-MM-dd');
                    const startIso = new Date(`${shiftDateStr}T${startTime}:00`).toISOString();
                    const endIso = new Date(`${shiftDateStr}T${endTime}:00`).toISOString();

                    // Check for overlap strictly
                    const overlap = shifts.find(s => s.date === shiftDateStr && startIso < s.end_time && endIso > s.start_time);
                    if (overlap) {
                        hasOverlap = true;
                        break;
                    }

                    shiftsToCreate.push({
                        title,
                        date: shiftDateStr,
                        start_time: startIso,
                        end_time: endIso,
                        assigned_to: finalAssignedTo,
                        custom_assigned_name: finalCustomName,
                        is_open: isOpen
                    });
                }

                if (hasOverlap) {
                    setFormError("Cannot create a full week of shifts because one or more days already have overlapping shifts. Please create them individually.");
                    return;
                }

                const res = await supabase.from('shifts').insert(shiftsToCreate);
                error = res.error;
            } else {
                const startIso = new Date(`${date}T${startTime}:00`).toISOString();
                const endIso = new Date(`${date}T${endTime}:00`).toISOString();

                // Check for overlaps for new single shift
                const overlappingShift = shifts.find(s => s.date === date && startIso < s.end_time && endIso > s.start_time);

                if (overlappingShift) {
                    const confirmed = window.confirm(
                        `⚠️ Shift Overlap Detected\n\nThere is already a shift scheduled on ${date} that overlaps with this time.\n\nDo you want to create this shift anyway and allow them to overlap?`
                    );
                    if (!confirmed) return;
                }

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
            target_user_ids: reqTargetUsers.length > 0 ? reqTargetUsers : null,
            created_by: (await supabase.auth.getUser()).data.user.id
        }]);

        if (error) {
            alert("Error sending request: " + error.message);
        } else {
            alert(`Availability request sent to ${reqTargetUsers.length > 0 ? reqTargetUsers.length + " caregiver(s)" : "all caregivers"}!`);
            setIsRequestModalOpen(false);
            setReqTargetUsers([]); // reset
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

    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Top Row: Title, Month Nav, View Toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ margin: 0 }}>Master Schedule</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: '0.2rem' }}>
                            <button onClick={prevMonth} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--neutral-600)' }}>
                                <ChevronLeft size={20} />
                            </button>
                            <h3 style={{ margin: 0, minWidth: '160px', textAlign: 'center', fontSize: '1.1rem' }}>
                                {format(currentDate, 'MMMM yyyy')}
                            </h3>
                            <button onClick={nextMonth} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--neutral-600)' }}>
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <button onClick={goToToday} className="btn btn-outline text-sm" style={{ padding: '0.4rem 0.75rem' }}>
                            Today
                        </button>
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
                    </div>
                </div>

                {/* Bottom Row: Actions (Only on Calendar View) */}
                {viewMode === 'calendar' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label className="text-sm font-semibold text-primary" style={{ whiteSpace: 'nowrap' }}>Filter:</label>
                            <select
                                className="form-input"
                                style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', width: 'auto', minWidth: '220px', backgroundColor: 'white' }}
                                value={filterCaregiverId}
                                onChange={(e) => setFilterCaregiverId(e.target.value)}
                            >
                                <option value="">All Caregivers</option>
                                <optgroup label="Individuals">
                                    {caregivers.map(cg => (
                                        <option key={cg.id} value={cg.id}>{cg.full_name || 'Unnamed'}'s Schedule</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setIsRequestModalOpen(true)} className="btn btn-outline text-sm" style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'white' }}>
                                <CalendarIcon size={16} /> Request Availability
                            </button>
                            <button onClick={() => window.print()} className="btn btn-outline text-sm" style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'white' }}>
                                <Printer size={16} /> Print
                            </button>
                            <button onClick={openNewForm} className="btn btn-primary text-sm" style={{ display: 'flex', gap: '0.25rem' }}>
                                <Plus size={16} /> New Shift
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Shift Edit Modal */}
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

                            {currentShift?.trade_notes && (
                                <div style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <span>🔄</span>
                                    <div>
                                        <strong>Trade Notation:</strong>
                                        <div style={{ marginTop: '0.2rem' }}>{currentShift.trade_notes}</div>
                                    </div>
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
                                                title={`Use template: ${template.title} `}
                                            >
                                                {template.title} ({format(parseISO(`1970-01-01T${template.start_time.trim()}`), 'h:mma').toLowerCase()} - {format(parseISO(`1970-01-01T${template.end_time.trim()}`), 'h:mma').toLowerCase()})
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
                                        <select className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} required>
                                            {timeOptions.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End Time</label>
                                        <select className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} required>
                                            {timeOptions.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                                        </select>
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
                                                let dot = '';
                                                if (availRecord?.status === 'available') dot = '🟢';
                                                else if (availRecord?.status === 'available_morning') dot = '🟡 AM';
                                                else if (availRecord?.status === 'available_evening') dot = '🟡 PM 🌃';
                                                else if (availRecord?.status === 'unavailable') dot = '🔴';

                                                return (
                                                    <option key={cg.id} value={cg.id}>
                                                        {dot ? `${dot} ` : ''}{cg.full_name || 'Unnamed Caregiver'}
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
                                            Create this shift for Sunday–Saturday of the selected week (7 days)
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

            {/* Request Availability Modal */}
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
                                    <label className="form-label">Send To</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--neutral-300)', padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                                            <input
                                                type="checkbox"
                                                checked={reqTargetUsers.length === 0}
                                                onChange={() => setReqTargetUsers([])}
                                            />
                                            All Caregivers (Default)
                                        </label>
                                        <hr style={{ margin: '0.2rem 0', borderColor: 'var(--neutral-200)', borderStyle: 'solid', borderWidth: '1px 0 0 0' }} />
                                        {caregivers.map(cg => (
                                            <label key={cg.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={reqTargetUsers.includes(cg.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setReqTargetUsers(prev => [...prev, cg.id]);
                                                        } else {
                                                            setReqTargetUsers(prev => prev.filter(id => id !== cg.id));
                                                        }
                                                    }}
                                                />
                                                {cg.full_name || 'Unnamed'}
                                            </label>
                                        ))}
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
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', marginBottom: '1rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--success-500)', border: '1.5px solid var(--success-600)', display: 'inline-block' }}></span> All Day</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#bfdbfe', border: '1.5px solid #3b82f6', display: 'inline-block' }}></span> Morning Only</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#ddd6fe', border: '1.5px solid #7c3aed', display: 'inline-block' }}></span> Evening Only</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--danger-500)', display: 'inline-block' }}></span> Unavailable</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--neutral-100)', border: '1.5px solid var(--neutral-300)', display: 'inline-block' }}></span> No Response</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ width: 18, height: 18, borderRadius: 3, backgroundColor: 'transparent', border: '3px solid var(--warning-500)', display: 'inline-block' }}></span>
                                Open Shift Available (click to assign)
                            </div>
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
                                            {daysInMonth.map((day, dayIdx) => {
                                                const dayStr = format(day, 'yyyy-MM-dd');
                                                const avail = availabilityResponses.find(r => r.user_id === cg.id && r.date === dayStr);
                                                const openShiftsOnDay = shifts.filter(s => s.date === dayStr && !s.assigned_to && !s.custom_assigned_name);
                                                const isToday = isSameDay(day, new Date());

                                                let bgColor = 'repeating-linear-gradient(45deg, var(--neutral-50), var(--neutral-50) 5px, var(--neutral-100) 5px, var(--neutral-100) 10px)'; // Hatching for none
                                                let title = 'No response';
                                                let emoji = '';

                                                if (avail?.status === 'available') { bgColor = 'var(--success-500)'; title = 'Available all day'; emoji = '✓'; }
                                                else if (avail?.status === 'available_morning') { bgColor = '#bfdbfe'; title = 'Available morning only'; emoji = 'AM'; }
                                                else if (avail?.status === 'available_evening') { bgColor = '#ddd6fe'; title = 'Available evening only'; emoji = 'PM'; }
                                                else if (avail?.status === 'unavailable') { bgColor = 'var(--danger-500)'; title = 'Unavailable'; emoji = ''; }

                                                const hasNote = !!avail?.notes;
                                                if (hasNote) {
                                                    title += ` | Note: "${avail.notes}"`;
                                                }

                                                const validOpenShifts = openShiftsOnDay.filter(shift => {
                                                    const shiftHour = new Date(shift.start_time).getHours();
                                                    if (!avail || avail.status === 'unavailable') return false;
                                                    if (avail.status === 'available') return true;
                                                    if (avail.status === 'available_morning' && shiftHour < 12) return true;
                                                    if (avail.status === 'available_evening' && shiftHour >= 12) return true;
                                                    return false;
                                                });
                                                const hasValidOpenShift = validOpenShifts.length > 0;
                                                const canAssign = avail && avail.status !== 'unavailable';
                                                const cellId = `${cg.id}_${dayStr}`;

                                                // Check if this specific cell is currently hovered to elevate its td's z-index
                                                const isCellHovered = hoveredAvailCell === cellId;

                                                return (
                                                    <td key={dayStr} style={{ padding: '0.15rem 0.1rem', textAlign: 'center', position: 'relative', zIndex: isCellHovered ? 50 : 1 }}>
                                                        <div
                                                            title={`${cg.full_name}: ${title}${hasValidOpenShift ? ` | ${validOpenShifts.length} matching open shift(s)` : ''}`}
                                                            style={{
                                                                width: '100%',
                                                                minWidth: '24px',
                                                                height: '28px',
                                                                borderRadius: '4px',
                                                                background: bgColor,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 700,
                                                                cursor: canAssign ? 'pointer' : 'default',
                                                                border: hasValidOpenShift ? '2px solid var(--warning-500)' : (isToday ? '2px solid var(--primary-400)' : '1px solid transparent'),
                                                                transition: 'transform 0.1s',
                                                                color: avail?.status === 'unavailable' ? 'white' : 'var(--neutral-800)',
                                                                position: 'relative'
                                                            }}
                                                            onMouseEnter={e => {
                                                                if (canAssign) {
                                                                    e.currentTarget.style.transform = 'scale(1.15)';
                                                                    setHoveredAvailCell(cellId);
                                                                }
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                                setHoveredAvailCell(null);
                                                            }}
                                                        >
                                                            {emoji}
                                                            {hasNote && (
                                                                <MessageSquare
                                                                    size={10}
                                                                    fill="currentColor"
                                                                    style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: 'white', borderRadius: '50%', padding: '1px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', color: 'var(--primary-600)' }}
                                                                />
                                                            )}
                                                            {hoveredAvailCell === cellId && (
                                                                <div
                                                                    style={{
                                                                        position: 'absolute',
                                                                        ...(idx < 4 ? { top: '100%', paddingTop: '0.4rem' } : { bottom: '100%', paddingBottom: '0.4rem' }),
                                                                        ...(dayIdx < 4
                                                                            ? { left: '0', transform: 'none' }
                                                                            : { left: '50%', transform: 'translateX(-50%)' }),
                                                                        zIndex: 50,
                                                                        width: '240px'
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <div
                                                                        className="card"
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.6rem',
                                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                                                                            cursor: 'default',
                                                                            border: '1px solid var(--primary-200)',
                                                                            backgroundColor: 'var(--bg-app)',
                                                                            margin: 0,
                                                                            textAlign: 'left'
                                                                        }}
                                                                    >
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--neutral-200)', paddingBottom: '0.25rem', color: 'var(--primary-700)' }}>
                                                                            {cg.full_name} ({format(day, 'MMM d')})
                                                                        </div>

                                                                        {validOpenShifts.length === 0 ? (
                                                                            <div style={{ color: 'var(--neutral-500)', fontSize: '0.7rem', padding: '0.25rem', lineHeight: 1.4 }}>
                                                                                {openShiftsOnDay.length > 0
                                                                                    ? "No open shifts match this caregiver's availability."
                                                                                    : "No open shifts on this day."}
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '160px', overflowY: 'auto' }}>
                                                                                {validOpenShifts.map(shift => (
                                                                                    <button
                                                                                        key={shift.id}
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            const { error } = await supabase.from('shifts').update({ assigned_to: cg.id }).eq('id', shift.id);
                                                                                            if (!error) {
                                                                                                setShifts(prevShifts => prevShifts.map(s => {
                                                                                                    if (s.id === shift.id) {
                                                                                                        return { ...s, assigned_to: cg.id, users: { full_name: cg.full_name, first_name: cg.first_name } };
                                                                                                    }
                                                                                                    return s;
                                                                                                }));
                                                                                                setHoveredAvailCell(null);
                                                                                            } else {
                                                                                                alert('Error assigning shift: ' + error.message);
                                                                                            }
                                                                                        }}
                                                                                        title={`Assign to ${shift.title}`}
                                                                                        style={{
                                                                                            padding: '0.4rem',
                                                                                            fontSize: '0.75rem',
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            alignItems: 'flex-start',
                                                                                            gap: '0.2rem',
                                                                                            border: '1px solid var(--neutral-200)',
                                                                                            background: 'white',
                                                                                            borderRadius: 'var(--radius-sm)',
                                                                                            cursor: 'pointer',
                                                                                            width: '100%',
                                                                                            color: 'var(--neutral-800)'
                                                                                        }}
                                                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-50)'}
                                                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                                                                    >
                                                                                        <div style={{ fontWeight: 600 }}>{shift.title}</div>
                                                                                        <div style={{ fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                                                                                            {format(parseISO(shift.start_time), 'h:mma').toLowerCase()} - {format(parseISO(shift.end_time), 'h:mma').toLowerCase()}
                                                                                        </div>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        <div style={{ borderTop: '1px solid var(--neutral-200)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setHoveredAvailCell(null);
                                                                                    openNewForm();
                                                                                    setDate(dayStr);
                                                                                    setAssignedTo(cg.id);
                                                                                }}
                                                                                style={{
                                                                                    padding: '0.3rem',
                                                                                    fontSize: '0.7rem',
                                                                                    width: '100%',
                                                                                    background: 'transparent',
                                                                                    border: 'none',
                                                                                    color: 'var(--primary-600)',
                                                                                    cursor: 'pointer',
                                                                                    fontWeight: 600,
                                                                                    textAlign: 'center'
                                                                                }}
                                                                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                                                            >
                                                                                + Create New Shift
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
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
                            💡 Hover over any available caregiver cell to view and assign open shifts for that day.
                        </p>
                    </div>
                ) : (
                    /* ========== CALENDAR VIEW ========== */
                    <>
                        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--success-500)' }}></span> Assigned Shift</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: 'var(--warning-500)' }}></span> Open Shift</div>
                        </div>

                        {selectedShiftIds.length > 0 && (
                            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: 'var(--primary-600)', color: 'white', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                <div style={{ fontWeight: 600 }}>
                                    {selectedShiftIds.length} shift(s) selected
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button onClick={() => setIsBulkAssignModalOpen(true)} className="btn" style={{ backgroundColor: 'white', color: 'var(--primary-700)', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                                        Assign / Reassign
                                    </button>
                                    <button onClick={handleBulkDelete} className="btn" style={{ backgroundColor: 'var(--danger-500)', color: 'white', border: '1px solid var(--danger-400)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                                        Delete Selected
                                    </button>
                                    <button onClick={() => setSelectedShiftIds([])} className="btn" style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

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
                                        {calendarDays.map(day => {
                                            const dayStr = format(day, 'yyyy-MM-dd');
                                            let dayShifts = shifts.filter(s => s.date === dayStr);

                                            if (filterCaregiverId) {
                                                dayShifts = dayShifts.filter(s => s.assigned_to === filterCaregiverId);
                                            }

                                            const isTodayDay = isSameDay(day, new Date());
                                            const isCurrentMonthDay = isSameMonth(day, currentDate);

                                            return (
                                                <div
                                                    key={dayStr}
                                                    className={`calendar-day-cell ${isTodayDay ? 'is-today' : ''} ${!isCurrentMonthDay ? 'is-outside-month' : ''} `}
                                                    style={{ gridColumn: 'auto', cursor: 'pointer', backgroundColor: !isCurrentMonthDay ? 'var(--neutral-50)' : (filterCaregiverId ? '#fafcff' : 'transparent'), opacity: !isCurrentMonthDay ? 0.7 : 1 }}
                                                    onClick={(e) => {
                                                        // Only trigger if clicking the cell itself or the date label, not clicking inside a shift card
                                                        if (e.target === e.currentTarget || e.target.closest('.calendar-date-label')) {
                                                            openNewForm();
                                                            setDate(dayStr);
                                                            if (filterCaregiverId) setAssignedTo(filterCaregiverId);
                                                        }
                                                    }}
                                                >                                                  <div className="calendar-date-label">
                                                        <span>{format(day, 'd')}</span>
                                                        {isTodayDay && <span style={{ fontSize: '0.7rem', color: 'var(--primary-600)', backgroundColor: 'var(--primary-100)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Today</span>}
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {dayShifts.map(shift => {
                                                            const isAssigned = !!shift.assigned_to || !!shift.custom_assigned_name;
                                                            const locked = isDateLocked(shift.date);
                                                            const cardClass = isAssigned ? 'shift-assigned' : 'shift-open';

                                                            const shiftHour = new Date(shift.start_time).getHours();
                                                            const validCaregivers = caregivers.filter(cg => {
                                                                const avail = availabilityResponses.find(r => r.user_id === cg.id && r.date === dayStr);
                                                                if (!avail || avail.status === 'unavailable') return false;
                                                                if (avail.status === 'available') return true;
                                                                if (avail.status === 'available_morning' && shiftHour < 12) return true;
                                                                if (avail.status === 'available_evening' && shiftHour >= 12) return true;
                                                                return false;
                                                            });

                                                            return (
                                                                <div
                                                                    key={shift.id}
                                                                    className={`shift-card-mini ${cardClass}`}
                                                                    onClick={() => openEditForm(shift)}
                                                                    onMouseEnter={() => !isAssigned && setHoveredShiftId(shift.id)}
                                                                    onMouseLeave={() => setHoveredShiftId(null)}
                                                                    style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', opacity: locked ? 0.65 : 1, cursor: locked ? 'not-allowed' : 'pointer', position: 'relative' }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.2rem' }}>
                                                                        <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'flex-start' }}>
                                                                            {!locked && (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedShiftIds.includes(shift.id)}
                                                                                    onChange={(e) => toggleShiftSelection(e, shift.id, locked)}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    style={{ marginTop: '0.15rem', cursor: 'pointer', accentColor: 'var(--primary-600)', flexShrink: 0 }}
                                                                                />
                                                                            )}
                                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isAssigned ? 'var(--success-700)' : 'var(--warning-700)', lineHeight: 1.2, wordBreak: 'break-word' }}>
                                                                                {isAssigned ? (shift.users?.first_name || shift.users?.full_name || shift.custom_assigned_name || 'Caregiver') : '🚨 Open Shift'}
                                                                            </div>
                                                                        </div>
                                                                        {locked ? (
                                                                            <Lock size={11} style={{ color: 'var(--neutral-400)', flexShrink: 0, marginTop: '0.1rem' }} title="Locked: payroll confirmed" />
                                                                        ) : (
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleDelete(shift.id); }}
                                                                                style={{ background: 'none', border: 'none', color: 'var(--danger-500)', cursor: 'pointer', padding: '0.1rem', flexShrink: 0 }}
                                                                                title="Delete Shift"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontWeight: 500, color: 'var(--neutral-800)', fontSize: '0.75rem', lineHeight: 1.2, wordBreak: 'break-word' }}>
                                                                        {shift.title}
                                                                    </div>
                                                                    <div style={{ color: 'var(--neutral-500)', fontSize: '0.7rem', fontWeight: 500 }}>
                                                                        {format(parseISO(shift.start_time), 'h:mma').toLowerCase()} - {format(parseISO(shift.end_time), 'h:mma').toLowerCase()}
                                                                    </div>
                                                                    {shift.trade_notes && (
                                                                        <div style={{ marginTop: '0.2rem', fontSize: '0.65rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                                                                            🔄 Shift Traded
                                                                        </div>
                                                                    )}
                                                                    {!isAssigned && (
                                                                        <>
                                                                            <div style={{ marginTop: '0.2rem', fontSize: '0.65rem', color: 'var(--neutral-500)' }}>
                                                                                {validCaregivers.length === 1 ? '1 caregiver available' : `${validCaregivers.length} caregivers available`}
                                                                            </div>
                                                                            {hoveredShiftId === shift.id && (
                                                                                <div
                                                                                    style={{
                                                                                        position: 'absolute',
                                                                                        bottom: '100%',
                                                                                        left: '50%',
                                                                                        transform: 'translateX(-50%)',
                                                                                        zIndex: 50,
                                                                                        paddingBottom: '0.4rem', /* the invisible bridge */
                                                                                        width: '220px'
                                                                                    }}
                                                                                    onClick={e => e.stopPropagation()}
                                                                                >
                                                                                    <div
                                                                                        className="card"
                                                                                        style={{
                                                                                            width: '100%',
                                                                                            padding: '0.5rem',
                                                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                                                                                            cursor: 'default',
                                                                                            border: '1px solid var(--primary-200)',
                                                                                            backgroundColor: 'var(--bg-app)',
                                                                                            margin: 0
                                                                                        }}
                                                                                    >
                                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--neutral-200)', paddingBottom: '0.25rem', color: 'var(--primary-700)' }}>
                                                                                            Quick Assign
                                                                                        </div>
                                                                                        {validCaregivers.length === 0 ? (
                                                                                            <div style={{ color: 'var(--neutral-500)', fontSize: '0.7rem', padding: '0.25rem' }}>No one available for this shift time.</div>
                                                                                        ) : (
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', maxHeight: '160px', overflowY: 'auto' }}>
                                                                                                {validCaregivers.map(cg => {
                                                                                                    const avail = availabilityResponses.find(r => r.user_id === cg.id && r.date === dayStr);
                                                                                                    let indicator = '🟢';
                                                                                                    if (avail.status === 'available_morning') indicator = '🌅';
                                                                                                    if (avail.status === 'available_evening') indicator = '🌃';
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={cg.id}
                                                                                                            onClick={async (e) => {
                                                                                                                e.stopPropagation();
                                                                                                                const { error } = await supabase.from('shifts').update({ assigned_to: cg.id }).eq('id', shift.id);
                                                                                                                if (!error) {
                                                                                                                    // Update local state instead of full data refetch to prevent UI flicker
                                                                                                                    setShifts(prevShifts => prevShifts.map(s => {
                                                                                                                        if (s.id === shift.id) {
                                                                                                                            return { ...s, assigned_to: cg.id, users: { full_name: cg.full_name, first_name: cg.first_name } };
                                                                                                                        }
                                                                                                                        return s;
                                                                                                                    }));
                                                                                                                    setHoveredShiftId(null);
                                                                                                                }
                                                                                                            }}
                                                                                                            title={`Assign to ${cg.full_name}`}
                                                                                                            style={{
                                                                                                                padding: '0.4rem',
                                                                                                                fontSize: '0.75rem',
                                                                                                                display: 'flex',
                                                                                                                justifyContent: 'flex-start',
                                                                                                                alignItems: 'center',
                                                                                                                gap: '0.4rem',
                                                                                                                border: 'none',
                                                                                                                textAlign: 'left',
                                                                                                                background: 'transparent',
                                                                                                                borderRadius: 'var(--radius-sm)',
                                                                                                                cursor: 'pointer',
                                                                                                                width: '100%',
                                                                                                                color: 'var(--neutral-800)'
                                                                                                            }}
                                                                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-50)'}
                                                                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                                                                        >
                                                                                                            <span style={{ fontSize: '0.65rem' }}>{indicator}</span> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cg.full_name}</span>
                                                                                                        </button>
                                                                                                    )
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
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

            {/* Bulk Assign Modal */}
            {isBulkAssignModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', margin: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Bulk Assign {selectedShiftIds.length} Shift(s)</h3>
                            <button type="button" onClick={() => setIsBulkAssignModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: 'var(--neutral-500)' }}>&times;</button>
                        </div>
                        <form onSubmit={handleBulkAssignSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Assign To</label>
                                <select className="form-input" value={bulkAssignedTo} onChange={e => setBulkAssignedTo(e.target.value)}>
                                    <option value="">-- Open Shift (Unassigned) --</option>
                                    <option value="custom">-- 📍 Other (Manual Entry) --</option>
                                    {caregivers.map(cg => (
                                        <option key={cg.id} value={cg.id}>
                                            {cg.full_name || 'Unnamed Caregiver'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {bulkAssignedTo === 'custom' && (
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label">Caregiver Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter name (e.g. John Smith)"
                                        value={bulkCustomName}
                                        onChange={e => setBulkCustomName(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={bulkSubmitting}>
                                    {bulkSubmitting ? 'Updating...' : 'Apply Assignment'}
                                </button>
                                <button type="button" onClick={() => setIsBulkAssignModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSchedulePage;
