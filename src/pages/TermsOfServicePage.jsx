import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsOfServicePage = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--primary-50)',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
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

            <main style={{ flex: 1, padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', color: 'var(--neutral-900)' }}>Terms of Service</h1>

                    <div style={{ color: 'var(--neutral-700)', lineHeight: '1.6' }}>
                        <p style={{ marginBottom: '1.5rem' }}><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>1. Acceptance of Terms</h2>
                        <p style={{ marginBottom: '1.5rem' }}>By accessing and using the Agnes Care Team application, you agree to be bound by these Terms of Service.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>2. Use of the Application</h2>
                        <p style={{ marginBottom: '1.5rem' }}>This application is an internal scheduling and communication tool for caregivers of Agnes Care Team. Access is strictly limited to authorized personnel.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>3. SMS Communications</h2>
                        <p style={{ marginBottom: '1rem' }}>By providing your phone number and opting in, you agree to receive SMS communications from Agnes Care Team regarding your schedule, shifts, availability, and related notifications.</p>
                        <ul style={{ listStyleType: 'disc', paddingLeft: '2rem', marginBottom: '1.5rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Message frequency varies</strong> based on scheduling activity.</li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>Message and data rates may apply.</strong></li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>To cancel SMS service at any time, reply "STOP"</strong> to any message you receive from us. Upon sending "STOP," we will send one final message confirming your unsubscribe status. After this, you will no longer receive SMS messages from us.</li>
                            <li style={{ marginBottom: '0.5rem' }}><strong>For assistance, reply "HELP"</strong> to any message you receive, or contact your administrator directly.</li>
                            <li style={{ marginBottom: '0.5rem' }}>Carriers are not liable for delayed or undelivered messages.</li>
                        </ul>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>4. Account Security</h2>
                        <p style={{ marginBottom: '1.5rem' }}>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>5. Contact Us</h2>
                        <p style={{ marginBottom: '1.5rem' }}>If you have any questions about these Terms, please contact your Agnes Care Team administrator.</p>
                    </div>
                </div>
            </main>

            <footer style={{ backgroundColor: 'white', padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--neutral-200)' }}>
                <p style={{ color: 'var(--neutral-500)', marginBottom: '0.5rem', fontWeight: '500' }}>Agnes Care Team (ACT)</p>
                <p style={{ color: 'var(--neutral-500)', fontSize: '0.875rem' }}>Business Address: 724 1St Avenue, St. Paul, MN 55118</p>
                <p style={{ color: 'var(--neutral-400)', fontSize: '0.875rem', marginTop: '1rem' }}>
                    <a href="/terms" style={{ color: 'var(--primary-600)', textDecoration: 'none', marginRight: '1rem' }}>Terms of Service</a>
                    <a href="/privacy" style={{ color: 'var(--primary-600)', textDecoration: 'none' }}>Privacy Policy</a>
                </p>
                <p style={{ color: 'var(--neutral-400)', fontSize: '0.75rem', marginTop: '1rem' }}>
                    &copy; {new Date().getFullYear()} Agnes Care Team. All rights reserved.
                </p>
            </footer>
        </div>
    );
};

export default TermsOfServicePage;
