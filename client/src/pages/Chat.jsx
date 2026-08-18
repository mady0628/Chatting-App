import { useEffect } from 'react';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import useFriendStore from '../store/friendStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { getListConversationAPI, getListFriendAPI, getListFriendRequestAPI } from '../api/endpoints.js';
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";

const Chat = () => {
    const { logout } = useAuthStore();
    const { setConversations, activeConversation } = useChatStore();
    const { setFriends, setFriendRequests } = useFriendStore();

    const { joinConversation, leaveConversation } = useSocket();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [convData, friendsRes, requestsRes] = await Promise.all([
                    getListConversationAPI(),
                    getListFriendAPI(),
                    getListFriendRequestAPI()
                ]);
                setConversations(convData.conversations || []);
                if (friendsRes.success) setFriends(friendsRes.friends || []);
                if (requestsRes.success) setFriendRequests(requestsRes.friendRequests || []);
            } catch (err) {
                console.error("Error when fetching initial data: ", err);
            }
        };
        fetchData();
    }, [setConversations, setFriends, setFriendRequests]);

    useEffect(() => {
        if (activeConversation) {
            joinConversation(activeConversation.id);
            return () => {
                leaveConversation(activeConversation.id);
            };
        }
    }, [activeConversation]);

    return (
        <div className="h-screen w-screen flex bg-white text-slate-900 overflow-hidden font-sans">
            {/* Cột trái: Sidebar */}
            <div className="w-80 md:w-96 flex flex-col border-r border-sky-100 bg-white shrink-0">
                <Sidebar logout={logout} />
            </div>
            {/* Cột phải: Khung chat chính */}
            <div className="flex-1 flex flex-col bg-sky-50">
                {activeConversation ? (
                    <ChatWindow />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <div className="text-center space-y-3">
                            <div className="text-6xl">💬</div>
                            <h3 className="text-xl font-medium text-slate-700">Chưa chọn cuộc trò chuyện</h3>
                            <p className="text-sm text-slate-500 max-w-xs">Tìm kiếm một người bạn bên thanh Sidebar để bắt đầu trò chuyện real-time.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chat;
