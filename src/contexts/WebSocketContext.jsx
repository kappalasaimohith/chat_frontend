
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './SupabaseContext';

const WebSocketContext = createContext();

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }) {
  const { session } = useSupabase();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [messages, setMessages] = useState({});
  const [currentChatId, setCurrentChatId] = useState(null);
  const joinedChats = useRef(new Set());
  const messageQueue = useRef([]);

  useEffect(() => {
    if (!session) {
      if (socket) {
        socket.close();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // Parse host/port from API_BASE_URL
    let wsHost;
    try {
      const url = new URL(API_BASE_URL);
      wsHost = url.host;
    } catch {
      wsHost = 'localhost:5000';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${wsHost}/ws?token=${session.access_token}`;

    const ws = new WebSocket(wsUrl);
    setConnecting(true);
    setConnectionError(null);

    let pingInterval;
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        setConnectionError('Connection timeout');
        setConnecting(false);
        ws.close();
      }
    }, 10000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      setConnected(true);
      setConnecting(false);
      // Always join the current chat after connecting
      if (currentChatId) {
        ws.send(JSON.stringify({ type: 'join', chat_id: currentChatId }));
      }
      pingInterval = setInterval(() => {
        ws.send(JSON.stringify({ type: 'ping' }));
      }, 20000);
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      if (pingInterval) clearInterval(pingInterval);
      setConnected(false);
      setConnecting(false);
      joinedChats.current = new Set();
      if (event.code !== 1000 && session) {
        setTimeout(() => setSocket(null), 3000);
      }
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      if (pingInterval) clearInterval(pingInterval);
      setConnectionError('Connection failed');
      setConnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'new_message':
            setMessages(prev => {
              const chatMessages = prev[data.chat_id] || [];
              // Remove any optimistic message from the same sender with same content and close timestamp
              const filtered = chatMessages.filter(msg => {
                // Remove optimistic if:
                // 1. It's an optimistic id
                // 2. Same sender
                // 3. Same content
                // 4. Within 2 seconds of  the real message
                if (msg.id.startsWith('optimistic-') &&
                    msg.sender_id === data.sender_id &&
                    msg.content === data.content) {
                  const realTime = new Date(data.inserted_at).getTime();
                  const optTime = new Date(msg.inserted_at).getTime();
                  if (Math.abs(realTime - optTime) < 2000) {
                    return false; // filter out
                  }
                }
                return msg.id !== data.id;
              });
              return {
                ...prev,
                [data.chat_id]: [...filtered, data]
              };
            });
            break;
          case 'joined_chat':
            joinedChats.current.add(data.chat_id);
            const toSend = messageQueue.current.filter(m => m.chatId === data.chat_id);
            toSend.forEach(({ chatId, content }) => {
              ws.send(JSON.stringify({ type: 'new_message', chat_id: chatId, content }));
            });
            messageQueue.current = messageQueue.current.filter(m => m.chatId !== data.chat_id);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    setSocket(ws);

    return () => {
      clearTimeout(connectionTimeout);
      if (pingInterval) clearInterval(pingInterval);
    };
  }, [session, currentChatId]);

  const joinChat = useCallback((chatId) => {
    setCurrentChatId(chatId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'join', chat_id: chatId }));
    }
  }, [socket]);

  const leaveChat = useCallback(() => {
    setCurrentChatId(null);
  }, []);

  const sendMessage = useCallback((chatId, content) => {
    if (!chatId || !content.trim()) return;

    if (!socket || socket.readyState !== WebSocket.OPEN || !connected) {
      messageQueue.current.push({ chatId, content });
      return;
    }

    if (!joinedChats.current.has(chatId)) {
      socket.send(JSON.stringify({ type: 'join', chat_id: chatId }));
      messageQueue.current.push({ chatId, content });
      return;
    }

    socket.send(JSON.stringify({ type: 'new_message', chat_id: chatId, content }));
  }, [socket, connected]);

  const loadChatHistory = useCallback(async (chatId, limit = 100) => {
    if (!session) return [];

    try {
      const res = await fetch(`http://localhost:5000/api/chats/${chatId}/messages?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load chat history');
      const data = await res.json();
      setMessages(prev => ({ ...prev, [chatId]: data }));
      return data;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [session]);

  return (
    <WebSocketContext.Provider value={{
      socket,
      connected,
      connecting,
      connectionError,
      messages,
      setMessages,
      joinChat,
      leaveChat,
      sendMessage,
      loadChatHistory,
      currentChatId
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}
