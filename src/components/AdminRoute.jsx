import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * A route guard component that restricts access to administrative pages.
 * It checks the user's authentication session and `isAdmin` status from {@link useAuth}.
 * 
 * - If the authentication state is loading, it displays a loading message.
 * - If the user is not authenticated (`session` is null), they are redirected to the login page (`/auth`).
 * - If the user is authenticated but does not have administrator privileges (`isAdmin` is false),
 *   they are redirected to the root dashboard page (`/`).
 * - If the user is authenticated and is an admin, it renders the provided `children`.
 * 
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render if the user is an admin.
 * @returns {React.ReactNode|null} The children elements if access is allowed, or a loading state, or null.
 */
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
