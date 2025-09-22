// ChatMessages.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { useWebSocket } from '../contexts/WebSocketContext';

function ChatMessages({ chatId, groupMembers = [], isGroup = false, messages: propMessages }) {
  const { user } = useSupabase();
  const { messages: wsMessages, setMessages, sendMessage, loadChatHistory, socket } = useWebSocket();
  const [newMessage, setNewMessage] = useState('');
  const [joined, setJoined] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // Always merge backend messages (propMessages) with optimistic messages
  const chatMessages = useMemo(() => {
    let backendMsgs = [];
    if (Array.isArray(propMessages)) {
      backendMsgs = propMessages.filter(m => m.chat_id === chatId);
    } else if (wsMessages[chatId]?.length > 0) {
      backendMsgs = wsMessages[chatId];
    }
    // Remove optimistic messages that are now present in backend
    const filteredOptimistic = optimisticMessages.filter(om => {
      return !backendMsgs.some(pm =>
        pm.content === om.content &&
        pm.sender_id === om.sender_id &&
        Math.abs(new Date(pm.inserted_at).getTime() - new Date(om.inserted_at).getTime()) < 30000
      );
    });
    return [...backendMsgs, ...filteredOptimistic];
  }, [propMessages, wsMessages, chatId, optimisticMessages]);

  // Helper to get sender label for group chats
  const getSenderLabel = (sender_id, message) => {
    if (sender_id === user.id) return 'You';
    // Always prefer groupMembers email if available
    if (Array.isArray(groupMembers)) {
      const member = groupMembers.find(m => m.user_id === sender_id);
      if (member && member.email) return member.email;
    }
    // Fallback: if message has sender_email, use it
    if (message && message.sender_email) return message.sender_email;
    // Fallback: if message has sender_id that looks like a UUID, show 'Unknown User'
    if (typeof sender_id === 'string' && sender_id.length > 20 && sender_id.includes('-')) return 'Unknown User';
    return sender_id;
  };

  // Reset optimistic messages when chat changes
  useEffect(() => {
    setOptimisticMessages([]);
    setJoined(false);
  }, [chatId]);

  useEffect(() => {
    function handleJoinedChat(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'joined_chat' && data.chat_id === chatId) {
          setJoined(true);
        }
      } catch {}
    }
    if (socket) socket.addEventListener('message', handleJoinedChat);
    return () => {
      if (socket) socket.removeEventListener('message', handleJoinedChat);
    };
  }, [chatId, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      chat_id: chatId,
      sender_id: user.id,
      content: newMessage,
      inserted_at: new Date().toISOString(),
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    sendMessage(chatId, newMessage);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatMessages.map((message) => {
              const isCurrentUser = message.sender_id === user.id;
              return (
                <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-lg p-3 rounded-lg ${isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                    {isGroup && (
                      <div className="text-xs font-semibold text-indigo-300 mb-1">
                        {getSenderLabel(message.sender_id, message)}
                      </div>
                    )}
                    <p>{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.inserted_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <form onSubmit={handleSendMessage} className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-l-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatMessages;
