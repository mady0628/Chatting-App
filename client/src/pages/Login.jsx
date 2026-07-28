import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/authStore.js";

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, error, loading } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-sky-50 p-4 font-sans text-slate-900 relative overflow-hidden">
            {/* Ambient Background Gradient Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md bg-white/80 border border-sky-100 p-8 sm:p-10 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-200/30 text-blue-600 mx-auto flex items-center justify-center text-3xl shadow-lg shadow-blue-200/20 mb-4">
                        💬
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Chào Mừng Trở Lại
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                        Đăng nhập để tiếp tục trò chuyện cùng bạn bè
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-2xl mb-6 text-xs sm:text-sm font-semibold text-center flex items-center justify-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                            Địa chỉ Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition placeholder-slate-600"
                            placeholder="user@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                            Mật khẩu
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-slate-900 text-sm font-medium focus:outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-500/20 transition placeholder-slate-600"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition shadow-lg shadow-blue-200/30 disabled:opacity-50 active:scale-95 cursor-pointer mt-2"
                    >
                        {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs sm:text-sm text-slate-500 font-medium">
                    Chưa có tài khoản?{' '}
                    <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold transition">
                        Đăng ký ngay
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;

