import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, ShieldAlert, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AdminRolesPage = () => {
    const { isSuperAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    if (!isSuperAdmin) {
        return <Navigate to="/" replace />;
    }

    const fetchUsers = async () => {
        setLoading(true);
        // Non-admin users (caregivers + managers) — for role management
        const { data: nonAdmins, error } = await supabase
            .from('users')
            .select('id, full_name, email, role, avatar_url, payroll_report_contact, phone')
            .neq('role', 'admin')
            .order('full_name', { ascending: true });

        // Admin + manager users — for payroll contact toggle
        const { data: admins } = await supabase
            .from('users')
            .select('id, full_name, email, role, avatar_url, payroll_report_contact, phone')
            .in('role', ['admin', 'manager'])
            .order('full_name', { ascending: true });

        if (nonAdmins) setUsers(nonAdmins);
        if (admins) setAdminUsers(admins);
        if (error) console.error("Error fetching users:", error);
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleRole = async (userId, currentRole, userName) => {
        const newRole = currentRole === 'manager' ? 'caregiver' : 'manager';
        const actionStr = newRole === 'manager'
            ? `elevate ${userName || 'this user'} to Manager? They will gain full administrative access.`
            : `revoke Manager access from ${userName || 'this user'} and return them to Caregiver?`;

        if (!window.confirm(`Are you sure you want to ${actionStr}`)) return;

        const { error } = await supabase
            .from('users')
            .update({ role: newRole })
            .eq('id', userId);

        if (!error) {
            fetchUsers();
        } else {
            alert("Error updating role: " + error.message);
        }
    };

    const togglePayrollContact = async (userId, current) => {
        const { error } = await supabase
            .from('users')
            .update({ payroll_report_contact: !current })
            .eq('id', userId);

        if (!error) {
            fetchUsers();
        } else {
            alert("Error updating payroll contact: " + error.message);
        }
    };

    const UserAvatar = ({ u }) => (
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {u.avatar_url ? (
                <img src={u.avatar_url} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
                <span style={{ fontWeight: 'bold', color: 'var(--neutral-500)', fontSize: '1rem' }}>
                    {u.full_name?.charAt(0).toUpperCase() || '?'}
                </span>
            )}
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Shield size={28} className="text-primary" />
                <h2 style={{ margin: 0 }}>Role Management</h2>
            </div>

            <p className="text-sm text-neutral-600" style={{ marginBottom: '2rem' }}>
                Elevate caregivers to <strong>Manager</strong> status to grant them administrative privileges over the schedule, payroll, and team roster.
            </p>

            {/* ── Payroll Contact Section ── */}
            <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid var(--primary-500)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Bell size={18} className="text-primary" />
                    <h3 style={{ margin: 0 }}>Payroll Report Recipients</h3>
                </div>
                <p className="text-sm text-neutral-600" style={{ marginBottom: '1rem' }}>
                    Toggle which admins and managers receive the payroll report SMS. Their phone number must be set in their profile.
                </p>
                {adminUsers.length === 0 ? (
                    <p className="text-sm text-neutral-muted">No admin or manager accounts found.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {adminUsers.map(u => (
                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: u.payroll_report_contact ? 'var(--primary-50)' : 'var(--neutral-50)', border: `1px solid ${u.payroll_report_contact ? 'var(--primary-200)' : 'var(--neutral-200)'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <UserAvatar u={u} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.full_name || 'Unnamed'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                                            {u.phone || <span style={{ color: 'var(--danger-500)' }}>⚠ No phone number on file</span>}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => togglePayrollContact(u.id, u.payroll_report_contact)}
                                    style={{
                                        width: '44px', height: '26px',
                                        backgroundColor: u.payroll_report_contact ? 'var(--primary-500)' : 'var(--neutral-300)',
                                        borderRadius: '13px', position: 'relative',
                                        cursor: 'pointer', transition: 'background-color 0.2s',
                                        border: 'none', padding: 0, flexShrink: 0
                                    }}
                                    aria-label="Toggle Payroll Contact"
                                >
                                    <div style={{
                                        width: '22px', height: '22px', backgroundColor: 'white',
                                        borderRadius: '50%', position: 'absolute', top: '2px',
                                        left: u.payroll_report_contact ? '20px' : '2px',
                                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Role Management Section ── */}
            {loading ? (
                <p>Loading users...</p>
            ) : users.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No non-admin users found.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {users.map((u) => (
                        <div key={u.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', margin: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <UserAvatar u={u} />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{u.full_name || 'Unnamed User'}</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--neutral-500)' }}>{u.email}</p>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', padding: '0.1rem 0.5rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 600, backgroundColor: u.role === 'manager' ? 'var(--primary-100)' : 'var(--neutral-100)', color: u.role === 'manager' ? 'var(--primary-700)' : 'var(--neutral-600)' }}>
                                        {u.role === 'manager' ? <><ShieldCheck size={12} /> Manager</> : 'Caregiver'}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => toggleRole(u.id, u.role, u.full_name)}
                                className="btn"
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    backgroundColor: u.role === 'manager' ? 'var(--danger-50)' : 'var(--primary-50)',
                                    color: u.role === 'manager' ? 'var(--danger-700)' : 'var(--primary-700)',
                                    border: `1px solid ${u.role === 'manager' ? 'var(--danger-200)' : 'var(--primary-200)'}`
                                }}
                            >
                                {u.role === 'manager' ? (
                                    <><ShieldAlert size={16} /> Revoke Manager</>
                                ) : (
                                    <><ShieldCheck size={16} /> Make Manager</>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminRolesPage;
