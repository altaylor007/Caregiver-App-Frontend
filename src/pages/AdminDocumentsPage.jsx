import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, FileText, Download, CheckCircle, Clock } from 'lucide-react';

const AdminDocumentsPage = () => {
    const [documents, setDocuments] = useState([]);
    const [acknowledgments, setAcknowledgments] = useState({});
    const [loading, setLoading] = useState(true);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [existingFileUrl, setExistingFileUrl] = useState(null);
    const [existingFileName, setExistingFileName] = useState(null);
    const [formError, setFormError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        // Fetch documents
        const { data: docs } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (docs) setDocuments(docs);

        // Fetch acknowledgments and join with users to get names
        const { data: acks } = await supabase
            .from('document_acknowledgments')
            .select(`
                document_id,
                acknowledged_at,
                user_id,
                users (full_name, email)
            `);

        if (acks) {
            // Group acks by document_id
            const acksByDoc = {};
            acks.forEach(ack => {
                if (!acksByDoc[ack.document_id]) {
                    acksByDoc[ack.document_id] = [];
                }
                acksByDoc[ack.document_id].push({
                    userId: ack.user_id,
                    userName: ack.users?.full_name || ack.users?.email || 'Unknown User',
                    date: ack.acknowledged_at
                });
            });
            setAcknowledgments(acksByDoc);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openNewForm = () => {
        setIsEditing(true);
        setCurrentId(null);
        setTitle('');
        setDescription('');
        setFile(null);
        setExistingFileUrl(null);
        setExistingFileName(null);
        setRequiresAcknowledgment(true);
    };

    const openEditForm = (item) => {
        setIsEditing(true);
        setCurrentId(item.id);
        setTitle(item.title);
        setDescription(item.description);
        setFile(null);
        setExistingFileUrl(item.file_url);
        setExistingFileName(item.file_name);
        setRequiresAcknowledgment(item.requires_acknowledgment ?? true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setCurrentId(null);
        setTitle('');
        setDescription('');
        setFile(null);
        setExistingFileUrl(null);
        setExistingFileName(null);
        setRequiresAcknowledgment(true);
        setFormError('');
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!title || !description) {
            setFormError("Title and description are required.");
            return;
        }

        setUploading(true);
        let fileUrl = existingFileUrl;
        let fileName = existingFileName;
        let fileType = null;

        if (file) {
            const fileExt = file.name.split('.').pop();
            const filePath = `${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) {
                setFormError("Error uploading file: " + uploadError.message);
                setUploading(false);
                return;
            }

            const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
            fileUrl = data.publicUrl;
            fileName = file.name;
            fileType = file.type;
        }

        let error;
        if (currentId) {
            // Update
            const res = await supabase.from('documents').update({
                title,
                description,
                file_url: fileUrl,
                file_name: fileName,
                file_type: fileType,
                requires_acknowledgment: requiresAcknowledgment,
                updated_at: new Date().toISOString()
            }).eq('id', currentId);
            error = res.error;
        } else {
            // Insert
            const res = await supabase.from('documents').insert([{
                title,
                description,
                file_url: fileUrl,
                file_name: fileName,
                file_type: fileType,
                requires_acknowledgment: requiresAcknowledgment
            }]);
            error = res.error;

            // Dispatch Notifications to all caregivers if this is a new document
            if (!error) {
                const { data: users } = await supabase.from('users').select('id').eq('role', 'caregiver');
                if (users && users.length > 0) {
                    const { data: { user } } = await supabase.auth.getUser();
                    const notifications = users.map(u => ({
                        user_id: u.id,
                        actor_id: user.id,
                        type: 'document',
                        content: `A new document "${title}" has been uploaded.`
                    }));
                    await supabase.from('notifications').insert(notifications);
                }
            }
        }

        setUploading(false);

        if (error) {
            setFormError(error.message);
        } else {
            setIsEditing(false);
            fetchData();
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm("Delete this document? Caregivers will no longer see it.")) return;

        const { error } = await supabase.from('documents').delete().eq('id', item.id);

        if (!error) {
            // If there's an associated file, we could optionally delete it from storage here
            fetchData();
        } else {
            alert("Error deleting: " + error.message);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Documents</h2>
                {!isEditing && (
                    <button onClick={openNewForm} className="btn btn-primary text-sm" style={{ display: 'flex', gap: '0.25rem' }}>
                        <Plus size={16} /> Add New
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="card" style={{ border: '2px solid var(--primary-500)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>{currentId ? 'Edit Document' : 'Upload New Document'}</h3>

                    {formError && (
                        <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {formError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Title</label>
                            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description / Instructions</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Attached File (Optional)</label>
                            {existingFileName && !file && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--neutral-50)', borderRadius: 'var(--radius-md)' }}>
                                    <FileText size={16} className="text-primary" />
                                    <span className="text-sm">{existingFileName}</span>
                                </div>
                            )}
                            <input
                                type="file"
                                className="form-input"
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                            />
                            <p className="text-xs text-neutral-500" style={{ marginTop: '0.25rem' }}>
                                Upload a new file to {existingFileUrl ? 'replace the existing one' : 'attach to this document'}.
                            </p>
                        </div>

                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                            <input
                                type="checkbox"
                                id="requiresAck"
                                checked={requiresAcknowledgment}
                                onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
                                style={{ width: '1.25rem', height: '1.25rem' }}
                            />
                            <label htmlFor="requiresAck" className="form-label" style={{ marginBottom: 0 }}>
                                Requires caregivers to acknowledge this document
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploading}>
                                {uploading ? 'Saving...' : 'Save Document'}
                            </button>
                            <button type="button" onClick={cancelEdit} className="btn btn-outline" style={{ flex: 1 }} disabled={uploading}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading && !isEditing ? <p>Loading documents...</p> : null}

            {!loading && !isEditing && documents.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No documents have been uploaded yet.</p>
                </div>
            )}

            {!isEditing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {documents.map(item => {
                        const itemAcks = acknowledgments[item.id] || [];

                        return (
                            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={24} className="text-primary" />
                                        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{item.title}</h3>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button onClick={() => openEditForm(item)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }} title="Edit">
                                            <Edit2 size={16} className="text-neutral-500" />
                                        </button>
                                        <button onClick={() => handleDelete(item)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none', color: 'var(--danger-500)' }} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-neutral-700" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{item.description}</p>

                                {/* Attached File */}
                                {item.file_url && (
                                    <div style={{ backgroundColor: 'var(--neutral-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <FileText size={16} className="text-neutral-600" />
                                            <span className="text-sm font-medium">{item.file_name}</span>
                                        </div>
                                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-sm" style={{ padding: '0.25rem 0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                            <Download size={14} /> View
                                        </a>
                                    </div>
                                )}

                                {/* Acknowledgments Section */}
                                {item.requires_acknowledgment && (
                                    <div style={{ borderTop: '1px solid var(--neutral-100)', paddingTop: '1rem' }}>
                                        <h4 style={{ fontSize: '0.875rem', color: 'var(--neutral-600)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckCircle size={14} className="text-success" />
                                            Acknowledgments ({itemAcks.length})
                                        </h4>

                                        {itemAcks.length === 0 ? (
                                            <p className="text-xs text-neutral-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <Clock size={12} /> No caregivers have acknowledged this yet.
                                            </p>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {itemAcks.map((ack, idx) => (
                                                    <div key={idx} style={{
                                                        fontSize: '0.75rem',
                                                        backgroundColor: 'var(--success-50)',
                                                        color: 'var(--success-700)',
                                                        padding: '0.35rem 0.65rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.1rem',
                                                        border: '1px solid var(--success-200)'
                                                    }}>
                                                        <span style={{ fontWeight: 600 }}>{ack.userName}</span>
                                                        <span style={{ fontSize: '0.65rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            <CheckCircle size={10} />
                                                            {ack.date ? new Date(ack.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date unknown'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <p className="text-xs text-neutral-muted" style={{ margin: 0 }}>
                                    Last updated: {new Date(item.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminDocumentsPage;

