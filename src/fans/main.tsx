import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './fans.css'

/**
 * Where this app is mounted.
 *
 * Deployed on its own it answers at "/". On the staff app's deployment it sits
 * under "/fans" (a Vercel rewrite in vercel.json), and opening the built file
 * directly gives "/fans.html". Without the right basename every route misses
 * and the site reads "Page not found" at its own front door.
 */
function basename(path = window.location.pathname): string {
  if (path === '/fans.html' || path.startsWith('/fans.html/')) return '/fans.html'
  if (path === '/fans' || path.startsWith('/fans/')) return '/fans'
  return '/'
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename()}><App /></BrowserRouter>
  </React.StrictMode>,
)
