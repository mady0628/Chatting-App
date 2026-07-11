import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

const ProtectedRoute = () => {
    const { isAuthenticated } = useAuthStore();
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;