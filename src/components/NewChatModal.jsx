import { useState, useEffect } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function NewChatModal({ onClose, onCreate }) {
  const [isGroup, setIsGroup] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const { session } = useSupabase();

  const searchUsers = async (query) => {
    if (!query.trim() || query.length < 2 || !session?.access_token) {
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
        setSearchResults(users);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isGroup) {
        if (!name.trim()) throw new Error('Group name is required');
        if (members.length === 0) throw new Error('Please add at least one member');

        await onCreate({
          is_group: true,
          name: name.trim(),
          member_ids: members.map(user => user.id)
        });

        setSuccess(`Group chat "${name.trim()}" created successfully!`);
        clearForm();
        setTimeout(() => onClose(), 2000);
      } else {
        if (!selectedUser) throw new Error('Please select a user to chat with');

        await onCreate({
          is_group: false,
          other_user_id: selectedUser.id
        });

        setSuccess('Direct chat created successfully!');
        clearForm();
        setTimeout(() => onClose(), 2000);
      }
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const addMember = (user) => {
    if (!members.find(m => m.id === user.id)) {
      setMembers([...members, user]);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setError('This user is already added');
    }
  };

  const removeMember = (id) => {
    setMembers(members.filter(user => user.id !== id));
  };

  const selectUserFromSearch = (user) => {
    if (isGroup) {
      addMember(user);
    } else {
      setSelectedUser(user);
      setSearchQuery(user.email);
      setSearchResults([]);
    }
  };

  const clearForm = () => {
    setName('');
    setMembers([]);
    setSelectedUser(null);
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setSuccess(null);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
  };

  const isFormValid = () => {
    return isGroup
      ? name.trim().length > 0 && members.length > 0
      : !!selectedUser;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Create New Chat</h2>

        {error && (
          <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/30 rounded-md border border-red-500/50">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 text-sm text-green-400 bg-green-900/30 rounded-md border border-green-500/50">
            ✅ {success}
          </div>
        )}

        <div className="mb-4">
          <label className="inline-flex items-center mr-4">
            <input type="radio" checked={!isGroup} onChange={() => setIsGroup(false)} className="form-radio" />
            <span className="ml-2">Direct Message</span>
          </label>
          <label className="inline-flex items-center">
            <input type="radio" checked={isGroup} onChange={() => setIsGroup(true)} className="form-radio" />
            <span className="ml-2">Group Chat</span>
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          {isGroup ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Group Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                  placeholder="Enter group name"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Add Members</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                  placeholder="Search users by email..."
                />

                {searchResults.length > 0 && (
                  <div className="bg-gray-700 mt-1 rounded-md border border-gray-600 max-h-40 overflow-y-auto">
                    {searchResults.map(user => (
                      <div
                        key={user.id}
                        onClick={() => selectUserFromSearch(user)}
                        className="p-2 hover:bg-gray-600 cursor-pointer"
                      >
                        {user.email}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {members.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Members:</label>
                  <ul className="bg-gray-700 rounded-md p-2">
                    {members.map(user => (
                      <li key={user.id} className="flex justify-between items-center py-1">
                        <span>{user.email}</span>
                        <button type="button" onClick={() => removeMember(user.id)} className="text-red-400">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">User to Chat With</label>
              <div className="flex">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                  className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-l-md"
                  placeholder="Search users by email..."
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="px-3 py-2 bg-gray-600 text-white rounded-r-md"
                  >
                    ✕
                  </button>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="bg-gray-700 mt-1 rounded-md border border-gray-600 max-h-40 overflow-y-auto">
                  {searchResults.map(user => (
                    <div
                      key={user.id}
                      onClick={() => selectUserFromSearch(user)}
                      className="p-2 hover:bg-gray-600 cursor-pointer"
                    >
                      {user.email}
                    </div>
                  ))}
                </div>
              )}

              {selectedUser && (
                <div className="mt-2 p-2 bg-green-900/30 rounded-md border border-green-500/50">
                  Selected: {selectedUser.email}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewChatModal;
