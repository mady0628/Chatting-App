import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { getMessagesAPI, getConversationMembersAPI, markAsReadAPI, removeMemberAPI, leaveConversationAPI, addMemberToConversationAPI, searchUserAPI, uploadFileAPI, getPinnedMessageAPI, pinnedMessageAPI, unpinMessageAPI } from '../api/endpoints.js';

import GroupProfileModal from './GroupProfileModal.jsx';

const ChatWindow = () => {
    const { user } = useAuthStore();
    const { activeConversation, messages, setMessages, typingUsers, markConversationAsRead, conversationMembers, setConversationMember, replyingMessage, setReplyingMessage, onlineUsers, pinnedList, setPinnedList } = useChatStore();
    const { sendMessage, emitTypingStart, emitTypingStop, emitMarkAsRead, emitEditMessage, emitDeleteMessage, emitRemoveMember, emitLeaveConversation, emitAddMember, emitUpdatePinnedList } = useSocket();

    const [text, setText] = useState('');
    const messageEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [showEditGroupModal, setShowEditGroupModal] = useState(false);
    const [showPinnedListModal, setShowPinnedListModal] = useState(false);
    const [editMessage, setEditMessage] = useState(null);

    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [showInfoPanel, setShowInfoPanel] = useState(true);

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

    const scrollToBottom = (behavior = 'smooth') => {
        setTimeout(() => {
            messageEndRef.current?.scrollIntoView({ behavior, block: 'end' });
        }, 60);
    };

    useEffect(() => {
        if (!activeConversation) return;

        const loadMessages = async () => {
            try {
                const res = await getMessagesAPI(activeConversation.id, 55, 0);
                const reversedMessages = res.messages.reverse();
                setMessages(reversedMessages);
                await markAsReadAPI(activeConversation.id);
                markConversationAsRead(activeConversation.id);
                const lastOtherMessage = reversedMessages.slice().reverse().find(m => String(m.sender_id) !== String(user?.id));
                if (lastOtherMessage) {
                    emitMarkAsRead(activeConversation.id, lastOtherMessage.id);
                }
                scrollToBottom('auto');
            } catch (err) {
                console.error("Lỗi khi tải tin nhắn:", err);
            }
        };

        loadMessages();
    }, [activeConversation, setMessages]);

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
        }
    }, [messages]);

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
                            onClick={() => setShowInfoPanel(!showInfoPanel)}
                            className={`px-4 py-2 text-xs font-bold rounded-2xl transition cursor-pointer active:scale-95 border ${
                                showInfoPanel
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-white text-slate-700 hover:bg-sky-100 border-sky-200'
                            }`}
                            title="Thông tin cuộc trò chuyện"
                        >
                            Thông tin
                        </button>
                    </div>
                </div>

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
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
                                            <div className={`-mb-2.5 z-0 px-3.5 py-2 pb-3.5 rounded-2xl text-xs max-w-[85%] border shadow-xs ${
                                                isOwnMessage
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
                                    </div>

                                    {/* Action Buttons Hover */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-white border border-sky-200 rounded-2xl px-2 py-1 shadow-lg">
                                        {!isDeleted && (
                                            <>
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
                                Ảnh đã gửi ({messages.filter(m => m.type === 'image' && !m.deleted_at).length})
                            </span>
                        </div>
                        {messages.filter(m => m.type === 'image' && !m.deleted_at).length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4">Chưa có ảnh nào được chia sẻ trong hội thoại này</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                                {messages
                                    .filter(m => m.type === 'image' && !m.deleted_at)
                                    .map(m => (
                                        <a
                                            key={m.id}
                                            href={m.content}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="aspect-square rounded-xl overflow-hidden border border-sky-100 shadow-xs hover:opacity-90 transition block"
                                        >
                                            <img src={m.content} alt="Ảnh tin nhắn" className="w-full h-full object-cover" />
                                        </a>
                                    ))}
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
        </div>
    );
};

export default ChatWindow;



