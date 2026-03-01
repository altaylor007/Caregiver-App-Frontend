import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AdminRolesPage = () => {
    const { isSuperAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    if (!isSuperAdmin) {
        return <Navigate to="/" replace />;
    }

    const fetchUsers = async () => {
        setLoading(true);
        // We only want to manage roles of people who are NOT super admins.
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, role, avatar_url')
            .neq('role', 'admin')
            .order('full_name', { ascending: true });

        if (data) setUsers(data);
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

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Shield size={28} className="text-primary" />
                <h2 style={{ margin: 0 }}>Role Management</h2>
            </div>

            <p className="text-sm text-neutral-600" style={{ marginBottom: '2rem' }}>
                Elevate caregivers to <strong>Manager</strong> status to grant them administrative privileges over the schedule, payroll, and team roster.
            </p>

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
                                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {u.avatar_url ? (
                                        <img src={u.avatar_url} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span style={{ fontWeight: 'bold', color: 'var(--neutral-500)', fontSize: '1rem' }}>
                                            {u.full_name?.charAt(0).toUpperCase() || '?'}
                                        </span>
                                    )}
                                </div>
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
