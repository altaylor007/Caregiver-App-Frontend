import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [mode, setMode] = useState('login');
    const [resetSent, setResetSent] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            navigate('/');
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setSendingReset(true);
        setErrorMsg('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
                setErrorMsg('Too many requests. Please wait a few minutes and try again.');
            } else {
                if (error) console.error(error);
                setResetSent(true);
            }
        } catch (error) {
            if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
                setErrorMsg('Too many requests. Please wait a few minutes and try again.');
            } else {
                console.error(error);
                setResetSent(true);
            }
        } finally {
            setSendingReset(false);
        }
    };

    const textBtnStyle = {
        background: 'none',
        border: 'none',
        padding: '0.75rem 0.5rem',
        minHeight: '44px',
        color: 'var(--primary-600, inherit)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'var(--primary-50)' }}>
            <div className="card" style={{ width: '100%', maxWidth: 400, padding: '2rem' }}>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src="/tulip.svg" alt="ACT Logo" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem', display: 'block' }} />
                    {mode === 'login' ? (
                        <>
                            <h1 className="text-primary" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Agnes Care Team (ACT)</h1>
                            <p className="text-neutral-muted">Sign in to manage your schedule</p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-primary" style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Reset your password</h1>
                            <p className="text-neutral-muted">Enter the email you use to sign in and we'll send you a link to set a new password.</p>
                        </>
                    )}
                </div>

                {errorMsg && (
                    <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {errorMsg}
                    </div>
                )}

                {mode === 'login' ? (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                required
                                className="form-input"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                required
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                            {loading ? 'Processing...' : 'Sign In'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                className="text-primary"
                                style={textBtnStyle}
                                onClick={() => {
                                    setMode('forgot');
                                    setErrorMsg('');
                                    setResetSent(false);
                                }}
                            >
                                Forgot password?
                            </button>
                        </div>
                    </form>
                ) : (
                    <div>
                        {resetSent ? (
                            <div className="text-neutral-muted" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9375rem', lineHeight: 1.5 }}>
                                If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.
                            </div>
                        ) : (
                            <form onSubmit={handleResetSubmit}>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        required
                                        className="form-input"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                <button type="submit" disabled={sendingReset} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                                    {sendingReset ? 'Sending...' : 'Send reset link'}
                                </button>
                            </form>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                className="text-primary"
                                style={textBtnStyle}
                                onClick={() => {
                                    setMode('login');
                                    setErrorMsg('');
                                    setResetSent(false);
                                }}
                            >
                                Back to sign in
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthPage;
