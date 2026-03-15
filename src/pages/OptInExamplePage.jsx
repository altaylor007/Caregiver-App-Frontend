import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OptInExamplePage = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [consentMarketing, setConsentMarketing] = useState(false);
    const [consentNonMarketing, setConsentNonMarketing] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
        // This is a static example page for Twilio reviewers, so no actual submission occurs.
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--primary-50)',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header / Navigation */}
            <header style={{
                padding: '1.5rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => navigate('/welcome')}>
                    <img src="/tulip.svg" alt="ACT Logo" style={{ width: '2.5rem', height: '2.5rem' }} />
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-700)' }}>Agnes Care Team</span>
                </div>
                <button
                    onClick={() => navigate('/auth')}
                    className="btn btn-primary"
                    style={{ padding: '0.5rem 1.5rem', borderRadius: 'var(--radius-full)' }}
                >
                    Caregiver Login
                </button>
            </header>

            {/* Form Section */}
            <main style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '600px',
                    backgroundColor: 'white',
                    padding: '3rem',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: 'var(--neutral-900)',
                        marginBottom: '1rem',
                        textAlign: 'center'
                    }}>
                        Caregiver Registration & SMS Opt-In
                    </h1>
                    <p style={{
                        color: 'var(--neutral-600)',
                        marginBottom: '2rem',
                        textAlign: 'center',
                        lineHeight: '1.5'
                    }}>
                        *This is a representative example form provided for compliance verification. Agnes Care Team uses SMS to communicate shift and schedule updates to our caregivers.*
                    </p>

                    {submitted ? (
                        <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'var(--success-50)', color: 'var(--success-700)', borderRadius: 'var(--radius-md)' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Registration Submitted</h2>
                            <p>Thank you. Your SMS preferences have been recorded.</p>
                            <button onClick={() => setSubmitted(false)} className="btn btn-outline" style={{ marginTop: '1.5rem' }}>Go Back</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Full Name <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    placeholder="Type your full name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.25rem', border: '1px solid var(--neutral-300)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Email <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="email"
                                    required
                                    className="form-input"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.25rem', border: '1px solid var(--neutral-300)' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label className="form-label" style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Phone Number <span style={{ color: 'red' }}>*</span></label>
                                <input
                                    type="tel"
                                    required
                                    className="form-input"
                                    placeholder="Enter your phone number here"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.25rem', border: '1px solid var(--neutral-300)' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    id="consentNonMarketing"
                                    required
                                    checked={consentNonMarketing}
                                    onChange={(e) => setConsentNonMarketing(e.target.checked)}
                                    style={{ marginTop: '0.25rem', width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                />
                                <label htmlFor="consentNonMarketing" style={{ fontSize: '0.9rem', color: 'var(--neutral-700)', lineHeight: '1.5', cursor: 'pointer' }}>
                                    I consent to receive non-marketing text messages from Agnes Care Team about account updates, schedule changes, and shift reminders. Frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.
                                </label>
                            </div>

                            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                <input
                                    type="checkbox"
                                    id="consentMarketing"
                                    checked={consentMarketing}
                                    onChange={(e) => setConsentMarketing(e.target.checked)}
                                    style={{ marginTop: '0.25rem', width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                />
                                <label htmlFor="consentMarketing" style={{ fontSize: '0.9rem', color: 'var(--neutral-700)', lineHeight: '1.5', cursor: 'pointer' }}>
                                    I consent to receive marketing text messages from Agnes Care Team at the phone number provided. Frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.
                                </label>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <a href="/terms" style={{ color: 'var(--primary-600)', fontWeight: 'bold', textDecoration: 'none', marginRight: '1rem' }} target="_blank" rel="noopener noreferrer">Terms of Service</a>
                                <span style={{ color: 'var(--neutral-400)' }}>&amp;</span>
                                <a href="/privacy" style={{ color: 'var(--primary-600)', fontWeight: 'bold', textDecoration: 'none', marginLeft: '1rem' }} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
                                Submit
                            </button>
                        </form>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer style={{
                backgroundColor: 'white',
                padding: '2rem',
                textAlign: 'center',
                borderTop: '1px solid var(--neutral-200)'
            }}>
                <p style={{ color: 'var(--neutral-500)', marginBottom: '0.5rem', fontWeight: '500' }}>Agnes Care Team (ACT)</p>
                <div style={{ color: 'var(--neutral-500)', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                    <span>Email: admin@agnescare.com</span>
                    <span>Phone: (555) 123-4567</span>
                </div>
                <p style={{ color: 'var(--neutral-400)', fontSize: '0.75rem', marginTop: '1rem' }}>
                    &copy; {new Date().getFullYear()} Agnes Care Team. All rights reserved.
                </p>
            </footer>
        </div>
    );
};

export default OptInExamplePage;
