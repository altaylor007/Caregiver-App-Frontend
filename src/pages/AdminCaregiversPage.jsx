import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, UserX, UserCheck, Mail } from 'lucide-react';

const AdminCaregiversPage = () => {
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);

    // State for new caregiver form
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchCaregivers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, phone, status, role, acknowledged_responsibilities, payroll_enabled')
            .eq('role', 'caregiver')
            .order('created_at', { ascending: false });

        if (data) setCaregivers(data);
        if (error) console.error("Error fetching caregivers:", error);

        setLoading(false);
    };

    useEffect(() => {
        fetchCaregivers();
    }, []);

    const handleAddCaregiver = async (e) => {
        e.preventDefault();

        // Construct the signup URL based on window.location
        const signupUrl = `${window.location.origin}/auth`;

        const subject = encodeURIComponent("Invitation to join Agnes Care Team (ACT)");
        const body = encodeURIComponent(`Hello,\n\nYou have been invited to join the caregiver scheduling team on Agnes Care Team (ACT).\n\nPlease click the link below to create your account. During sign up, you will be asked to provide your phone number. Once logged in, please navigate to the Responsibilities section to review and acknowledge our operating protocols.\n\nSign up here: ${signupUrl}\n\nThank you!`);

        // Open the user's default email client
        window.location.href = `mailto:${newEmail}?subject=${subject}&body=${body}`;

        setNewEmail('');
        setSuccessMsg("Email drafted! Please send it from your email client.");
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
        const action = newPayrollStatus ? 'enable' : 'disable';

        if (!window.confirm(`Are you sure you want to ${action} payroll tracking for this caregiver?`)) return;

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

    // Removed old handleRemoveCaregiver function

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Manage Caregivers</h2>

            <div className="card">
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={20} className="text-primary" />
                    Invite Caregiver
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
                    Send an email invitation with a direct link to sign up.
                </p>

                <form onSubmit={handleAddCaregiver}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            required
                            className="form-input"
                            placeholder="caregiver@email.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <Mail size={18} /> Send Invite Email
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
                                            className="btn"
                                            style={{
                                                padding: '0.2rem 0.5rem',
                                                fontSize: '0.75rem',
                                                backgroundColor: cg.payroll_enabled ? 'var(--success-50)' : 'var(--neutral-100)',
                                                color: cg.payroll_enabled ? 'var(--success-700)' : 'var(--neutral-600)',
                                                border: `1px solid ${cg.payroll_enabled ? 'var(--success-200)' : 'var(--neutral-300)'}`
                                            }}
                                        >
                                            {cg.payroll_enabled ? 'Enabled' : 'Disabled'}
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
