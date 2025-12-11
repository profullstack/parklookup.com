/**
 * useAuth Hook
 * Provides authentication state and methods via server-side API routes
 * NO direct Supabase calls from client - all auth goes through API
 */

'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const AuthContext = createContext(null);

// Storage key for auth token
const AUTH_TOKEN_KEY = 'parklookup_auth_token';

/**
 * Get stored token from localStorage
 */
const getStoredToken = () => {
  if (typeof window === 'undefined') {return null;}
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * Store token in localStorage
 */
const storeToken = (token) => {
  if (typeof window === 'undefined') {return;}
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    console.error('Failed to store token:', error);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch current session from server using stored token
   */
  const fetchSession = useCallback(async () => {
    try {
      const token = getStoredToken();
      
      // If no token stored, we're not authenticated
      if (!token) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.user && data.session) {
        setSession(data.session);
        setUser(data.user);
      } else {
        // Token is invalid, clear it
        storeToken(null);
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    fetchSession();

    // Poll for session changes (since we can't use realtime from client)
    // This is a simple approach - could be improved with SSE or WebSockets
    const interval = setInterval(fetchSession, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [fetchSession]);

  /**
   * Sign in with email and password
   */
  const signIn = async ({ email, password }) => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.error } };
      }

      // Store the access token for persistence
      if (data.session?.access_token) {
        storeToken(data.session.access_token);
      }

      setUser(data.user);
      setSession(data.session);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message } };
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async ({ email, password }) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.error } };
      }

      // User might need to confirm email, so don't set session yet
      if (data.session) {
        // Store the access token for persistence
        if (data.session.access_token) {
          storeToken(data.session.access_token);
        }
        setUser(data.user);
        setSession(data.session);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message } };
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async () => {
    try {
      const token = getStoredToken();
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await response.json();

      // Always clear local state and token, even if server request fails
      storeToken(null);
      setUser(null);
      setSession(null);

      if (!response.ok) {
        return { error: { message: data.error } };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  /**
   * Refresh session from server
   */
  const refreshSession = async () => {
    await fetchSession();
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;