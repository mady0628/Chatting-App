import { create } from 'zustand';
import useAuthStore from './authStore.js';

const useChatStore = create((set) => ({
    conversations: [],
    activeConversation: null,
    messages: [],
    onlineUsers: [],
    typingUsers: {},
    conversationMembers: [],
    replyingMessage: null,
    pinnedList: [],
    setConversations: (conversations) => set({ conversations }),
    setActiveConversation: (conversation) => set((state) => {
        if (state.activeConversation?.id === conversation?.id) return state;
        return { activeConversation: conversation, messages: [], conversationMembers: [], pinnedList: [] };
    }),
    setMessages: (messages) => set(() => {
        const seen = new Set();
        const uniqueMessages = (Array.isArray(messages) ? messages : []).filter(m => {
            if (!m || !m.id) return false;
            const idStr = String(m.id);
            if (seen.has(idStr)) return false;
            seen.add(idStr);
            return true;
        });
        return { messages: uniqueMessages };
    }),
    prependMessages: (olderMessages) => set((state) => {
        const existingIds = new Set(state.messages.map(m => String(m.id)));
        const uniqueOlder = (Array.isArray(olderMessages) ? olderMessages : []).filter(m => !existingIds.has(String(m.id)));
        return { messages: [...uniqueOlder, ...state.messages] };
    }),
    appendMessages: (newerMessages) => set((state) => {
        const existingIds = new Set(state.messages.map(m => String(m.id)));
        const uniqueNewer = (Array.isArray(newerMessages) ? newerMessages : []).filter(m => !existingIds.has(String(m.id)));
        return { messages: [...state.messages, ...uniqueNewer] };
    }),
    setConversationMember: (members) => set({ conversationMembers: members }),
    addMessage: (message) => set((state) => {
        if (state.activeConversation && String(state.activeConversation.id) === String(message.conversation_id)) {
            const exist = state.messages.find(m => String(m.id) === String(message.id));
            if (exist) return state;
            return { messages: [...state.messages, message] };
        }
        return state;
    }),
    updateLastMessage: (message) => set((state) => {
        const isActive = String(state.activeConversation?.id) === String(message.conversation_id);
        const targetConvIndex = state.conversations.findIndex(c => String(c.id) === String(message.conversation_id));

        const currentUserID = useAuthStore.getState().user?.id;
        const isOwn = String(message.sender_id) === String(currentUserID);
        const senderPrefix = isOwn ? 'Bạn' : (message.sender_name || 'Thành viên');

        const displayLastMessage = message.type === 'image'
            ? `${senderPrefix} đã gửi 1 ảnh`
            : `${senderPrefix}: ${message.content}`;

        if (targetConvIndex !== -1) {
            const targetConv = state.conversations[targetConvIndex];
            const updatedConv = {
                ...targetConv,
                last_message: displayLastMessage,
                last_message_sender_id: message.sender_id,
                last_message_sender_name: message.sender_name,
                last_message_type: message.type,
                last_message_time: message.created_at,
                unread_count: isActive ? 0 : (targetConv.unread_count || 0) + 1
            };
            const remainingConvs = state.conversations.filter((_, idx) => idx !== targetConvIndex);
            return {
                conversations: [updatedConv, ...remainingConvs]
            };
        }

        const newConv = {
            id: message.conversation_id,
            group_name: message.sender_name,
            type: 'direct',
            other_user_name: message.sender_name,
            other_user_avatar: message.sender_avatar,
            other_user_id: message.sender_id,
            last_message: displayLastMessage,
            last_message_sender_id: message.sender_id,
            last_message_sender_name: message.sender_name,
            last_message_type: message.type,
            last_message_time: message.created_at,
            unread_count: isActive ? 0 : 1
        };

        return {
            conversations: [newConv, ...state.conversations]
        };
    }),
    updateMemberReadStatus: (userID, lastReadMessageID) => set((state) => ({
        conversationMembers: state.conversationMembers.map(m => m.id === userID ? { ...m, last_read_message_id: lastReadMessageID } : m)
    })),
    setOnlineUsers: (users) => set({
        onlineUsers: Array.isArray(users) ? users.map(String) : [],
    }),
    addOnlineUser: (userID) => set((state) => {
        const idStr = String(userID);
        return {
            onlineUsers: state.onlineUsers.includes(idStr) ? state.onlineUsers : [...state.onlineUsers, idStr],
        };
    }),
    removeOnlineUser: (userID) => set((state) => {
        const idStr = String(userID);
        return {
            onlineUsers: state.onlineUsers.filter(id => id !== idStr),
        };
    }),
    setTyping: (conversationID, userID, username, isTyping) => set((state) => {
        const typing = { ...state.typingUsers };
        if (!typing[conversationID]) {
            typing[conversationID] = {};
        }

        if (isTyping) {
            typing[conversationID][userID] = username;
        } else {
            delete typing[conversationID][userID];
        }

        return { typingUsers: typing };
    }),
    markConversationAsRead: (conversationID) => set((state) => ({
        conversations: state.conversations.map(conv => {
            if (conv.id === conversationID) {
                return { ...conv, unread_count: 0 };
            }
            return conv;
        })
    })),
    setReplyingMessage: (message) => set({ replyingMessage: message }),
    updateEditedMessage: (messageID, newContent, editAt) => set((state) => ({
        messages: state.messages.map(m =>
            m.id === messageID ? { ...m, content: newContent, edited_at: editAt } : m
        )
    })),
    updateDeletedMessage: (messageID, deleteAt) => set((state) => ({
        messages: state.messages.map(m =>
            m.id === messageID ? { ...m, content: "Tin nhắn đã được thu hồi", deleted_at: deleteAt } : m
        )
    })),
    removeConversationMember: (userID) => set((state) => ({
        conversationMembers: state.conversationMembers.filter(m => String(m.id) !== String(userID))
    })),
    updateGroupInfo: (conversationID, { group_name, group_avatar }) => set((state) => ({
        conversations: state.conversations.map(c =>
            String(c.id) === String(conversationID)
                ? { ...c, group_name: group_name || c.group_name, group_avatar: group_avatar || c.group_avatar }
                : c
        ),
        activeConversation: String(state.activeConversation?.id) === String(conversationID)
            ? { ...state.activeConversation, group_name: group_name || state.activeConversation.group_name, group_avatar: group_avatar || state.activeConversation.group_avatar }
            : state.activeConversation
    })),
    setPinnedList: (pinnedList) => set({ pinnedList }),
    updateMessageReactions: (messageID, reactions) => set((state) => ({
        messages: state.messages.map(m => String(m.id) === String(messageID) ? { ...m, reactions } : m)
    }))
}))
export default useChatStore;