import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CaregiverResponsibilitiesPage = () => {
    const { user, profile } = useAuth();
    const [responsibilities, setResponsibilities] = useState([]);
    const [loading, setLoading] = useState(true);

    // Check if the user is an admin; admins always bypass the acknowledgement.
    // If caregiver, check if they acknowledged. Default to assuming they need to if we don't know yet.
    const isAdmin = profile?.role === 'admin';
    const [hasAcknowledged, setHasAcknowledged] = useState(isAdmin || profile?.acknowledged_responsibilities === true);
    const [isAcknowledging, setIsAcknowledging] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (profile) {
            setHasAcknowledged(profile.role === 'admin' || profile.acknowledged_responsibilities === true);
        }
    }, [profile]);

    useEffect(() => {
        const fetchItems = async () => {
            const { data } = await supabase
                .from('responsibilities')
                .select('*')
                .order('last_updated', { ascending: false });

            if (data) setResponsibilities(data);
            setLoading(false);
        };

        fetchItems();
    }, []);

    const handleAcknowledge = async () => {
        if (!user) return;
        setIsAcknowledging(true);
        const { error } = await supabase
            .from('users')
            .update({ acknowledged_responsibilities: true })
            .eq('id', user.id);

        setIsAcknowledging(false);
        if (!error) {
            setHasAcknowledged(true);
        } else {
            alert("Error saving acknowledgement: " + error.message);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}>
                    <ChevronLeft size={24} />
                </button>
                <h2 style={{ margin: 0 }}>Care Plan & Protocols</h2>
            </div>

            <div className="card" style={{ backgroundColor: 'var(--primary-50)', borderLeft: '4px solid var(--primary-500)', marginBottom: '1.5rem' }}>
                <p className="text-sm">
                    <strong>Important:</strong> Please review this section regularly. You will receive notifications when these protocols change.
                </p>
            </div>

            {loading ? (
                <p>Loading responsibilities...</p>
            ) : responsibilities.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No protocols have been posted yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {responsibilities.map(item => (
                        <div key={item.id} className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <FileText size={18} className="text-primary" />
                                <h3 style={{ fontSize: '1.125rem', margin: 0 }}>{item.title}</h3>
                            </div>
                            <p className="text-sm text-neutral-700" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                                {item.description}
                            </p>
                            <p className="text-xs text-neutral-muted" style={{ marginTop: '0.75rem', borderTop: '1px solid var(--neutral-100)', paddingTop: '0.5rem' }}>
                                Last updated: {new Date(item.last_updated).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {!hasAcknowledged && responsibilities.length > 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '2px dashed var(--primary-500)', marginTop: '2rem', backgroundColor: 'var(--primary-50)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'var(--primary-200)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <FileText size={32} />
                    </div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Acknowledge Responsibilities</h3>
                    <p className="text-neutral-600" style={{ marginBottom: '2rem', lineHeight: '1.6' }}>
                        By clicking below, you confirm that you have read, understood, and agree to the standard operating procedures and responsibilities listed above.
                    </p>
                    <button
                        onClick={handleAcknowledge}
                        disabled={isAcknowledging}
                        className="btn btn-primary"
                        style={{ width: '100%', maxWidth: 300, margin: '0 auto' }}
                    >
                        {isAcknowledging ? 'Processing...' : 'I Acknowledge & Agree'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CaregiverResponsibilitiesPage;
