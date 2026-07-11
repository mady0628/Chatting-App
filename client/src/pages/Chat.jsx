import { useEffect } from 'react';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { getListConversationAPI } from '../api/endpoints.js';
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";

const Chat = () => {
    const { logout } = useAuthStore();
    const { setConversations, activeConversation } = useChatStore();

    const { joinConversation, leaveConversation } = useSocket();

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const data = await getListConversationAPI();
                setConversations(data.conversations || []);
            } catch (err) {
                console.error("Error when get list conversation: ", err);
            }
        };
        fetchConversations();
    }, [setConversations]);

    useEffect(() => {
        if (activeConversation) {
            joinConversation(activeConversation.id);
            return () => {
                leaveConversation(activeConversation.id);
            }
        }
    }, [activeConversation]);
    return (
        <div className="h-screen w-screen flex bg-dark-950 text-white overflow-hidden font-sans">
            {/* Cột trái: Sidebar chứa tìm kiếm và danh sách hội thoại */}
            <div className="w-80 md:w-96 flex flex-col border-r border-white/5 bg-zinc-900/50 backdrop-blur-md">
                <Sidebar logout={logout} />
            </div>
            {/* Cột phải: Khung chat chính */}
            <div className="flex-1 flex flex-col bg-zinc-950/20">
                {activeConversation ? (
                    <ChatWindow />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                        <div className="text-center space-y-3">
                            <div className="text-6xl">💬</div>
                            <h3 className="text-xl font-medium text-zinc-300">Chưa chọn cuộc trò chuyện</h3>
                            <p className="text-sm text-zinc-500 max-w-xs">Tìm kiếm một người bạn bên thanh Sidebar để bắt đầu trò chuyện real-time.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Chat;