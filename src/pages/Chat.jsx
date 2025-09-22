import { useState, useEffect, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import ChatList from '../components/ChatList';
import ChatMessages from '../components/ChatMessages';
import NewChatModal from '../components/NewChatModal';
import GroupMemberManager from '../components/GroupMemberManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Chat() {
  const { user, session, signOut } = useSupabase();
  const { joinChat, leaveChat, currentChatId, connected, connecting, connectionError } = useWebSocket();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showGroupMemberManager, setShowGroupMemberManager] = useState(false);
  const [error, setError] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);

  // Fetch user's chats
  useEffect(() => {
    async function fetchChats() {
      if (!user || !session?.access_token) {
        setError('You must be logged in to view chats');
        setLoading(false);
        return;
      }

      try {
        // Connect directly to the backend server with auth token
  const response = await fetch(`${API_BASE_URL}/api/chats`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch chats');
        
        const data = await response.json();
        setChats(data);
      } catch (error) {
        console.error('Error fetching chats:', error);
        setError('Failed to load chats. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchChats();
  }, [user, session]);

  // State for group members
  const [groupMembers, setGroupMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // State for messages and polling interval
  const [messages, setMessages] = useState([]);
  const pollingRef = useRef(null);

  // Update current chat info when currentChatId changes
  useEffect(() => {
    if (currentChatId) {
      const chat = chats.find(c => c.id === currentChatId);
      // Try to load messages from localStorage first
      const cacheKey = `chat_history_${currentChatId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setMessages(parsed);
        } catch {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      console.log('Setting current chat:', chat);

      // Log all emails for this chat
      if (chat) {
        if (chat.is_group && chat.members && Array.isArray(chat.members)) {
          const emails = chat.members.map(m => m.email).filter(Boolean);
          console.log(`[Chat.jsx] Group chat (${chat.id}): members' emails:`, emails);
        } else if (!chat.is_group) {
          console.log(`[Chat.jsx] DM chat (${chat.id}): other_user_email:`, chat.other_user_email);
        }
      }

      // If this is a direct message and other_user_email is missing, try to find it
      if (chat && !chat.is_group && !chat.other_user_email) {
        console.log('Direct message missing other_user_email, attempting to fix');
        // Fallback: fetch chat members and set user_emails manually
  fetch(`${API_BASE_URL}/api/chats/${chat.id}/users`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
          .then(res => res.json())
          .then(members => {
            if (Array.isArray(members)) {
              const emails = members.map(m => m.email).filter(Boolean);
              console.log("Fetched emails for chat members:", emails);
              const otherEmail = emails.find(e => e !== user?.email) || 'Unknown User';
              setCurrentChat({ ...chat, user_emails: emails, other_user_email: otherEmail, display_name: otherEmail });
            } else {
              setCurrentChat(chat);
            }
          })
          .catch(() => setCurrentChat(chat));
      } else {
        setCurrentChat(chat);
      }

      // If this is a group chat, fetch members
      if (chat && chat.is_group && session?.access_token) {
        setLoadingMembers(true);
  fetch(`${API_BASE_URL}/api/chats/${currentChatId}/users`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        .then(response => response.json())
        .then(members => {
          console.log('Fetched group members:', members);
          setGroupMembers(members);
        })
        .catch(error => {
          console.error('Error fetching group members:', error);
          setGroupMembers([]);
        })
        .finally(() => {
          setLoadingMembers(false);
        });
      } else {
        setGroupMembers([]);
      }
    } else {
      setCurrentChat(null);
      setGroupMembers([]);
      setMessages([]);
    }
  }, [currentChatId, chats, session, user]);

  // Poll messages every 20 seconds for the current chat
  useEffect(() => {
    if (!currentChatId || !session?.access_token) {
      setMessages([]);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    async function fetchMessages() {
      try {
  const resp = await fetch(`${API_BASE_URL}/api/chats/${currentChatId}/messages`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (resp.ok) {
          const msgs = await resp.json();
          setMessages(prevMsgs => {
            // Merge previous and new, deduplicate by id
            const all = [...(Array.isArray(prevMsgs) ? prevMsgs : []), ...msgs];
            const deduped = Object.values(
              all.reduce((acc, m) => {
                acc[m.id] = m;
                return acc;
              }, {})
            ).sort((a, b) => new Date(a.inserted_at) - new Date(b.inserted_at));
            // Store in localStorage
            try {
              localStorage.setItem(`chat_history_${currentChatId}`, JSON.stringify(deduped));
            } catch {}
            return deduped;
          });
        }
      } catch (e) {
        // Optionally handle error
      }
    }
    fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 20000); // 20 seconds
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentChatId, session]);

  // Handle chat selection
  const handleSelectChat = (chatId) => {
    joinChat(chatId);
  };

  // Handle creating a new chat
  const handleCreateChat = async (newChat) => {
    console.log('🚀 handleCreateChat called with:', newChat);
    console.log('👤 Current user:', user);
    console.log('🔑 Session available:', !!session);
    console.log('🔑 Access token available:', !!session?.access_token);
    
    if (!user || !session?.access_token) {
      console.error('❌ User not authenticated');
      setError('You must be logged in to create chats');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
  const endpoint = `${API_BASE_URL}/api/chats`;
      const body = newChat.is_group 
        ? { name: newChat.name, member_ids: newChat.member_ids, is_group: true }
        : { other_user_id: newChat.other_user_id };
      
      console.log('📡 Making API request to create chat...');
      console.log('🌐 Endpoint:', endpoint);
      console.log('📦 Request body:', body);
      console.log('🔑 Authorization header:', `Bearer ${session.access_token.substring(0, 20)}...`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body),
      });

      console.log('📡 Create chat response status:', response.status);
      console.log('📡 Create chat response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to create chat:', response.status, errorText);
        throw new Error(`Failed to create chat: ${response.status} ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Chat created successfully:', responseData);
      const { chat_id } = responseData;
      
      // Refresh chats list
      console.log('🔄 Refreshing chats list...');
  const chatsResponse = await fetch(`${API_BASE_URL}/api/chats`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      console.log('📡 Refresh chats response status:', chatsResponse.status);
      
      if (!chatsResponse.ok) {
        const errorText = await chatsResponse.text();
        console.error('❌ Failed to fetch chats:', chatsResponse.status, errorText);
        throw new Error('Failed to fetch chats');
      }
      
      const chatsData = await chatsResponse.json();
      console.log('✅ Chats list refreshed:', chatsData);
      setChats(chatsData);
      
      // Join the new chat (wait until WebSocket is connected)
      console.log('🚪 Joining new chat:', chat_id);
      if (connected) {
        joinChat(chat_id);
      } else {
        const start = Date.now();
        const waitForWs = setInterval(() => {
          if (connected || Date.now() - start > 5000) {
            clearInterval(waitForWs);
            if (connected) {
              joinChat(chat_id);
            } else {
              console.warn('WebSocket not connected after 5s; continuing without joining room');
            }
          }
        }, 200);
      }
      setShowNewChatModal(false);
      
      console.log('✅ Chat creation process completed successfully');
    } catch (error) {
      console.error('❌ Error creating chat:', error);
      setError(`Failed to create chat: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && chats.length === 0) {
    return <div className="flex items-center justify-center h-screen">Loading chats...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold">Realtime Chat</h1>
        <div className="flex items-center space-x-4">
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-2">
            {connecting && (
              <div className="flex items-center space-x-2 text-yellow-400">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span className="text-sm">Connecting...</span>
              </div>
            )}
            {connected && (
              <div className="flex items-center space-x-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">Connected</span>
              </div>
            )}
            {connectionError && (
              <div className="flex items-center space-x-2 text-red-400">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="text-sm">Connection Failed</span>
              </div>
            )}
          </div>
          <span>{user?.email}</span>
          <button 
            onClick={() => signOut()}
            className="px-3 py-1 text-sm bg-red-600 rounded hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold">Chats</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="p-1 bg-indigo-600 rounded hover:bg-indigo-700"
            >
              New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatList 
              chats={chats} 
              currentChatId={currentChatId} 
              onSelectChat={handleSelectChat} 
            />
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col ">
          {currentChatId ? (
            <>
              {/* Chat header with group management */}
              <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold">
                    {currentChat?.is_group
                      ? (currentChat?.display_name || currentChat?.name || 'Group Chat')
                      : (Array.isArray(currentChat?.user_emails)
                          ? (currentChat.user_emails.find(email => email !== user?.email) || 'Unknown User')
                          : ((currentChat?.other_user_email && currentChat?.other_user_email !== user?.email)
                              ? currentChat.other_user_email
                              : 'Unknown User'))}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {currentChat?.is_group 
                      ? `Group Chat (${groupMembers.length} members)` 
                      : (Array.isArray(currentChat?.user_emails)
                          ? `Chatting with ${currentChat.user_emails.find(email => email !== user?.email) || 'Unknown User'}`
                          : ((currentChat?.other_user_email && currentChat?.other_user_email !== user?.email)
                              ? `Chatting with ${currentChat.other_user_email}`
                              : 'Chatting with Unknown User'))}
                  </p>
                  {/* {currentChat?.is_group && groupMembers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Members:</p>
                      <div className="flex flex-wrap gap-1">
                        {groupMembers.map(member => (
                          <span key={member.user_id} className="text-xs bg-gray-700 px-2 py-1 rounded">
                            {member.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )} */}
                </div>
                <div className="space-x-2">
                  {currentChat?.is_group && (
                    <button
                      onClick={() => setShowGroupMemberManager(true)}
                      className="px-3 py-1 text-sm bg-indigo-600 rounded hover:bg-indigo-700"
                    >
                      Manage Members
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!currentChatId || !session?.access_token) return;
                      if (!confirm('Delete this chat? This cannot be undone.')) return;
                      try {
                        const resp = await fetch(`${API_BASE_URL}/api/chats/${currentChatId}`, {
                          method: 'DELETE',
                          headers: { 'Authorization': `Bearer ${session.access_token}` }
                        });
                        if (!resp.ok) {
                          const txt = await resp.text();
                          throw new Error(txt);
                        }
                        // Refresh chats and clear selection
                        leaveChat();
                        const refreshed = await fetch(`${API_BASE_URL}/api/chats`, {
                          headers: { 'Authorization': `Bearer ${session.access_token}` }
                        });
                        if (refreshed.ok) {
                          const list = await refreshed.json();
                          setChats(list);
                        }
                      } catch (e) {
                        setError('Failed to delete chat');
                      }
                    }}
                    className="px-3 py-1 text-sm bg-red-600 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChatMessages 
                  chatId={currentChatId} 
                  groupMembers={currentChat?.is_group ? groupMembers : []}
                  isGroup={!!currentChat?.is_group}
                  messages={messages}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a chat or create a new one to start messaging
            </div>
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal 
          onClose={() => setShowNewChatModal(false)} 
          onCreate={handleCreateChat} 
        />
      )}

      {/* Group Member Manager Modal */}
      {showGroupMemberManager && currentChatId && (
        <GroupMemberManager
          chatId={currentChatId}
          onClose={() => setShowGroupMemberManager(false)}
        />
      )}

      {/* Error message */}
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-900/80 text-white rounded-md shadow-lg">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default Chat;