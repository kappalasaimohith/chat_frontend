import React, {useEffect } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function ChatList({ chats, currentChatId, onSelectChat }) {
  const { user, session } = useSupabase();
  if (!chats || chats.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No chats yet. Create a new chat to get started.
      </div>
    );
  }


  // Log all emails for each chat only when chats change
  useEffect(() => {
    chats.forEach(chat => {
      if (chat.is_group) {
        if (chat.members && Array.isArray(chat.members)) {
          const emails = chat.members.map(m => m.email).filter(Boolean);
          console.log(`[ChatList] Group chat (${chat.id}): members' emails:`, emails);
        }
      } else {
        console.log(`[ChatList] DM chat (${chat.id}): other_user_email:`, chat.other_user_email);
      }
    });
  }, [chats]);

  // State to store fallback emails for DMs
  const [dmFallbackEmails, setDmFallbackEmails] = React.useState({});

  useEffect(() => {
    // For each DM missing user_emails/other_user_email, fetch members
    chats.forEach(chat => {
      if (!chat.is_group && (!Array.isArray(chat.user_emails) || chat.user_emails.length < 2)) {
        // Only fetch if not already fetched
        if (!dmFallbackEmails[chat.id] && session?.access_token) {
          fetch(`${API_BASE_URL}/api/chats/${chat.id}/users`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          })
            .then(res => res.json())
            .then(members => {
              if (Array.isArray(members)) {
                const emails = members.map(m => m.email).filter(Boolean);
                setDmFallbackEmails(prev => ({ ...prev, [chat.id]: emails }));
              }
            })
            .catch(() => {});
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, session]);

  return (
    <ul className="divide-y divide-gray-700">
      {chats.map((chat) => {
        let displayName;
        if (chat.is_group) {
          displayName = chat.display_name || chat.name || 'Group Chat';
        } else if (Array.isArray(chat.user_emails) && chat.user_emails.length > 1) {
          displayName = chat.user_emails.find(email => email !== user?.email) || 'Loading...';
        } else if (chat.other_user_email) {
          displayName = chat.other_user_email;
        } else if (dmFallbackEmails[chat.id]) {
          displayName = dmFallbackEmails[chat.id].find(email => email !== user?.email) || 'Loading...';
        } else {
          displayName = 'Loading...';
        }
        return (
          <li 
            key={chat.id} 
            className={`p-4 cursor-pointer hover:bg-gray-700 ${currentChatId === chat.id ? 'bg-gray-700' : ''}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${chat.is_group ? 'bg-purple-500' : 'bg-green-500'}`}></div>
              <span className="font-medium">
                {displayName}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {chat.is_group ? 'Group Chat' : 'Direct Message'}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default ChatList;