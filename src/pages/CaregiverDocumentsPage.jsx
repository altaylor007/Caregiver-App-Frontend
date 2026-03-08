import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, ChevronLeft, Download, CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const CaregiverDocumentsPage = () => {
    const { user, profile } = useAuth();
    const location = useLocation();
    const isOnboarding = new URLSearchParams(location.search).get('onboarding') === 'true';
    const [documents, setDocuments] = useState([]);
    const [acknowledgedDocIds, setAcknowledgedDocIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [acknowledgingId, setAcknowledgingId] = useState(null);

    const isAdmin = profile?.role === 'admin';
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            setLoading(true);

            // Fetch documents
            const { data: docs } = await supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (docs) setDocuments(docs);

            // Fetch acknowledgments for this user
            const { data: acks } = await supabase
                .from('document_acknowledgments')
                .select('document_id')
                .eq('user_id', user.id);

            if (acks) {
                const ackSet = new Set(acks.map(a => a.document_id));
                setAcknowledgedDocIds(ackSet);
            }

            setLoading(false);
        };

        fetchData();
    }, [user]);

    const handleAcknowledge = async (docId) => {
        if (!user || acknowledgingId) return;

        // Admins don't need to acknowledge, but we can let them if they want to test it
        // However, usually we might just return here if isAdmin, but let's allow it for testing purposes.

        setAcknowledgingId(docId);

        const { error } = await supabase
            .from('document_acknowledgments')
            .insert([{
                document_id: docId,
                user_id: user.id
            }]);

        if (!error) {
            setAcknowledgedDocIds(prev => {
                const newSet = new Set(prev);
                newSet.add(docId);
                return newSet;
            });

            // Also update the old 'acknowledged_responsibilities' flag just in case 
            // other parts of the app still rely on it for general onboarding checks.
            // We only need to do this once.
            if (!profile?.acknowledged_responsibilities) {
                await supabase.from('users').update({ acknowledged_responsibilities: true }).eq('id', user.id);
            }
        } else {
            // Handle unique constraint violation silently if they somehow double-clicked
            if (error.code !== '23505') {
                alert("Error saving acknowledgement: " + error.message);
            } else {
                setAcknowledgedDocIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(docId);
                    return newSet;
                });
            }
        }
        setAcknowledgingId(null);
    };

    const allAcknowledged = documents.filter(d => d.requires_acknowledgment).every(doc => acknowledgedDocIds.has(doc.id));

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                {!isOnboarding && (
                    <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}>
                        <ChevronLeft size={24} />
                    </button>
                )}
                <h2 style={{ margin: 0 }}>Documents</h2>
            </div>

            {isOnboarding && (
                <div style={{
                    backgroundColor: 'var(--primary-600)',
                    color: 'white',
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        Step 1: Review Required Protocols
                    </h3>
                    <p style={{ margin: 0, opacity: 0.9 }}>
                        Welcome to Agnes Care Team! Before we get you scheduled, please ensure you read and acknowledge any required documents below.
                    </p>
                </div>
            )}

            <div className="card" style={{ backgroundColor: 'var(--primary-50)', borderLeft: '4px solid var(--primary-500)', marginBottom: '1.5rem' }}>
                <p className="text-sm">
                    <strong>Important:</strong> Please review any documents below that require acknowledgment. You will receive a notification when new documents are uploaded.
                </p>
            </div>

            {!loading && documents.filter(d => d.requires_acknowledgment).length > 0 && allAcknowledged && !isAdmin && (
                <div style={{ backgroundColor: 'var(--success-50)', color: 'var(--success-700)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <CheckCircle size={18} />
                    You are up to date! All protocols have been acknowledged.
                </div>
            )}

            {loading ? (
                <p>Loading documents...</p>
            ) : documents.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No documents have been posted yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {documents.map(item => {
                        const isAcked = acknowledgedDocIds.has(item.id);

                        return (
                            <div key={item.id} className="card" style={{
                                border: (item.requires_acknowledgment && !isAcked) ? '2px solid var(--warning-400)' : '1px solid var(--neutral-200)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Status Indicator Strip */}
                                {item.requires_acknowledgment && !isAcked && !isAdmin && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: 'var(--warning-500)' }} />
                                )}
                                {item.requires_acknowledgment && isAcked && !isAdmin && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: 'var(--success-500)' }} />
                                )}

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: 40, height: 40,
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--primary-50)',
                                        color: 'var(--primary-600)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <FileText size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem 0' }}>{item.title}</h3>
                                        <p className="text-xs text-neutral-muted" style={{ margin: 0 }}>
                                            Updated: {new Date(item.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-sm text-neutral-700" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: '1rem' }}>
                                    {item.description}
                                </p>

                                {item.file_url && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <a
                                            href={item.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline text-sm"
                                            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', width: '100%', justifyContent: 'center', backgroundColor: 'var(--neutral-50)' }}
                                        >
                                            <Download size={16} /> Open Attached Document
                                        </a>
                                    </div>
                                )}

                                {/* Acknowledgment Area */}
                                {!isAdmin && item.requires_acknowledgment && (
                                    <div style={{
                                        borderTop: '1px solid var(--neutral-100)',
                                        paddingTop: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {isAcked ? (
                                                <CheckCircle size={20} className="text-success" />
                                            ) : (
                                                <Circle size={20} className="text-warning-500" />
                                            )}
                                            <span style={{ fontSize: '0.875rem', fontWeight: isAcked ? 500 : 600, color: isAcked ? 'var(--neutral-600)' : 'var(--warning-700)' }}>
                                                {isAcked ? 'Acknowledged' : 'Action Required: Please read and acknowledge'}
                                            </span>
                                        </div>

                                        {!isAcked && (
                                            <button
                                                onClick={() => handleAcknowledge(item.id)}
                                                disabled={acknowledgingId === item.id}
                                                className="btn btn-primary text-sm"
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                {acknowledgingId === item.id ? 'Processing...' : 'Acknowledge'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {isOnboarding && !loading && (
                <div style={{
                    position: 'sticky',
                    bottom: 0,
                    backgroundColor: 'white',
                    padding: '1rem',
                    borderTop: '1px solid var(--neutral-200)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: '0 -4px 10px rgba(0,0,0,0.05)',
                    marginTop: '2rem',
                    margin: '2rem -1rem -2rem -1rem' // Override parent padding to bleed to edges
                }}>
                    <button
                        onClick={() => navigate('/availability?onboarding=true')}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    >
                        Next Step: Set Availability <ArrowRight size={20} />
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="btn btn-outline"
                        style={{ border: 'none', color: 'var(--neutral-500)' }}
                    >
                        Skip Onboarding for now
                    </button>
                </div>
            )}
        </div>
    );
};

export default CaregiverDocumentsPage;

