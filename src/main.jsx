import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import './index.css'

const App = lazy(() => import('./App.jsx'))
const NewApiDashboard = lazy(() => import('./NewApiDashboard.jsx'))

function Layout() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950">
        <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center h-14 gap-1">
              <NavLink
                to="/oneapi"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`
                }
              >
                OneAPI
              </NavLink>
              <NavLink
                to="/newapi"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`
                }
              >
                NewAPI
              </NavLink>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Navigate to="/newapi" replace />} />
          <Route
            path="/oneapi"
            element={
              <Suspense fallback={<div className="p-6 text-gray-300">Loading...</div>}>
                <App />
              </Suspense>
            }
          />
          <Route
            path="/newapi"
            element={
              <Suspense fallback={<div className="p-6 text-gray-300">Loading...</div>}>
                <NewApiDashboard />
              </Suspense>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Layout />
  </React.StrictMode>
)
