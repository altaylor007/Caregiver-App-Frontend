import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2 } from 'lucide-react';

const AdminResponsibilitiesPage = () => {
    const [responsibilities, setResponsibilities] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [formError, setFormError] = useState('');

    const fetchItems = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('responsibilities')
            .select('*')
            .order('last_updated', { ascending: false });

        if (data) setResponsibilities(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const openNewForm = () => {
        setIsEditing(true);
        setCurrentId(null);
        setTitle('');
        setDescription('');
    };

    const openEditForm = (item) => {
        setIsEditing(true);
        setCurrentId(item.id);
        setTitle(item.title);
        setDescription(item.description);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setCurrentId(null);
        setTitle('');
        setDescription('');
        setFormError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!title || !description) {
            setFormError("Title and description are required.");
            return;
        }

        let error;
        if (currentId) {
            // Update
            const res = await supabase.from('responsibilities').update({
                title,
                description,
                last_updated: new Date().toISOString()
            }).eq('id', currentId);
            error = res.error;
        } else {
            // Insert
            const res = await supabase.from('responsibilities').insert([{ title, description }]);
            error = res.error;
        }

        if (error) {
            setFormError(error.message);
        } else {
            setIsEditing(false);
            fetchItems();

            // Notify (For now, we just log it. A true notification system would broadcast here)
            console.log("Broadcasting notification for responsibilities update...");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this responsibility?")) return;
        const { error } = await supabase.from('responsibilities').delete().eq('id', id);
        if (!error) fetchItems();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>Responsibilities</h2>
                {!isEditing && (
                    <button onClick={openNewForm} className="btn btn-primary text-sm" style={{ display: 'flex', gap: '0.25rem' }}>
                        <Plus size={16} /> Add New
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="card" style={{ border: '2px solid var(--primary-500)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>{currentId ? 'Edit Responsibility' : 'New Responsibility'}</h3>

                    {formError && (
                        <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-600)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {formError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Task / Title</label>
                            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Detailed Description</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
                            <button type="button" onClick={cancelEdit} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {loading && !isEditing ? <p>Loading...</p> : null}

            {!loading && !isEditing && responsibilities.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p className="text-neutral-muted">No responsibilities have been documented yet.</p>
                </div>
            )}

            {!isEditing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {responsibilities.map(item => (
                        <div key={item.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.125rem' }}>{item.title}</h3>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button onClick={() => openEditForm(item)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}>
                                        <Edit2 size={16} className="text-neutral-500" />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none', color: 'var(--danger-500)' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-neutral-700" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
                            <p className="text-xs text-neutral-muted" style={{ marginTop: '0.75rem' }}>
                                Last updated: {new Date(item.last_updated).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminResponsibilitiesPage;
