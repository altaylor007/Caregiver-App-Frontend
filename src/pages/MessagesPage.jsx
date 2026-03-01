import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, MessageSquare, Plus, Smile } from 'lucide-react';

// Hardcoded default emojis for reactions to avoid heavy dependencies
const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏'];

const MessagesPage = () => {
    const { user } = useAuth();

    // View State: 'topics' or 'messages'
    const [view, setView] = useState('topics');
    const [activeTopic, setActiveTopic] = useState(null);

    // Data State
    const [topics, setTopics] = useState([]);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);

    // Input State
    const [newTopicTitle, setNewTopicTitle] = useState('');
    const [newTopicMessage, setNewTopicMessage] = useState('');
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Mentions state
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Initial Fetch of Topics and Users
    useEffect(() => {
        fetchTopics();
        fetchUsers();

        // Subscribe to new topics
        const topicsSub = supabase
            .channel('topics_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_topics' }, () => {
                fetchTopics();
            })
            .subscribe();

        return () => supabase.removeChannel(topicsSub);
    }, []);

    // Fetch Messages when entering a topic
    useEffect(() => {
        if (view === 'messages' && activeTopic) {
            fetchMessages(activeTopic.id);

            // Subscribe to new messages & reactions for this topic
            const msgSub = supabase
                .channel(`messages_topic_${activeTopic.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `topic_id=eq.${activeTopic.id}` }, () => {
                    fetchMessages(activeTopic.id);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
                    fetchMessages(activeTopic.id); // Re-fetch to get new reactions
                })
                .subscribe();

            return () => supabase.removeChannel(msgSub);
        }
    }, [view, activeTopic]);

    // Auto-scroll
    useEffect(() => {
        if (view === 'messages') {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages, view]);

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
            .select(`
                *, 
                users(full_name, role, avatar_url),
                message_reactions(id, emoji, user_id)
            `)
            .eq('topic_id', topicId)
            .order('created_at', { ascending: true });

        if (data) setMessages(data);
    };

    const handleCreateTopic = async (e) => {
        e.preventDefault();
        if (!newTopicTitle.trim() || !newTopicMessage.trim()) return;

        setIsCreatingTopic(true);
        // 1. Create the topic
        const { data: topicData, error: topicError } = await supabase
            .from('message_topics')
            .insert([{ title: newTopicTitle.trim() }])
            .select()
            .single();

        if (topicError || !topicData) {
            alert("Error creating topic. Make sure you ran the 'team_comm_updates.sql' script in Supabase! Details: " + topicError?.message);
            setIsCreatingTopic(false);
            return;
        }

        // 2. Insert the first message for this topic
        const { error: msgError } = await supabase
            .from('messages')
            .insert([{
                author_id: user.id,
                topic_id: topicData.id,
                content: newTopicMessage.trim()
            }]);

        if (!msgError) {
            setNewTopicTitle('');
            setNewTopicMessage(''); // Clear message input
            setActiveTopic(topicData);
            setView('messages');
        } else {
            alert("Topic was created, but failed to insert the first message: " + msgError?.message);
        }

        setIsCreatingTopic(false);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !activeTopic) return;

        setIsSending(true);
        const content = newMessage.trim();

        // 1. Insert Message
        const { data: insertedMsg, error } = await supabase
            .from('messages')
            .insert([{
                author_id: user.id,
                topic_id: activeTopic.id,
                content: content
            }])
            .select()
            .single();

        if (!error && insertedMsg) {
            setNewMessage('');

            // 2. Parse Mentions and Create Notifications
            // Look for @Name or @Firstname Lastname in the content
            const mentions = users.filter(u => content.toLowerCase().includes(`@${u.full_name?.toLowerCase()}`));

            if (mentions.length > 0) {
                const notifications = mentions.map(m => ({
                    user_id: m.id,
                    actor_id: user.id,
                    type: 'mention',
                    reference_id: insertedMsg.id,
                    is_read: false
                }));
                // Insert silently
                supabase.from('notifications').insert(notifications).then();
            }
        } else {
            alert("Failed to send message.");
        }
        setIsSending(false);
    };

    const toggleReaction = async (messageId, emoji) => {
        // Find if user already reacted with this emoji
        const msg = messages.find(m => m.id === messageId);
        if (!msg) return;

        const existingReaction = msg.message_reactions?.find(r => r.emoji === emoji && r.user_id === user.id);

        if (existingReaction) {
            // Remove it
            await supabase.from('message_reactions').delete().eq('id', existingReaction.id);
        } else {
            // Add it
            await supabase.from('message_reactions').insert([{
                message_id: messageId,
                user_id: user.id,
                emoji: emoji
            }]);
        }
        // fetchMessages will be called by realtime subscription
    };

    const handleInputMentions = (e) => {
        const val = e.target.value;
        setNewMessage(val);

        // Very basic mention trigger
        const match = val.match(/@(\w*)$/);
        if (match) {
            setShowMentions(true);
            setMentionFilter(match[1].toLowerCase());
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = (fullName) => {
        const newVal = newMessage.replace(/@\w*$/, `@${fullName} `);
        setNewMessage(newVal);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    return (
        <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
                {view === 'messages' && (
                    <button onClick={() => setView('topics')} className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}>
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
                                    type="text"
                                    className="form-input"
                                    placeholder="Topic Title (e.g. Schedule Change)"
                                    value={newTopicTitle}
                                    onChange={(e) => setNewTopicTitle(e.target.value)}
                                    maxLength={50}
                                    required
                                />
                                <textarea
                                    className="form-input"
                                    placeholder="First message..."
                                    rows="2"
                                    value={newTopicMessage}
                                    onChange={(e) => setNewTopicMessage(e.target.value)}
                                    required
                                    style={{ resize: 'vertical' }}
                                />
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
                                        onClick={() => { setActiveTopic(topic); setView('messages'); }}
                                        style={{ padding: '1rem', borderBottom: '1px solid var(--neutral-100)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--neutral-50)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-100)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <MessageSquare size={20} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', marginBottom: '0.1rem' }}>{topic.title}</h3>
                                            <p className="text-xs text-neutral-muted">Started {format(parseISO(topic.created_at), 'MMM do, yyyy')}</p>
                                        </div>
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
                                    const isAdmin = msg.users?.role === 'admin';

                                    // Aggregate reactions
                                    const reactionCounts = {};
                                    if (msg.message_reactions) {
                                        msg.message_reactions.forEach(r => {
                                            if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, me: false };
                                            reactionCounts[r.emoji].count++;
                                            if (r.user_id === user.id) reactionCounts[r.emoji].me = true;
                                        });
                                    }

                                    return (
                                        <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                                backgroundColor: isAdmin ? 'var(--primary-600)' : 'var(--secondary-100)',
                                                color: isAdmin ? 'white' : 'var(--secondary-700)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem',
                                                overflow: 'hidden'
                                            }}>
                                                {msg.users?.avatar_url ? (
                                                    <img src={msg.users.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    msg.users?.full_name?.charAt(0).toUpperCase() || '?'
                                                )}
                                            </div>

                                            <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.75rem', color: isAdmin ? 'var(--primary-700)' : 'var(--neutral-700)' }}>
                                                        {isMine ? 'You' : (msg.users?.full_name || 'Caregiver')}
                                                        {isAdmin && !isMine && ' (Admin)'}
                                                    </span>
                                                    <span className="text-xs text-neutral-muted">
                                                        {format(parseISO(msg.created_at), 'M/d, h:mm a')}
                                                    </span>
                                                </div>

                                                <div className="text-sm" style={{
                                                    backgroundColor: isMine ? 'var(--primary-600)' : 'var(--neutral-100)',
                                                    color: isMine ? 'white' : 'inherit',
                                                    padding: '0.75rem 1rem',
                                                    borderRadius: isMine ? '16px 16px 0 16px' : '16px 16px 16px 0',
                                                    wordBreak: 'break-word',
                                                    position: 'relative',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {msg.content}

                                                    {/* Quick Emoji Picker hover menu (mobile uses tap context usually, simplified here) */}
                                                    <div className="action-menu" style={{
                                                        position: 'absolute', bottom: '-12px', right: isMine ? 'auto' : '-10px', left: isMine ? '-10px' : 'auto',
                                                        display: 'flex', gap: '0.25rem', backgroundColor: 'white', borderRadius: '12px', padding: '0.1rem 0.25rem',
                                                        boxShadow: 'var(--shadow-sm)', opacity: 0.8
                                                    }}>
                                                        {REACTIONS.map(emoji => (
                                                            <span key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                                                                {emoji}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Display Reactions */}
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
                        {showMentions && (
                            <div style={{ backgroundColor: 'white', borderTop: '1px solid var(--neutral-200)', borderBottom: '1px solid var(--neutral-200)', maxHeight: 150, overflowY: 'auto' }}>
                                <div className="text-xs text-neutral-muted" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--neutral-50)' }}>Mention a team member</div>
                                {users.filter(u => u.full_name?.toLowerCase().includes(mentionFilter)).map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => insertMention(u.full_name)}
                                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--neutral-100)' }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{u.full_name}</span> <span className="text-xs text-neutral-muted">({u.role})</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Box */}
                        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--neutral-200)', backgroundColor: 'var(--neutral-50)' }}>
                            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="form-input"
                                    placeholder="Type a message... (Use @Name to tag)"
                                    style={{ flex: 1, backgroundColor: 'white' }}
                                    value={newMessage}
                                    onChange={handleInputMentions}
                                    disabled={isSending}
                                    autoComplete="off"
                                />
                                <button type="submit" disabled={isSending || !newMessage.trim()} className="btn btn-primary">
                                    {isSending ? '...' : 'Send'}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MessagesPage;
