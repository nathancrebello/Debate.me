"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User, AuthResponse } from './api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { username: string; name: string; email: string; password: string; preferredLanguage: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Only run on client-side
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Only access localStorage on client-side
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      api.setToken(token);
      const response = await api.getCurrentUser();
      
      if (response.success && response.user && response.user._id) {
        setUser(response.user);
      } else {
        // Clear token if the response indicates failure
        console.error('Auth check failed: Invalid user data', response);
        localStorage.removeItem('token');
        api.setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      if (typeof window !== 'undefined') {
        // Only clear token on client-side
        localStorage.removeItem('token');
        api.setToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login({ email, password });
      
      if (!response.success) {
        throw new Error(response.message || 'Login failed');
      }
      
      if (!response.user || !response.user._id) {
        console.error('Invalid user data received from server:', response);
        throw new Error('Invalid user data received from server');
      }
      
      if (response.token) {
        localStorage.setItem('token', response.token);
        api.setToken(response.token);
      } else {
        console.error('No token received from server');
        throw new Error('Authentication failed: No token received');
      }
      
      setUser(response.user);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during login');
    }
  };

  const signup = async (data: { username: string; name: string; email: string; password: string; preferredLanguage: string }) => {
    try {
      console.log('Attempting signup with data:', { 
        ...data, 
        password: '[REDACTED]' 
      });
      
      const response = await api.signup(data);
      
      console.log('Signup response received:', response);
      
      if (!response.success) {
        throw new Error(response.message || 'Signup failed');
      }
      
      if (!response.user || !response.user._id) {
        console.error('Invalid user data received from server:', response);
        throw new Error('Invalid user data received from server');
      }
      
      if (response.token) {
        localStorage.setItem('token', response.token);
        api.setToken(response.token);
      } else {
        console.error('No token received from server');
        throw new Error('Authentication failed: No token received');
      }
      
      setUser(response.user);
      router.push('/dashboard');
    } catch (error) {
      console.error('Signup failed:', error);
      // Re-throw the error with a more user-friendly message if needed
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unexpected error occurred during signup');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear the user state even if the server request fails
      setUser(null);
      router.replace('/');
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.getCurrentUser();
      if (response.success && response.user && response.user._id) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 