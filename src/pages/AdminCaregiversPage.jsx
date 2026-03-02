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

    const generateMessage = () => {
        const authUrl = `${window.location.origin}/auth`;
        return `Hello,\n\nYou have been invited to join the caregiver scheduling team on Agnes Care Team (ACT).\n\nAn administrator has created an account for you. You will shortly receive a separate system email from Supabase containing an invitation link. Please click that secure link to log in, and you will be prompted to set your password and provide your phone number.\n\nOnce logged in, please navigate to the Responsibilities section to review and acknowledge our operating protocols.\n\nYou can access the regular login page at any time here: ${authUrl}\n\nThank you!`;
    };

    const handleGmail = () => {
        if (!newEmail) { setErrorMsg("Please enter an email address"); return; }
        const subject = encodeURIComponent("Invitation to join Agnes Care Team (ACT)");
        const body = encodeURIComponent(generateMessage());
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${newEmail}&su=${subject}&body=${body}`, '_blank');
        setSuccessMsg("Draft created in Gmail!");
        setErrorMsg('');
        setNewEmail('');
    };

    const handleDefaultMail = () => {
        if (!newEmail) { setErrorMsg("Please enter an email address"); return; }
        const subject = encodeURIComponent("Invitation to join Agnes Care Team (ACT)");
        const body = encodeURIComponent(generateMessage());
        window.location.href = `mailto:${newEmail}?subject=${subject}&body=${body}`;
        setSuccessMsg("Email drafted! Please send it from your email client.");
        setErrorMsg('');
        setNewEmail('');
    };

    const handleSMS = () => {
        if (!newEmail) { setErrorMsg("Please enter a phone number"); return; }
        const body = encodeURIComponent(generateMessage());
        window.location.href = `sms:${newEmail}?&body=${body}`;
        setSuccessMsg("SMS draft created! Please send it from your messaging app.");
        setErrorMsg('');
        setNewEmail('');
    };

    const handleCopy = () => {
        const body = generateMessage();
        navigator.clipboard.writeText(body);
        setSuccessMsg("Invitation copied to clipboard!");
        setErrorMsg('');
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
                    Send an invitation link via email or text message, or simply copy the link.
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="form-group">
                        <label className="form-label">Email Address or Phone Number</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Email or phone number"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button type="button" onClick={handleGmail} className="btn btn-secondary" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <Mail size={18} /> Open in Gmail
                        </button>
                        <button type="button" onClick={handleDefaultMail} className="btn btn-secondary" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <Mail size={18} /> Default Mail App
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button type="button" onClick={handleSMS} className="btn btn-secondary" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <MessageSquare size={18} /> Send text (SMS)
                        </button>
                        <button type="button" onClick={handleCopy} className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <Copy size={18} /> Copy Invite Message Only
                        </button>
                    </div>
                </div>
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
