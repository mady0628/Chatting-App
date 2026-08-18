import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { getMessagesAPI, getConversationMembersAPI, markAsReadAPI, removeMemberAPI, leaveConversationAPI, addMemberToConversationAPI, searchUserAPI, uploadFileAPI, getPinnedMessageAPI, pinnedMessageAPI, unpinMessageAPI, toggleReactionAPI, searchMessageAPI, getMessagesContext, getMessagesBeforeAPI, getMessagesAfterAPI, getConversationImagesAPI } from '../api/endpoints.js';

import GroupProfileModal from './GroupProfileModal.jsx';

const groupReactions = (reactions = [], currentUserID) => {
    if (!Array.isArray(reactions) || reactions.length === 0) return [];

    const map = {};
    reactions.forEach(r => {
        if (!map[r.emoji]) {
            map[r.emoji] = {
                emoji: r.emoji,
                count: 0,
                users: [],
                hasReacted: false
            };
        }
        map[r.emoji].count += 1;
        map[r.emoji].users.push(r.username || 'Người dùng');
        if (String(r.user_id) === String(currentUserID)) {
            map[r.emoji].hasReacted = true;
        }
    });

    return Object.values(map);
};

const ChatWindow = () => {
    const { user } = useAuthStore();
    const { activeConversation, messages, setMessages, prependMessages, appendMessages, typingUsers, markConversationAsRead, conversationMembers, setConversationMember, replyingMessage, setReplyingMessage, onlineUsers, pinnedList, setPinnedList } = useChatStore();
    const { sendMessage, emitTypingStart, emitTypingStop, emitMarkAsRead, emitEditMessage, emitDeleteMessage, emitRemoveMember, emitLeaveConversation, emitAddMember, emitUpdatePinnedList, emitUpdateReactions } = useSocket();

    const [text, setText] = useState('');
    const messageEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const isPrependingRef = useRef(false);
    const isAppendingRef = useRef(false);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);
    const [showPinnedListModal, setShowPinnedListModal] = useState(false);
    const [editMessage, setEditMessage] = useState(null);

    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const [reactionModalMessage, setReactionModalMessage] = useState(null);
    const [selectedEmojiTab, setSelectedEmojiTab] = useState('ALL');

    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (reactionModalMessage) {
            const updated = messages.find(m => String(m.id) === String(reactionModalMessage.id));
            if (updated) {
                setReactionModalMessage(updated);
            }
        }
    }, [messages]);

    const handleToggleReaction = async (messageID, emoji) => {
        try {
            const res = await toggleReactionAPI({
                conversationID: activeConversation.id,
                messageID,
                emoji
            });
            if (res.success) {
                emitUpdateReactions(activeConversation.id, messageID, res.reactions);
            }
        } catch (err) {
            console.error("Lỗi khi thả cảm xúc:", err);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert("Vui lòng chọn tệp hình ảnh!");
            return;
        }
        setSelectedImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
        e.target.value = '';
    };

    const handleCancelImagePreview = () => {
        setSelectedImageFile(null);
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            setImagePreviewUrl(null);
        }
    };

    const isUserNearBottom = () => {
        const container = chatContainerRef.current;
        if (!container) return true;
        const threshold = 150;
        return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    };

    const scrollToBottom = (behavior = 'smooth', force = false) => {
        if (!force && !isUserNearBottom()) return;
        setTimeout(() => {
            messageEndRef.current?.scrollIntoView({ behavior, block: 'end' });
        }, 60);
    };

    const [isContextMode, setIsContextMode] = useState(false);
    const [hasMoreAfter, setHasMoreAfter] = useState(false);
    const [loadingAfter, setLoadingAfter] = useState(false);

    const [sharedImages, setSharedImages] = useState([]);
    const [hasMoreSharedImages, setHasMoreSharedImages] = useState(false);
    const [totalSharedImages, setTotalSharedImages] = useState(0);
    const [loadingSharedImages, setLoadingSharedImages] = useState(false);

    const fetchSharedImages = async (offset = 0, append = false) => {
        if (!activeConversation) return;
        setLoadingSharedImages(true);
        try {
            const res = await getConversationImagesAPI({
                conversationID: activeConversation.id,
                limit: 6,
                offset
            });
            if (res.success) {
                setTotalSharedImages(res.total);
                setHasMoreSharedImages(res.hasMore);
                if (append) {
                    setSharedImages(prev => [...prev, ...res.images]);
                } else {
                    setSharedImages(res.images || []);
                }
            }
        } catch (err) {
            console.error("Lỗi khi tải danh sách ảnh đã gửi:", err);
        } finally {
            setLoadingSharedImages(false);
        }
    };

    useEffect(() => {
        if (!activeConversation) return;

        setHasMore(true);
        setHasMoreAfter(false);
        setIsContextMode(false);
        setLoadingMore(false);
        setLoadingAfter(false);
        fetchSharedImages(0, false);

        const loadMessages = async () => {
            try {
                const res = await getMessagesAPI(activeConversation.id, 55, 0);
                const reversedMessages = res.messages.reverse();
                if (res.messages.length < 55) {
                    setHasMore(false);
                }
                setMessages(reversedMessages);
                await markAsReadAPI(activeConversation.id);
                markConversationAsRead(activeConversation.id);
                const lastOtherMessage = reversedMessages.slice().reverse().find(m => String(m.sender_id) !== String(user?.id));
                if (lastOtherMessage) {
                    emitMarkAsRead(activeConversation.id, lastOtherMessage.id);
                }
                scrollToBottom('auto', true);
            } catch (err) {
                console.error("Lỗi khi tải tin nhắn:", err);
            }
        };

        loadMessages();
    }, [activeConversation, setMessages]);

    const loadMoreMessages = async () => {
        if (loadingMore || !hasMore || !activeConversation || messages.length === 0) return;
        setLoadingMore(true);

        const container = chatContainerRef.current;
        const previousScrollHeight = container ? container.scrollHeight : 0;

        try {
            let olderMessages = [];
            if (isContextMode) {
                const oldestMsg = messages[0];
                const res = await getMessagesBeforeAPI({
                    conversationID: activeConversation.id,
                    messageID: oldestMsg.id
                });
                if (!res.messages || res.messages.length === 0) {
                    setHasMore(false);
                    return;
                }
                if (res.messages.length < 20) {
                    setHasMore(false);
                }
                olderMessages = res.messages;
            } else {
                const currentOffset = messages.length;
                const res = await getMessagesAPI(activeConversation.id, 55, currentOffset);
                if (!res.messages || res.messages.length === 0) {
                    setHasMore(false);
                    return;
                }
                if (res.messages.length < 55) {
                    setHasMore(false);
                }
                olderMessages = res.messages.reverse();
            }

            isPrependingRef.current = true;
            prependMessages(olderMessages);

            setTimeout(() => {
                if (container) {
                    container.scrollTop = container.scrollHeight - previousScrollHeight;
                }
            }, 0);
        } catch (err) {
            console.error("Lỗi khi tải thêm tin nhắn cũ:", err);
        } finally {
            setLoadingMore(false);
        }
    };

    const loadAfterMessages = async () => {
        if (loadingAfter || !hasMoreAfter || !activeConversation || messages.length === 0) return;
        setLoadingAfter(true);

        try {
            const newestMsg = messages[messages.length - 1];
            const res = await getMessagesAfterAPI({
                conversationID: activeConversation.id,
                messageID: newestMsg.id
            });

            if (!res.messages || res.messages.length === 0) {
                setHasMoreAfter(false);
                setIsContextMode(false);
                return;
            }

            if (res.messages.length < 20) {
                setHasMoreAfter(false);
                setIsContextMode(false);
            }

            isAppendingRef.current = true;
            appendMessages(res.messages);
        } catch (err) {
            console.error("Lỗi khi tải thêm tin nhắn mới:", err);
        } finally {
            setLoadingAfter(false);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollTop <= 200 && hasMore && !loadingMore) {
            loadMoreMessages();
        }
        if (scrollHeight - scrollTop - clientHeight <= 200 && hasMoreAfter && !loadingAfter) {
            loadAfterMessages();
        }
    };

    useEffect(() => {
        if (isPrependingRef.current) {
            isPrependingRef.current = false;
            return;
        }
        if (isAppendingRef.current) {
            isAppendingRef.current = false;
            return;
        }
        if (isContextMode) {
            return;
        }
        if (messages.length > 0) {
            scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth', false);
        }
    }, [messages, isContextMode]);

    useEffect(() => {
        if (!activeConversation) return;
        const fetchMembers = async () => {
            try {
                const res = await getConversationMembersAPI(activeConversation.id);
                setConversationMember(res.member || []);
            } catch (err) {
                console.error("Lỗi khi tải thành viên cuộc trò chuyện:", err);
            }
        };
        fetchMembers();
    }, [activeConversation, setConversationMember]);

    useEffect(() => {
        if (!activeConversation) return;
        getPinnedMessageAPI(activeConversation.id)
            .then(res => {
                if (res.success) {
                    setPinnedList(res.pinnedList || []);
                }
            })
            .catch(err => console.error("Lỗi khi tải danh sách ghim:", err));
    }, [activeConversation, setPinnedList]);

    const handlePinMessage = async (msg) => {
        try {
            const res = await pinnedMessageAPI({ conversationID: activeConversation.id, messageID: msg.id });
            if (res.success) {
                setPinnedList(res.pinnedList || []);
                emitUpdatePinnedList(activeConversation.id, res.pinnedList || []);
            }
        } catch (err) {
            alert("Lỗi khi ghim tin nhắn!");
        }
    };

    const handleUnpinMessage = async (messageID) => {
        try {
            const res = await unpinMessageAPI({ conversationID: activeConversation.id, messageID });
            if (res.success) {
                setPinnedList(res.pinnedList || []);
                emitUpdatePinnedList(activeConversation.id, res.pinnedList || []);
            }
        } catch (err) {
            alert("Lỗi khi gỡ ghim!");
        }
    };

    const handleJumpToMessage = (messageID) => {
        const el = document.getElementById(`msg-${messageID}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-500', 'bg-blue-100/50');
            setTimeout(() => {
                el.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-100/50');
            }, 2000);
        } else {
            alert("Tin nhắn này ở vị trí cũ chưa được tải vào khung chat");
        }
    };

    const handleInputChange = (e) => {
        setText(e.target.value);
        emitTypingStart(activeConversation.id);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        typingTimeoutRef.current = setTimeout(() => {
            emitTypingStop(activeConversation.id);
        }, 2000);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() && !selectedImageFile) return;

        if (editMessage) {
            emitEditMessage(editMessage.id, activeConversation.id, text.trim());
            setEditMessage(null);
            setText('');
            return;
        }

        try {
            if (selectedImageFile) {
                setIsUploadingImage(true);
                const res = await uploadFileAPI(selectedImageFile);
                const imageUrl = res.fileURL || res.fileUrl;
                if (imageUrl) {
                    sendMessage(activeConversation.id, imageUrl, 'image', replyingMessage?.id);
                }
                handleCancelImagePreview();
                setIsUploadingImage(false);
            }

            if (text.trim()) {
                sendMessage(activeConversation.id, text.trim(), 'text', replyingMessage?.id);
                setText('');
            }

            setReplyingMessage(null);
            emitTypingStop(activeConversation.id);
            scrollToBottom('smooth', true);
        } catch (err) {
            console.error("Lỗi khi gửi tin nhắn/ảnh:", err);
            alert("Lỗi khi gửi tin nhắn!");
            setIsUploadingImage(false);
        }
    };

    const handleViewMembers = async () => {
        try {
            const res = await getConversationMembersAPI(activeConversation.id);
            setConversationMember(res.member || []);
            setShowMembersModal(true);
        } catch (err) {
            console.log("Error when load member of group", err.message);
            alert("Không thể tải danh sách thành viên");
        }
    };

    const handleRemoveMember = async (targetUserID, username) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa ${username} khỏi nhóm?`)) {
            try {
                await removeMemberAPI(activeConversation.id, targetUserID);
                emitRemoveMember(activeConversation.id, targetUserID);
                useChatStore.getState().removeConversationMember(targetUserID);
            } catch (err) {
                console.error("Lỗi khi xóa thành viên:", err);
                alert(err.response?.data?.message || "Lỗi khi xóa thành viên!");
            }
        }
    };

    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [addMemberQuery, setAddMemberQuery] = useState('');
    const [addMemberSearchResults, setAddMemberSearchResults] = useState([]);
    const [selectedAddMembers, setSelectedAddMembers] = useState([]);

    const handleSearchNewMember = async (e) => {
        const query = e.target.value;
        setAddMemberQuery(query);
        if (!query.trim()) {
            setAddMemberSearchResults([]);
            return;
        }
        try {
            const res = await searchUserAPI(query);
            if (res.success) {
                const existingMemberIDs = conversationMembers.map(m => String(m.id));
                setAddMemberSearchResults(res.data.filter(u => !existingMemberIDs.includes(String(u.id))));
            }
        } catch (err) {
            console.error("Lỗi khi tìm kiếm người dùng mới:", err);
        }
    };

    const handleSelectAddMember = (member) => {
        if (!selectedAddMembers.some(m => m.id === member.id)) {
            setSelectedAddMembers([...selectedAddMembers, member]);
        }
        setAddMemberQuery('');
        setAddMemberSearchResults([]);
    };

    const handleRemoveSelectAddMember = (memberID) => {
        setSelectedAddMembers(selectedAddMembers.filter(m => m.id !== memberID));
    };

    const handleAddMembersSubmit = async () => {
        if (selectedAddMembers.length === 0) return;
        try {
            const targetIDs = selectedAddMembers.map(m => m.id);
            await addMemberToConversationAPI(activeConversation.id, targetIDs);
            emitAddMember(activeConversation.id, targetIDs);
            const res = await getConversationMembersAPI(activeConversation.id);
            setConversationMember(res.member || []);
            setShowAddMemberModal(false);
            setSelectedAddMembers([]);
            setAddMemberQuery('');
            alert("Thêm thành viên thành công!");
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi thêm thành viên!");
        }
    };

    const handleLeaveConversation = async () => {
        if (window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm?")) {
            try {
                await leaveConversationAPI(activeConversation.id);
                emitLeaveConversation(activeConversation.id);
                const currentConvs = useChatStore.getState().conversations;
                useChatStore.getState().setConversations(currentConvs.filter(c => c.id !== activeConversation.id));
                useChatStore.getState().setActiveConversation(null);
            } catch (err) {
                alert(err.response?.data?.message || "Error when leave group");
            }
        }
    };

    const handleSearchMessage = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim() || !activeConversation) return;
        setIsSearching(true);
        try {
            const res = await searchMessageAPI({ conversationID: activeConversation.id, content: searchQuery });
            if (res.success) {
                setSearchResult(res.messages || []);
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Error when search message');
        } finally {
            setIsSearching(false);
        }
    };

    const handleJumpToSearchResult = async (targetMessageID) => {
        try {
            const res = await getMessagesContext({
                conversationID: activeConversation.id,
                messageID: targetMessageID
            });

            if (res.success && res.messages) {
                setIsContextMode(true);
                setHasMore(true);
                setHasMoreAfter(true);
                setMessages(res.messages);

                setTimeout(() => {
                    const el = document.getElementById(`msg-${targetMessageID}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('bg-yellow-200', 'transition-all', 'duration-500');
                        setTimeout(() => {
                            el.classList.remove('bg-yellow-200');
                        }, 2500);
                    }
                }, 150);
            }
        } catch (err) {
            console.error("Lỗi khi tải ngữ cảnh tin nhắn:", err);
        }
    };

    const isDirect = activeConversation.type === 'direct';
    const activeName = isDirect ? activeConversation.other_user_name : activeConversation.group_name;
    const isOnline = isDirect && onlineUsers.includes(String(activeConversation.other_user_id));

    const activeTyping = typingUsers[activeConversation.id] || {};
    const typingList = Object.entries(activeTyping).filter(([id]) => String(id) !== String(user?.id));

    const currentUserMember = conversationMembers.find(m => String(m.id) === String(user?.id));
    const isAdmin = currentUserMember?.role === 'admin';

    // Render Modal Thành Viên với Portal
    const membersModalContent = showMembersModal ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-sky-50/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white border border-sky-200/60 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <span>👥</span> Thành Viên Nhóm
                    </h3>
                    <button
                        onClick={() => {
                            setShowMembersModal(false);
                            setShowAddMemberModal(false);
                        }}
                        className="text-slate-500 hover:text-slate-900 w-8 h-8 rounded-full flex items-center justify-center hover:bg-sky-100 transition cursor-pointer font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Nút & Khung Thêm thành viên dành cho Admin */}
                {isAdmin && (
                    <div className="mb-4">
                        {!showAddMemberModal ? (
                            <button
                                onClick={() => setShowAddMemberModal(true)}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                            >
                                <span>➕</span> Thêm thành viên mới
                            </button>
                        ) : (
                            <div className="bg-sky-50 p-3 rounded-2xl border border-sky-200 space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-900">Tìm & Thêm thành viên</span>
                                    <button
                                        onClick={() => setShowAddMemberModal(false)}
                                        className="text-xs text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                                    >
                                        Hủy
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Nhập tên người dùng..."
                                    value={addMemberQuery}
                                    onChange={handleSearchNewMember}
                                    className="w-full px-3 py-1.5 bg-white border border-sky-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                                {/* Kết quả tìm kiếm */}
                                {addMemberSearchResults.length > 0 && (
                                    <div className="max-h-28 overflow-y-auto space-y-1 bg-white border border-sky-100 rounded-xl p-1 shadow-sm">
                                        {addMemberSearchResults.map(u => (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => handleSelectAddMember(u)}
                                                className="w-full flex items-center gap-2 p-1.5 hover:bg-sky-50 rounded-lg transition text-left cursor-pointer"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center overflow-hidden">
                                                    {u.avatar_url ? (
                                                        <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        u.username?.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-800 font-medium truncate">{u.username}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Đã chọn */}
                                {selectedAddMembers.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {selectedAddMembers.map(m => (
                                            <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                                                {m.username}
                                                <button onClick={() => handleRemoveSelectAddMember(m.id)} className="hover:text-red-200 font-bold cursor-pointer">✕</button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {selectedAddMembers.length > 0 && (
                                    <button
                                        onClick={handleAddMembersSubmit}
                                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
                                    >
                                        Xác nhận thêm ({selectedAddMembers.length})
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-2.5 mb-4 pr-1 divide-y divide-sky-100">
                    {conversationMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between pt-2.5 first:pt-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shadow-sm">
                                    {m.avatar_url ? (
                                        <img src={m.avatar_url} alt={m.username} className="w-full h-full object-cover" />
                                    ) : (
                                        m.username?.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="text-sm text-slate-700 font-semibold">{m.username}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${m.role === 'admin'
                                    ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                                    : 'bg-sky-100 text-slate-500'
                                    }`}>
                                    {m.role}
                                </span>
                                {isAdmin && String(m.id) !== String(user?.id) && (
                                    <button
                                        onClick={() => handleRemoveMember(m.id, m.username)}
                                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer font-bold"
                                        title="Xóa khỏi nhóm"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={() => {
                            setShowMembersModal(false);
                            setShowAddMemberModal(false);
                        }}
                        className="px-5 py-2 bg-sky-100 hover:bg-sky-200 text-slate-900 rounded-2xl text-xs font-bold transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="flex h-full bg-sky-50 text-slate-900 overflow-hidden w-full">
            {/* Khung chat chính ở giữa */}
            <div className="flex-1 flex flex-col h-full bg-sky-50 min-w-0">
                {/* Header */}
                <div className="px-6 py-4 border-b border-sky-100/80 bg-white/80 backdrop-blur-md flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-md border border-blue-200/40 overflow-hidden">
                                {(isDirect ? activeConversation.other_user_avatar : activeConversation.group_avatar) ? (
                                    <img src={isDirect ? activeConversation.other_user_avatar : activeConversation.group_avatar} alt={activeName} className="w-full h-full object-cover" />
                                ) : (
                                    activeName?.charAt(0).toUpperCase()
                                )}
                            </div>
                            {isDirect && isOnline && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-base text-slate-900 leading-tight">{activeName}</h4>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
                                {isDirect ? (
                                    <>
                                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                        <span>{isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span>Nhóm chat • {conversationMembers.length} thành viên</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setShowSearch(!showSearch);
                                setSearchQuery('');
                                setSearchResult([]);
                            }}
                            className={`px-3 py-2 text-xs font-bold rounded-2xl transition cursor-pointer active:scale-95 border ${showSearch
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-sky-100 border-sky-200'
                                }`}
                            title="Tìm kiếm tin nhắn"
                        >
                            🔍 Tìm kiếm
                        </button>
                        <button
                            onClick={() => setShowInfoPanel(!showInfoPanel)}
                            className={`px-4 py-2 text-xs font-bold rounded-2xl transition cursor-pointer active:scale-95 border ${showInfoPanel
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-sky-100 border-sky-200'
                                }`}
                            title="Thông tin cuộc trò chuyện"
                        >
                            Thông tin
                        </button>
                    </div>
                </div>

                {/* Khung tìm kiếm tin nhắn */}
                {showSearch && (
                    <div className="p-3 bg-white border-b border-sky-100 shadow-sm z-10 animate-fade-in shrink-0">
                        <form onSubmit={handleSearchMessage} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                placeholder="Nhập nội dung cần tìm..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-sky-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                            />
                            <button
                                type="submit"
                                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                            >
                                {isSearching ? 'Đang tìm...' : 'Tìm'}
                            </button>
                        </form>

                        {/* Danh sách kết quả */}
                        {searchResult.length > 0 && (
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                <p className="text-[11px] font-bold text-slate-500 mb-1">Tìm thấy {searchResult.length} kết quả:</p>
                                {searchResult.map((msg) => (
                                    <div
                                        key={msg.id}
                                        onClick={() => handleJumpToSearchResult(msg.id)}
                                        className="p-2 bg-sky-50/60 hover:bg-sky-100 rounded-xl border border-sky-100 cursor-pointer transition text-xs"
                                    >
                                        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                                            <span className="font-bold text-slate-800">{msg.sender_name}</span>
                                            <span>
                                                {new Date(msg.created_at).toLocaleDateString('vi-VN')} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 font-medium line-clamp-2">{msg.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {searchResult.length === 0 && searchQuery && !isSearching && (
                            <p className="text-xs text-slate-400 text-center py-2">Không tìm thấy tin nhắn nào.</p>
                        )}
                    </div>
                )}

                {/* Pinned Messages Bar (Zalo Style với nút +X ghim) */}
                {pinnedList.length > 0 && (
                    <div className="px-6 py-2.5 bg-blue-50/90 border-b border-blue-100/80 flex items-center justify-between shadow-xs shrink-0 z-10 backdrop-blur-xs select-none">
                        <div
                            onClick={() => handleJumpToMessage(pinnedList[0].message_id)}
                            className="flex items-center gap-2 text-xs min-w-0 pr-2 cursor-pointer group flex-1"
                            title="Nhấp để cuộn tới tin nhắn này"
                        >
                            <span className="font-bold text-blue-700 shrink-0 uppercase tracking-wider text-[11px]">
                                Ghim:
                            </span>
                            <span className="font-bold text-slate-900 shrink-0">
                                {pinnedList[0].sender_name}:
                            </span>
                            <span className="truncate text-slate-600 font-medium group-hover:text-blue-700 transition">
                                {pinnedList[0].type === 'image' ? 'Đã gửi 1 ảnh' : pinnedList[0].content}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {pinnedList.length > 1 && (
                                <button
                                    onClick={() => setShowPinnedListModal(true)}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] transition cursor-pointer shadow-xs active:scale-95"
                                >
                                    +{pinnedList.length - 1} ghim
                                </button>
                            )}
                            <button
                                onClick={() => handleUnpinMessage(pinnedList[0].message_id)}
                                className="text-xs font-bold text-red-600 hover:bg-red-100/70 px-2 py-1 rounded-xl transition cursor-pointer"
                                title="Gỡ ghim tin nhắn này"
                            >
                                Bỏ ghim
                            </button>
                        </div>
                    </div>
                )}

                {/* Message List */}
                <div
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
                >
                    {loadingMore && (
                        <div className="flex items-center justify-center py-2 text-xs font-semibold text-sky-600 animate-pulse gap-2">
                            <span>⏳</span> Đang tải tin nhắn cũ hơn...
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isOwnMessage = String(msg.sender_id) === String(user?.id);
                        const isDeleted = !!msg.deleted_at;
                        const isEdited = !!msg.edited_at && !isDeleted;

                        return (
                            <div key={msg.id} id={`msg-${msg.id}`} className="space-y-1 group transition-all duration-300 rounded-2xl p-1">
                                <div className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {!isOwnMessage && (
                                        <div className="w-7 h-7 rounded-full bg-sky-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mb-1 border border-sky-200 overflow-hidden">
                                            {msg.sender_avatar ? (
                                                <img src={msg.sender_avatar} alt={msg.sender_name} className="w-full h-full object-cover" />
                                            ) : (
                                                msg.sender_name?.charAt(0).toUpperCase() || 'U'
                                            )}
                                        </div>
                                    )}

                                    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[65%]`}>
                                        {/* Quoted / Replied Message Bubble (Bóng Tin Nhắn Trích Dẫn Ở Trên) */}
                                        {msg.reply_content && !isDeleted && (
                                            <div className={`-mb-2.5 z-0 px-3.5 py-2 pb-3.5 rounded-2xl text-xs max-w-[85%] border shadow-xs ${isOwnMessage
                                                    ? 'bg-blue-800/70 text-blue-100 border-blue-400/30'
                                                    : 'bg-slate-300/80 text-slate-800 border-slate-300'
                                                }`}>
                                                <span className="font-bold block text-[10px] opacity-75 mb-0.5">
                                                    {msg.reply_sender_name || 'Thành viên'}
                                                </span>
                                                <p className="truncate text-xs opacity-90">{msg.reply_content}</p>
                                            </div>
                                        )}

                                        {/* Main Message Bubble (Tin Nhắn Chính Ở Dưới) */}
                                        <div className={`relative z-10 transition ${msg.type === 'image' && !isDeleted
                                            ? 'p-0 bg-transparent shadow-none'
                                            : `rounded-3xl px-4 py-3 shadow-md ${isOwnMessage
                                                ? 'bg-blue-600 text-white rounded-br-xs shadow-blue-100'
                                                : 'bg-sky-100 text-slate-900 rounded-bl-xs border border-sky-200/60'
                                            }`
                                            }`}>
                                            {!isOwnMessage && !isDirect && msg.type !== 'image' && (
                                                <div className="text-[11px] font-bold text-blue-700 mb-1">
                                                    {msg.sender_name}
                                                </div>
                                            )}

                                            {/* Content */}
                                            {isDeleted ? (
                                                <p className="text-sm italic text-slate-500 opacity-70">Tin nhắn đã được thu hồi</p>
                                            ) : msg.type === 'image' ? (
                                                <div className="relative group/img overflow-hidden rounded-3xl shadow-md border border-sky-200/50">
                                                    {!isOwnMessage && !isDirect && (
                                                        <div className="absolute top-2 left-2 z-10 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] text-white font-bold">
                                                            {msg.sender_name}
                                                        </div>
                                                    )}
                                                    <a href={msg.content} target="_blank" rel="noreferrer" className="block">
                                                        <img
                                                            src={msg.content}
                                                            alt="Hình ảnh tin nhắn"
                                                            onLoad={() => scrollToBottom('smooth')}
                                                            className="max-w-xs max-h-72 w-full rounded-3xl object-cover hover:scale-105 transition-transform duration-200"
                                                        />
                                                    </a>
                                                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[9px] text-white font-medium">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            ) : msg.type === 'file' ? (
                                                <a href={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline font-bold text-xs my-1">
                                                    Tải file đính kèm
                                                </a>
                                            ) : (
                                                <p className="text-sm leading-relaxed break-words font-medium">{msg.content}</p>
                                            )}

                                            {msg.type !== 'image' && (
                                                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                                                    {isEdited && (
                                                        <span className="text-[9px] italic opacity-60 text-slate-700">(đã sửa)</span>
                                                    )}
                                                    <span className="block text-[10px] opacity-60 text-right font-medium">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Render Reactions Badge List under Message Bubble */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className={`flex flex-wrap gap-1 mt-1 z-10 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                                {groupReactions(msg.reactions, user?.id).map((group) => (
                                                    <button
                                                        key={group.emoji}
                                                        type="button"
                                                        onClick={() => {
                                                            setReactionModalMessage(msg);
                                                            setSelectedEmojiTab(group.emoji);
                                                        }}
                                                        title={`Xem danh sách (${group.users.join(', ')})`}
                                                        className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all cursor-pointer shadow-xs ${group.hasReacted
                                                                ? 'bg-blue-100 border-blue-400 text-blue-700 font-bold shadow-blue-100/50'
                                                                : 'bg-white/90 border-sky-200 text-slate-700 hover:bg-sky-100 font-medium'
                                                            }`}
                                                    >
                                                        <span>{group.emoji}</span>
                                                        <span className="text-[10px]">{group.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons Hover */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-white border border-sky-200 rounded-2xl px-2 py-1 shadow-lg">
                                        {!isDeleted && (
                                            <>
                                                <div className="flex items-center gap-0.5 border-r border-sky-100 pr-1.5 mr-0.5">
                                                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                            className="hover:scale-125 transition-transform text-sm px-0.5 cursor-pointer"
                                                            title={`Thả cảm xúc ${emoji}`}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePinMessage(msg)}
                                                    className="text-[11px] font-semibold text-blue-700 hover:bg-sky-100 px-2 py-1 rounded-lg transition cursor-pointer"
                                                    title="Ghim tin nhắn này"
                                                >
                                                    Ghim
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditMessage(null);
                                                        setReplyingMessage(msg);
                                                    }}
                                                    className="text-[11px] font-semibold text-slate-700 hover:bg-sky-100 px-2 py-1 rounded-lg transition cursor-pointer"
                                                    title="Trả lời"
                                                >
                                                    Trả lời
                                                </button>
                                            </>
                                        )}
                                        {isOwnMessage && !isDeleted && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReplyingMessage(null);
                                                        setEditMessage(msg);
                                                        setText(msg.content);
                                                    }}
                                                    className="text-[11px] font-semibold text-slate-700 hover:bg-sky-100 px-2 py-1 rounded-lg transition cursor-pointer"
                                                    title="Chỉnh sửa"
                                                >
                                                    Sửa
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm("Bạn có chắc muốn thu hồi tin nhắn này?")) {
                                                            emitDeleteMessage(msg.id, activeConversation.id);
                                                        }
                                                    }}
                                                    className="text-[11px] font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition cursor-pointer"
                                                    title="Thu hồi"
                                                >
                                                    Thu hồi
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Read receipt avatars */}
                                <div className={`flex gap-1 mt-0.5 ${isOwnMessage ? 'justify-end pr-2' : 'justify-start pl-9'}`}>
                                    {conversationMembers.map(m => {
                                        if (String(m.id) === String(user?.id)) return null;
                                        if (m.last_read_message_id === msg.id) {
                                            return (
                                                <div key={m.id} className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white overflow-hidden shadow-xs" title={`Đã xem bởi ${m.username}`}>
                                                    {m.avatar_url ? (
                                                        <img src={m.avatar_url} alt={m.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[8px] text-white font-bold flex items-center justify-center h-full leading-none">
                                                            {m.username?.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messageEndRef} />
                </div>

                {/* Replying Banner */}
                {replyingMessage && (
                    <div className="px-6 py-2.5 bg-sky-100/60 border-t border-blue-200/30 flex items-center justify-between animate-fade-in">
                        <div className="text-xs text-blue-700 min-w-0 pr-3">
                            <span className="font-bold text-blue-700">Trả lời {replyingMessage.sender_name || 'thành viên'}:</span>
                            <p className="truncate text-slate-700 text-[11px] mt-0.5">{replyingMessage.content}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyingMessage(null)}
                            className="text-slate-500 hover:text-slate-900 text-xs font-bold w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Editing Banner */}
                {editMessage && (
                    <div className="px-6 py-2.5 bg-amber-50/60 border-t border-amber-500/30 flex items-center justify-between animate-fade-in">
                        <div className="text-xs text-amber-200 min-w-0 pr-3">
                            <span className="font-bold text-amber-300">Chỉnh sửa tin nhắn:</span>
                            <p className="truncate text-slate-700 text-[11px] mt-0.5">{editMessage.content}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditMessage(null);
                                setText('');
                            }}
                            className="text-slate-500 hover:text-slate-900 text-xs font-bold w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Image Preview Banner */}
                {imagePreviewUrl && (
                    <div className="px-6 py-2.5 bg-blue-50/90 border-t border-blue-200/60 flex items-center justify-between animate-fade-in shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-blue-200 shadow-md">
                                <img src={imagePreviewUrl} alt="Xem trước" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-xs">
                                <span className="font-bold text-blue-900 block">
                                    Ảnh xem trước
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] block mt-0.5">
                                    {selectedImageFile?.name}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleCancelImagePreview}
                            className="text-slate-400 hover:text-red-600 text-xs font-bold w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                            title="Hủy chọn ảnh"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Input Bar */}
                <form onSubmit={handleSend} className="p-4 border-t border-sky-100 bg-white/60 backdrop-blur-md flex items-center gap-3 shrink-0">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="px-3.5 py-3 text-slate-700 hover:text-blue-600 hover:bg-sky-100/80 rounded-2xl transition cursor-pointer flex items-center justify-center shrink-0 border border-sky-100/60 disabled:opacity-50 text-xs font-bold"
                        title="Gửi hình ảnh"
                    >
                        Ảnh
                    </button>
                    <input
                        type="text"
                        value={text}
                        onChange={handleInputChange}
                        disabled={isUploadingImage}
                        placeholder={editMessage ? "Chỉnh sửa tin nhắn..." : "Nhập tin nhắn..."}
                        className="flex-1 px-5 py-3.5 rounded-2xl bg-sky-50/80 border border-sky-100 text-sm text-slate-900 focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition placeholder-slate-500 font-medium disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isUploadingImage || (!text.trim() && !selectedImageFile)}
                        className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition cursor-pointer active:scale-95 shadow-lg shadow-blue-200/30 flex items-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>{isUploadingImage ? 'Đang tải...' : editMessage ? 'Lưu' : 'Gửi'}</span>
                    </button>
                </form>
            </div>

            {/* Panel Thông Tin Bên Phải (Zalo Style) */}
            {showInfoPanel && (
                <div className="w-80 border-l border-sky-100 bg-white flex flex-col h-full overflow-y-auto shrink-0 select-none animate-fade-in">
                    {/* Header Panel */}
                    <div className="p-4 border-b border-sky-100 flex items-center justify-between font-bold text-sm text-slate-900">
                        <span>Thông tin hội thoại</span>
                        <button
                            onClick={() => setShowInfoPanel(false)}
                            className="text-slate-400 hover:text-slate-700 text-xs font-bold w-7 h-7 rounded-full hover:bg-sky-50 flex items-center justify-center transition cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Section 1: Avatar & Display Name */}
                    <div className="p-6 text-center border-b border-sky-100 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-blue-600 text-white font-bold text-2xl flex items-center justify-center overflow-hidden shadow-md mb-3 border-2 border-sky-200">
                            {(isDirect ? activeConversation.other_user_avatar : activeConversation.group_avatar) ? (
                                <img src={isDirect ? activeConversation.other_user_avatar : activeConversation.group_avatar} alt={activeName} className="w-full h-full object-cover" />
                            ) : (
                                activeName?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <h4 className="font-bold text-base text-slate-900 leading-tight mb-1">{activeName}</h4>
                        <span className="text-xs text-slate-500 font-medium">
                            {isDirect ? (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến') : `${conversationMembers.length} thành viên`}
                        </span>
                    </div>

                    {/* Section 2: Quick Actions for Group */}
                    {!isDirect && (
                        <div className="p-4 border-b border-sky-100 space-y-2">
                            <button
                                onClick={() => setShowEditGroupModal(true)}
                                className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100/80 text-blue-700 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-between"
                            >
                                <span>Chỉnh sửa thông tin nhóm</span>
                                <span className="text-blue-400">›</span>
                            </button>
                            <button
                                onClick={handleViewMembers}
                                className="w-full py-2.5 px-4 bg-sky-50 hover:bg-sky-100/80 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer flex items-center justify-between"
                            >
                                <span>Danh sách thành viên ({conversationMembers.length})</span>
                                <span className="text-slate-400">›</span>
                            </button>
                        </div>
                    )}

                    {/* Section 3: Media Gallery (Ảnh đã gửi) */}
                    <div className="p-4 border-b border-sky-100">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                                Ảnh đã gửi ({totalSharedImages})
                            </span>
                        </div>
                        {sharedImages.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4">Chưa có ảnh nào được chia sẻ trong hội thoại này</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                                    {sharedImages.map(img => (
                                        <div
                                            key={img.id}
                                            onClick={() => handleJumpToSearchResult(img.id)}
                                            className="aspect-square rounded-xl overflow-hidden border border-sky-100 shadow-xs hover:opacity-90 transition block cursor-pointer group relative"
                                            title="Bấm để nhảy đến vị trí ảnh này trong cuộc trò chuyện"
                                        >
                                            <img src={img.content} alt="Ảnh tin nhắn" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                        </div>
                                    ))}
                                </div>
                                {hasMoreSharedImages && (
                                    <button
                                        onClick={() => fetchSharedImages(sharedImages.length, true)}
                                        disabled={loadingSharedImages}
                                        className="w-full py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                                    >
                                        {loadingSharedImages ? 'Đang tải thêm...' : 'Xem thêm ảnh cũ'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Section 4: Leave Group (Bottom Action) */}
                    {!isDirect && (
                        <div className="p-4 mt-auto">
                            <button
                                onClick={handleLeaveConversation}
                                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl text-xs transition cursor-pointer text-center"
                            >
                                Rời khỏi nhóm
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Portal for Members Modal */}
            {membersModalContent && ReactDOM.createPortal(membersModalContent, document.body)}

            {/* Modal Edit Group Profile */}
            {showEditGroupModal && <GroupProfileModal onClose={() => setShowEditGroupModal(false)} />}

            {/* Modal Danh sách tin nhắn ghim (+X ghim) */}
            {showPinnedListModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-fade-in flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between pb-4 border-b border-sky-100">
                            <h3 className="font-bold text-base text-slate-900">
                                Danh sách tin nhắn đã ghim ({pinnedList.length})
                            </h3>
                            <button
                                onClick={() => setShowPinnedListModal(false)}
                                className="text-slate-400 hover:text-slate-700 font-bold text-sm w-7 h-7 rounded-full hover:bg-sky-50 flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
                            {pinnedList.map((pin) => (
                                <div
                                    key={pin.pin_id}
                                    className="p-3 bg-sky-50/60 hover:bg-sky-100/80 rounded-2xl border border-sky-100 flex items-center justify-between gap-3 transition"
                                >
                                    <div
                                        onClick={() => {
                                            setShowPinnedListModal(false);
                                            handleJumpToMessage(pin.message_id);
                                        }}
                                        className="flex-1 min-w-0 cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-xs text-slate-900">{pin.sender_name}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(pin.pinned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 truncate font-medium">
                                            {pin.type === 'image' ? 'Đã gửi 1 ảnh' : pin.content}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleUnpinMessage(pin.message_id)}
                                        className="text-xs font-bold text-red-600 hover:bg-red-100/80 px-2.5 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                                    >
                                        Bỏ ghim
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="pt-3 border-t border-sky-100 text-right">
                            <button
                                onClick={() => setShowPinnedListModal(false)}
                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {reactionModalMessage && ReactDOM.createPortal(
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-sky-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between pb-3 border-b border-sky-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span>Cảm xúc về tin nhắn</span>
                            </h3>
                            <button
                                onClick={() => setReactionModalMessage(null)}
                                className="text-slate-400 hover:text-slate-700 w-7 h-7 rounded-full hover:bg-sky-100 flex items-center justify-center font-bold text-sm transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Tabs Filter Emoji */}
                        <div className="flex items-center gap-1.5 py-3 border-b border-sky-100 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setSelectedEmojiTab('ALL')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${selectedEmojiTab === 'ALL'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-sky-100 text-slate-600 hover:bg-sky-200'
                                    }`}
                            >
                                Tất cả {reactionModalMessage.reactions?.length || 0}
                            </button>
                            {groupReactions(reactionModalMessage.reactions, user?.id).map((g) => (
                                <button
                                    key={g.emoji}
                                    onClick={() => setSelectedEmojiTab(g.emoji)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${selectedEmojiTab === g.emoji
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-sky-100 text-slate-600 hover:bg-sky-200'
                                        }`}
                                >
                                    <span>{g.emoji}</span>
                                    <span>{g.count}</span>
                                </button>
                            ))}
                        </div>

                        {/* User List */}
                        <div className="max-h-64 overflow-y-auto py-2 space-y-1 divide-y divide-sky-50">
                            {(reactionModalMessage.reactions || [])
                                .filter(r => selectedEmojiTab === 'ALL' || r.emoji === selectedEmojiTab)
                                .sort((a, b) => {
                                    const aIsMe = String(a.user_id) === String(user?.id);
                                    const bIsMe = String(b.user_id) === String(user?.id);
                                    if (aIsMe && !bIsMe) return -1;
                                    if (!aIsMe && bIsMe) return 1;
                                    return 0;
                                })
                                .map(r => (
                                    <div key={r.id || `${r.user_id}-${r.emoji}`} className="flex items-center justify-between py-2 px-1 rounded-2xl hover:bg-sky-50 transition">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shadow-xs shrink-0">
                                                {r.avatar_url ? (
                                                    <img src={r.avatar_url} alt={r.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    r.username?.charAt(0).toUpperCase() || 'U'
                                                )}
                                            </div>
                                            <span className="text-xs font-bold text-slate-800">
                                                {r.username} {String(r.user_id) === String(user?.id) && <span className="text-blue-600 font-normal">(Bạn)</span>}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{r.emoji}</span>
                                            {String(r.user_id) === String(user?.id) && (
                                                <button
                                                    onClick={() => handleToggleReaction(reactionModalMessage.id, r.emoji)}
                                                    className="text-[11px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded-xl border border-red-200 transition cursor-pointer active:scale-95 ml-1"
                                                    title="Gỡ cảm xúc này"
                                                >
                                                    Hủy
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>

                        <div className="pt-3 border-t border-sky-100 flex justify-end">
                            <button
                                onClick={() => setReactionModalMessage(null)}
                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ChatWindow;



