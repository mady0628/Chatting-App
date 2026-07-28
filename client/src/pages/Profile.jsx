import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

const Profile = () => {
    const navigate = useNavigate();
    const { user, updateProfile, changePassword, loading } = useAuthStore();

    // Tab switcher: 'profile' | 'password'
    const [activeTab, setActiveTab] = useState('profile');

    // Profile State
    const [username, setUsername] = useState(user?.username || '');
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');

    // Password State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Feedback notifications
    const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

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

    return (
        <div className="min-h-screen w-full bg-sky-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans overflow-y-auto relative">
            {/* Ambient Background Gradient Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Back Button & Header */}
            <div className="w-full max-w-2xl mb-4 flex items-center justify-between relative z-10">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer px-4 py-2 rounded-2xl bg-white border border-sky-100 hover:bg-sky-100"
                >
                    <span>← Quay lại Chat</span>
                </button>
                <h1 className="text-base font-bold text-slate-700">Quản Lý Tài Khoản</h1>
            </div>

            {/* Main Container */}
            <div className="w-full max-w-2xl bg-white/90 border border-sky-100 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl relative z-10">
                {/* Banner Header */}
                <div className="bg-gradient-to-r from-sky-100/60 via-blue-50/40 to-white p-6 sm:p-8 border-b border-sky-100 flex items-center gap-6">
                    <div className="relative group shrink-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-600 border-2 border-blue-300/40 overflow-hidden flex items-center justify-center font-bold text-3xl text-white shadow-xl">
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                user?.username?.charAt(0).toUpperCase() || 'U'
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
                    <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
                            {user?.username}
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">{user?.email}</p>
                        <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Đã đăng nhập
                        </span>
                    </div>
                </div>

                {/* Tabs Switcher */}
                <div className="flex border-b border-sky-100 bg-sky-50/40 p-1.5 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-3 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'profile'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/30'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-sky-100/40'
                        }`}
                    >
                        <span>👤</span> Thông tin cá nhân
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('password')}
                        className={`flex-1 py-3 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                            activeTab === 'password'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200/30'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-sky-100/40'
                        }`}
                    >
                        <span>🔒</span> Đổi mật khẩu
                    </button>
                </div>

                {/* Tab Content */}
                <div className="p-6 sm:p-8">
                    {/* TAB 1: THÔNG TIN CÁ NHÂN */}
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            {profileMsg.text && (
                                <div className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 ${
                                    profileMsg.type === 'success' 
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                }`}>
                                    <span>{profileMsg.type === 'success' ? '✅' : '⚠️'}</span>
                                    <span>{profileMsg.text}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Địa chỉ Email
                                </label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-4 py-3.5 rounded-2xl bg-sky-50/60 border border-sky-100 text-slate-500 text-sm font-medium cursor-not-allowed select-none"
                                />
                                <p className="text-[12px] text-slate-500 mt-1">Email tài khoản cố định và không thể chỉnh sửa.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Tên hiển thị
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="Nhập tên hiển thị mới..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Ảnh đại diện
                                </label>
                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-sky-50/60 border border-sky-100">
                                    <div className="w-12 h-12 rounded-full bg-blue-600/30 text-blue-600 font-bold border border-blue-200/30 overflow-hidden flex items-center justify-center shrink-0 text-lg">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            user?.username?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-700 hover:file:bg-blue-600/40 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-blue-200/30 active:scale-95 cursor-pointer"
                                >
                                    {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TAB 2: ĐỔI MẬT KHẨU */}
                    {activeTab === 'password' && (
                        <form onSubmit={handleChangePassword} className="space-y-5">
                            {passwordMsg.text && (
                                <div className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 ${
                                    passwordMsg.type === 'success' 
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                }`}>
                                    <span>{passwordMsg.type === 'success' ? '✅' : '⚠️'}</span>
                                    <span>{passwordMsg.text}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Mật khẩu hiện tại
                                </label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Mật khẩu mới
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="Tối thiểu 6 ký tự..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                    Xác nhận mật khẩu mới
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl bg-sky-100/60 border border-sky-200/80 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition"
                                    placeholder="Nhập lại mật khẩu mới..."
                                />
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-blue-200/30 active:scale-95 cursor-pointer"
                                >
                                    {loading ? 'Đang cập nhật...' : 'Đổi Mật Khẩu'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;


