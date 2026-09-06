import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import { getConversationMembersAPI, markAsReadAPI } from '../api/endpoints';
import useFriendStore from '../store/friendStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
let socket = null;

const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
        console.error("Audio playback error:", e);
    }
};

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

            socket.on('account_banned', (data) => {
                alert(data?.message || "Tài khoản của bạn đã bị khóa bởi Quản trị viên!");
                useAuthStore.getState().logout();
                window.location.href = '/login';
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
                const currentUser = useAuthStore.getState().user;
                if (message.type !== 'system' && String(message.sender_id) !== String(currentUser?.id)) {
                    playNotificationSound();
                }
                addMessage(message);
                updateLastMessage(message);
                const active = useChatStore.getState().activeConversation;
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

            socket.on('admin_role_changed', ({ conversationID }) => {
                const { activeConversation } = useChatStore.getState();
                if (String(activeConversation?.id) === String(conversationID)) {
                    getConversationMembersAPI(conversationID).then(res => {
                        useChatStore.getState().setConversationMember(res.member || []);
                    }).catch(err => console.error("Lỗi khi cập nhật danh sách thành viên:", err));
                }
            });

            socket.on('pinned_list_updated', ({ conversationID, pinnedList }) => {
                const { activeConversation } = useChatStore.getState();
                if (String(activeConversation?.id) === String(conversationID)) {
                    useChatStore.getState().setPinnedList(pinnedList || []);
                }
            });

            socket.on('message_reaction_updated', ({ messageID, reactions }) => {
                useChatStore.getState().updateMessageReactions(messageID, reactions);
            });

            socket.on('receive_friend_request', ({ requestID, senderInfo, created_at }) => {
                useFriendStore.getState().addFriendRequest({
                    request_id: requestID,
                    sender_id: senderInfo?.id,
                    sender_name: senderInfo?.username,
                    sender_avatar: senderInfo?.avatar_url,
                    request_created_at: created_at || new Date()
                });
            });

            socket.on('friend_request_accepted', ({ friendInfo }) => {
                useFriendStore.getState().addFriend({
                    friend_id: friendInfo?.id,
                    friend_name: friendInfo?.username,
                    friend_avatar: friendInfo?.avatar_url
                });
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

    const emitUpdateReactions = (conversationID, messageID, reactions) => {
        if (socket) {
            socket.emit('update_reactions', { conversationID, messageID, reactions });
        }
    }

    const emitSendFriendRequest = (receiveID, requestID, senderInfo) => {
        if (socket) {
            socket.emit('send_friend_request', { receiveID, requestID, senderInfo });
        }
    }

    const emitAcceptFriendRequest = (senderID, friendInfo) => {
        if (socket) {
            socket.emit('accept_friend_request', { senderID, friendInfo });
        }
    }

    const emitTransferAdmin = (conversationID, targetUserID) => {
        if (socket) {
            socket.emit('transfer_admin', { conversationID, targetUserID });
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
        emitUpdatePinnedList,
        emitUpdateReactions,
        emitSendFriendRequest,
        emitAcceptFriendRequest,
        emitTransferAdmin
    };
};
