import api from './axios.js';
// Authentication API
export const loginAPI = async (email, password) => {
    const respone = await api.post('/auth/sign-in', { email, password });
    return respone.data;
}

export const registerAPI = async (username, email, password) => {
    const respone = await api.post('/auth/sign-up', { username, email, password });
    return respone.data;
}

// User API
export const searchUserAPI = async (q) => {
    const respone = await api.get(`/users/search?q=${q}`);
    return respone.data;
}

// Conversation API
export const createDirectConversationAPI = async (targetID) => {
    const respone = await api.post('/conversation/direct', { targetID });
    return respone.data;
}

export const createGroupConversationAPI = async (nameGroup, memberIDs) => {
    const respone = await api.post('/conversation/group', { nameGroup, memberIDs });
    return respone.data;
}

export const getListConversationAPI = async (limit = 0, offset = 0) => {
    const respone = await api.get(`/conversation/get-all?limit=${limit}&offset=${offset}`);
    return respone.data;
}

export const getMessagesAPI = async (conversationID, limit = 20, offset = 0) => {
    const respone = await api.get(`/conversation/${conversationID}/messages?limit=${limit}&offset=${offset}`);
    return respone.data;
}