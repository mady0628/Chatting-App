import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import useFriendStore from '../store/friendStore.js';
import { searchUserAPI, createDirectConversationAPI, getListConversationAPI, createGroupConversationAPI, sendFriendRequestAPI } from '../api/endpoints.js';
import { useSocket } from '../hooks/useSocket.js';
import ProfileModal from './ProfileModal.jsx';
import FriendsModal from './FriendsModal.jsx';

const getPreviewText = (conv, currentUser) => {
    if (!conv || !conv.last_message) return "Chưa có tin nhắn nào";
    if (conv.last_message_type === 'system') return conv.last_message;

    const isImageMsg = conv.last_message_type === 'image' || 
                       conv.last_message.startsWith('http://') || 
                       conv.last_message.startsWith('https://');

    const isOwnMsg = String(conv.last_message_sender_id || '') === String(currentUser?.id);
    const senderPrefix = isOwnMsg ? "Bạn" : (conv.last_message_sender_name || "Thành viên");

    if (isImageMsg) {
        return `${senderPrefix} đã gửi 1 ảnh`;
    }

    if (conv.last_message.startsWith('Bạn:') || (conv.last_message_sender_name && conv.last_message.startsWith(`${conv.last_message_sender_name}:`))) {
        return conv.last_message;
    }

    return `${senderPrefix}: ${conv.last_message}`;
};

const Sidebar = ({ logout }) => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { emitCreateConversation, joinConversation, emitSendFriendRequest } = useSocket();
    const { conversations, setConversations, activeConversation, setActiveConversation, onlineUsers } = useChatStore();
    const { friends, friendRequests } = useFriendStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showFriendsModal, setShowFriendsModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [groupSearchResult, setGroupSearchResult] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const res = await searchUserAPI(query);
            if (res.success) {
                setSearchResults(res.data.filter(u => u.id !== user?.id));
            }
        } catch (err) {
            console.error("Lỗi khi tìm kiếm người dùng mới:", err);
        }
    };

    const handleStartChat = async (targetUser) => {
        try {
            const res = await createDirectConversationAPI(targetUser.id);
            const conversationID = res.conversationID;

            emitCreateConversation(conversationID, [user.id, targetUser.id]);
            joinConversation(conversationID);

            const data = await getListConversationAPI();
            setConversations(data.conversations || []);

            const newActive = data.conversations.find(c => String(c.id) === String(conversationID));
            if (newActive) {
                setActiveConversation(newActive);
            }

            setSearchQuery('');
            setSearchResults([]);
            setIsSearching(false);
        } catch (err) {
            if (err.response?.data?.conversationID) {
                const existingID = err.response.data.conversationID;

                try {
                    const data = await getListConversationAPI();
                    setConversations(data.conversations || []);

                    const existingConv = data.conversations.find(c => String(c.id) === String(existingID));
                    if (existingConv) {
                        setActiveConversation(existingConv);
                    } else {
                        setActiveConversation({
                            id: existingID,
                            type: 'direct',
                            other_user_id: targetUser.id,
                            other_user_name: targetUser.username
                        });
                    }
                } catch {
                    setActiveConversation({
                        id: existingID,
                        type: 'direct',
                        other_user_id: targetUser.id,
                        other_user_name: targetUser.username
                    });
                }

                setSearchQuery('');
                setSearchResults([]);
                setIsSearching(false);
            } else {
                console.error("Không thể tạo cuộc hội thoại:", err);
            }
        }
    };

    const handleSendFriendRequest = async (e, targetUser) => {
        e.stopPropagation();
        try {
            const res = await sendFriendRequestAPI({ receiveID: targetUser.id });
            if (res.success) {
                alert(`Đã gửi lời mời kết bạn tới ${targetUser.username}!`);
                emitSendFriendRequest(targetUser.id, res.requestID || '', {
                    id: user.id,
                    username: user.username,
                    avatar_url: user.avatar_url
                });
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi gửi lời mời kết bạn");
        }
    };

    const filteredConversations = conversations.filter(conv => {
        const displayName = conv.type === 'direct' ? conv.other_user_name : conv.group_name;
        return displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const newUsers = searchResults.filter(u => {
        const exists = conversations.some(conv => conv.type === 'direct' && conv.other_user_id === u.id);
        return !exists;
    });

    const handleGroupSearch = async (e) => {
        const query = e.target.value;
        setGroupSearchQuery(query);

        if (!query.trim()) {
            setGroupSearchResult([]);
            return;
        }
        try {
            const res = await searchUserAPI(query);
            if (res.success) {
                setGroupSearchResult(res.data.filter(u => u.id !== user?.id));
            }
        } catch (err) {
            console.log("Error search user:", err.message);
        }
    };

    const hanldeSelectMember = (member) => {
        if (!selectedMembers.some(m => m.id === member.id)) {
            setSelectedMembers([...selectedMembers, member]);
        }
        setGroupSearchQuery('');
        setGroupSearchResult([]);
    };

    const handleRemoveMember = (memberID) => {
        setSelectedMembers(selectedMembers.filter(m => m.id !== memberID));
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            alert("Vui lòng nhập tên nhóm");
            return;
        }
        if (selectedMembers.length === 0) {
            alert("Vui lòng chọn ít nhất 1 thành viên");
            return;
        }

        try {
            const memberIDs = selectedMembers.map(m => m.id);
            const res = await createGroupConversationAPI(groupName, memberIDs);
            emitCreateConversation(res.conversationID, [user.id, ...memberIDs]);
            joinConversation(res.conversationID);

            const data = await getListConversationAPI();
            setConversations(data.conversations || []);

            const newActive = data.conversations.find(c => String(c.id) === String(res.conversationID));
            if (newActive) {
                setActiveConversation(newActive);
            }

            setShowCreateGroupModal(false);
            setSelectedMembers([]);
            setGroupName('');
        } catch (err) {
            console.log("Error when create group", err.message);
            alert("Không thể tạo nhóm");
        }
    };

    const groupModalContent = showCreateGroupModal ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-sky-50/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white border border-sky-200/60 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        Tạo Nhóm Chat Mới
                    </h3>
                    <button
                        onClick={() => setShowCreateGroupModal(false)}
                        className="text-slate-500 hover:text-slate-900 w-8 h-8 rounded-full flex items-center justify-center hover:bg-sky-100 transition cursor-pointer text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tên nhóm</label>
                    <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Nhập tên nhóm chat..."
                        className="w-full px-4 py-3 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Thêm thành viên</label>
                    <input
                        type="text"
                        value={groupSearchQuery}
                        onChange={handleGroupSearch}
                        placeholder="Tìm bạn bè theo tên..."
                        className="w-full px-4 py-3 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                    />

                    {groupSearchResult.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto bg-sky-50 border border-sky-100 rounded-2xl p-1 divide-y divide-slate-800">
                            {groupSearchResult.map(u => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => hanldeSelectMember(u)}
                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-sky-100/60 transition flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-700 font-bold text-xs flex items-center justify-center">
                                            {u.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{u.username}</span>
                                    </div>
                                    <span className="text-xs text-blue-600 font-bold bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-200/20">+ Thêm</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedMembers.length > 0 && (
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Thành viên đã chọn ({selectedMembers.length})</label>
                        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-sky-50/50 rounded-2xl border border-sky-100">
                            {selectedMembers.map(m => (
                                <span
                                    key={m.id}
                                    className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-200/30 text-blue-700 rounded-xl text-xs font-semibold"
                                >
                                    {m.username}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMember(m.id)}
                                        className="text-blue-600 hover:text-slate-900 font-bold cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-sky-100">
                    <button
                        type="button"
                        onClick={() => {
                            setShowCreateGroupModal(false);
                            setGroupName('');
                            setSelectedMembers([]);
                        }}
                        className="px-4 py-2.5 rounded-2xl text-slate-500 hover:text-slate-900 text-sm font-semibold transition cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateGroup}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm transition cursor-pointer shadow-lg shadow-blue-200/30 active:scale-95"
                    >
                        Tạo Nhóm
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="flex flex-col h-full bg-white border-r border-sky-100 text-slate-900 select-none">
            <div className="p-4 flex items-center justify-between border-b border-sky-100 bg-white/90">
                <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-3 text-left hover:opacity-90 transition cursor-pointer group flex-1 min-w-0 mr-2"
                    title="Chỉnh sửa hồ sơ cá nhân"
                >
                    <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-600 overflow-hidden flex items-center justify-center font-bold text-white shadow-md border-2 border-blue-200/50 group-hover:border-blue-300 transition">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                user?.username?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition truncate flex items-center gap-1.5">
                            <span className="truncate">{user?.username}</span>
                        </h4>
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                            Trực tuyến
                        </span>
                    </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                    {user?.system_role === 'admin' && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-bold py-1.5 px-3 rounded-xl transition cursor-pointer"
                            title="Trang quản trị hệ thống"
                        >
                            Quản trị
                        </button>
                    )}
                    <button
                        onClick={logout}
                        className="text-slate-500 hover:text-rose-400 transition text-xs font-semibold cursor-pointer py-1.5 px-3 rounded-xl hover:bg-sky-100"
                        title="Đăng xuất tài khoản"
                    >
                        Đăng xuất
                    </button>
                </div>
            </div>

            <div className="p-3.5 flex gap-2 border-b border-sky-100/60">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearch}
                        placeholder="Tìm hội thoại hoặc bạn..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-sky-50/60 border border-sky-100 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-200 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm pointer-events-none">🔍</span>
                </div>
                <button
                    onClick={() => setShowFriendsModal(true)}
                    className="relative px-3 bg-sky-100 hover:bg-sky-200 text-sky-700 font-semibold rounded-2xl text-sm transition cursor-pointer active:scale-95 flex items-center justify-center gap-1 shrink-0"
                    title="Danh bạ bạn bè"
                >
                    👥 Danh bạ
                    {friendRequests.length > 0 && (
                        <span className="w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {friendRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm transition cursor-pointer active:scale-95 shadow-md shadow-blue-200/20 flex items-center justify-center shrink-0"
                    title="Tạo nhóm chat mới"
                >
                    Tạo nhóm
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
                {isSearching && searchQuery.trim() ? (
                    <div>
                        <div className="px-3 py-1.5 text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-1">
                            Kết quả tìm kiếm ({searchResults.length})
                        </div>
                        {searchResults.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs text-slate-500 bg-sky-50/40 rounded-2xl border border-sky-100">
                                Không tìm thấy người dùng phù hợp từ khóa
                            </div>
                        ) : (
                            searchResults.map(u => {
                                const isUserOnline = onlineUsers.includes(String(u.id));
                                const isFriend = Array.isArray(friends) && friends.some(f => String(f?.friend_id) === String(u?.id));
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => handleStartChat(u)}
                                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-sky-100/60 transition text-left cursor-pointer mb-1 border border-slate-100 bg-white"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="relative shrink-0">
                                                {u.avatar_url ? (
                                                    <img src={u.avatar_url} alt={u.username} className="w-11 h-11 rounded-full object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-full bg-sky-500/30 border border-sky-200/30 flex items-center justify-center font-bold text-sky-700">
                                                        {u.username?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                {isUserOnline && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm truncate text-slate-900">{u.username}</div>
                                                <span className="text-[11px] text-slate-500">
                                                    {isFriend ? 'Đã là bạn bè' : 'Người dùng mới'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            {isFriend ? (
                                                <span className="px-2.5 py-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                    ✓ Bạn bè
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleSendFriendRequest(e, u)}
                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 active:scale-95 rounded-xl shadow-sm transition"
                                                    title="Gửi lời mời kết bạn"
                                                >
                                                    + Kết bạn
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div>
                        <div className="px-3 py-1.5 text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-1">
                            Trò chuyện gần đây
                        </div>
                        {conversations.length === 0 ? (
                            <div className="px-3 py-8 text-center text-xs text-slate-500 bg-sky-50/40 rounded-2xl border border-sky-100/60">
                                Chưa có cuộc hội thoại nào.<br/>Nhập tên bạn bè ở trên để bắt đầu!
                            </div>
                        ) : (
                            conversations.map(conv => {
                                const isDirect = conv.type === 'direct';
                                const displayName = isDirect ? conv.other_user_name : conv.group_name;
                                const isOnline = isDirect && onlineUsers.includes(String(conv.other_user_id));
                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => setActiveConversation(conv)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left cursor-pointer mb-1 ${
                                            activeConversation?.id === conv.id
                                                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                                                : 'hover:bg-sky-100/60 text-slate-700'
                                        }`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className="w-11 h-11 rounded-full bg-sky-100 flex items-center justify-center font-bold text-slate-900 shadow-inner overflow-hidden">
                                                {(isDirect ? conv.other_user_avatar : conv.group_avatar) ? (
                                                    <img src={isDirect ? conv.other_user_avatar : conv.group_avatar} alt={displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    displayName?.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            {isOnline && (
                                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h5 className="font-bold text-sm text-slate-900 truncate">{displayName}</h5>
                                                {conv.last_message_time && (
                                                    <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                                                        {new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                                    {getPreviewText(conv, user)}
                                                </p>
                                                {conv.unread_count > 0 && (
                                                    <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-md ml-2 shrink-0">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
            />

            <FriendsModal
                isOpen={showFriendsModal}
                onClose={() => setShowFriendsModal(false)}
            />

            {groupModalContent && ReactDOM.createPortal(groupModalContent, document.body)}
        </div>
    );
};

export default Sidebar;


