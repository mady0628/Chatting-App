import { useEffect, useRef, useState } from 'react';
import useAuthStore from '../store/authStore.js';
import useChatStore from '../store/chatStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { getMessagesAPI } from '../api/endpoints.js';

const ChatWindow = () => {
    const { user } = useAuthStore();
    const { activeConversation, messages, setMessages, typingUsers } = useChatStore();
    const { sendMessage, emitTypingStart, emitTypingStop } = useSocket();

    const [text, setText] = useState('');
    const messageEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // 1. Tải lịch sử tin nhắn khi mở cuộc trò chuyện
    useEffect(() => {
        if (!activeConversation) return;

        const loadMessages = async () => {
            try {
                const res = await getMessagesAPI(activeConversation.id, 55, 0);
                // Đảo ngược mảng để tin nhắn cũ ở trên, tin mới ở dưới
                setMessages(res.messages.reverse());
            } catch (err) {
                console.error("Lỗi khi tải tin nhắn:", err);
            }
        };

        loadMessages();
    }, [activeConversation, setMessages]);

    // 2. Tự động cuộn xuống tin nhắn cuối cùng
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 3. Xử lý gõ tin nhắn và phát sự kiện typing
    const handleInputChange = (e) => {
        setText(e.target.value);

        // Gửi sự kiện typing_start
        emitTypingStart(activeConversation.id);

        // Xóa timeout cũ nếu người dùng vẫn đang gõ tiếp
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Đặt timeout gửi sự kiện typing_stop sau 2 giây ngừng gõ
        typingTimeoutRef.current = setTimeout(() => {
            emitTypingStop(activeConversation.id);
        }, 2000);
    };

    // 4. Gửi tin nhắn
    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim()) return;

        sendMessage(activeConversation.id, text.trim());
        emitTypingStop(activeConversation.id); // Dừng hiệu ứng typing ngay lập tức
        setText('');
    };

    // Lấy thông tin hiển thị của cuộc trò chuyện
    const isDirect = activeConversation.type === 'direct';
    const activeName = isDirect ? activeConversation.other_user_name : activeConversation.group_name;

    // Lấy danh sách những ai đang gõ trong cuộc trò chuyện này (loại trừ chính mình)
    const activeTyping = typingUsers[activeConversation.id] || {};
    const typingList = Object.entries(activeTyping).filter(([id]) => id !== user.id);

    return (
        <div className="flex flex-col h-full bg-zinc-950/20">
            {/* Header Khung Chat */}
            <div className="p-4 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200 shadow-sm border border-white/5">
                        {activeName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-white">{activeName}</h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                            {isDirect ? 'Cuộc trò chuyện 1-1' : 'Nhóm chat'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Danh sách tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => {
                    // Kiểm tra người gửi bằng cách đối chiếu ID người gửi (sender_id)
                    const isOwnMessage = msg.sender_id === user?.id;

                    return (
                        <div
                            key={msg.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md ${
                                isOwnMessage
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-zinc-800 text-zinc-100 rounded-bl-none border border-white/5'
                            }`}>
                                {/* Tên người gửi ở chat nhóm */}
                                {!isOwnMessage && !isDirect && (
                                    <div className="text-[10px] font-bold text-indigo-400 mb-1">
                                        {msg.sender_name}
                                    </div>
                                )}
                                <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                                <span className="block text-[9px] text-white/50 text-right mt-1.5">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Chỉ báo đang nhập chữ (Typing Indicator) */}
                {typingList.length > 0 && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-850 text-zinc-400 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs italic flex items-center gap-1.5 border border-white/5">
                            <span>{typingList.map(([_, name]) => name).join(', ')} đang nhập</span>
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </span>
                        </div>
                    </div>
                )}
                
                {/* Neo cuộn trang tự động */}
                <div ref={messageEndRef} />
            </div>

            {/* Thanh nhập tin nhắn */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-zinc-900/10 flex items-center gap-3">
                <input
                    type="text"
                    value={text}
                    onChange={handleInputChange}
                    placeholder="Gửi tin nhắn..."
                    className="flex-1 px-4 py-3 rounded-xl glass-input text-sm focus:outline-none placeholder-zinc-500"
                />
                <button
                    type="submit"
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition cursor-pointer active:scale-95 shadow-lg"
                >
                    Gửi
                </button>
            </form>
        </div>
    );
};

export default ChatWindow;
