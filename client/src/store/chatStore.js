import { create } from 'zustand';

const useChatStore = create((set) => ({
    conversations: [],
    activeConversation: null,
    messages: [],
    onlineUsers: [],
    typingUsers: {},
    setConversations: (conversations) => set({ conversations }),
    setActiveConversation: (conversation) => set((state) => {
        if (state.activeConversation?.id === conversation?.id) return state;
        return { activeConversation: conversation, messages: [] };
    }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => {
        if (state.activeConversation && state.activeConversation.id === message.conversation_id) {
            const exist = state.messages.find(m => m.id === message.id);
            if (exist) return state;
            return { messages: [...state.messages, message] };
        }
        return state;
    }),
    updateLastMessage: (message) => set((state) => ({
        conversations: state.conversations.map(conv => {
            if (conv.id === message.conversation_id) {
                return {
                    ...conv,
                    last_message: message.content,
                    last_message_time: message.created_at
                };
            }
            return conv;
        })
    })),
    setOnlineUsers: (users) => set({
        onlineUsers: users,
    }),
    addOnlineUser: (userID) => set((state) => ({
        onlineUsers: state.onlineUsers.includes(userID) ? state.onlineUsers : [...state.onlineUsers, userID],
    })),
    removeOnlineUser: (userID) => set((state) => ({
        onlineUsers: state.onlineUsers.filter(id => id !== userID),
    })),
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
    })
}))
export default useChatStore;