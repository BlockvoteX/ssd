import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiCall } from '../utils/api';

// Types
interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  };
  dateOfBirth: string;
  gender: string;
  isAdmin: boolean;
  isVerified: boolean;
  profileImage?: string;
  lastLogin?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: User | null;
  loading: boolean;
  jwt: string | null;
  signIn: (identifier: string, password: string) => Promise<{ success: boolean; message: string }>;
  signUp: (userData: SignUpData) => Promise<{ success: boolean; message: string }>;
  signOut: () => void;
  updateProfile: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  forgotPassword: (identifier: string) => Promise<{ success: boolean; message: string }>;
}

interface SignUpData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  dateOfBirth: string;
  gender: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [jwt, setJwt] = useState<string | null>(localStorage.getItem('token'));

  // Initialize auth state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        setJwt(token);
        try {
          // First set user from localStorage for immediate access
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          
          // Then verify token with server in background
          const data = await apiCall('/auth/verify-token', {
            method: 'POST',
            requireAuth: true
          });

          if (data.success) {
            // Update with fresh data from server
            setUser(data.user);
          } else {
            // Token is invalid, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setJwt(null);
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          // Don't clear user data immediately on network errors
          // Keep using cached user data but log the error
          console.warn('Using cached user data due to network error');
        }
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const signIn = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: { identifier, password },
        requireAuth: false
      });

      if (data.success) {
        // Optimized: Store user data immediately
        const userData = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setJwt(data.token);
        
        return { success: true, message: data.message || 'Login successful' };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Check if it's a backend unavailable error
      if (error instanceof Error && error.message.includes('Backend server is not available')) {
        return { 
          success: false, 
          message: 'Backend server is not deployed yet. Please deploy the backend to use authentication features.' 
        };
      }
      
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (userData: SignUpData) => {
    setLoading(true);
    try {
      const data = await apiCall('/auth/register', {
        method: 'POST',
        body: userData,
        requireAuth: false
      });

      if (data.success) {
        // Optimized: Store user data and login immediately after registration
        const newUser = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
        setJwt(data.token);
        
        return { success: true, message: data.message || 'Registration successful' };
      } else {
        return { success: false, message: data.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Server is busy')) {
          return { success: false, message: 'Server is currently busy. Please wait a moment and try again.' };
        }
        if (error.message.includes('Backend server is not available')) {
          return { 
            success: false, 
            message: 'Backend server is not deployed yet. Please deploy the backend to use authentication features.' 
          };
        }
      }
      
      return { success: false, message: 'Network error. Please try again in a few moments.' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setJwt(null);
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const data = await apiCall('/auth/profile', {
        method: 'PUT',
        body: userData,
        requireAuth: true
      });

      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || 'Update failed' };
      }
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const forgotPassword = async (identifier: string) => {
    try {
      const data = await apiCall('/auth/forgot-password', {
        method: 'POST',
        body: { identifier },
        requireAuth: false
      });

      return { 
        success: data.success, 
        message: data.message || (data.success ? 'Request submitted' : 'Request failed') 
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const value: AuthContextType = {
    user,
    userProfile: user, // For backward compatibility
    loading,
    jwt,
    signIn,
    signUp,
    signOut,
    updateProfile,
    forgotPassword,
  };

  return (
    <AuthContext.Provider value={value}>
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
