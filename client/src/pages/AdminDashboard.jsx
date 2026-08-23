import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import {
    getSystemStatsAPI,
    getAdminUsersAPI,
    toggleBanUserAPI,
    changeSystemRoleAPI,
    getAdminConversationsAPI,
    getAdminConversationMessagesAPI
} from '../api/endpoints.js';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'conversations'
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);

    // Users state
    const [users, setUsers] = useState([]);
    const [userQuery, setUserQuery] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [usersTotal, setUsersTotal] = useState(0);

    // Conversations state
    const [conversations, setConversations] = useState([]);
    const [loadingConvs, setLoadingConvs] = useState(false);
    const [convsTotal, setConvsTotal] = useState(0);

    // Inspect Messages Modal state
    const [inspectConv, setInspectConv] = useState(null);
    const [inspectMessages, setInspectMessages] = useState([]);
    const [loadingInspect, setLoadingInspect] = useState(false);

    // Fetch System Stats
    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await getSystemStatsAPI();
            if (res.success) {
                setStats(res.stats);
            }
        } catch (err) {
            console.error("Lỗi khi tải thống kê:", err);
        } finally {
            setLoadingStats(false);
        }
    };

    // Fetch Users list
    const fetchUsers = async (query = '') => {
        setLoadingUsers(true);
        try {
            const res = await getAdminUsersAPI(query);
            if (res.success) {
                setUsers(res.users);
                setUsersTotal(res.total);
            }
        } catch (err) {
            console.error("Lỗi khi tải danh sách người dùng:", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Fetch Conversations list
    const fetchConversations = async () => {
        setLoadingConvs(true);
        try {
            const res = await getAdminConversationsAPI();
            if (res.success) {
                setConversations(res.conversations);
                setConvsTotal(res.total);
            }
        } catch (err) {
            console.error("Lỗi khi tải danh sách hội thoại:", err);
        } finally {
            setLoadingConvs(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchUsers();
        fetchConversations();
    }, []);

    // Search users handler
    const handleUserSearch = (e) => {
        e.preventDefault();
        fetchUsers(userQuery);
    };

    // Toggle Ban User handler
    const handleToggleBan = async (targetUser) => {
        const actionText = targetUser.is_banned ? "MỞ KHÓA" : "KHÓA";
        if (window.confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản ${targetUser.username}?`)) {
            try {
                const res = await toggleBanUserAPI(targetUser.id);
                if (res.success) {
                    alert(res.message);
                    fetchUsers(userQuery);
                    fetchStats();
                }
            } catch (err) {
                alert(err.response?.data?.message || "Lỗi khi thay đổi trạng thái khóa tài khoản!");
            }
        }
    };

    // Toggle System Role handler
    const handleChangeRole = async (targetUser) => {
        const newRole = targetUser.system_role === 'admin' ? 'user' : 'admin';
        const roleText = newRole === 'admin' ? 'CẤP QUYỀN SYSTEM ADMIN' : 'HẠ QUYỀN THÀNH USER THƯỜNG';
        if (window.confirm(`Bạn có chắc muốn ${roleText} cho ${targetUser.username}?`)) {
            try {
                const res = await changeSystemRoleAPI(targetUser.id, newRole);
                if (res.success) {
                    alert(res.message);
                    fetchUsers(userQuery);
                    fetchStats();
                }
            } catch (err) {
                alert(err.response?.data?.message || "Lỗi khi thay đổi quyền hệ thống!");
            }
        }
    };

    // Open Inspect Messages Modal
    const handleInspectMessages = async (conv) => {
        setInspectConv(conv);
        setLoadingInspect(true);
        try {
            const res = await getAdminConversationMessagesAPI(conv.id);
            if (res.success) {
                setInspectMessages(res.messages || []);
            }
        } catch (err) {
            alert("Lỗi khi tải nội dung tin nhắn cuộc trò chuyện!");
        } finally {
            setLoadingInspect(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-8">
            {/* Header Navigation */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
                <div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                            ← Quay lại Chat
                        </button>
                        <span className="text-xs font-semibold text-slate-400">System Control Center</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mt-2">Trang Quản Trị Hệ Thống</h1>
                </div>

                <div className="flex items-center gap-3 bg-sky-50 px-4 py-2.5 rounded-2xl border border-sky-100">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm overflow-hidden">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            user?.username?.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-sm text-slate-900">{user?.username}</div>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">
                            {user?.system_role || 'admin'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Dashboard Stats Overview Cards */}
            <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng Người Dùng</div>
                    <div className="text-3xl font-black text-slate-900">{loadingStats ? '...' : stats?.totalUsers || 0}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-red-100 shadow-xs">
                    <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Tài Khoản Bị Khóa</div>
                    <div className="text-3xl font-black text-red-600">{loadingStats ? '...' : stats?.bannedUsers || 0}</div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cuộc Trò Chuyện</div>
                    <div className="text-3xl font-black text-slate-900">
                        {loadingStats ? '...' : stats?.totalConversations || 0}
                        <span className="text-xs font-normal text-slate-400 ml-2">({stats?.totalGroups || 0} nhóm)</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng Số Tin Nhắn</div>
                    <div className="text-3xl font-black text-blue-600">{loadingStats ? '...' : stats?.totalMessages || 0}</div>
                </div>
            </div>

            {/* Main Tabs Container */}
            <div className="max-w-7xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                {/* Tab Controls */}
                <div className="flex border-b border-slate-200 bg-slate-50/50 p-2 gap-2">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 py-3 text-xs font-bold rounded-2xl transition cursor-pointer text-center ${activeTab === 'users'
                                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Quản lý Người Dùng ({usersTotal})
                    </button>
                    <button
                        onClick={() => setActiveTab('conversations')}
                        className={`flex-1 py-3 text-xs font-bold rounded-2xl transition cursor-pointer text-center ${activeTab === 'conversations'
                                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Quản lý Cuộc Trò Chuyện ({convsTotal})
                    </button>
                </div>

                {/* Tab 1: Users Management */}
                {activeTab === 'users' && (
                    <div className="p-6">
                        {/* Search Bar */}
                        <form onSubmit={handleUserSearch} className="flex gap-2 mb-6 max-w-md">
                            <input
                                type="text"
                                value={userQuery}
                                onChange={(e) => setUserQuery(e.target.value)}
                                placeholder="Nhập tên hoặc email cần tìm..."
                                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:border-blue-500 font-medium"
                            />
                            <button
                                type="submit"
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl transition cursor-pointer shadow-sm"
                            >
                                Tìm kiếm
                            </button>
                        </form>

                        {/* Users Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold tracking-wider">
                                        <th className="py-3 px-4">Người dùng</th>
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Quyền hệ thống</th>
                                        <th className="py-3 px-4">Trạng thái</th>
                                        <th className="py-3 px-4 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingUsers ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-slate-400 italic">Đang tải danh sách...</td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-slate-400 italic">Không tìm thấy người dùng nào</td>
                                        </tr>
                                    ) : (
                                        users.map((u) => (
                                            <tr key={u.id} className="hover:bg-slate-50/80 transition">
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center overflow-hidden">
                                                            {u.avatar_url ? (
                                                                <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                                                            ) : (
                                                                u.username?.charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-slate-900">{u.username}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 font-medium text-slate-600">{u.email}</td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${u.system_role === 'admin'
                                                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                            : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {u.system_role || 'user'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[10px] ${u.is_banned
                                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                        {u.is_banned ? 'Đã bị khóa' : 'Hoạt động'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    {u.id !== user?.id && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleChangeRole(u)}
                                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                                                            >
                                                                {u.system_role === 'admin' ? 'Hạ quyền Admin' : 'Cấp quyền Admin'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleBan(u)}
                                                                className={`px-3 py-1.5 font-bold rounded-xl transition cursor-pointer ${u.is_banned
                                                                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                                                        : 'bg-red-100 hover:bg-red-200 text-red-700'
                                                                    }`}
                                                            >
                                                                {u.is_banned ? 'Mở khóa' : 'Khóa tài khoản'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab 2: Conversations Management */}
                {activeTab === 'conversations' && (
                    <div className="p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold tracking-wider">
                                        <th className="py-3 px-4">Tên / Loại cuộc trò chuyện</th>
                                        <th className="py-3 px-4">Người tạo</th>
                                        <th className="py-3 px-4">Số thành viên</th>
                                        <th className="py-3 px-4">Tổng tin nhắn</th>
                                        <th className="py-3 px-4 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingConvs ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-slate-400 italic">Đang tải danh sách hội thoại...</td>
                                        </tr>
                                    ) : conversations.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-slate-400 italic">Chưa có cuộc trò chuyện nào trong hệ thống</td>
                                        </tr>
                                    ) : (
                                        conversations.map((c) => (
                                            <tr key={c.id} className="hover:bg-slate-50/80 transition">
                                                <td className="py-3.5 px-4 font-bold text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${c.type === 'group' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {c.type === 'group' ? 'Nhóm' : 'Chat 1-1'}
                                                        </span>
                                                        <span>{c.name || 'Cuộc trò chuyện 1-1'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-600 font-medium">{c.creator_name || 'Hệ thống'}</td>
                                                <td className="py-3.5 px-4 font-semibold text-slate-800">{c.member_count} thành viên</td>
                                                <td className="py-3.5 px-4 font-semibold text-blue-600">{c.message_count} tin nhắn</td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <button
                                                        onClick={() => handleInspectMessages(c)}
                                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition cursor-pointer"
                                                    >
                                                        Xem tin nhắn
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Inspect Messages */}
            {inspectConv && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                            <div>
                                <h3 className="font-bold text-base text-slate-900">
                                    Giám sát tin nhắn: {inspectConv.name || 'Cuộc trò chuyện 1-1'}
                                </h3>
                                <p className="text-xs text-slate-400">ID: {inspectConv.id}</p>
                            </div>
                            <button
                                onClick={() => setInspectConv(null)}
                                className="text-slate-400 hover:text-slate-700 font-bold text-sm w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                            {loadingInspect ? (
                                <p className="text-center text-xs text-slate-400 italic py-8">Đang tải tin nhắn...</p>
                            ) : inspectMessages.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 italic py-8">Không có tin nhắn nào trong hội thoại này</p>
                            ) : (
                                inspectMessages.map((m) => (
                                    <div key={m.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-xs text-blue-900">{m.sender_name}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <p className="text-xs text-slate-800 font-medium">{m.content}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button
                                onClick={() => setInspectConv(null)}
                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
