import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/mockDatabase';
import { Message, Conversation } from '../types';
import { Send, Search, MoreVertical, ArrowLeft, Trash2, X, CheckSquare, Square } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';



const Inbox: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null); // This is now conversationId
    const [activeMessages, setActiveMessages] = useState<Message[]>([]); // Messages for active chat
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [fetchedUsers, setFetchedUsers] = useState<Record<string, { name: string, email: string }>>({});
    const [showSidebarMenu, setShowSidebarMenu] = useState(false);

    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

    // Confirmation Modal State
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

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sidebarMenuRef = useRef<HTMLDivElement>(null);

    // Initial Auth Check and Inbox Fetch
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchInbox();

        // Handle URL parameters for direct chat link
        const params = new URLSearchParams(location.search);
        const targetUserId = params.get('userId');
        const targetUserName = params.get('userName');
        const targetUserEmail = params.get('userEmail');

        if (targetUserId) {
            const newConvId = [user.id, targetUserId].sort().join('_');
            setActiveChatId(newConvId);
            if (targetUserName) {
                setFetchedUsers(prev => ({
                    ...prev,
                    [targetUserId]: {
                        name: targetUserName,
                        email: targetUserEmail || ''
                    }
                }));
            }
        }

        // Poll Inbox (slowly)
        const interval = setInterval(fetchInbox, 10000);
        return () => clearInterval(interval);
    }, [user, navigate, location.search]);

    // Active Chat Polling (Fast)
    useEffect(() => {
        if (!activeChatId || !user) return;

        fetchChatMessages(activeChatId);
        const interval = setInterval(() => fetchChatMessages(activeChatId), 3000); // 3s poll for active chat

        // Mark as read immediately when opening/polling
        api.messages.markAsRead(activeChatId, user.id);

        return () => clearInterval(interval);
    }, [activeChatId, user]);

    useEffect(() => {
        scrollToBottom();
    }, [activeMessages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(event.target as Node)) {
                setShowSidebarMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchInbox = async () => {
        if (!user) return;
        const res = await api.messages.getInbox(user.id);
        if (res.success && res.data) {
            setConversations(res.data);
            setLoading(false);
        } else {
            setLoading(false);
        }
    };


    const fetchChatMessages = async (convId: string) => {
        const res = await api.messages.getChat(convId);
        if (res.success && res.data) {
            setActiveMessages(res.data);
        }
    };

    const getOtherUserId = (convId: string) => {
        if (!user) return '';
        const parts = convId.split('_');
        // Handle admin specially if needed, but 'admin' string works with this logic if sorted properly in ID generation
        return parts.find(id => id !== user.id) || parts[0];
    }

    // Helper to get display info for a conversation
    const getConversationInfo = (conv: Conversation) => {
        const otherId = getOtherUserId(conv.id);
        const details = conv.participant_details?.[otherId] || { name: 'Unknown', email: otherId };
        // Override for Admin
        if (otherId === 'admin' || otherId === 'foodhunt101lpu@gmail.com') {
            return { name: 'Food-Hunt Team', email: 'admin', initial: 'F' };
        }
        return {
            name: details.name || 'Unknown',
            email: details.email || '',
            initial: (details.name || '?')[0]?.toUpperCase() || '?',
            avatar: details.avatar
        };
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !activeChatId || !inputText.trim()) return;

        const otherId = getOtherUserId(activeChatId);
        const res = await api.messages.send(user.id, otherId, inputText.trim());

        if (res.success) {
            setInputText('');
            // Optimistic update?
            fetchChatMessages(activeChatId);
            fetchInbox(); // Update list order
        }
    };

    const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            e.preventDefault();
            const query = searchQuery.trim();

            // @ts-ignore
            const res = await api.users.search(query);

            if (res.success && res.data) {
                const targetUser = res.data;
                const targetId = targetUser.id;
                // Deterministic ID
                const newConvId = [user?.id, targetId].sort().join('_');
                setActiveChatId(newConvId);
                setSearchQuery('');

                // If it doesn't exist in 'conversations', we might want to manually fetch user info to display in header
                // But fetchChatMessages (which calls getChat) works fine on empty collections.
                // The tricky part is the "Header" showing the name if the conversation doesn't exist yet.
                // We can seed `fetchedUsers` for that.
                setFetchedUsers(prev => ({ ...prev, [targetId]: { name: targetUser.name, email: targetUser.email, initial: targetUser.name?.[0] || '?' } }));

            } else {
                // Handle "Start chat with 'unknown' if we want?" For now just alert or ignore
                alert('User not found');
            }
        }
    };

    // --- Selection Mode Logic ---

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedChats(new Set());
        setShowSidebarMenu(false);
    };

    const toggleChatSelection = (convId: string) => {
        const newSelected = new Set(selectedChats);
        if (newSelected.has(convId)) {
            newSelected.delete(convId);
        } else {
            newSelected.add(convId);
        }
        setSelectedChats(newSelected);
    };

    const confirmDeleteSelected = () => {
        if (!user || selectedChats.size === 0) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete Conversations',
            message: `Are you sure you want to delete ${selectedChats.size} conversation(s)?`,
            action: performDeleteSelected,
            isDestructive: true
        });
    };

    const performDeleteSelected = async () => {
        if (!user) return;

        for (const convId of selectedChats) {
            const res = await api.messages.deleteConversation(user.id, convId);
        }

        setIsSelectionMode(false);
        setSelectedChats(new Set());
        if (activeChatId && selectedChats.has(activeChatId)) {
            setActiveChatId(null);
        }
        fetchInbox();
    };

    const confirmClearInbox = () => {
        if (!user) return;
        setConfirmModal({
            isOpen: true,
            title: 'Clear Inbox',
            message: "Are you sure you want to delete ALL conversations? This cannot be undone.",
            action: performClearInbox,
            isDestructive: true
        });
    };

    const performClearInbox = async () => {
        if (!user) return;
        await api.messages.clearAll(user.id);
        fetchInbox();
        setActiveChatId(null);
    };


    const activeConversation = conversations.find(c => c.id === activeChatId);

    // Derived display info for Active Chat Header
    let displayUserName = 'Loading...';
    let displayUserId = '...';
    let displayInitial = '?';

    if (activeChatId) {
        if (activeConversation) {
            const info = getConversationInfo(activeConversation);
            displayUserName = info.name;
            displayUserId = info.email;
            displayInitial = info.initial;
        } else {
            // Probably a new chat from search
            const otherId = getOtherUserId(activeChatId);
            if (otherId === 'admin' || otherId === 'foodhunt101lpu@gmail.com') {
                displayUserName = 'Food-Hunt Team';
                displayInitial = 'F';
            } else if (fetchedUsers[otherId]) {
                displayUserName = fetchedUsers[otherId].name;
                displayUserId = fetchedUsers[otherId].email;
                displayInitial = (displayUserName || '?')[0];
            } else {
                displayUserName = 'User';
                displayUserId = otherId;
            }
        }
    }

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-white dark:bg-gray-900">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-64px)] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
            {/* Sidebar / Chat List */}
            <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] flex-col border-r border-gray-200 dark:border-gray-800 bg-gradient-to-b from-white to-orange-50/30 dark:bg-none dark:bg-gray-900`}>
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-gray-50 to-orange-50/30 dark:bg-none dark:bg-gray-800 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 relative h-[72px]">
                    {isSelectionMode ? (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSelectionMode(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                    <X size={20} />
                                </button>
                                <span className="font-bold">{selectedChats.size} Selected</span>
                            </div>
                            {selectedChats.size > 0 && (
                                <button onClick={confirmDeleteSelected} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Foodies</h1>
                            <div className="relative" ref={sidebarMenuRef}>
                                <button
                                    onClick={() => setShowSidebarMenu(!showSidebarMenu)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <MoreVertical size={20} className="text-gray-500 dark:text-gray-400" />
                                </button>

                                {showSidebarMenu && (
                                    <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1">
                                        <button
                                            onClick={toggleSelectionMode}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Select Chat
                                        </button>
                                        <button
                                            onClick={confirmClearInbox}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Clear Inbox
                                        </button>
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
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search or start a new chat"
                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                            disabled={isSelectionMode}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400" size={16} />
                    </div>
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {conversations.map(conv => {
                        const { name, email, initial } = getConversationInfo(conv);
                        const isSelected = selectedChats.has(conv.id);
                        const unread = conv.unread_counts?.[user?.id || ''] || 0;

                        return (
                            <div
                                key={conv.id}
                                onClick={() => {
                                    if (isSelectionMode) {
                                        toggleChatSelection(conv.id);
                                    } else {
                                        setActiveChatId(conv.id);
                                        setActiveMessages([]); // Clear previous to show loading state or empty first
                                    }
                                }}
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${activeChatId === conv.id && !isSelectionMode ? 'bg-primary-50 dark:bg-gray-800' : ''}`}
                            >
                                {isSelectionMode && (
                                    <div className="text-primary-600">
                                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </div>
                                )}
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-orange-200 dark:from-primary-900 dark:to-orange-900 flex items-center justify-center text-lg font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">
                                    {initial}
                                </div>
                                <div className="flex-1 min-w-0 border-b border-gray-100 dark:border-gray-800 pb-3">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <div className="flex items-baseline gap-1 min-w-0 pr-2">
                                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{name}</h3>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 opacity-75 flex-shrink-0">#{email}</span>
                                        </div>
                                        <span className={`text-xs flex-shrink-0 ${unread > 0 ? 'text-primary-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {formatTime(conv.last_message?.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate pr-2">
                                            {conv.last_message?.content || 'No messages'}
                                        </p>
                                        {unread > 0 && activeChatId !== conv.id && (
                                            <span className="bg-primary-600 rounded-full w-2.5 h-2.5 block"></span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {conversations.length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No chats yet. Start a conversation!
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            {activeChatId ? (
                <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-orange-50/20 dark:bg-none dark:bg-[#0b141a] relative">
                    {/* Chat Header */}
                    <div className="p-3 bg-white dark:bg-gray-800 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 shadow-sm z-20">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setActiveChatId(null)} className="md:hidden text-gray-500 dark:text-gray-400 mr-1">
                                <ArrowLeft size={24} />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-orange-200 dark:from-primary-900 dark:to-orange-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold">
                                {displayInitial}
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="font-bold text-gray-900 dark:text-gray-100">{displayUserName}</h2>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 opacity-75">#{displayUserId}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Messages Background */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none dark:opacity-5 opacity-[0.02]" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 custom-scrollbar">
                        {activeMessages.map((msg, idx) => {
                            const isMe = msg.sender_id === user?.id;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[70%] md:max-w-[60%] rounded-2xl px-4 py-2 shadow-sm text-sm ${isMe
                                            ? 'bg-primary-600 text-white rounded-tr-none'
                                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-700'
                                            }`}
                                    >
                                        <div className="break-words">
                                            {msg.content}
                                        </div>
                                        {msg.request_id && !isMe && msg.request_status === 'pending' && (
                                            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        const res = await api.splits.respondToRequest(msg.request_id!, 'accepted');
                                                        if (res.success) {
                                                            // Update local message state to hide buttons
                                                            setActiveMessages(prev => prev.map(m => m.id === msg.id ? { ...m, request_status: 'accepted' } : m));
                                                        } else alert(res.message);
                                                    }}
                                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded text-xs font-bold"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const res = await api.splits.respondToRequest(msg.request_id!, 'rejected');
                                                        if (res.success) {
                                                            // Update local message state to hide buttons
                                                            setActiveMessages(prev => prev.map(m => m.id === msg.id ? { ...m, request_status: 'rejected' } : m));
                                                        } else alert(res.message);
                                                    }}
                                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded text-xs font-bold"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {msg.request_id && msg.request_status && msg.request_status !== 'pending' && (
                                            <div className="mt-2 text-xs italic text-gray-500">
                                                {msg.request_status === 'accepted' ? 'Request Accepted' : 'Request Rejected'}
                                            </div>
                                        )}
                                        <div className={`flex justify-end items-center gap-1 text-[10px] mt-1 ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
                                            <span>
                                                {formatTime(msg.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-gray-800 flex items-center gap-2 z-10 border-t border-gray-200 dark:border-gray-700">
                        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="Type a message"
                                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-full px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all placeholder-gray-500 dark:placeholder-gray-400"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim()}
                                className={`p-3 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${inputText.trim() ? 'bg-primary-600 text-white shadow-lg hover:bg-primary-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 border-b-[6px] border-primary-600 text-center p-10">
                    <div className="w-24 h-24 bg-primary-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 text-primary-600 animate-bounce-slow">
                        <MoreVertical size={48} className="rotate-90" />
                    </div>
                    <h2 className="text-3xl font-light text-gray-800 dark:text-gray-200 mb-4">Food-Hunt Messenger</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md">Send and receive messages to coordinate your meal splits.<br />Connect with other foodies instantly.</p>
                </div>
            )}
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};

export default Inbox;
