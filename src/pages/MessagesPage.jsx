import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { formatShift } from '../lib/timeUtils';
import { ChevronLeft, MessageSquare, Plus, Trash2, SmilePlus, Zap, Image as ImageIcon, X, Camera } from 'lucide-react';

// Quick-pick emojis shown in the hover picker
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🙏'];

// A simple inline emoji picker with a few categories
const EMOJI_LIBRARY = [
    '😀', '😂', '😍', '🥺', '😎', '🤔', '😅', '🙌',
    '👍', '👎', '❤️', '🔥', '🎉', '💯', '✅', '🙏',
    '😢', '😡', '🤦', '🤷', '👀', '💪', '🫶', '🥳',
];

const MessagesPage = () => {
    const { user, isAdmin, profile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [view, setView] = useState('topics');
    const [activeTopic, setActiveTopic] = useState(null);

    const [topics, setTopics] = useState([]);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);

    const [newTopicTitle, setNewTopicTitle] = useState('');
    const [newTopicMessage, setNewTopicMessage] = useState('');
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');

    // Hover emoji picker state: { msgId, showLibrary }
    const [emojiPickerFor, setEmojiPickerFor] = useState(null);
    const emojiPickerRef = useRef(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const hasAutoSelectedRef = useRef(false);

    const unreadTopicIds = useMemo(() => {
        if (!profile?.last_read_messages_at || !messages.length) return new Set();
        const cutoff = new Date(profile.last_read_messages_at);
        return new Set(
            messages
                .filter(m => new Date(m.created_at) > cutoff)
                .map(m => m.topic_id)
        );
    }, [messages, profile?.last_read_messages_at]);

    const latestMessageByTopic = useMemo(() => {
        const map = new Map();
        messages.forEach(m => {
            const current = map.get(m.topic_id);
            if (!current || new Date(m.created_at) > new Date(current)) {
                map.set(m.topic_id, m.created_at);
            }
        });
        return map;
    }, [messages]);

    useEffect(() => {
        fetchUsers();

        const topicsSub = supabase
            .channel('topics_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_topics' }, fetchTopics)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_topics' }, fetchTopics)
            .subscribe();

        return () => supabase.removeChannel(topicsSub);
    }, []);

    useEffect(() => {
        if (view === 'topics') {
            fetchTopics();
        }
    }, [view]);

    // Handle deep-linking to a specific message from a notification URL
    useEffect(() => {
        if (!user) return;

        // Mark as read when landing on page
        supabase.from('users').update({ last_read_messages_at: new Date().toISOString() }).eq('id', user.id).then();

        const msgId = searchParams.get('msg');
        const topicParam = searchParams.get('topic');

        if (msgId) {
            const loadDeepLinkedTopic = async () => {
                // Find what topic this message belongs to
                const { data } = await supabase.from('messages').select('topic_id').eq('id', msgId).single();
                if (data?.topic_id) {
                    // Fetch the topic details
                    const { data: topicData } = await supabase.from('message_topics').select('*').eq('id', data.topic_id).single();
                    if (topicData) {
                        setActiveTopic(topicData);
                        setView('messages');

                        // Clear the msg parameter and replace with topic parameter
                        setSearchParams({ topic: topicData.id }, { replace: true });
                    }
                }
            };
            loadDeepLinkedTopic();
        } else if (topicParam && (!activeTopic || activeTopic.id !== topicParam)) {
            const loadDirectTopic = async () => {
                const { data: topicData } = await supabase.from('message_topics').select('*').eq('id', topicParam).single();
                if (topicData) {
                    setActiveTopic(topicData);
                    setView('messages');
                }
            };
            loadDirectTopic();
        }
    }, [searchParams.get('msg'), searchParams.get('topic'), user]);

    useEffect(() => {
        if (view === 'messages' && activeTopic) {
            fetchMessages(activeTopic.id);

            const msgSub = supabase
                .channel(`messages_topic_${activeTopic.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `topic_id=eq.${activeTopic.id}` }, (payload) => {
                    console.log('Realtime msg change:', payload);
                    fetchMessages(activeTopic.id);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
                    console.log('Realtime reaction change:', payload);
                    fetchMessages(activeTopic.id);
                })
                .subscribe();

            return () => supabase.removeChannel(msgSub);
        }
    }, [view, activeTopic]);

    useEffect(() => {
        if (view === 'messages') {
            // Give a slight delay for messages to render before scrolling to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [messages, view]);

    // Close emoji picker on outside click
    useEffect(() => {
        const handler = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setEmojiPickerFor(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('id, full_name, role');
        if (data) setUsers(data);
    };

    const fetchTopics = async () => {
        const { data } = await supabase
            .from('message_topics')
            .select('*, messages(created_at)');
        if (data) {
            const sortedData = [...data].sort((a, b) => {
                const aLatest = a.messages && a.messages.length > 0
                    ? Math.max(...a.messages.map(m => new Date(m.created_at).getTime()))
                    : 0;
                const bLatest = b.messages && b.messages.length > 0
                    ? Math.max(...b.messages.map(m => new Date(m.created_at).getTime()))
                    : 0;

                if (aLatest !== bLatest) {
                    return bLatest - aLatest;
                }
                return new Date(b.created_at) - new Date(a.created_at);
            });

            setTopics(sortedData);
            if (!hasAutoSelectedRef.current) {
                hasAutoSelectedRef.current = true;
                const topicId = searchParams.get('topic');
                if (topicId) {
                    const matchedTopic = sortedData.find(t => t.id === topicId);
                    if (matchedTopic) {
                        setActiveTopic(matchedTopic);
                        setView('messages');
                    }
                }
            }
        }
    };

    const fetchMessages = async (topicId) => {
        const { data } = await supabase
            .from('messages')
            .select(`*, users(full_name, role, avatar_url), message_reactions(id, emoji, user_id)`)
            .eq('topic_id', topicId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                alert('This file type cannot be displayed in the app. Please use a JPEG, PNG, WebP, or GIF image.\n\niPhone users: when sharing a photo, choose "Most Compatible" format.\n\nAndroid/Samsung users: open your Camera app settings and change the picture format from HEIF to JPEG.');
                e.target.value = '';
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
        }
    };

    const uploadImage = async () => {
        if (!selectedFile) return null;
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error } = await supabase.storage
            .from('message-attachments')
            .upload(filePath, selectedFile, { contentType: selectedFile.type || 'application/octet-stream' });
            
        if (error) {
            console.error('Error uploading image', error);
            throw new Error(`Image upload failed: ${error.message}`);
        }
        
        const { data } = supabase.storage
            .from('message-attachments')
            .getPublicUrl(filePath);
            
        return data.publicUrl;
    };

    const handleCreateTopic = async (e) => {
        e.preventDefault();
        if (!newTopicTitle.trim() || (!newTopicMessage.trim() && !selectedFile)) return;

        setIsCreatingTopic(true);
        const { data: topicData, error: topicError } = await supabase
            .from('message_topics')
            .insert([{ title: newTopicTitle.trim() }])
            .select()
            .single();

        if (topicError || !topicData) {
            alert('Error creating topic: ' + topicError?.message);
            setIsCreatingTopic(false);
            return;
        }

        const imageUrl = await uploadImage();
        const content = newTopicMessage.trim();
        const { data: msgData, error: msgError } = await supabase.from('messages').insert([{
            author_id: user.id,
            topic_id: topicData.id,
            content: content,
            image_url: imageUrl
        }]).select().single();

        if (!msgError && msgData) {
            setNewTopicTitle('');
            setNewTopicMessage('');
            clearImage();
            setActiveTopic(topicData);
            setView('messages');
            setSearchParams({ topic: topicData.id });

            // Handle mentions
            handleMentionsNotification(content, msgData.id);
        } else {
            alert('Topic created but first message failed: ' + msgError?.message);
        }
        setIsCreatingTopic(false);
    };

    const handleDeleteTopic = async (topicId, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this entire thread and all its messages?')) return;

        // Cascade deletes messages if FK is set, otherwise delete messages first
        const { error: msgError } = await supabase.from('messages').delete().eq('topic_id', topicId);
        if (msgError) {
            console.error('Error deleting messages:', msgError);
            alert('Could not delete messages: ' + msgError.message);
            return;
        }

        const { error: topicError } = await supabase.from('message_topics').delete().eq('id', topicId);
        if (topicError) {
            console.error('Error deleting topic:', topicError);
            alert('Could not delete topic: ' + topicError.message);
            return;
        }

        fetchTopics();
    };

    const handleDeleteMessage = async (msgId) => {
        if (!window.confirm('Delete this message?')) return;

        await supabase.from('message_reactions').delete().eq('message_id', msgId);

        const { error: msgError } = await supabase.from('messages').delete().eq('id', msgId);
        if (msgError) {
            console.error('Error deleting message:', msgError);
            alert('Could not delete message: ' + msgError.message);
            return;
        }

        fetchMessages(activeTopic.id);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && !selectedFile) || !user || !activeTopic) return;

        setIsSending(true);
        let imageUrl = null;
        try {
            imageUrl = await uploadImage();
        } catch (uploadErr) {
            alert(uploadErr.message);
            setIsSending(false);
            return;
        }
        const content = newMessage.trim();

        const { data: insertedMsg, error } = await supabase
            .from('messages')
            .insert([{ author_id: user.id, topic_id: activeTopic.id, content, image_url: imageUrl }])
            .select()
            .single();

        if (!error && insertedMsg) {
            setNewMessage('');
            clearImage();

            // Bump read receipt since they are active
            supabase.from('users').update({ last_read_messages_at: new Date().toISOString() }).eq('id', user.id).then();

            // Trigger a manual fetch just in case WebSockets are slow
            fetchMessages(activeTopic.id);

            handleMentionsNotification(content, insertedMsg.id);
        } else {
            alert('Failed to send message.');
        }
        setIsSending(false);
    };

    const handleMentionsNotification = async (content, messageId) => {
        if (!content.includes('@')) return; // Quick exit 

        if (content.toLowerCase().includes('@all')) {
            // Notify everyone except the sender
            const notifications = users.filter(u => u.id !== user.id).map(u => ({
                user_id: u.id, actor_id: user.id, type: 'mention',
                reference_id: messageId, is_read: false
            }));
            if (notifications.length > 0) {
                const { error } = await supabase.from('notifications').insert(notifications);
                if (error) console.error("Error inserting @all notifications:", error);
            }
        } else {
            // Check individual users
            const mentions = users.filter(u => content.toLowerCase().includes(`@${u.full_name?.toLowerCase()}`));
            if (mentions.length > 0) {
                const notifications = mentions.filter(m => m.id !== user.id).map(m => ({
                    user_id: m.id, actor_id: user.id, type: 'mention',
                    reference_id: messageId, is_read: false
                }));
                if (notifications.length > 0) {
                    const { error } = await supabase.from('notifications').insert(notifications);
                    if (error) console.error("Error inserting mention notifications:", error);
                }
            }
        }
    };

    const toggleReaction = async (messageId, emoji) => {
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const existing = msg.message_reactions?.find(r => r.emoji === emoji && r.user_id === user.id);
        if (existing) {
            await supabase.from('message_reactions').delete().eq('id', existing.id);
        } else {
            await supabase.from('message_reactions').insert([{ message_id: messageId, user_id: user.id, emoji }]);
        }
        setEmojiPickerFor(null);
    };

    const handleInputMentions = (e, isNewTopic = false) => {
        const val = e.target.value;
        if (isNewTopic) setNewTopicMessage(val);
        else setNewMessage(val);

        const match = val.match(/@(\w*)$/);
        if (match) { setShowMentions(true); setMentionFilter(match[1].toLowerCase()); }
        else setShowMentions(false);
    };

    const insertMention = (name) => {
        if (view === 'topics') {
            setNewTopicMessage(newTopicMessage.replace(/@\w*$/, `@${name} `));
        } else {
            setNewMessage(newMessage.replace(/@\w*$/, `@${name} `));
        }
        setShowMentions(false);
        inputRef.current?.focus();
    };

    return (
        <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
                {view === 'messages' && (
                    <button onClick={() => { setView('topics'); setSearchParams({}); }} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}>
                        <ChevronLeft size={24} />
                    </button>
                )}
                <h2 style={{ margin: 0 }}>
                    {view === 'topics' ? 'Team Topics' : activeTopic?.title}
                </h2>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', height: '100%' }}>

                {/* --- TOPICS VIEW --- */}
                {view === 'topics' && (
                    <>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
                            {isAdmin && (
                                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--neutral-500)', textTransform: 'uppercase' }}>Quick Actions:</span>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setNewTopicTitle('Submit your availability');
                                            setNewTopicMessage('Please submit your availability for next month by the 20th so we can prepare the schedule. @all');
                                            inputRef.current?.focus();
                                        }}
                                        className="btn btn-outline"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center', color: 'var(--primary-600)', borderColor: 'var(--primary-200)' }}
                                    >
                                        <Zap size={12} /> Request Availability from Team
                                    </button>
                                </div>
                            )}
                            <form onSubmit={handleCreateTopic} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <input
                                    type="text" className="form-input"
                                    placeholder="Topic Title (e.g. Schedule Change)"
                                    value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)}
                                    maxLength={50} required
                                />
                                <textarea
                                    ref={view === 'topics' ? inputRef : null}
                                    className="form-input" placeholder="First message... (Use @Name or @all to tag)" rows="2"
                                    value={newTopicMessage} onChange={(e) => handleInputMentions(e, true)}
                                    required={!selectedFile} style={{ resize: 'vertical' }}
                                />

                                {previewUrl && view === 'topics' && (
                                    <div style={{ position: 'relative', width: 'fit-content' }}>
                                        <img src={previewUrl} alt="Preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }} />
                                        <button type="button" onClick={clearImage} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger-500)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* Mentions Dropdown inside of new topic form */}
                                {showMentions && view === 'topics' && (
                                    <div style={{ backgroundColor: 'white', border: '1px solid var(--neutral-200)', borderRadius: 'var(--radius-md)', maxHeight: 150, overflowY: 'auto' }}>
                                        <div className="text-xs text-neutral-muted" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--neutral-50)' }}>Mention someone...</div>
                                        {/* "All" Option */}
                                        {"all".includes(mentionFilter) && (
                                            <div onClick={() => insertMention('all')}
                                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--neutral-100)' }}>
                                                <span style={{ fontWeight: 600 }}>all</span> <span className="text-xs text-neutral-muted">(Notify Everyone)</span>
                                            </div>
                                        )}
                                        {users.filter(u => u.full_name?.toLowerCase().includes(mentionFilter)).map(u => (
                                            <div key={u.id} onClick={() => insertMention(u.full_name)}
                                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--neutral-100)' }}>
                                                <span style={{ fontWeight: 600 }}>{u.full_name}</span> <span className="text-xs text-neutral-muted">({u.role})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <div>
                                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} id="topic-image-upload" />
                                            <label htmlFor="topic-image-upload" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', cursor: 'pointer', border: 'none', color: 'var(--neutral-600)', background: 'white' }}>
                                                <ImageIcon size={18} /> Attach Image
                                            </label>
                                        </div>
                                        <div>
                                            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageChange} style={{ display: 'none' }} id="topic-camera-upload" />
                                            <label htmlFor="topic-camera-upload" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', cursor: 'pointer', border: 'none', color: 'var(--neutral-600)', background: 'white' }}>
                                                <Camera size={18} /> Take Photo
                                            </label>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={isCreatingTopic} className="btn btn-primary" style={{ display: 'flex', gap: '0.25rem' }}>
                                        <Plus size={16} /> Create Topic
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {topics.length === 0 ? (
                                <p className="text-sm text-neutral-muted" style={{ padding: '2rem', textAlign: 'center' }}>No topics yet. Create one!</p>
                            ) : (
                                topics.map(topic => {
                                    const latestDate = latestMessageByTopic.get(topic.id);
                                    return (
                                        <div
                                            key={topic.id}
                                            onClick={() => { setActiveTopic(topic); setView('messages'); setSearchParams({ topic: topic.id }); }}
                                            className={unreadTopicIds.has(topic.id) ? 'topic-item--unread' : ''}
                                            style={{ padding: '1rem', borderBottom: '1px solid var(--neutral-100)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--neutral-50)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-100)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <MessageSquare size={20} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{ fontSize: '1rem', marginBottom: '0.1rem' }}>
                                                    {topic.title}
                                                    {unreadTopicIds.has(topic.id) && (
                                                        <span className="topic-unread-dot" aria-label="Unread messages" />
                                                    )}
                                                </h3>
                                                <p className="text-xs text-neutral-muted">
                                                    {latestDate ? formatDistanceToNow(new Date(latestDate), { addSuffix: true }) : 'No messages yet'}
                                                </p>
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    onClick={(e) => handleDeleteTopic(topic.id, e)}
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.3rem', border: 'none', color: 'var(--danger-500)', flexShrink: 0 }}
                                                    title="Delete thread"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )}

                {/* --- MESSAGES VIEW --- */}
                {view === 'messages' && (
                    <>
                        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: 'white' }}>
                            {messages.length === 0 ? (
                                <p className="text-sm text-neutral-muted" style={{ textAlign: 'center', marginTop: '2rem' }}>No messages in this thread yet.</p>
                            ) : (
                                messages.map((msg) => {
                                    const isMine = msg.author_id === user?.id;
                                    const isAdminMsg = msg.users?.role === 'admin';
                                    const canDelete = isMine || isAdmin;

                                    // Aggregate reactions
                                    const reactionCounts = {};
                                    if (msg.message_reactions) {
                                        msg.message_reactions.forEach(r => {
                                            if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, me: false };
                                            reactionCounts[r.emoji].count++;
                                            if (r.user_id === user.id) reactionCounts[r.emoji].me = true;
                                        });
                                    }

                                    const isPickerOpen = emojiPickerFor?.msgId === msg.id;

                                    return (
                                        <div
                                            key={msg.id}
                                            style={{ display: 'flex', gap: '0.75rem', flexDirection: isMine ? 'row-reverse' : 'row' }}
                                            onMouseLeave={() => {
                                                // Don't close if picker is open
                                                if (!isPickerOpen) setEmojiPickerFor(null);
                                            }}
                                        >
                                            {/* Avatar */}
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                                backgroundColor: isAdminMsg ? 'var(--primary-600)' : 'var(--secondary-100)',
                                                color: isAdminMsg ? 'white' : 'var(--secondary-700)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 'bold', fontSize: '0.875rem', overflow: 'hidden'
                                            }}>
                                                {msg.users?.avatar_url ? (
                                                    <img src={msg.users.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    msg.users?.full_name?.charAt(0).toUpperCase() || '?'
                                                )}
                                            </div>

                                            <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                                {/* Name + time */}
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.75rem', color: isAdminMsg ? 'var(--primary-700)' : 'var(--neutral-700)' }}>
                                                        {isMine ? 'You' : (msg.users?.full_name || 'Caregiver')}
                                                        {isAdminMsg && !isMine && ' (Admin)'}
                                                    </span>
                                                    <span className="text-xs text-neutral-muted">
                                                        {formatShift(msg.created_at, 'M/d, h:mm a')}
                                                    </span>
                                                </div>

                                                {/* Bubble + hover actions */}
                                                <div style={{ position: 'relative' }}>
                                                    <div
                                                        className="text-sm"
                                                        style={{
                                                            backgroundColor: isMine ? 'var(--primary-600)' : 'var(--neutral-100)',
                                                            color: isMine ? 'white' : 'inherit',
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: isMine ? '16px 16px 0 16px' : '16px 16px 16px 0',
                                                            wordBreak: 'break-word',
                                                            lineHeight: '1.4'
                                                        }}
                                                    >
                                                        {msg.image_url && (
                                                            <div style={{ marginBottom: msg.content ? '0.5rem' : '0' }}>
                                                                <img src={msg.image_url} alt="Attached image" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(msg.image_url, '_blank')} />
                                                            </div>
                                                        )}
                                                        {msg.content}
                                                    </div>

                                                    {/* Hover action bar — shown on group hover via inline state */}
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%', transform: 'translateY(-50%)',
                                                            [isMine ? 'right' : 'left']: 'calc(100% + 6px)',
                                                            display: 'flex', gap: '0.25rem', alignItems: 'center',
                                                            opacity: 0,
                                                        }}
                                                        className="msg-actions"
                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={(e) => { if (!isPickerOpen) e.currentTarget.style.opacity = '0'; }}
                                                    >
                                                        {/* Emoji reaction button */}
                                                        <div style={{ position: 'relative' }}>
                                                            <button
                                                                onClick={() => setEmojiPickerFor(isPickerOpen ? null : { msgId: msg.id, showLibrary: false })}
                                                                title="React"
                                                                style={{ background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                                            >
                                                                <SmilePlus size={14} color="var(--neutral-600)" />
                                                            </button>

                                                            {/* Emoji picker popup */}
                                                            {isPickerOpen && (
                                                                <div
                                                                    ref={emojiPickerRef}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        bottom: 'calc(100% + 6px)',
                                                                        [isMine ? 'right' : 'left']: 0,
                                                                        backgroundColor: 'white',
                                                                        borderRadius: 'var(--radius-lg)',
                                                                        boxShadow: 'var(--shadow-lg)',
                                                                        padding: '0.5rem',
                                                                        zIndex: 200,
                                                                        minWidth: '200px',
                                                                        border: '1px solid var(--neutral-200)'
                                                                    }}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {/* Quick picks */}
                                                                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--neutral-100)', paddingBottom: '0.5rem' }}>
                                                                        {QUICK_REACTIONS.map(emoji => (
                                                                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                                                                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', padding: '0.1rem', borderRadius: 4, lineHeight: 1 }}
                                                                                title={emoji}
                                                                            >{emoji}</button>
                                                                        ))}
                                                                    </div>

                                                                    {/* Toggle full library */}
                                                                    <button
                                                                        onClick={() => setEmojiPickerFor(prev => ({ ...prev, showLibrary: !prev.showLibrary }))}
                                                                        style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary-600)', cursor: 'pointer', display: 'block', marginBottom: emojiPickerFor?.showLibrary ? '0.5rem' : 0, padding: '0.1rem 0' }}
                                                                    >
                                                                        {emojiPickerFor?.showLibrary ? '▲ Hide library' : '▼ More emoji'}
                                                                    </button>

                                                                    {emojiPickerFor?.showLibrary && (
                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '0.1rem', marginTop: '0.25rem' }}>
                                                                            {EMOJI_LIBRARY.map(emoji => (
                                                                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                                                                    style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: '0.15rem', borderRadius: 4, lineHeight: 1 }}
                                                                                    title={emoji}
                                                                                >{emoji}</button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Delete own/admin button */}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                title="Delete message"
                                                                style={{ background: 'var(--neutral-100)', border: '1px solid var(--neutral-200)', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: 'var(--danger-500)' }}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Existing reactions display */}
                                                {Object.keys(reactionCounts).length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                                                        {Object.keys(reactionCounts).map(emoji => (
                                                            <div
                                                                key={emoji}
                                                                onClick={() => toggleReaction(msg.id, emoji)}
                                                                style={{
                                                                    backgroundColor: reactionCounts[emoji].me ? 'var(--primary-50)' : 'var(--neutral-50)',
                                                                    border: `1px solid ${reactionCounts[emoji].me ? 'var(--primary-300)' : 'var(--neutral-200)'}`,
                                                                    padding: '0.1rem 0.4rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                                }}
                                                            >
                                                                {emoji} <span style={{ fontWeight: 600, color: 'var(--neutral-600)' }}>{reactionCounts[emoji].count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Mentions Dropdown */}
                        {showMentions && view === 'messages' && (
                            <div style={{ backgroundColor: 'white', borderTop: '1px solid var(--neutral-200)', borderBottom: '1px solid var(--neutral-200)', maxHeight: 150, overflowY: 'auto' }}>
                                <div className="text-xs text-neutral-muted" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--neutral-50)' }}>Mention a team member</div>
                                {/* "All" Option */}
                                {"all".includes(mentionFilter) && (
                                    <div onClick={() => insertMention('all')}
                                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--neutral-100)' }}>
                                        <span style={{ fontWeight: 600 }}>all</span> <span className="text-xs text-neutral-muted">(Notify Everyone)</span>
                                    </div>
                                )}
                                {users.filter(u => u.full_name?.toLowerCase().includes(mentionFilter)).map(u => (
                                    <div key={u.id} onClick={() => insertMention(u.full_name)}
                                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--neutral-100)' }}>
                                        <span style={{ fontWeight: 600 }}>{u.full_name}</span> <span className="text-xs text-neutral-muted">({u.role})</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {previewUrl && view === 'messages' && (
                            <div style={{ padding: '0.75rem 1rem 0 1rem', backgroundColor: 'var(--neutral-50)' }}>
                                <div style={{ position: 'relative', width: 'fit-content' }}>
                                    <img src={previewUrl} alt="Preview" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }} />
                                    <button type="button" onClick={clearImage} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger-500)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Input Box */}
                        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-outline" style={{ padding: '0.6rem', border: '1px solid var(--neutral-300)', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)' }} title="Attach Image">
                                    <ImageIcon size={18} color="var(--neutral-600)" />
                                </button>
                                <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn btn-outline" style={{ padding: '0.6rem', border: '1px solid var(--neutral-300)', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)' }} title="Take Photo">
                                    <Camera size={18} color="var(--neutral-600)" />
                                </button>
                                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageChange} style={{ display: 'none' }} />
                                <input
                                    ref={inputRef} type="text" className="form-input"
                                    placeholder="Type a message... (Use @Name to tag)"
                                    style={{ flex: 1, backgroundColor: 'white' }}
                                    value={newMessage} onChange={handleInputMentions}
                                    disabled={isSending} autoComplete="off"
                                />
                                <button type="submit" disabled={isSending || (!newMessage.trim() && !selectedFile)} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                                    {isSending ? '...' : 'Send'}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>

            {/* CSS for hover reveal of action bar */}
            <style>{`
                .msg-actions { opacity: 0; transition: opacity 0.15s; }
                div:hover > div > div > .msg-actions { opacity: 1; }
            `}</style>
        </div>
    );
};

export default MessagesPage;
