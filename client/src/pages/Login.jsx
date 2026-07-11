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
        <div className="min-h-screen flex items-center justify-center bg-dark-950 p-4">
            <div className="w-full max-w-md glass-card p-8 rounded-2xl shadow-xl border border-white/10">
                <h2 className="text-3xl font-bold text-center mb-6 text-white tracking-wide">
                    Đăng Nhập
                </h2>
                {/* Hiển thị lỗi nếu có */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg glass-input text-white focus:outline-none"
                            placeholder="nhapmail@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Mật khẩu</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg glass-input text-white focus:outline-none"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition duration-200 disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                        {loading ? 'Đang xác thực...' : 'Đăng nhập'}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-zinc-400">
                    Chưa có tài khoản?{' '}
                    <Link to="/register" className="text-indigo-400 hover:underline font-medium">
                        Đăng ký ngay
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default Login;