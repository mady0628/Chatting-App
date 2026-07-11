import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import Chat from '../pages/Chat.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

const AppRoutes = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route element={<ProtectedRoute />}>
                    <Route path='/' element={<Chat />} />
                </Route>
                {/*If URL not exist, redirect to Login*/}
                <Route path='*' element={<Navigate to='/login' replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;