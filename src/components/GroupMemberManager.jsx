import { useState, useEffect } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

function GroupMemberManager({ chatId, onClose }) {
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [members, setMembers] = useState([]);
  const [adminId, setAdminId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const { session, user } = useSupabase();

  // Fetch current group members
  useEffect(() => {
    if (session) {
      fetchMembers();
    }
  }, [chatId, session]);

  const fetchMembers = async () => {
    if (!session) {
      setError('You must be logged in to view group members');
      setLoading(false);
      return;
    }

    try {
  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/users`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // If API returns { members: [...], admin_id: ... }
        if (Array.isArray(data.members) && data.admin_id) {
          setMembers(data.members);
          setAdminId(data.admin_id);
        } else if (Array.isArray(data)) {
          setMembers(data);
          // Try to infer admin from is_admin property
          const admin = data.find(m => m.is_admin);
          setAdminId(admin ? admin.user_id : null);
        } else {
          setMembers([]);
          setAdminId(null);
        }
      } else {
        throw new Error('Failed to fetch members');
      }
    } catch (error) {
      setError('Failed to load group members');
    } finally {
      setLoading(false);
    }
  };

  // Search for users to add
  const searchUsers = async (query) => {
    if (!query.trim() || query.length < 2 || !session) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
  const response = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        // Filter out users who are already members
        const availableUsers = users.filter(user => 
          !members.some(member => member.user_id === user.id)
        );
        setSearchResults(availableUsers);
      } else {
        console.error('Failed to search users');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, session]);

  // Add user to group
  const addUserToGroup = async (userId) => {
    if (!session) {
      setError('You must be logged in to add members');
      return;
    }

    setAddingUser(true);
    try {
  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      
      if (response.ok) {
        // Refresh members list
        await fetchMembers();
        setSearchQuery('');
        setSearchResults([]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setAddingUser(false);
    }
  };

  // Remove user from group
  const removeUserFromGroup = async (userId) => {
    if (!session) {
      setError('You must be logged in to remove members');
      return;
    }

    try {
  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        // Refresh members list
        await fetchMembers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove user');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">Loading members...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Manage Group Members</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        {error && (
          <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/30 rounded-md">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Current Members */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Current Members ({members.length})</h3>
          <div className="space-y-2">
            {members.map((member, idx) => (
              <div key={member.user_id || member.email || idx} className="flex justify-between items-center p-3 bg-gray-700 rounded-md">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {member.email || member.user_id}
                    {adminId && member.user_id === adminId && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-600 text-white rounded">Admin</span>
                    )}
                  </div>
                  {member.joined_at && (
                    <div className="text-sm text-gray-400">Joined: {new Date(member.joined_at).toLocaleDateString()}</div>
                  )}
                </div>
                {/* Only admin can remove, and not themselves */}
                {user?.id === adminId && member.user_id !== adminId && (
                  <button
                    onClick={() => removeUserFromGroup(member.user_id)}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add New Members */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Add New Members</h3>
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              placeholder="Search users by email..."
            />
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0"
                    onClick={() => addUserToGroup(user.id)}
                  >
                    <div className="text-white">{user.email}</div>
                    <div className="text-xs text-gray-400">ID: {user.id}</div>
                  </div>
                ))}
              </div>
            )}
            
            {searching && (
              <div className="absolute right-2 top-2 text-gray-400">
                Searching...
              </div>
            )}
          </div>
          
          {addingUser && (
            <div className="text-center text-gray-400">
              Adding user...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupMemberManager;
