import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
    const { session, isAdmin, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading) {
            if (!session) {
                navigate('/auth', { replace: true });
            } else if (!isAdmin) {
                // If logged in but not an admin, redirect to caregiver dashboard
                navigate('/', { replace: true });
            }
        }
    }, [session, isAdmin, isLoading, navigate]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Loading...</p>
            </div>
        );
    }

    return session && isAdmin ? children : null;
};

export default AdminRoute;
