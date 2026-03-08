import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, ChevronRight } from 'lucide-react';

const DashboardPage = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const [nextShift, setNextShift] = useState(null);
    const [openShiftsCount, setOpenShiftsCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            const today = startOfDay(new Date()).toISOString();

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
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Dashboard</h2>

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
                            {format(parseISO(nextShift.date), 'EEEE, MMM do')}
                        </p>
                        <p className="text-sm text-neutral-muted">
                            {format(parseISO(nextShift.start_time), 'h:mm a')} - {format(parseISO(nextShift.end_time), 'h:mm a')}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-neutral-muted" style={{ marginTop: '1rem' }}>You have no upcoming shifts scheduled right now.</p>
                )}
            </div>

            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3>Open Shifts</h3>
                    <p className="text-sm text-neutral-muted" style={{ marginTop: '0.25rem' }}>Pick up extra hours</p>
                </div>
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
            </div>

        </div>
    );
};

export default DashboardPage;
