import { Routes, Route, Navigate } from 'react-router-dom';
import { useSupabase } from './contexts/SupabaseContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

function ConfigurationError() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-md text-center">
        <div className="text-red-400 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-white">Configuration Error</h1>
        <p className="text-gray-400">
          Supabase configuration is not set up. Please update <code className="bg-gray-700 px-2 py-1 rounded">src/config.js</code> with your Supabase credentials:
        </p>
        <div className="bg-gray-700 p-4 rounded text-left text-sm">
          <div>url: 'your_supabase_url'</div>
          <div>anonKey: 'your_supabase_anon_key'</div>
        </div>
        <p className="text-gray-400 text-sm">
          You can find these in your Supabase project dashboard under Settings API.
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, configError } = useSupabase();
  
  if (configError) {
    return <ConfigurationError />;
  }
  
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  return children;
}

function App() {
  const { configError } = useSupabase();
  
  if (configError) {
    return <ConfigurationError />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;