import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

            {/* Hero Section */}
            <main style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                textAlign: 'center'
            }}>
                <div style={{ maxWidth: '800px' }}>
                    <h1 style={{
                        fontSize: '3.5rem',
                        fontWeight: '800',
                        color: 'var(--neutral-900)',
                        lineHeight: '1.2',
                        marginBottom: '1.5rem'
                    }}>
                        Empowering Our <span style={{ color: 'var(--primary-600)' }}>In-Home Care</span>
                    </h1>
                    <p style={{
                        fontSize: '1.25rem',
                        color: 'var(--neutral-600)',
                        marginBottom: '2.5rem',
                        lineHeight: '1.6',
                        maxWidth: '600px',
                        margin: '0 auto 2.5rem'
                    }}>
                        Dedicated to the seamless communication and scheduling of our in-home care team for Agnes.
                    </p>
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'center'
                    }}>
                        <button
                            onClick={() => navigate('/auth')}
                            className="btn btn-primary"
                            style={{
                                padding: '0.75rem 2rem',
                                fontSize: '1.125rem',
                                borderRadius: 'var(--radius-full)'
                            }}
                        >
                            Access Schedule
                        </button>
                    </div>
                </div>
            </main>

            {/* Footer with Business Info */}
            <footer style={{
                backgroundColor: 'white',
                padding: '2rem',
                textAlign: 'center',
                borderTop: '1px solid var(--neutral-200)'
            }}>
                <p style={{ color: 'var(--neutral-500)', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Agnes Care Team (ACT)
                </p>
                <p style={{ color: 'var(--neutral-500)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Business Address: 724 1St Avenue, St. Paul, MN 55118
                </p>
                <div style={{ color: 'var(--neutral-500)', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                    <span>Email: admin@agnescare.com</span>
                    <span>Phone: (555) 123-4567</span>
                </div>
                <p style={{ color: 'var(--neutral-600)', fontSize: '0.875rem', maxWidth: '600px', margin: '0 auto 1rem auto', lineHeight: '1.5' }}>
                    We utilize SMS text messaging to send our caregivers account updates, shift notifications, and scheduling reminders.
                </p>
                <p style={{ color: 'var(--neutral-400)', fontSize: '0.875rem', marginTop: '1rem' }}>
                    <a href="/terms" style={{ color: 'var(--primary-600)', textDecoration: 'none', marginRight: '1rem' }}>Terms of Service</a>
                    <a href="/privacy" style={{ color: 'var(--primary-600)', textDecoration: 'none', marginRight: '1rem' }}>Privacy Policy</a>
                    <a href="/opt-in" style={{ color: 'var(--primary-600)', textDecoration: 'none' }}>SMS Opt-In Form Example</a>
                </p>
                <p style={{ color: 'var(--neutral-400)', fontSize: '0.75rem', marginTop: '1rem' }}>
                    &copy; {new Date().getFullYear()} Agnes Care Team. All rights reserved.
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
