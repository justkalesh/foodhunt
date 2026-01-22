import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { Message, Conversation, Vendor } from '../types';
import { Send, Search, MoreVertical, ArrowLeft, Trash2, X, CheckSquare, Square, ChevronDown } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { supabase } from '../services/supabase';
import { PageLoading } from '../components/ui/LoadingSpinner';

// ==========================================
// SQL REQUIREMENTS FOR REALTIME CHAT
// ==========================================
// Run these commands in your Supabase SQL Editor:
//
// 1. Enable Realtime:
//    alter publication supabase_realtime add table messages;
//    alter publication supabase_realtime add table conversations;
//
// 2. RLS Policies (Ensure users can only see their own data):
//    create policy "Users can view their own conversations"
//    on conversations for select
//    using (auth.uid()::text = any(participants));
//
//    create policy "Users can view messages in their conversations"
//    on messages for select
//    using (
//      exists (
//        select 1 from conversations
//        where id = messages.conversation_id
//        and auth.uid()::text = any(participants)
//      )
//    );
// ==========================================

const Inbox: React.FC = () => {
    const { user, isEmailVerified } = useAuth();
    const { permissionStatus, requestPermission } = usePushNotifications();
    const navigate = useNavigate();
    const location = useLocation();

    // -- State --
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [activeMessages, setActiveMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [fetchedUsers, setFetchedUsers] = useState<Record<string, { name: string, email: string }>>({});
    const [showSidebarMenu, setShowSidebarMenu] = useState(false);

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

    // Modals
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: () => { },
        isDestructive: false
    });

    // Mentions & Scroll
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionCursorPos, setMentionCursorPos] = useState<number | null>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // Toast Notification
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

    // Refs
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sidebarMenuRef = useRef<HTMLDivElement>(null);
    const lastMessageRef = useRef<string | null>(null);

    // ------------------------------------------------------------------
    // 1. Initial Load & Setup
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        fetchInbox();
        loadVendors();

        // Handle URL Params for direct linking
        const params = new URLSearchParams(location.search);
        const targetUserId = params.get('userId');
        const targetUserName = params.get('userName');
        const targetUserEmail = params.get('userEmail');

        if (targetUserId) {
            const newConvId = [user.id, targetUserId].sort().join('_');
            setActiveChatId(newConvId);

            // Set fetched user info for display
            const displayName = targetUserName || (targetUserId === 'foodhunt101lpu@gmail.com' ? 'Food-Hunt Team' : 'User');
            const displayEmail = targetUserEmail || targetUserId;

            setFetchedUsers(prev => ({
                ...prev,
                [targetUserId]: {
                    name: displayName,
                    email: displayEmail
                }
            }));
        }
    }, [user, navigate, location.search]);

    const loadVendors = async () => {
        const res = await api.vendors.getAll();
        if (res.success && res.data) setVendors(res.data);
    };

    const fetchInbox = async () => {
        if (!user) return;
        const res = await api.messages.getInbox(user.id);
        if (res.success && res.data) {
            setConversations(res.data);
        }
        setLoading(false);
    };

    // ------------------------------------------------------------------
    // 2. Realtime Inbox Updates (e.g. New Conversation initiated by someone else)
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel('inbox_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversations'
                },
                () => {
                    // Refetch inbox list when table changes
                    // Ideally filter by participant participation, but generic refresh is safer for MVP
                    fetchInbox();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // ------------------------------------------------------------------
    // 3. Realtime Messages for ACTIVE Chat (FIXED LOGIC)
    // ------------------------------------------------------------------
    const fetchChatMessages = React.useCallback(async (convId: string) => {
        const res = await api.messages.getChat(convId);
        if (res.success && res.data) {
            setActiveMessages(res.data);
        }
    }, []);

    useEffect(() => {
        if (!activeChatId || !user) return;

        // 1. Initial Fetch
        fetchChatMessages(activeChatId);

        // 2. Mark Read
        api.messages.markAsRead(activeChatId, user.id);

        // 3. Subscribe
        // Use a unique channel name per active chat to avoid mixing listeners!
        const channelName = `room:${activeChatId}`;

        const channel = supabase.channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${activeChatId}`
                },
                (payload) => {
                    const newMsg = payload.new as Message;

                    // FIX: Stale Closure - Use functional update
                    setActiveMessages((prevMessages) => {
                        // Prevent duplicates
                        if (prevMessages.some(m => m.id === newMsg.id)) return prevMessages;
                        return [...prevMessages, newMsg];
                    });

                    // Mark as read if not my own message
                    if (newMsg.sender_id !== user.id) {
                        api.messages.markAsRead(activeChatId, user.id);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Connected
                }
            });

        // 4. Cleanup (Critical!)
        return () => {
            supabase.removeChannel(channel);
        };

    }, [activeChatId, user, fetchChatMessages]);


    // ------------------------------------------------------------------
    // 4. Auto-Scroll Logic
    // ------------------------------------------------------------------
    useEffect(() => {
        if (activeMessages.length > 0) {
            const lastMsg = activeMessages[activeMessages.length - 1];
            if (lastMessageRef.current !== lastMsg.id) {
                lastMessageRef.current = lastMsg.id;
                scrollToBottom();
            }
        }
    }, [activeMessages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollBottom(!isNearBottom);
        }
    };

    // ------------------------------------------------------------------
    // 5. Actions (Send, Search, Select)
    // ------------------------------------------------------------------
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !activeChatId || !inputText.trim()) return;

        const textToSend = inputText.trim();
        setInputText(''); // Clear immediately to prevent duplicates

        const otherId = getOtherUserId(activeChatId);
        const res = await api.messages.send(user.id, otherId, textToSend);

        if (res.success) {
            // Optional: Optimistically append message if latency is an issue, 
            // but Realtime subscription should handle it quickly.
            fetchInbox(); // Update timestamp in sidebar
        } else {
            setToast({ message: 'Failed to send message. Please try again.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            setInputText(textToSend); // Restore if failed
        }
    };

    const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            e.preventDefault();
            // @ts-ignore
            const res = await api.users.search(searchQuery.trim());
            if (res.success && res.data) {
                const targetUser = res.data;
                const newConvId = [user?.id, targetUser.id].sort().join('_');
                setActiveChatId(newConvId);
                setSearchQuery('');
                setFetchedUsers(prev => ({
                    ...prev,
                    [targetUser.id]: { name: targetUser.name, email: targetUser.email }
                }));
            } else {
                setToast({ message: 'User not found. Please check the email or ID.', type: 'error' });
                setTimeout(() => setToast(null), 3000);
            }
        }
    };

    // --- Helpers ---
    const getOtherUserId = (convId: string) => {
        if (!user) return '';
        const parts = convId.split('_');
        return parts.find(id => id !== user.id) || parts[0];
    };

    const getConversationInfo = (conv: Conversation) => {
        const otherId = getOtherUserId(conv.id);
        const details = conv.participant_details?.[otherId] || { name: 'Unknown', email: otherId };

        // Admin overrides
        if (otherId === 'admin' || otherId === 'foodhunt101lpu@gmail.com') {
            return { name: 'Food-Hunt Team', email: 'admin', initial: 'F', id: otherId };
        }

        // Check seeded users from search
        if (fetchedUsers[otherId]) {
            return {
                name: fetchedUsers[otherId].name,
                email: fetchedUsers[otherId].email,
                initial: fetchedUsers[otherId].name[0],
                id: otherId
            };
        }

        return {
            name: details.name || 'Unknown',
            email: details.email || '',
            initial: (details.name || '?')[0]?.toUpperCase() || '?',
            avatar: details.pfp_url || details.avatar,
            id: otherId
        };
    };

    const renderMessageContent = (content: string, isMe: boolean) => {
        // Basic parser for mentions @[Name](id:ID)
        const parts = [];
        const regex = /@\[(.*?)\]\(id:(.*?)\)/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }
            parts.push(
                <Link
                    key={match.index}
                    to={`/vendors/${match[2]}`}
                    className={`font-bold hover:underline ${isMe ? 'text-white' : 'text-primary-600'}`}
                >
                    @{match[1]}
                </Link>
            );
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }
        return parts.length > 0 ? parts : content;
    };

    // --- Mentions Logic ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputText(val);

        const selectionStart = e.target.selectionStart || 0;
        const textBefore = val.slice(0, selectionStart);
        const atIndex = textBefore.lastIndexOf('@');

        if (atIndex !== -1 && (atIndex === 0 || textBefore[atIndex - 1] === ' ')) {
            const query = textBefore.slice(atIndex + 1);
            setMentionQuery(query);
            setMentionCursorPos(atIndex);
        } else {
            setMentionQuery(null);
            setMentionCursorPos(null);
        }
    };

    const insertMention = (vendor: Vendor) => {
        if (mentionCursorPos === null || !inputRef.current) return;
        const before = inputText.slice(0, mentionCursorPos);
        const after = inputText.slice(inputRef.current.selectionStart || inputText.length);
        const newText = `${before}@[${vendor.name}](id:${vendor.id}) ${after}`;
        setInputText(newText);
        setMentionQuery(null);
        setMentionCursorPos(null);
        inputRef.current.focus();
    };

    const filteredVendors = mentionQuery
        ? vendors.filter(v => v.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
        : [];

    // --- Selection & Deletion ---
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedChats(new Set());
        setShowSidebarMenu(false);
    };

    const toggleChatSelection = (convId: string) => {
        const newSet = new Set(selectedChats);
        if (newSet.has(convId)) newSet.delete(convId);
        else newSet.add(convId);
        setSelectedChats(newSet);
    };

    const performDeleteSelected = async () => {
        if (!user) return;
        for (const convId of selectedChats) {
            await api.messages.deleteConversation(user.id, convId);
        }
        setIsSelectionMode(false);
        setSelectedChats(new Set());
        fetchInbox();
        if (activeChatId && selectedChats.has(activeChatId)) setActiveChatId(null);
    };

    const performClearInbox = async () => {
        if (!user) return;
        await api.messages.clearAll(user.id);
        fetchInbox();
        setActiveChatId(null);
    };

    // --- Render ---
    if (loading) return <PageLoading message="Loading inbox..." />;

    const activeConversation = conversations.find(c => c.id === activeChatId);
    let displayInfo = activeConversation ? getConversationInfo(activeConversation) : null;

    // Fallback display info for fresh chats
    if (!displayInfo && activeChatId) {
        const otherId = getOtherUserId(activeChatId);
        if (fetchedUsers[otherId]) {
            displayInfo = {
                name: fetchedUsers[otherId].name,
                email: fetchedUsers[otherId].email,
                initial: fetchedUsers[otherId].name[0],
                id: otherId
            } as any;
        } else if (otherId) {
            displayInfo = { name: 'User', email: otherId, initial: 'U', id: otherId } as any;
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="h-[80vh] bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex">
                {/* Sidebar */}
                <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 flex-col border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900`}>

                    {permissionStatus !== 'granted' && (
                        <div className="bg-primary-600 text-white p-3 text-xs flex justify-between items-center">
                            <span>Turn on notifications to get notified about new messages.</span>
                            <button onClick={requestPermission} className="bg-white text-primary-600 px-3 py-1 rounded-full font-bold hover:bg-gray-100">Enable</button>
                        </div>
                    )}

                    {/* Header */}
                    <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-slate-800 h-[72px] bg-white dark:bg-slate-900">
                        {isSelectionMode ? (
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setIsSelectionMode(false)}><X size={20} /></button>
                                    <span className="font-bold">{selectedChats.size} Selected</span>
                                </div>
                                {selectedChats.size > 0 && (
                                    <button onClick={() => setConfirmModal({
                                        isOpen: true,
                                        title: 'Delete Conversations',
                                        message: `Delete ${selectedChats.size} conversation(s)?`,
                                        action: performDeleteSelected,
                                        isDestructive: true
                                    })} className="text-red-500"><Trash2 size={20} /></button>
                                )}
                            </div>
                        ) : (
                            <>
                                <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Foodies</h1>
                                <div className="relative" ref={sidebarMenuRef}>
                                    <button onClick={() => setShowSidebarMenu(!showSidebarMenu)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                                        <MoreVertical size={20} />
                                    </button>
                                    {showSidebarMenu && (
                                        <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border z-50 py-1">
                                            <button onClick={toggleSelectionMode} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Select Chat</button>
                                            <button onClick={() => setConfirmModal({
                                                isOpen: true,
                                                title: 'Clear Inbox',
                                                message: "Delete ALL conversations?",
                                                action: performClearInbox,
                                                isDestructive: true
                                            })} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">Clear Inbox</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Search */}
                    <div className="p-3">
                        <div className="relative">
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search user..."
                                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                                disabled={isSelectionMode}
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {conversations.map(conv => {
                            const info = getConversationInfo(conv);
                            const isSelected = selectedChats.has(conv.id);
                            const unread = conv.unread_counts?.[user?.id || ''] || 0;

                            return (
                                <div
                                    key={conv.id}
                                    onClick={() => isSelectionMode ? toggleChatSelection(conv.id) : activeChatId !== conv.id && (setActiveChatId(conv.id), setActiveMessages([]))}
                                    className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-gray-50 dark:border-slate-800 ${activeChatId === conv.id && !isSelectionMode
                                        ? 'bg-primary-50 dark:bg-primary-900/10 border-l-4 border-l-primary-500'
                                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent'
                                        }`}
                                >
                                    {isSelectionMode && (
                                        <div className="text-primary-600">{isSelected ? <CheckSquare size={20} /> : <Square size={20} />}</div>
                                    )}
                                    <div className="relative w-12 h-12 flex-shrink-0">
                                        {info.avatar ? (
                                            <img src={info.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center font-bold text-primary-700 dark:text-primary-300">
                                                {info.initial}
                                            </div>
                                        )}
                                        {unread > 0 && activeChatId !== conv.id && (
                                            <span className="absolute top-0 right-0 bg-primary-600 rounded-full w-3 h-3 border-2 border-white"></span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline">
                                            <h3 className="font-medium truncate">{info.name}</h3>
                                            <span className="text-xs text-gray-500">{conv.last_message ? new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 truncate">{conv.last_message?.content || 'No messages'}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {conversations.length === 0 && <div className="p-8 text-center text-gray-500">No chats yet.</div>}
                    </div>
                </div>

                {/* Chat Area */}
                {activeChatId ? (
                    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-950 relative">
                        {/* Glassmorphism Header */}
                        <div className="p-4 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 flex items-center justify-between border-b border-gray-100 dark:border-slate-800 z-20">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveChatId(null)} className="md:hidden text-gray-500"><ArrowLeft size={24} /></button>
                                <Link to={`/profile/${displayInfo?.id}`} className="flex items-center gap-3 hover:opacity-80">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                        {displayInfo?.avatar ? <img src={displayInfo.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold bg-primary-100 text-primary-600">{displayInfo?.initial}</div>}
                                    </div>
                                    <div>
                                        <h2 className="font-bold">{displayInfo?.name}</h2>
                                        <span className="text-xs text-gray-500">View Profile</span>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-2 z-10 custom-scrollbar scroll-smooth"
                            onScroll={handleScroll}
                            ref={scrollContainerRef}
                        >
                            {activeMessages.map((msg, idx) => {
                                const isMe = msg.sender_id === user?.id;
                                const showDateSep = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(activeMessages[idx - 1].created_at).toDateString();

                                return (
                                    <React.Fragment key={msg.id}>
                                        {showDateSep && (
                                            <div className="flex justify-center my-4">
                                                <span className="bg-gray-200 dark:bg-gray-700 text-xs px-3 py-1 rounded-full">{new Date(msg.created_at).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md text-sm ${isMe
                                                ? 'bg-gradient-to-r from-primary-600 to-orange-500 text-white rounded-tr-none'
                                                : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-tl-none'
                                                }`}>
                                                <div className="break-words">{renderMessageContent(msg.content, isMe)}</div>
                                                {/* Request Buttons (Simplified) */}
                                                {msg.request_id && !isMe && msg.request_status === 'pending' && (
                                                    <div className="mt-2 pt-2 border-t flex gap-2">
                                                        <button onClick={() => api.splits.respondToRequest(msg.request_id!, 'accepted').then(() => fetchChatMessages(activeChatId!))} className="bg-green-500 text-white px-3 py-1 rounded text-xs">Accept</button>
                                                        <button onClick={() => api.splits.respondToRequest(msg.request_id!, 'rejected').then(() => fetchChatMessages(activeChatId!))} className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs">Reject</button>
                                                    </div>
                                                )}
                                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            <div ref={messagesEndRef} />
                            {showScrollBottom && (
                                <button onClick={scrollToBottom} className="absolute bottom-20 right-6 bg-white p-2 rounded-full shadow-lg text-primary-600 animate-bounce"><ChevronDown size={24} /></button>
                            )}
                        </div>

                        {/* Floating Input Bar */}
                        <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center gap-3 z-10 border-t border-gray-100 dark:border-slate-800 relative">
                            {/* Mention Popup */}
                            {mentionQuery && filteredVendors.length > 0 && (
                                <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-50">
                                    {filteredVendors.map(v => (
                                        <button key={v.id} onClick={() => insertMention(v)} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium text-gray-900 dark:text-white transition-colors">{v.name}</button>
                                    ))}
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-3">
                                <input
                                    ref={inputRef}
                                    value={inputText}
                                    onChange={handleInputChange}
                                    placeholder={isEmailVerified ? "Type a message..." : "Please verify your email to send messages."}
                                    disabled={!isEmailVerified}
                                    className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full px-6 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 border border-transparent focus:border-primary-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <button type="submit" disabled={!inputText.trim() || !isEmailVerified} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${inputText.trim() && isEmailVerified
                                    ? 'bg-gradient-to-r from-primary-600 to-orange-500 text-white hover:shadow-primary-500/30 hover:scale-105'
                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500'
                                    }`}>
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 text-center p-10">
                        <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg">
                            <Send size={40} />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Food-Hunt <span className="text-primary-600">Messenger</span></h2>
                        <p className="text-gray-500 dark:text-gray-400">Select a conversation to start chatting with foodies.</p>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    onConfirm={confirmModal.action}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    isDestructive={confirmModal.isDestructive}
                />

                {/* Toast Notification */}
                {toast && (
                    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in-down ${toast.type === 'error' ? 'bg-red-500 text-white' :
                        toast.type === 'success' ? 'bg-green-500 text-white' :
                            'bg-slate-800 text-white'
                        }`}>
                        <span className="text-sm font-medium">{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inbox;
