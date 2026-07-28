import { useState } from 'react';
import ReactDOM from 'react-dom';
import useAuthStore from '../store/authStore.js';

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, updateProfile, changePassword, loading } = useAuthStore();

    // Active tab: 'profile' | 'password'
    const [activeTab, setActiveTab] = useState('profile');

    // State Profile
    const [username, setUsername] = useState(user?.username || '');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');

    // State Change Password
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Messages
    const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

    if (!isOpen) return null;

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileMsg({ type: '', text: '' });

        const formData = new FormData();
        if (username !== user?.username) {
            formData.append('newUsername', username);
        }
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }

        if (!avatarFile && username === user?.username) {
            setProfileMsg({ type: 'error', text: 'Chưa có thông tin nào thay đổi.' });
            return;
        }

        try {
            const data = await updateProfile(formData);
            setProfileMsg({ type: 'success', text: 'Cập nhật thông tin thành công!' });
            setUsername(data.user?.username || username);
            setAvatarPreview(data.user?.avatar_url || avatarPreview);
            setAvatarFile(null);
        } catch (err) {
            setProfileMsg({ type: 'error', text: err.message });
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordMsg({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setPasswordMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải từ 6 ký tự trở lên!' });
            return;
        }

        try {
            await changePassword(oldPassword, newPassword);
            setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setPasswordMsg({ type: 'error', text: err.message });
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-sky-50/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-white border border-sky-200/60 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100 bg-white/90">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">⚙️</span> Cài Đặt Tài Khoản
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-900 w-8 h-8 rounded-full flex items-center justify-center hover:bg-sky-100 transition cursor-pointer text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-sky-100 bg-sky-50/50 p-1.5 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'profile'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/30'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-sky-100/50'
                        }`}
                    >
                        <span>👤</span> Hồ Sơ Cá Nhân
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('password')}
                        className={`flex-1 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'password'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/30'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-sky-100/50'
                        }`}
                    >
                        <span>🔒</span> Đổi Mật Khẩu
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="space-y-5">
                            {profileMsg.text && (
                                <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
                                    profileMsg.type === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                }`}>
                                    <span>{profileMsg.type === 'success' ? '✅' : '⚠️'}</span>
                                    <span>{profileMsg.text}</span>
                                </div>
                            )}

                            {/* Avatar Selector */}
                            <div className="flex flex-col items-center gap-3 py-2">
                                <div className="relative group cursor-pointer">
                                    <div className="w-24 h-24 rounded-full bg-sky-100 border-2 border-blue-200/50 overflow-hidden flex items-center justify-center font-bold text-3xl text-blue-600 shadow-xl">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            user?.username?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <label className="absolute inset-0 rounded-full bg-sky-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-xs font-semibold text-white transition cursor-pointer backdrop-blur-xs">
                                        <span>📷 Đổi ảnh</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <span className="text-[12px] font-medium text-slate-500">Nhấp vào ảnh để tải avatar mới</span>
                            </div>

                            {/* Email Field */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-3 rounded-2xl bg-sky-50/60 border border-sky-100 text-slate-500 text-sm font-medium cursor-not-allowed select-none"
                                />
                            </div>

                            {/* Username Field */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tên hiển thị</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="Nhập tên người dùng mới..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-3 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-sky-100 text-sm font-semibold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-blue-200/30 active:scale-95 cursor-pointer"
                                >
                                    {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'password' && (
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            {passwordMsg.text && (
                                <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
                                    passwordMsg.type === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                }`}>
                                    <span>{passwordMsg.type === 'success' ? '✅' : '⚠️'}</span>
                                    <span>{passwordMsg.text}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Mật khẩu hiện tại</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Mật khẩu mới</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="••••••••"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-3 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-sky-100 text-sm font-semibold transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-blue-200/30 active:scale-95 cursor-pointer"
                                >
                                    {loading ? 'Đang xử lý...' : 'Đổi Mật Khẩu'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ProfileModal;


