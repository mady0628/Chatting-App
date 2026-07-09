import { create } from 'zustand';
import { loginAPI, registerAPI } from '../api/endpoints.js';

const useAuthStore = create((set) => ({
    user: JSON.parse(localStorage.getItem('user')) || null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    error: null,
    loading: false,
    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const data = await loginAPI(email, password);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            set({
                user: data.user,
                token: data.token,
                isAuthenticated: true,
                loading: false,
            })
            return data;
        } catch (err) {
            const errMessage = err.response?.data?.message || "Login failed";
            set({
                error: errMessage, loading: false,
            })
            throw new Error(errMessage);
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
            user: null,
            token: null,
            isAuthenticated: false,
        })
    }
}))

export default useAuthStore;
