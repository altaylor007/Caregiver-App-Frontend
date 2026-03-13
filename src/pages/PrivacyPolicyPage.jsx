import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage = () => {
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
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem', color: 'var(--neutral-900)' }}>Privacy Policy</h1>

                    <div style={{ color: 'var(--neutral-700)', lineHeight: '1.6' }}>
                        <p style={{ marginBottom: '1.5rem' }}><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

                        <p style={{ marginBottom: '1.5rem' }}>At Agnes Care Team, we respect your privacy and are committed to protecting the personal information you share with us as a caregiver using our application.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>1. Information We Collect</h2>
                        <p style={{ marginBottom: '1.5rem' }}>We collect personal information such as your name, email address, phone number, and schedule availability strictly for internal scheduling and operational purposes.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>2. How We Use Your Information</h2>
                        <p style={{ marginBottom: '1.5rem' }}>Your information is used exclusively to manage your caregiver schedule, communicate shift updates, and facilitate contact between administrators and team members.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>3. Information Sharing - No Third-Party Marketing</h2>
                        <p style={{ marginBottom: '1.5rem', fontWeight: 'bold', backgroundColor: 'var(--primary-50)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                            No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All other categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
                        </p>
                        <p style={{ marginBottom: '1.5rem' }}>We do not sell, rent, or lease your personal information to third parties.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>4. Security</h2>
                        <p style={{ marginBottom: '1.5rem' }}>We employ industry-standard security measures to protect the information you submit through the application.</p>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '2rem', marginBottom: '1rem', color: 'var(--neutral-900)' }}>5. Contact Us</h2>
                        <p style={{ marginBottom: '1.5rem' }}>If you have any questions about this Privacy Policy, please contact your Agnes Care Team administrator.</p>
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

export default PrivacyPolicyPage;
