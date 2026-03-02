import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const UpdatePasswordPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // We need to know who is updating their password to save their phone
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setErrorMsg("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setErrorMsg("Password must be at least 6 characters.");
            return;
        }

        if (!phone || phone.trim().length < 10) {
            setErrorMsg("Please enter a valid phone number including area code.");
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Update their authentication password
            const { error: authError } = await supabase.auth.updateUser({ password });
            if (authError) throw authError;

            // 2. Format the phone number (assuming US if no country code provided)
            let formattedPhone = phone.trim();
            if (!formattedPhone.startsWith('+')) {
                // Remove all non-numeric characters for checking
                const numericOnly = formattedPhone.replace(/\D/g, '');
                if (numericOnly.length === 10) {
                    formattedPhone = `+1${numericOnly}`;
                } else if (numericOnly.length === 11 && numericOnly.startsWith('1')) {
                    formattedPhone = `+${numericOnly}`;
                }
            }

            // 3. Save the phone number to the users profile table and opt them into SMS by default
            if (user?.id) {
                const { error: dbError } = await supabase
                    .from('users')
                    .update({
                        phone_number: formattedPhone,
                        phone: formattedPhone, // Keep legacy column updated
                        sms_enabled: true
                    })
                    .eq('id', user.id);

                if (dbError) {
                    console.error("Failed to save phone number to database:", dbError);
                    // We don't throw here because their password did update successfully
                }
            }

            alert('Account setup complete! Welcome to the team.');
            navigate('/');
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'var(--primary-50)' }}>
            <div className="card" style={{ width: '100%', maxWidth: 400, padding: '2rem' }}>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 className="text-primary" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Set Your Password</h1>
                    <p className="text-neutral-muted">Welcome to Agnes Care Team (ACT)! Please provide a phone number to receive schedule updates and set a secure password.</p>
                </div>

                {errorMsg && (
                    <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Phone Number <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="tel"
                            required
                            className="form-input"
                            placeholder="e.g. (555) 123-4567"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                        <p className="text-xs text-neutral-muted" style={{ marginTop: '0.25rem' }}>Required for SMS shift notifications.</p>
                    </div>

                    <div className="form-group">
                        <label className="form-label">New Password <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="password"
                            required
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirm New Password <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="password"
                            required
                            className="form-input"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                        {loading ? 'Saving...' : 'Complete Setup & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UpdatePasswordPage;
