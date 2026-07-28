import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import { getConversationMembersAPI, markAsReadAPI } from '../api/endpoints';

const SOCKET_URL = 'http://localhost:5000';
let socket = null;

export const useSocket = () => {
    const { token, isAuthenticated } = useAuthStore();
    const {
        addMessage,
        setOnlineUsers,
        addOnlineUser,
        removeOnlineUser,
        setTyping,
        updateLastMessage,
    } = useChatStore();

    useEffect(() => {
        if (!isAuthenticated || !token) {
            if (socket) {
                socket.removeAllListeners();
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

            socket.on('get_online_users', (users) => {
                setOnlineUsers(users);
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
                const active = useChatStore.getState().activeConversation;
                const currentUser = useAuthStore.getState().user;
                if (active && String(active.id) === String(message.conversation_id) && String(message.sender_id) !== String(currentUser?.id)) {
                    markAsReadAPI(message.conversation_id).catch(err => console.error(err));
                    socket.emit('mark_as_read', { conversationID: message.conversation_id, lastReadMessageID: message.id });
                }
            });

            socket.on('typing_start', ({ conversationID, userID, username }) => {
                setTyping(conversationID, userID, username, true);
            });

            socket.on('typing_stop', ({ conversationID, userID }) => {
                setTyping(conversationID, userID, null, false);
            });

            socket.on('new_conversation', (conversation) => {
                const currentConvs = useChatStore.getState().conversations;
                if (!currentConvs.some(c => String(c.id) === String(conversation.id))) {
                    useChatStore.getState().setConversations([conversation, ...currentConvs]);
                }
                socket.emit('join_conversation', conversation.id);
            })

            socket.on('message_read', ({ conversationID, userID, lastReadMessageID }) => {
                const active = useChatStore.getState().activeConversation;
                if (active && String(active.id) === String(conversationID)) {
                    useChatStore.getState().updateMemberReadStatus(userID, lastReadMessageID);
                }
            })

            socket.on('message_edited', ({ messageID, newContent, editedAt }) => {
                useChatStore.getState().updateEditedMessage(messageID, newContent, editedAt);
            })

            socket.on('message_deleted', ({ messageID, deletedAt }) => {
                useChatStore.getState().updateDeletedMessage(messageID, deletedAt);
            })

            socket.on('member_removed', ({ conversationID, targetUserID }) => {
                const active = useChatStore.getState().activeConversation;
                if (active && String(active.id) === String(conversationID)) {
                    useChatStore.getState().removeConversationMember(targetUserID);
                }
            })

            socket.on('you_were_removed', ({ conversationID }) => {
                const { activeConversation, conversations, setConversations, setActiveConversation } = useChatStore.getState();
                setConversations(conversations.filter(c => String(c.id) !== String(conversationID)));
                if (String(activeConversation?.id) === String(conversationID)) {
                    setActiveConversation(null);
                    alert("Bạn đã bị xóa khỏi nhóm chat");
                }
                socket.emit('leave_conversation', conversationID);
            })

            socket.on('members_added', ({ conversationID }) => {
                const { activeConversation } = useChatStore.getState();
                if (String(activeConversation?.id) === String(conversationID)) {
                    getConversationMembersAPI(conversationID).then(res => {
                        useChatStore.getState().setConversationMember(res.member || []);
                    })
                }
            })

            socket.on('user_left', ({ conversationID, userID }) => {
                const { activeConversation } = useChatStore.getState();
                if (String(activeConversation?.id) === String(conversationID)) {
                    useChatStore.getState().removeConversationMember(userID);
                }
            });

            socket.on('group_profile_updated', ({ conversationID, group_name, group_avatar }) => {
                useChatStore.getState().updateGroupInfo(conversationID, { group_name, group_avatar });
            });

            socket.on('pinned_list_updated', ({ conversationID, pinnedList }) => {
                const { activeConversation } = useChatStore.getState();
                if (String(activeConversation?.id) === String(conversationID)) {
                    useChatStore.getState().setPinnedList(pinnedList || []);
                }
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

    const sendMessage = (conversationID, content, type = 'text', replyToID = null) => {
        if (socket) {
            socket.emit('send_message', { conversationID, content, type, replyToID });
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

    const emitCreateConversation = (conversationID, memberIDs) => {
        if (socket) {
            socket.emit('create_conversation', { conversationID, memberIDs });
        }
    };

    const emitMarkAsRead = (conversationID, lastReadMessageID) => {
        if (socket) {
            socket.emit('mark_as_read', { conversationID, lastReadMessageID });
        }
    }

    const emitEditMessage = (messageID, conversationID, newContent) => {
        if (socket) {
            socket.emit('edit_message', { messageID, conversationID, newContent });
        }
    }

    const emitDeleteMessage = (messageID, conversationID) => {
        if (socket) {
            socket.emit('delete_message', { messageID, conversationID });
        }
    }

    const emitRemoveMember = (conversationID, targetUserID) => {
        if (socket) {
            socket.emit('remove_member', { conversationID, targetUserID });
        }
    }

    const emitAddMember = (conversationID, targetIDs) => {
        if (socket) {
            socket.emit('add_member', { conversationID, targetIDs });
        }
    }

    const emitLeaveConversation = (conversationID) => {
        if (socket) {
            socket.emit('leave_conversation', { conversationID });
        }
    }

    const emitUpdatePinnedList = (conversationID, pinnedList) => {
        if (socket) {
            socket.emit('update_pinned_list', { conversationID, pinnedList });
        }
    }

    return {
        socket,
        joinConversation,
        leaveConversation,
        sendMessage,
        emitTypingStart,
        emitTypingStop,
        emitCreateConversation,
        emitMarkAsRead,
        emitEditMessage,
        emitDeleteMessage,
        emitRemoveMember,
        emitAddMember,
        emitLeaveConversation,
        emitUpdatePinnedList
    };
};
