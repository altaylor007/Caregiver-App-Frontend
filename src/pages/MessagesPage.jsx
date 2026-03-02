import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, MessageSquare, Plus, Trash2, SmilePlus } from 'lucide-react';

// Quick-pick emojis shown in the hover picker
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🙏'];

// A simple inline emoji picker with a few categories
const EMOJI_LIBRARY = [
    '😀', '😂', '😍', '🥺', '😎', '🤔', '😅', '🙌',
    '👍', '👎', '❤️', '🔥', '🎉', '💯', '✅', '🙏',
    '😢', '😡', '🤦', '🤷', '👀', '💪', '🫶', '🥳',
];

const MessagesPage = () => {
    const { user, isAdmin } = useAuth();
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

    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');

    // Hover emoji picker state: { msgId, showLibrary }
    const [emojiPickerFor, setEmojiPickerFor] = useState(null);
    const emojiPickerRef = useRef(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        fetchTopics();
        fetchUsers();

        const topicsSub = supabase
            .channel('topics_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_topics' }, fetchTopics)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_topics' }, fetchTopics)
            .subscribe();

        return () => supabase.removeChannel(topicsSub);
    }, []);

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
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setTopics(data);
    };

    const fetchMessages = async (topicId) => {
        const { data } = await supabase
            .from('messages')
            .select(`*, users(full_name, role, avatar_url), message_reactions(id, emoji, user_id)`)
            .eq('topic_id', topicId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
    };

    const handleCreateTopic = async (e) => {
        e.preventDefault();
        if (!newTopicTitle.trim() || !newTopicMessage.trim()) return;

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

        const content = newTopicMessage.trim();
        const { data: msgData, error: msgError } = await supabase.from('messages').insert([{
            author_id: user.id,
            topic_id: topicData.id,
            content: content
        }]).select().single();

        if (!msgError && msgData) {
            setNewTopicTitle('');
            setNewTopicMessage('');
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
        await supabase.from('messages').delete().eq('topic_id', topicId);
        await supabase.from('message_topics').delete().eq('id', topicId);
        fetchTopics();
    };

    const handleDeleteMessage = async (msgId) => {
        if (!window.confirm('Delete this message?')) return;
        await supabase.from('message_reactions').delete().eq('message_id', msgId);
        await supabase.from('messages').delete().eq('id', msgId);
        fetchMessages(activeTopic.id);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !activeTopic) return;

        setIsSending(true);
        const content = newMessage.trim();

        const { data: insertedMsg, error } = await supabase
            .from('messages')
            .insert([{ author_id: user.id, topic_id: activeTopic.id, content }])
            .select()
            .single();

        if (!error && insertedMsg) {
            setNewMessage('');

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
                                    required style={{ resize: 'vertical' }}
                                />

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
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
                                topics.map(topic => (
                                    <div
                                        key={topic.id}
                                        onClick={() => { setActiveTopic(topic); setView('messages'); setSearchParams({ topic: topic.id }); }}
                                        style={{ padding: '1rem', borderBottom: '1px solid var(--neutral-100)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--neutral-50)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-100)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <MessageSquare size={20} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ fontSize: '1rem', marginBottom: '0.1rem' }}>{topic.title}</h3>
                                            <p className="text-xs text-neutral-muted">Started {format(parseISO(topic.created_at), 'MMM do, yyyy')}</p>
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
                                ))
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
                                                        {format(parseISO(msg.created_at), 'M/d, h:mm a')}
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

                        {/* Input Box */}
                        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    ref={inputRef} type="text" className="form-input"
                                    placeholder="Type a message... (Use @Name to tag)"
                                    style={{ flex: 1, backgroundColor: 'white' }}
                                    value={newMessage} onChange={handleInputMentions}
                                    disabled={isSending} autoComplete="off"
                                />
                                <button type="submit" disabled={isSending || !newMessage.trim()} className="btn btn-primary">
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
