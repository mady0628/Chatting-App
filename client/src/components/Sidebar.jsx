import { useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import { searchUserAPI, createDirectConversationAPI, getListConversationAPI } from '../api/endpoints.js';

const Sidebar = ({ logout }) => {
    const { user } = useAuthStore();
    const { conversations, setConversations, activeConversation, setActiveConversation, onlineUsers } = useChatStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // 1. Xử lý tìm kiếm (Vừa lọc danh sách cũ, vừa gọi API tìm người mới)
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
                // Loại bỏ chính mình khỏi kết quả tìm kiếm
                setSearchResults(res.data.filter(u => u.id !== user.id));
            }
        } catch (err) {
            console.error("Lỗi khi tìm kiếm người dùng mới:", err);
        }
    };

    // 2. Click bắt đầu trò chuyện với người mới
    const handleStartChat = async (targetUser) => {
        try {
            const res = await createDirectConversationAPI(targetUser.id);
            const conversationID = res.conversationID;

            // Load lại danh sách phòng chat mới nhất
            const data = await getListConversationAPI();
            setConversations(data.conversations || []);

            // Đặt cuộc trò chuyện vừa tạo/tìm thấy làm cuộc trò chuyện hoạt động
            const newActive = data.conversations.find(c => c.id === conversationID);
            if (newActive) {
                setActiveConversation(newActive);
            }

            // Xóa nội dung tìm kiếm
            setSearchQuery('');
            setSearchResults([]);
            setIsSearching(false);
        } catch (err) {
            // Nếu cuộc hội thoại đã tồn tại từ trước (lỗi 400 và backend trả về ID cũ)
            if (err.response?.data?.conversationID) {
                const existingID = err.response.data.conversationID;
                
                try {
                    const data = await getListConversationAPI();
                    setConversations(data.conversations || []);
                    
                    const existingConv = data.conversations.find(c => c.id === existingID);
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
                } catch (fetchErr) {
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

    // Lọc danh sách trò chuyện hiện có theo từ khóa tìm kiếm (Local Search)
    const filteredConversations = conversations.filter(conv => {
        const displayName = conv.type === 'direct' ? conv.other_user_name : conv.group_name;
        return displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Lọc danh sách người dùng mới: Chỉ lấy người dùng CHƯA có phòng chat trực tiếp với mình
    const newUsers = searchResults.filter(u => {
        const exists = conversations.some(conv => conv.type === 'direct' && conv.other_user_id === u.id);
        return !exists;
    });

    return (
        <div className="flex flex-col h-full bg-zinc-900/40 backdrop-blur-md">
            {/* Header: Thông tin cá nhân & Đăng xuất */}
            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-zinc-900/40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm leading-tight text-white">{user?.username}</h4>
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Trực tuyến
                        </span>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="text-zinc-400 hover:text-red-400 transition text-xs font-semibold cursor-pointer py-1.5 px-3 rounded-lg hover:bg-white/5"
                >
                    Đăng xuất
                </button>
            </div>

            {/* Ô tìm kiếm */}
            <div className="p-3">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearch}
                    placeholder="Tìm cuộc hội thoại hoặc người dùng..."
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm placeholder-zinc-500 focus:outline-none"
                />
            </div>

            {/* Nội dung danh sách */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
                {isSearching && searchQuery.trim() ? (
                    <div>
                        <div className="px-3 py-1.5 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mb-1">
                            Kết quả tìm kiếm
                        </div>
                        {filteredConversations.length === 0 && newUsers.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-zinc-500 bg-white/2 rounded-xl border border-white/5">
                                Không tìm thấy cuộc hội thoại hay người dùng nào
                            </div>
                        ) : (
                            <>
                                {/* RENDER HỘI THOẠI CŨ KHỚP TỪ KHÓA */}
                                {filteredConversations.map(conv => {
                                    const isDirect = conv.type === 'direct';
                                    const displayName = isDirect ? conv.other_user_name : conv.group_name;
                                    const isOnline = isDirect && onlineUsers.includes(conv.other_user_id);
                                    return (
                                        <button
                                            key={conv.id}
                                            onClick={() => {
                                                setActiveConversation(conv);
                                                setSearchQuery('');
                                                setSearchResults([]);
                                                setIsSearching(false);
                                            }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left cursor-pointer mb-1 ${
                                                activeConversation?.id === conv.id
                                                    ? 'bg-indigo-600/25 border border-indigo-500/20 text-white'
                                                    : 'hover:bg-white/5 text-zinc-300'
                                            }`}
                                        >
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white">
                                                    {displayName?.charAt(0).toUpperCase()}
                                                </div>
                                                {isOnline && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-semibold text-sm truncate">{displayName}</h5>
                                                <p className="text-xs text-zinc-400 truncate">{conv.last_message || 'Chưa có tin nhắn'}</p>
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* RENDER NGƯỜI DÙNG MỚI CHƯA TỪNG CHAT */}
                                {newUsers.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleStartChat(u)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left cursor-pointer mb-1"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-purple-600/40 flex items-center justify-center font-bold text-purple-200">
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm truncate text-zinc-200">{u.username}</div>
                                            <span className="text-[10px] text-indigo-400">Tạo cuộc trò chuyện mới</span>
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                ) : (
                    /* HIỂN THỊ TOÀN BỘ DANH SÁCH CHAT KHI KHÔNG TÌM KIẾM */
                    <div>
                        <div className="px-3 py-1.5 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mb-1">
                            Trò chuyện gần đây
                        </div>
                        {conversations.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-zinc-500 bg-white/2 rounded-xl border border-white/5">
                                Chưa có cuộc hội thoại nào. Hãy tìm bạn để bắt đầu chat!
                            </div>
                        ) : (
                            conversations.map(conv => {
                                const isDirect = conv.type === 'direct';
                                const displayName = isDirect ? conv.other_user_name : conv.group_name;
                                const isOnline = isDirect && onlineUsers.includes(conv.other_user_id);
                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => setActiveConversation(conv)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left cursor-pointer mb-1 ${
                                            activeConversation?.id === conv.id
                                                ? 'bg-indigo-600/20 border border-indigo-500/20 text-white'
                                                : 'hover:bg-white/5 text-zinc-300'
                                        }`}
                                    >
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200">
                                                {displayName?.charAt(0).toUpperCase()}
                                            </div>
                                            {isOnline && (
                                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full"></span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h5 className="font-semibold text-sm truncate">{displayName}</h5>
                                                {conv.last_message_time && (
                                                    <span className="text-[10px] text-zinc-500">
                                                        {new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                                                {conv.last_message || "Chưa có tin nhắn nào"}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;