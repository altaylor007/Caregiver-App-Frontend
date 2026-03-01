import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, FileText, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboardPage = () => {
    const { profile } = useAuth();

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Admin Dashboard</h2>

            <div className="card" style={{ backgroundColor: 'var(--primary-700)', color: 'white', border: 'none' }}>
                <h3>Welcome, {profile?.full_name || 'Admin'}</h3>
                <p style={{ marginTop: '0.5rem', opacity: 0.9 }}>
                    Manage your caregivers and shifts here.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <Link to="/admin/caregivers" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ height: '100%', textAlign: 'center', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <Users size={32} className="text-primary" style={{ marginBottom: '0.5rem' }} />
                        <h4 style={{ fontSize: '0.875rem' }}>Caregivers</h4>
                    </div>
                </Link>

                <Link to="/admin/schedule" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ height: '100%', textAlign: 'center', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <Calendar size={32} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
                        <h4 style={{ fontSize: '0.875rem' }}>Master Schedule</h4>
                    </div>
                </Link>

                <Link to="/admin/documents" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ height: '100%', textAlign: 'center', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <FileText size={32} className="text-primary" style={{ marginBottom: '0.5rem' }} />
                        <h4 style={{ fontSize: '0.875rem' }}>Documents</h4>
                    </div>
                </Link>

                <Link to="/admin/reports" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="card" style={{ height: '100%', textAlign: 'center', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                        <Clock size={32} className="text-secondary" style={{ marginBottom: '0.5rem' }} />
                        <h4 style={{ fontSize: '0.875rem' }}>Hours Report</h4>
                    </div>
                </Link>
            </div>

            <div className="card">
                <h3>Pending Items</h3>
                <p className="text-neutral-muted text-sm" style={{ marginTop: '0.5rem' }}>
                    0 Time-off Requests
                </p>
                <p className="text-neutral-muted text-sm">
                    0 Shift Trade Requests
                </p>
            </div>

        </div>
    );
};

export default AdminDashboardPage;
