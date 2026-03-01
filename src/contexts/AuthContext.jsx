import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = async (userId) => {
        if (!userId) {
            setProfile(null);
            return;
        }
        try {
            // Using a Promise.race to enforce a timeout just in case it hangs
            const fetchPromise = supabase.from('users').select('*').eq('id', userId).single();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) {
                console.error("AuthContext: Supabase error in fetchProfile:", error);
            }
            if (data) setProfile(data);
        } catch (err) {
            console.error("AuthContext: Exception in fetchProfile:", err);
            setProfile(null);
        }
    };

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user?.id) {
                        await fetchProfile(session.user.id);
                    }
                }
            } catch (err) {
                console.error("AuthContext: Session error in getSession catch:", err);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user?.id) {
                // If it's a SIGNED_IN event or similar, fetch profile.
                // We don't await this so it doesn't block other auth listeners, 
                // but we let it update state when it finishes.
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const value = {
        session,
        user,
        profile,
        isLoading,
        isAdmin: profile?.role === 'admin',
        signOut: () => supabase.auth.signOut(),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
