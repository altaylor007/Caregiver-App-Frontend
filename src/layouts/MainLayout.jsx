import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home, Calendar, CalendarCheck, Users, MessageSquare, Menu, X, FileText, Bell, FolderOpen, Shield, User, Contact, Moon, Sun } from 'lucide-react';
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
    const { user, profile, signOut, isAdmin, isSuperAdmin, activeRole, setActiveRole } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    const hasMultipleRoles = Boolean((profile?.role === 'admin' || profile?.role === 'manager') && profile?.is_caregiver);

    useEffect(() => {
        if (location.pathname.includes('/messages')) {
            setHasUnreadMessages(false);
        }
    }, [location.pathname]);

    useEffect(() => {
        if (!profile) return;

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

        const checkUnreadMessages = async () => {
            // Get user's last read time
            const { data: userData } = await supabase.from('users').select('last_read_messages_at').eq('id', user.id).single();
            if (userData) {
                const lastRead = new Date(userData.last_read_messages_at || '2000-01-01').getTime();

                // Get latest message time
                const { data: latestMsg } = await supabase.from('messages').select('created_at').order('created_at', { ascending: false }).limit(1).single();
                if (latestMsg) {
                    const latestTime = new Date(latestMsg.created_at).getTime();
                    if (latestTime > lastRead) {
                        setHasUnreadMessages(true);
                    }
                }
            }
        };
        checkUnreadMessages();

        const msgsSub = supabase
            .channel('public:messages_layout')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                // If we are NOT currently on the messages page, show the dot
                if (!window.location.pathname.includes('/messages')) {
                    setHasUnreadMessages(true);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(notifSub);
            supabase.removeChannel(msgsSub);
        };
    }, [user]);

    const markAsRead = async (notif) => {
        await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        setShowNotifications(false);
        if (notif.type === 'document') {
            navigate('/documents');
        } else {
            // Find reference_id to open the specific thread
            if (notif.reference_id) {
                navigate(`/messages?msg=${notif.reference_id}`);
            } else {
                navigate('/messages');
            }
        }
    };
    return (
        <div className="page-container">
            {/* Top Header */}
            <header className="app-header">
                <div>
                    <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src="/tulip.svg" alt="ACT Logo" style={{ width: '2rem', height: '2rem' }} />
                        <h1 className="text-primary" style={{ margin: 0, cursor: 'pointer' }}>ACT</h1>
                    </NavLink>
                </div>
                <div style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>

                    {hasMultipleRoles && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.2rem' }}>
                            <span className="text-xs text-neutral-500 hidden sm-inline" style={{ fontWeight: 600 }}>Viewing as:</span>
                            <select
                                value={activeRole}
                                onChange={(e) => {
                                    setActiveRole(e.target.value);
                                    navigate('/');
                                }}
                                className="form-input"
                                style={{
                                    padding: '0.25rem 1.5rem 0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    height: 'auto',
                                    minHeight: 'auto',
                                    backgroundColor: activeRole === 'caregiver' ? 'var(--neutral-100)' : 'var(--primary-50)',
                                    borderColor: activeRole === 'caregiver' ? 'var(--neutral-300)' : 'var(--primary-300)',
                                    color: activeRole === 'caregiver' ? 'var(--neutral-700)' : 'var(--primary-800)',
                                    fontWeight: 600,
                                    margin: 0
                                }}
                            >
                                <option value={profile.role}>{profile.role === 'admin' ? 'Admin' : 'Manager'}</option>
                                <option value="caregiver">Caregiver</option>
                            </select>
                        </div>
                    )}

                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/welcome');
                        }}
                        className="btn btn-outline"
                        style={{ padding: '0.4rem', border: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title="Sign Out"
                    >
                        <LogOut size={20} className="text-neutral-500" />
                        <span className="text-sm text-neutral-600 hidden sm-inline">Sign Out</span>
                    </button>

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
                                        onClick={() => markAsRead(n)}
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
            </header >

            {/* Main Content Area */}
            < main style={{ flex: 1, paddingBottom: '1rem', marginTop: '1rem' }}>
                <Outlet />
            </main >

            {/* Bottom Mobile Navigation */}
            < nav className="bottom-nav" >
                {
                    isAdmin ? (
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
                            {
                                isSuperAdmin && (
                                    <NavLink to="/admin/roles" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                        <Shield />
                                        <span>Roles</span>
                                    </NavLink>
                                )
                            }
                            <NavLink to="/admin/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <FolderOpen />
                                <span>Documents</span>
                            </NavLink>
                            <NavLink to="/messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                                <div style={{ position: 'relative' }}>
                                    <MessageSquare />
                                    {hasUnreadMessages && (
                                        <span style={{
                                            position: 'absolute', top: -2, right: -4, width: 8, height: 8,
                                            backgroundColor: 'var(--danger-500)', borderRadius: '50%'
                                        }}></span>
                                    )}
                                </div>
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
                                to="/availability"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <CalendarCheck />
                                <span>Availability</span>
                            </NavLink>

                            <NavLink
                                to="/messages"
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <div style={{ position: 'relative' }}>
                                    <MessageSquare />
                                    {hasUnreadMessages && (
                                        <span style={{
                                            position: 'absolute', top: -2, right: -4, width: 8, height: 8,
                                            backgroundColor: 'var(--danger-500)', borderRadius: '50%'
                                        }}></span>
                                    )}
                                </div>
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
            </nav >
        </div >
    );
};

export default MainLayout;
