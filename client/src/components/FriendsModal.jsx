import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import useFriendStore from '../store/friendStore';
import { 
    getListFriendAPI, 
    getListFriendRequestAPI, 
    acceptFriendRequestAPI, 
    rejectFriendRequestAPI, 
    removeFriendAPI,
    createDirectConversationAPI,
    getListConversationAPI
} from '../api/endpoints';
import { useSocket } from '../hooks/useSocket';

const FriendsModal = ({ isOpen, onClose }) => {
    const { user } = useAuthStore();
    const { friends, friendRequests, setFriends, setFriendRequests, removeFriend, removeFriendRequest } = useFriendStore();
    const { setConversations, setActiveConversation, onlineUsers } = useChatStore();
    const { emitAcceptFriendRequest, emitCreateConversation, joinConversation } = useSocket();

    const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests'
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [friendsRes, requestsRes] = await Promise.all([
                getListFriendAPI(),
                getListFriendRequestAPI()
            ]);
            if (friendsRes.success) setFriends(friendsRes.friends || []);
            if (requestsRes.success) setFriendRequests(requestsRes.friendRequests || []);
        } catch (err) {
            console.error("Lỗi khi tải dữ liệu bạn bè:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (reqItem) => {
        try {
            const res = await acceptFriendRequestAPI({ requestID: reqItem.request_id });
            if (res.success) {
                removeFriendRequest(reqItem.request_id);
                // Emit socket event to notify sender
                emitAcceptFriendRequest(reqItem.sender_id, {
                    id: user.id,
                    username: user.username,
                    avatar_url: user.avatar_url
                });
                // Re-fetch friends list
                const friendsRes = await getListFriendAPI();
                if (friendsRes.success) setFriends(friendsRes.friends || []);
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi chấp nhận lời mời");
        }
    };

    const handleReject = async (requestID) => {
        try {
            const res = await rejectFriendRequestAPI({ requestID });
            if (res.success) {
                removeFriendRequest(requestID);
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi từ chối lời mời");
        }
    };

    const handleUnfriend = async (friendID) => {
        if (!window.confirm("Bạn có chắc chắn muốn hủy kết bạn?")) return;
        try {
            const res = await removeFriendAPI(friendID);
            if (res.success) {
                removeFriend(friendID);
            }
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi hủy kết bạn");
        }
    };

    const handleStartChat = async (friend) => {
        try {
            const res = await createDirectConversationAPI(friend.friend_id);
            const conversationID = res.conversationID;

            emitCreateConversation(conversationID, [user.id, friend.friend_id]);
            joinConversation(conversationID);

            const data = await getListConversationAPI();
            setConversations(data.conversations || []);

            const newActive = data.conversations?.find(c => String(c.id) === String(conversationID));
            if (newActive) {
                setActiveConversation(newActive);
            }
            onClose();
        } catch (err) {
            if (err.response?.data?.conversationID) {
                const existingID = err.response.data.conversationID;
                const data = await getListConversationAPI();
                setConversations(data.conversations || []);
                const existingConv = data.conversations?.find(c => String(c.id) === String(existingID));
                if (existingConv) setActiveConversation(existingConv);
                onClose();
            } else {
                alert("Lỗi khi mở cuộc trò chuyện");
            }
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        👥 Danh bạ bạn bè
                    </h3>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs Nav */}
                <div className="flex border-b border-slate-100 bg-white px-5 pt-3">
                    <button
                        onClick={() => setActiveTab('friends')}
                        className={`pb-3 px-4 text-sm font-semibold transition-all relative ${
                            activeTab === 'friends'
                                ? 'text-sky-600 border-b-2 border-sky-500'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Bạn bè ({friends.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`pb-3 px-4 text-sm font-semibold transition-all relative flex items-center gap-1.5 ${
                            activeTab === 'requests'
                                ? 'text-sky-600 border-b-2 border-sky-500'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Lời mời kết bạn
                        {friendRequests.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
                                {friendRequests.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="p-5 max-h-96 overflow-y-auto space-y-3">
                    {loading ? (
                        <div className="py-8 text-center text-slate-400">Đang tải dữ liệu...</div>
                    ) : activeTab === 'friends' ? (
                        friends.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 space-y-2">
                                <div className="text-4xl">👥</div>
                                <p className="text-sm">Bạn chưa có người bạn nào.</p>
                            </div>
                        ) : (
                            friends.map((item) => {
                                const isOnline = onlineUsers.includes(String(item.friend_id));
                                return (
                                    <div 
                                        key={item.friend_id} 
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                {item.friend_avatar ? (
                                                    <img 
                                                        src={item.friend_avatar} 
                                                        alt={item.friend_name} 
                                                        className="w-11 h-11 rounded-full object-cover border border-slate-200"
                                                    />
                                                ) : (
                                                    <div className="w-11 h-11 rounded-full bg-sky-100 text-sky-600 font-bold flex items-center justify-center text-lg">
                                                        {item.friend_name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                {isOnline && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-800 text-sm">{item.friend_name}</h4>
                                                <span className="text-xs text-slate-400">
                                                    {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleStartChat(item)}
                                                className="px-3 py-1.5 text-xs font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                                            >
                                                Nhắn tin
                                            </button>
                                            <button
                                                onClick={() => handleUnfriend(item.friend_id)}
                                                className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Hủy kết bạn"
                                            >
                                                Hủy bạn
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )
                    ) : (
                        friendRequests.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 space-y-2">
                                <div className="text-4xl">📩</div>
                                <p className="text-sm">Không có lời mời kết bạn nào.</p>
                            </div>
                        ) : (
                            friendRequests.map((reqItem) => (
                                <div 
                                    key={reqItem.request_id} 
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                                >
                                    <div className="flex items-center gap-3">
                                        {reqItem.sender_avatar ? (
                                            <img 
                                                src={reqItem.sender_avatar} 
                                                alt={reqItem.sender_name} 
                                                className="w-11 h-11 rounded-full object-cover border border-slate-200"
                                            />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-lg">
                                                {reqItem.sender_name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="font-semibold text-slate-800 text-sm">{reqItem.sender_name}</h4>
                                            <span className="text-xs text-slate-400">Đã gửi lời mời kết bạn</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleAccept(reqItem)}
                                            className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 rounded-lg shadow-sm transition-colors"
                                        >
                                            Đồng ý
                                        </button>
                                        <button
                                            onClick={() => handleReject(reqItem.request_id)}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                                        >
                                            Từ chối
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FriendsModal;
