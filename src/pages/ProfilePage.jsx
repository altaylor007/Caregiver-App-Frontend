import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

const ProfilePage = () => {
    const { user, profile, signOut } = useAuth();
    const [phone, setPhone] = useState(profile?.phone || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (profile?.phone) setPhone(profile.phone);
    }, [profile]);

    const handleUpdatePhone = async () => {
        setIsSaving(true);
        const { error } = await supabase.from('users').update({ phone }).eq('id', user.id);
        setIsSaving(false);
        if (error) {
            alert("Failed to update phone: " + error.message);
        } else {
            alert('Phone number updated successfully!');
        }
    };

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Profile & Settings</h2>

            <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2rem', margin: '0 auto 1rem auto' }}>
                    {user?.email?.charAt(0).toUpperCase() || 'C'}
                </div>
                <h3 className="text-sm">Caregiver Account</h3>
                <p className="text-neutral-muted text-sm">{user?.email}</p>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Responsibilities List</h3>
                <Link to="/responsibilities" style={{ textDecoration: 'none' }}>
                    <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'space-between' }}>
                        View Care Plan & Protocols
                        <span>→</span>
                    </button>
                </Link>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Time & Availability</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <Link to="/availability" style={{ textDecoration: 'none' }}>
                        <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'space-between' }}>
                            Monthly Availability
                            <span>→</span>
                        </button>
                    </Link>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Contact Settings</h3>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Phone Number (For Directory)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                            type="tel"
                            className="form-input"
                            placeholder="e.g. (555) 123-4567"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button onClick={handleUpdatePhone} disabled={isSaving} className="btn btn-primary text-sm">
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            <button onClick={signOut} className="btn btn-danger" style={{ width: '100%', marginTop: '1rem' }}>
                Log Out
            </button>
        </div>
    );
};

export default ProfilePage;
