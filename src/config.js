// Supabase Configuration
// Update these values with your actual Supabase project credentials
// You can find these in your Supabase project dashboard under Settings > API

export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key_here',
};

// Instructions:
// 1. Replace 'https://your-project-id.supabase.co' with your actual Supabase project URL
// 2. Replace 'your_anon_key_here' with your actual Supabase anonymous key
// 3. Save this file
// 4. Restart your development server
