import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerAPI } from '../api/endpoints.js';

const Register = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await registerAPI(username, email, password);
            alert('Sign up Success');
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Sign up fail');
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-950 p-4">
            <div className="w-full max-w-md glass-card p-8 rounded-2xl shadow-xl border border-white/10">
                <h2 className="text-3xl font-bold text-center mb-6 text-white tracking-wide">
                    Đăng Ký Tài Khoản
                </h2>
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">UserName</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg glass-input text-white focus:outline-none"
                            placeholder="Tên của bạn"
                            required
                        />
                    </div>
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
                            placeholder="Tối thiểu 6 ký tự"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition duration-200 disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                        {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-zinc-400">
                    Đã có tài khoản?{' '}
                    <Link to="/login" className="text-indigo-400 hover:underline font-medium">
                        Đăng nhập
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default Register;