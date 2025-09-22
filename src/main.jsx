import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { WebSocketProvider } from './contexts/WebSocketContext';
import './index.css'
import { SupabaseProvider } from './contexts/SupabaseContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <SupabaseProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </SupabaseProvider>
    </BrowserRouter>
  </React.StrictMode>,
)