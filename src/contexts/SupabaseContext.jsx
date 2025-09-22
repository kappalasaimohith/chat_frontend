import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config';

// Get Supabase configuration from local config file
const supabaseUrl = SUPABASE_CONFIG.url;
const supabaseAnonKey = SUPABASE_CONFIG.anonKey;

// Check if configuration is properly set up
const isConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'https://your-project-id.supabase.co' && 
  supabaseAnonKey !== 'your_anon_key_here';

if (!isConfigured) {
  console.warn('Supabase configuration is not set up. Please update src/config.js with your Supabase credentials.');
}

// Create Supabase client with fallback for development
const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const SupabaseContext = createContext();

export function useSupabase() {
  return useContext(SupabaseContext);
}

export function SupabaseProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [configError, setConfigError] = useState(!isConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    signUp: (data) => supabase ? supabase.auth.signUp(data) : Promise.reject(new Error('Supabase not configured')),
    signIn: (data) => supabase ? supabase.auth.signInWithPassword(data) : Promise.reject(new Error('Supabase not configured')),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.reject(new Error('Supabase not configured')),
    user,
    session,
    supabase,
    loading,
    configError
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}