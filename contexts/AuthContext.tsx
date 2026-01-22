
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse, UserRole } from '../types';
import { supabase } from '../services/supabase';
import { api } from '../services/mockDatabase';

// Generate a unique 6-digit UID
const generateUniqueUid = async (): Promise<string> => {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    // Generate random 6-digit number (100000-999999)
    const uid = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if it already exists
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('uid', uid)
      .maybeSingle();

    if (!data) {
      return uid; // UID is unique
    }
  }
  // Fallback: use timestamp-based UID if random fails
  return Date.now().toString().slice(-6);
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsCompletion: boolean; // New flag
  isEmailVerified: boolean;
  login: (email: string, pass: string) => Promise<AuthResponse>;
  signup: (data: any) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<any>;
  completeGoogleSignup: (data: any, firebaseUser: any) => Promise<AuthResponse>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsCompletion, setNeedsCompletion] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsEmailVerified(!!session.user.email_confirmed_at);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setNeedsCompletion(false);
        setIsEmailVerified(false);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth State Change:", event, session?.user?.id);
      if (session?.user) {
        setIsEmailVerified(!!session.user.email_confirmed_at);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setNeedsCompletion(false);
        setIsEmailVerified(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const res = await api.users.getMe(userId);
    if (res.success && res.data) {
      setUser(res.data);
      setNeedsCompletion(false);
    } else {
      console.log("User authenticated but profile not found. Redirecting to completion.");
      // User is authenticated but has no profile -> Needs completion
      setNeedsCompletion(true);
      setUser(null);
    }
    setIsLoading(false);
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

      if (error) throw error;
      if (!data.user) throw new Error("No user returned");

      const res = await api.users.getMe(data.user.id);
      if (res.success && res.data) {
        setUser(res.data);
        setIsEmailVerified(!!data.user.email_confirmed_at);
        return { success: true, message: 'Login successful.', token: data.session?.access_token, user: res.data };
      }
      return { success: false, message: 'User profile not found.' };

    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, message: error.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: any) => {
    setIsLoading(true);
    try {
      if (data.password !== data.confirm_password) return { success: false, message: 'Passwords do not match.' };

      // Signup with Supabase Auth
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;
      if (!authData.user) throw new Error("Signup failed");

      // Generate unique 6-digit UID
      const uid = await generateUniqueUid();

      // Create Public Profile
      const newUser: User = {
        id: authData.user.id,
        uid: uid,
        email: data.email,
        name: data.name,
        semester: data.semester,
        role: UserRole.STUDENT,
        is_disabled: false,
        created_at: new Date().toISOString(),
        loyalty_points: 0,
        pfp_url: ''
      };

      // Direct insert via Supabase client (using mapping in api is awkward for direct insert of User type if api.users.create doesn't exist.
      // But we can use supabase directly here or add create to api. 
      // Let's use supabase directly for profile creation to be sure.
      const { error: profileError } = await supabase.from('users').insert(newUser);
      if (profileError) throw profileError;

      // Welcome Message
      try {
        // Resolve admin email to user ID first
        const adminRes = await api.users.search('foodhunt101lpu@gmail.com');
        if (adminRes.success && adminRes.data) {
          await api.messages.send(adminRes.data.id, newUser.id, `Welcome to Food Hunt! 🍕\n\nWe're thrilled to have you join our campus food community. Start exploring vendors, join meal splits, and save money while making new friends!\n\nHappy eating!`);
        }
      } catch (e) {
        console.log("Welcome msg check failed or ignored", e);
      }

      // Notify Admin
      try {
        // Assuming 'admin' ID is known or we just send to a specific email user if we knew their ID. 
        // For now, we'll try to look up the admin or just log it.
        // Ideally we would send to a dedicated admin user.
        // Let's assume we want to notify "foodhunt101lpu@gmail.com" if that user exists.
        // But we don't have their ID handy. 
        // We will search for them or just skip if not critical. 
        // "When someone joins your list" -> Notify Admin. 
        // Let's try to notify the admin account if we can find it.
        // For now, let's just log or try a hardcoded ID if we had one.
        // Since we don't know the Admin ID, we will skip or maybe send to a 'topic' if we used topics, but FCM topics would be easier.
        // However, we implemented direct messaging.
        // Let's try to resolve the admin email to an ID.
        const res = await api.users.search('foodhunt101lpu@gmail.com');
        if (res.success && res.data) {
          await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: res.data.id,
              title: 'New Member Joined!',
              body: `${newUser.name} just joined the Food Hunt!`
            })
          });
        }
      } catch (e) {
        console.log("Admin notify failed", e);
      }

      setUser(newUser);
      setNeedsCompletion(false); // Ensure no redirect to complete-profile after successful signup
      return { success: true, message: 'Signup successful.', token: authData.session?.access_token, user: newUser };

    } catch (error: any) {
      console.error("Signup error:", error);
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    // Supabase Google Auth requires redirection usually.
    // For this dev setup, we might stick to Email/Pass or use signInWithOAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Redirecting...' };
  };

  const completeGoogleSignup = async (data: any, supabaseUser: any) => {
    setIsLoading(true);
    try {
      // Generate unique 6-digit UID
      const uid = await generateUniqueUid();

      const newUser: User = {
        id: supabaseUser.id,
        uid: uid,
        email: supabaseUser.email,
        name: data.name,
        semester: data.semester,
        role: UserRole.STUDENT,
        is_disabled: false,
        created_at: new Date().toISOString(),
        loyalty_points: 0,
        pfp_url: supabaseUser.user_metadata?.avatar_url || ''
      };

      const { error: profileError } = await supabase.from('users').insert(newUser);
      if (profileError) throw profileError;

      // Welcome Message
      try {
        // Resolve admin email to user ID first
        const adminRes = await api.users.search('foodhunt101lpu@gmail.com');
        if (adminRes.success && adminRes.data) {
          await api.messages.send(adminRes.data.id, newUser.id, `Welcome to Food Hunt! 🍕\n\nWe're thrilled to have you join our campus food community. Start exploring vendors, join meal splits, and save money while making new friends!\n\nHappy eating!`);
        }
      } catch (e) {
        console.log("Welcome msg check failed or ignored", e);
      }

      setUser(newUser);
      setNeedsCompletion(false);
      return { success: true, message: 'Profile completed.', user: newUser };

    } catch (error: any) {
      console.error("Completion error:", error);
      return { success: false, message: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNeedsCompletion(false);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, needsCompletion, isEmailVerified, login, signup, signInWithGoogle, completeGoogleSignup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
