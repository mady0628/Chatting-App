import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Chat from '../pages/Chat.jsx';
import Profile from '../pages/Profile.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import useAuthStore from '../store/authStore.js';

const AdminRoute = () => {
    const { user } = useAuthStore();
    if (user?.system_role !== 'admin') {
        return <Navigate to="/" replace />;
    }
    return <AdminDashboard />;
};

const AppRoutes = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route element={<ProtectedRoute />}>
                    <Route path='/' element={<Chat />} />
                    <Route path='/profile' element={<Profile />} />
                    <Route path='/admin' element={<AdminRoute />} />
                </Route>
                {/*If URL not exist, redirect to Login*/}
                <Route path='*' element={<Navigate to='/login' replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRoutes;