import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

const ProfilePage = () => {
    const { user, profile, signOut } = useAuth();
    const [firstName, setFirstName] = useState(profile?.first_name || '');
    const [lastName, setLastName] = useState(profile?.last_name || '');
    const [phone, setPhone] = useState(profile?.phone_number || profile?.phone || '');
    const [smsEnabled, setSmsEnabled] = useState(profile?.sms_enabled || false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

    useEffect(() => {
        if (profile?.first_name) setFirstName(profile.first_name);
        if (profile?.last_name) setLastName(profile.last_name);
        if (profile?.phone_number || profile?.phone) setPhone(profile.phone_number || profile.phone);
        if (profile?.sms_enabled !== undefined) setSmsEnabled(profile.sms_enabled);
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    }, [profile]);

    const handleUpdateSettings = async () => {
        setIsSaving(true);
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        const { error } = await supabase.from('users').update({
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            full_name: fullName || null,
            phone_number: phone,
            sms_enabled: smsEnabled,
            phone: phone
        }).eq('id', user.id);

        setIsSaving(false);
        if (error) {
            alert("Failed to update settings: " + error.message);
        } else {
            alert('Settings updated successfully!');
        }
    };

    const handleImageUpload = async (event) => {
        try {
            setIsUploading(true);
            const file = event.target.files[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            const { error: updateError } = await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id);
            if (updateError) throw updateError;

            setAvatarUrl(data.publicUrl);
            alert('Avatar updated successfully!');
        } catch (error) {
            alert('Error uploading avatar: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div>
            <h2 style={{ marginBottom: '1rem' }}>Profile & Settings</h2>

            <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1rem auto' }}>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt="Profile Avatar"
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2rem' }}>
                            {(firstName || profile?.first_name || user?.email)?.charAt(0).toUpperCase() || 'C'}
                        </div>
                    )}
                    <label style={{
                        position: 'absolute', bottom: 0, right: -5,
                        backgroundColor: 'var(--primary-600)', color: 'white',
                        borderRadius: '50%', width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
                    }}>
                        <span style={{ fontSize: '1rem' }}>+</span>
                        <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                </div>
                {isUploading && <p className="text-xs text-primary-600" style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>Uploading...</p>}
                <h3 className="text-sm">Caregiver Account</h3>
                <p className="text-neutral-muted text-sm">{user?.email}</p>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Documents List</h3>
                <Link to="/documents" style={{ textDecoration: 'none' }}>
                    <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'space-between' }}>
                        View Documents
                        <span>→</span>
                    </button>
                </Link>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Your Name</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div className="form-group">
                        <label className="form-label">First Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Jane"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            style={{ marginTop: '0.5rem' }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Last Name</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Doe"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            style={{ marginTop: '0.5rem' }}
                        />
                    </div>
                </div>
                <p className="text-xs text-neutral-muted">Your name appears on the schedule and to other team members.</p>
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
                <h3 style={{ marginBottom: '1rem' }}>Contact & Notifications</h3>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Phone Number</label>
                    <input
                        type="tel"
                        className="form-input"
                        placeholder="e.g. +15551234567"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        style={{ width: '100%', marginTop: '0.5rem' }}
                    />
                    <p className="text-xs text-neutral-muted" style={{ marginTop: '0.25rem' }}>Include country code (e.g. +1 for US) for SMS delivery.</p>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <label className="form-label" style={{ marginBottom: 0 }}>SMS Notifications</label>
                        <p className="text-xs text-neutral-muted">Receive texts for available shifts & updates.</p>
                    </div>
                    <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                        <input
                            type="checkbox"
                            checked={smsEnabled}
                            onChange={(e) => setSmsEnabled(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: smsEnabled ? 'var(--primary-600)' : '#ccc', transition: '.4s', borderRadius: '24px'
                        }}>
                            <span style={{
                                position: 'absolute', content: '""', height: '18px', width: '18px', left: smsEnabled ? '18px' : '3px', bottom: '3px',
                                backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                            }}></span>
                        </span>
                    </label>
                </div>

                <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                    <p className="text-xs text-neutral-700" style={{ lineHeight: '1.4' }}>
                        By providing your phone number and enabling SMS Notifications, you agree to receive scheduling and notification messages from Agnes Care Team. Msg & data rates may apply. Msg frequency varies. Reply STOP to cancel or HELP for help. See our <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-600)' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-600)' }}>Privacy Policy</a>.
                    </p>
                </div>

                <button onClick={handleUpdateSettings} disabled={isSaving} className="btn btn-primary" style={{ width: '100%' }}>
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            <button onClick={signOut} className="btn btn-danger" style={{ width: '100%', marginTop: '1rem' }}>
                Log Out
            </button>
        </div>
    );
};

export default ProfilePage;
