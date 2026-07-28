import api from './axios.js';

// Authentication API
export const loginAPI = async (email, password) => {
    const response = await api.post('/auth/sign-in', { email, password });
    return response.data;
};

export const registerAPI = async (username, email, password) => {
    const response = await api.post('/auth/sign-up', { username, email, password });
    return response.data;
};

// User Profile & Account API
export const updateProfileAPI = async (formData) => {
    const response = await api.put('/users/profile', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const changePasswordAPI = async (oldPassword, newPassword) => {
    const response = await api.patch('/users/password', {
        oldPassword,
        newPassword,
    });
    return response.data;
};

export const searchUserAPI = async (q) => {
    const response = await api.get(`/users/search?q=${q}`);
    return response.data;
};

// Conversation API
export const createDirectConversationAPI = async (targetID) => {
    const response = await api.post('/conversation/direct', { targetID });
    return response.data;
};

export const createGroupConversationAPI = async (nameGroup, memberIDs) => {
    const response = await api.post('/conversation/group', { nameGroup, memberIDs });
    return response.data;
};

export const getListConversationAPI = async (limit = 0, offset = 0) => {
    const response = await api.get(`/conversation/get-all?limit=${limit}&offset=${offset}`);
    return response.data;
};

export const getMessagesAPI = async (conversationID, limit = 20, offset = 0) => {
    const response = await api.get(`/conversation/${conversationID}/messages?limit=${limit}&offset=${offset}`);
    return response.data;
};

export const getConversationMembersAPI = async (conversationID) => {
    const response = await api.get(`/conversation/${conversationID}/members`);
    return response.data;
};

export const markAsReadAPI = async (conversationID) => {
    const response = await api.patch(`/conversation/${conversationID}/mark-read`);
    return response.data;
};

export const removeMemberAPI = async (conversationID, targetUserID) => {
    const response = await api.delete(`/conversation/${conversationID}/remove-member/${targetUserID}`);
    return response.data;
};

export const leaveConversationAPI = async (conversationID) => {
    const respone = await api.delete(`/conversation/${conversationID}/leave`);
    return respone.data;
}

export const addMemberToConversationAPI = async (conversationID, targetIDs) => {
    const respone = await api.post(`/conversation/${conversationID}/add-member`, { targetIDs });
    return respone.data;
}

export const uploadFileAPI = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/conversation/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data;
}

export const updateGroupProfileAPI = async ({ conversationID, name, avatar_url }) => {
    const response = await api.put(`/conversation/group/${conversationID}/update-profile`, { name, avatar_url });
    return response.data;
}

export const getPinnedMessageAPI = async (conversationID) => {
    const response = await api.get(`/conversation/${conversationID}/pinned-messages`);
    return response.data;
}

export const pinnedMessageAPI = async ({ conversationID, messageID }) => {
    const response = await api.post(`/conversation/${conversationID}/pin/${messageID}`);
    return response.data;
}

export const unpinMessageAPI = async ({ conversationID, messageID }) => {
    const response = await api.delete(`/conversation/${conversationID}/unpin/${messageID}`);
    return response.data;
}