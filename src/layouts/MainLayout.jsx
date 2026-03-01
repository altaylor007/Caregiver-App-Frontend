import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, Users, Bell, User, Contact, FileText, Moon, Sun, FolderOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

// Assuming these imports are needed for the routes and navigation,
// but they are not used directly in MainLayout unless userRole is defined and used for conditional rendering.
// For the purpose of this task, I will only add AdminPayrollPage as requested.
// The other page imports from the instruction seem to belong to a different file (e.g., App.jsx where routes are defined).
// import AdminCaregiversPage from '../pages/AdminCaregiversPage';
// import CaregiverResponsibilitiesPage from '../pages/CaregiverResponsibilitiesPage';
// import CaregiverDirectoryPage from '../pages/CaregiverDirectoryPage';
// import MessageBoardPage from '../pages/MessageBoardPage';
// import AdminPayrollPage from '../pages/AdminPayrollPage'; // This import is added as per instruction.

const MainLayout = () => {
    const { user, isAdmin } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*, actor:users!actor_id(full_name)')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false });
            if (data) setNotifications(data);
        };

        fetchNotifications();

        // Subscribe to real-time notification drops
        const notifSub = supabase
            .channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                fetchNotifications();
            })
            .subscribe();

        return () => supabase.removeChannel(notifSub);
    }, [user]);

    const markAsRead = async (notifId, notifType) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        setShowNotifications(false);
        if (notifType === 'document') {
            navigate('/documents');
        } else {
            navigate('/messages'); // Take them to messages where they were tagged
        }
    };
    return (
        <div className="page-container">
            {/* Top Header */}
            <header className="app-header">
                <div>
                    <NavLink to="/" style={{ textDecoration: 'none' }}>
                        <h1 className="text-primary" style={{ margin: 0, cursor: 'pointer' }}>ACT</h1>
                    </NavLink>
                </div>
                <div style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        onClick={toggleTheme}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem', border: 'none' }}
                        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                    >
                        {theme === 'light' ? <Moon size={20} className="text-neutral-500" /> : <Sun size={20} className="text-neutral-500" />}
                    </button>

                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem', border: 'none', position: 'relative' }}
                    >
                        <Bell size={20} className="text-neutral-500" />
                        {notifications.length > 0 && (
                            <span style={{
                                position: 'absolute', top: 2, right: 4, width: 8, height: 8,
                                backgroundColor: 'var(--danger-500)', borderRadius: '50%'
                            }}></span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="card" style={{
                            position: 'absolute', top: '100%', right: 0, width: 250, zIndex: 50,
                            padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem',
                            boxShadow: 'var(--shadow-lg)'
                        }}>
                            <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', padding: '0 0.5rem' }}>Notifications</h4>
                            {notifications.length === 0 ? (
                                <p className="text-xs text-neutral-muted" style={{ padding: '0.5rem' }}>No new notifications.</p>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n.id}
                                        onClick={() => markAsRead(n.id, n.type)}
                                        style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-50)' }}
                                    >
                                        <p className="text-sm">
                                            <span style={{ fontWeight: 600 }}>{n.actor?.full_name || 'Someone'}</span>
                                            {n.type === 'mention' ? ' tagged you in a message.' : ' uploaded a new document.'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content Area */}
            <main style={{ flex: 1, paddingBottom: '1rem', marginTop: '1rem' }}>
                <Outlet />
            </main>

            {/* Bottom Mobile Navigation */}
            <nav className="bottom-nav">
                {isAdmin ? (
                    <>
                        <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Home />
                            <span>Home</span>
                        </NavLink>
                        <NavLink to="/admin/schedule" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Calendar />
                            <span>Schedule</span>
                        </NavLink>
                        <NavLink to="/admin/payroll" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <FileText />
                            <span>Hours Reporting</span>
                        </NavLink>
                        <NavLink to="/admin/caregivers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <Users />
                            <span>Team</span>
                        </NavLink>
                        <NavLink to="/admin/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <FolderOpen />
                            <span>Documents</span>
                        </NavLink>
                        <NavLink to="/messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <MessageSquare />
                            <span>Messages</span>
                        </NavLink>
                    </>
                ) : (
                    <>
                        <NavLink
                            to="/"
                            end
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Home />
                            <span>Home</span>
                        </NavLink>

                        <NavLink
                            to="/schedule"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Calendar />
                            <span>Schedule</span>
                        </NavLink>

                        <NavLink
                            to="/messages"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <MessageSquare />
                            <span>Messages</span>
                        </NavLink>

                        <NavLink
                            to="/documents"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <FolderOpen />
                            <span>Documents</span>
                        </NavLink>

                        <NavLink
                            to="/directory"
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Contact />
                            <span>Directory</span>
                        </NavLink>
                    </>
                )}
                <NavLink
                    to="/profile"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <User />
                    <span>Profile</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default MainLayout;
