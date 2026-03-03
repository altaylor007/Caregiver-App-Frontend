import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { UserPlus, UserX, UserCheck, Mail, MessageSquare, Copy, KeyRound } from 'lucide-react';

const AdminCaregiversPage = () => {
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);

    // State for new caregiver form
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchCaregivers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, phone, status, role, acknowledged_responsibilities, payroll_enabled, avatar_url')
            .eq('role', 'caregiver')
            .order('created_at', { ascending: false });

        if (data) setCaregivers(data);
        if (error) console.error("Error fetching caregivers:", error);

        setLoading(false);
    };

    useEffect(() => {
        fetchCaregivers();
    }, []);

    const generateRandomPassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let pwd = "";
        for (let i = 0; i < 12; i++) {
            pwd += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewPassword(pwd);
    };

    const generateMessage = (email, password) => {
        const authUrl = `${window.location.origin}/auth`;
        return `Hello,\n\nYou have been invited to join the caregiver scheduling team on Agnes Care Team (ACT).\n\nAn administrator has created an account for you. Your initial credentials are:\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease click the secure link below to log in. You will be prompted to set your own password and provide your phone number.\n\nOnce logged in, please navigate to the Responsibilities section to review and acknowledge our operating protocols.\n\nLogin here: ${authUrl}\n\nThank you!`;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newEmail || !newName) {
            setErrorMsg("Please provide both email and full name.");
            return;
        }

        const passwordToUse = newPassword || 'Agnes2026'; // Default if empty

        setIsSubmitting(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            // Invoke the edge function securely using the admin client which has the service role key
            const { data, error: invokeError } = await supabaseAdmin.functions.invoke('create-caregiver', {
                body: { email: newEmail, fullName: newName, password: passwordToUse }
            });

            if (invokeError) throw invokeError;
            if (data?.error) throw new Error(data.error);

            setSuccessMsg(`Success! Caregiver created. Check your email app or click "Send Email Invite" below.`);

            // Try to open the default mail client automatically
            const subject = encodeURIComponent("Invitation to join Agnes Care Team (ACT)");
            const body = encodeURIComponent(generateMessage(newEmail, passwordToUse));
            window.location.href = `mailto:${newEmail}?subject=${subject}&body=${body}`;

            setNewEmail('');
            setNewName('');
            setNewPassword('');
            fetchCaregivers();

        } catch (error) {
            setErrorMsg(error.message);
            // Hide the actual token/auth errors from end user if it's too technical
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'inactive' ? 'deactivate' : 'reactivate';

        if (!window.confirm(`Are you sure you want to ${action} this caregiver's account?`)) return;

        const { error } = await supabase
            .from('users')
            .update({ status: newStatus })
            .eq('id', id);

        if (!error) {
            fetchCaregivers();
        } else {
            alert("Error updating caregiver status: " + error.message);
        }
    };

    const togglePayroll = async (id, currentPayrollStatus) => {
        const newPayrollStatus = !currentPayrollStatus;

        // Optimistically update UI (optional, but skipping here to stick to fetch logic)

        const { error } = await supabase
            .from('users')
            .update({ payroll_enabled: newPayrollStatus })
            .eq('id', id);

        if (!error) {
            fetchCaregivers();
        } else {
            alert("Error updating payroll status: " + error.message);
        }
    };

    const handleResetPassword = async (cg) => {
        const DEFAULT_PASSWORD = 'Agnes2026';
        if (!window.confirm(`Reset ${cg.full_name || cg.email}'s password to the default (${DEFAULT_PASSWORD})?`)) return;

        const { error } = await supabaseAdmin.auth.admin.updateUserById(cg.id, {
            password: DEFAULT_PASSWORD
        });

        if (error) {
            alert('Error resetting password: ' + error.message);
        } else {
            setSuccessMsg(`Password for ${cg.full_name || cg.email} reset to ${DEFAULT_PASSWORD} successfully.`);
            setTimeout(() => setSuccessMsg(''), 5000);
        }
    };

    // Removed old handleRemoveCaregiver function

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Manage Caregivers</h2>

            <div className="card">
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={20} className="text-primary" />
                    Create Caregiver Account
                </h3>

                {errorMsg && (
                    <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div style={{ backgroundColor: 'var(--success-50)', color: 'var(--success-700)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {successMsg}
                    </div>
                )}

                <p className="text-sm text-neutral-600" style={{ marginBottom: '1rem' }}>
                    Create an account for a new caregiver. They will use this email and temporary password to log in, and will be required to set their own password immediately.
                </p>

                <form onSubmit={handleCreateUser} style={{ marginBottom: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Full Name <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            required
                            className="form-input"
                            placeholder="e.g. Jane Doe"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Email Address <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="email"
                            required
                            className="form-input"
                            placeholder="e.g. jane@example.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Temporary Password</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Leave blank for default: Agnes2026"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <button type="button" onClick={generateRandomPassword} className="btn btn-secondary">
                                Generate
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <UserPlus size={18} /> {isSubmitting ? 'Creating...' : 'Create Caregiver Account'}
                    </button>
                </form>
            </div>

            <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Team Roster ({caregivers.length})</h3>

            {loading ? (
                <p>Loading...</p>
            ) : caregivers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No caregivers have signed up yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {caregivers.map((cg) => (
                        <div key={cg.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', margin: 0, opacity: cg.status === 'inactive' ? 0.6 : 1 }}>
                            <div style={{ flexGrow: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {cg.avatar_url ? (
                                            <img src={cg.avatar_url} alt={cg.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontWeight: 'bold', color: 'var(--neutral-500)', fontSize: '0.875rem' }}>
                                                {cg.full_name?.charAt(0).toUpperCase() || '?'}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontWeight: 600 }}>{cg.full_name || 'Unnamed Caregiver'}</p>
                                    {cg.status === 'inactive' && (
                                        <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-700)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Inactive</span>
                                    )}
                                </div>
                                <p className="text-sm text-neutral-muted">{cg.email}</p>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', flex: 1 }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', display: 'block' }}>Account Access</span>
                                        </div>
                                        <button
                                            onClick={() => toggleStatus(cg.id, cg.status)}
                                            className="btn"
                                            style={{
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '0.75rem',
                                                backgroundColor: cg.status === 'active' ? 'var(--warning-50)' : 'var(--success-50)',
                                                color: cg.status === 'active' ? 'var(--warning-700)' : 'var(--success-700)',
                                                border: `1px solid ${cg.status === 'active' ? 'var(--warning-200)' : 'var(--success-200)'}`
                                            }}
                                        >
                                            {cg.status === 'active' ? 'Deactivate' : 'Reactivate'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', flex: 1 }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', display: 'block' }}>Payroll Tracking</span>
                                        </div>
                                        <button
                                            onClick={() => togglePayroll(cg.id, cg.payroll_enabled)}
                                            style={{
                                                width: '40px',
                                                height: '24px',
                                                backgroundColor: cg.payroll_enabled ? 'var(--success-500)' : 'var(--neutral-300)',
                                                borderRadius: '12px',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s',
                                                border: 'none',
                                                padding: 0
                                            }}
                                            aria-label="Toggle Payroll"
                                        >
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                backgroundColor: 'white',
                                                borderRadius: '50%',
                                                position: 'absolute',
                                                top: '2px',
                                                left: cg.payroll_enabled ? '18px' : '2px',
                                                transition: 'left 0.2s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                            }} />
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', flex: 1 }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-600)', display: 'block' }}>Password</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--neutral-400)' }}>Default: Agnes2026</span>
                                        </div>
                                        <button
                                            onClick={() => handleResetPassword(cg)}
                                            className="btn"
                                            title="Reset to default password: Agnes2026"
                                            style={{
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '0.75rem',
                                                backgroundColor: 'var(--primary-50)',
                                                color: 'var(--primary-700)',
                                                border: '1px solid var(--primary-200)',
                                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                                            }}
                                        >
                                            <KeyRound size={13} /> Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminCaregiversPage;
