import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';

const SOCKET_URL = 'http://localhost:5000';
let socket = null;

export const useSocket = () => {
    const { token, isAuthenticated } = useAuthStore();
    const {
        addMessage,
        addOnlineUser,
        removeOnlineUser,
        setOnlineUsers,
        setTyping,
        updateLastMessage
    } = useChatStore();

    useEffect(() => {
        if (!isAuthenticated || !token) {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
            return;
        }

        if (!socket) {
            socket = io(SOCKET_URL, {
                auth: {
                    token: `Bearer ${token}`
                }
            });

            socket.on('connect', () => {
                console.log('Socket connected successfully');
            });

            socket.on('user_online', (userID) => {
                addOnlineUser(userID);
            });

            socket.on('user_offline', (userID) => {
                removeOnlineUser(userID);
            });

            socket.on('receive_message', (message) => {
                addMessage(message);
                updateLastMessage(message);
            });

            socket.on('typing_start', ({ conversationID, userID, username }) => {
                setTyping(conversationID, userID, username, true);
            });

            socket.on('typing_stop', ({ conversationID, userID }) => {
                setTyping(conversationID, userID, null, false);
            });
        }

        return () => {
        };
    }, [token, isAuthenticated]);

    const joinConversation = (conversationID) => {
        if (socket) {
            socket.emit('join_conversation', conversationID);
        }
    };

    const leaveConversation = (conversationID) => {
        if (socket) {
            socket.emit('leave_conversation', conversationID);
        }
    };

    const sendMessage = (conversationID, content, type = 'text') => {
        if (socket) {
            socket.emit('send_message', { conversationID, content, type });
        }
    };

    const emitTypingStart = (conversationID) => {
        if (socket) {
            socket.emit('typing_start', conversationID);
        }
    };

    const emitTypingStop = (conversationID) => {
        if (socket) {
            socket.emit('typing_stop', conversationID);
        }
    };

    return {
        socket,
        joinConversation,
        leaveConversation,
        sendMessage,
        emitTypingStart,
        emitTypingStop
    };
};
