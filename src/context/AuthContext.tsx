import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper function to make API calls with retry logic
const apiCall = async (endpoint: string, options: RequestInit = {}, retryCount = 3): Promise<{ response: Response; data: any }> => {
  const token = localStorage.getItem('token');
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      // If rate limited (429), wait and retry
      if (response.status === 429 && attempt < retryCount) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`Rate limited. Retrying in ${waitTime/1000}s... (attempt ${attempt + 1}/${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Check if response is ok
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Server is busy. Please try again in a few minutes.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { response, data };
    } catch (error) {
      // If it's the last attempt or not a retryable error, throw
      if (attempt === retryCount || !(error instanceof TypeError)) {
        console.error('API call failed:', error);
        
        // Check if it's a network error (backend not available)
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error('Backend server is not available. Please deploy the backend first or use demo mode.');
        }
        
        throw error;
      }
      
      // Wait before retrying on network errors
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Network error. Retrying in ${waitTime/1000}s... (attempt ${attempt + 1}/${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Maximum retry attempts exceeded');
};

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
          const { response, data } = await apiCall('/auth/verify-token', {
            method: 'POST',
          });

          if (response.ok && data.success) {
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
      const { response, data } = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      if (response.ok && data.success) {
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
      const { response, data } = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      if (response.ok && data.success) {
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
      const { response, data } = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      if (response.ok && data.success) {
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
      const { response, data } = await apiCall('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });

      return { 
        success: response.ok && data.success, 
        message: data.message || (response.ok ? 'Request submitted' : 'Request failed') 
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
