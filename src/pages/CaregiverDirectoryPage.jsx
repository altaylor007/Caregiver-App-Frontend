import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, User as UserIcon } from 'lucide-react';

const CaregiverDirectoryPage = () => {
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDirectory = async () => {
            setLoading(true);
            // Fetch all active users (we can display both admins and caregivers, or just caregivers)
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, email, role, phone, avatar_url')
                .eq('status', 'active')
                .order('full_name', { ascending: true });

            if (data && !error) {
                setCaregivers(data);
            }
            setLoading(false);
        };

        fetchDirectory();
    }, []);

    return (
        <div style={{ paddingBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Team Directory</h2>

            {loading ? (
                <p className="text-sm text-neutral-muted">Loading directory...</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {caregivers.map(person => (
                        <div key={person.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                            <div style={{
                                width: 50, height: 50, borderRadius: '50%', backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 'bold', overflow: 'hidden'
                            }}>
                                {person.avatar_url ? (
                                    <img src={person.avatar_url} alt={person.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    person.full_name ? person.full_name.charAt(0).toUpperCase() : <UserIcon size={24} />
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{person.full_name || 'Unnamed Caregiver'}</h3>
                                    {person.role === 'admin' && (
                                        <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--primary-600)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Admin</span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                                    {person.phone ? (
                                        <a href={`tel:${person.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--neutral-600)', textDecoration: 'none', fontSize: '0.875rem' }}>
                                            <Phone size={14} className="text-primary" /> {person.phone}
                                        </a>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--neutral-400)', fontSize: '0.875rem' }}>
                                            <Phone size={14} /> No phone provided
                                        </div>
                                    )}

                                    <a href={`mailto:${person.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--neutral-600)', textDecoration: 'none', fontSize: '0.875rem' }}>
                                        <Mail size={14} className="text-primary" /> {person.email}
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CaregiverDirectoryPage;
