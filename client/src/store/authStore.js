import { create } from 'zustand';
import { loginAPI, updateProfileAPI, changePasswordAPI } from '../api/endpoints.js';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:5000';

const normalizeUser = (user) => {
    if (!user) return null;

    const avatarUrl = user.avatar_url;
    const isRelativeUpload = typeof avatarUrl === 'string' && avatarUrl.startsWith('/uploads');

    return {
        ...user,
        avatar_url: isRelativeUpload ? `${API_ORIGIN}${avatarUrl}` : avatarUrl,
    };
};

const useAuthStore = create((set) => ({
    user: normalizeUser(JSON.parse(localStorage.getItem('user'))) || null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    error: null,
    loading: false,

    setUser: (updatedUser) => {
        const normalizedUser = normalizeUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        set({ user: normalizedUser });
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const data = await loginAPI(email, password);
            const normalizedUser = normalizeUser(data.user);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            set({
                user: normalizedUser,
                token: data.token,
                isAuthenticated: true,
                loading: false,
            });
            return data;
        } catch (err) {
            const errMessage = err.response?.data?.message || "Login failed";
            set({
                error: errMessage,
                loading: false,
            });
            throw new Error(errMessage, { cause: err });
        }
    },

    updateProfile: async (formData) => {
        set({ loading: true, error: null });
        try {
            const data = await updateProfileAPI(formData);
            if (data.success && data.user) {
                const normalizedUser = normalizeUser(data.user);
                localStorage.setItem('user', JSON.stringify(normalizedUser));
                set({ user: normalizedUser, loading: false });
                return { ...data, user: normalizedUser };
            } else {
                set({ loading: false });
            }
            return data;
        } catch (err) {
            const errMessage = err.response?.data?.error || err.response?.data?.message || "Cập nhật hồ sơ thất bại";
            set({ error: errMessage, loading: false });
            throw new Error(errMessage, { cause: err });
        }
    },

    changePassword: async (oldPassword, newPassword) => {
        set({ loading: true, error: null });
        try {
            const data = await changePasswordAPI(oldPassword, newPassword);
            set({ loading: false });
            return data;
        } catch (err) {
            const errMessage = err.response?.data?.message || err.response?.data?.error || "Đổi mật khẩu thất bại";
            set({ error: errMessage, loading: false });
            throw new Error(errMessage, { cause: err });
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
            user: null,
            token: null,
            isAuthenticated: false,
        });
    }
}));

export default useAuthStore;
