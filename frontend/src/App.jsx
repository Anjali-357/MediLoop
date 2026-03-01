import React, { useContext, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, NavLink } from 'react-router-dom'
import { AppProvider, AppContext } from './context/AppContext'
import ScribeAIModule from './modules/scribe'
import RecoverbotModule from './modules/recoverbot'
import PainscanModule from './modules/painscan'
import CareGapModule from './modules/caregap'
import DashboardModule from './modules/dashboard'
import ControlCenter from './modules/control'
import PatientModule from './modules/patient'
import AlertToast from './components/AlertToast'

function AppContent() {
  const { currentPatient, alerts, removeAlert } = useContext(AppContext);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-50 flex overflow-hidden w-full">
        {/* Global Toast Alerts */}
        {alerts && alerts.length > 0 && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map(alert => (
              <AlertToast key={alert.id} alert={alert} onClose={() => removeAlert(alert.id)} />
            ))}
          </div>
        )}

        {/* Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-surface-900/50 z-40 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-surface-200 h-16">
            <span className="text-xl font-bold text-primary-600 tracking-tight">MediLoop</span>
            <button onClick={() => setSidebarOpen(false)} className="text-surface-500 hover:text-surface-700 focus:outline-none p-2 rounded-md hover:bg-surface-100 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="flex flex-col p-4 space-y-2">
            <NavLink to="/dashboard" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'}`}>
              <span className="mr-3">📊</span> Dashboard
            </NavLink>
            <NavLink to="/scribe" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'}`}>
              <span className="mr-3">🎙️</span> ScribeAI
            </NavLink>
            <NavLink to="/recoverbot" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'}`}>
              <span className="mr-3">🤖</span> RecoverBot
            </NavLink>
            <NavLink to="/control" onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'}`}>
              <span className="mr-3">⚡</span> Control Center
            </NavLink>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Header with hamburger menu */}
          <div className="bg-white border-b border-surface-200 h-16 flex items-center px-4 sm:px-6 flex-shrink-0 relative z-10 shadow-sm">
            <button onClick={() => setSidebarOpen(true)} className="text-surface-500 hover:text-surface-700 focus:outline-none flex items-center gap-3 p-2 rounded-md hover:bg-surface-100 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              <span className="text-xl font-bold text-primary-600 tracking-tight">MediLoop</span>
            </button>
          </div>

          <main className="flex-1 overflow-hidden bg-surface-50 flex flex-col">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/patient" element={<PatientModule />} />
              <Route path="/scribe" element={<ScribeAIModule />} />
              <Route path="/recoverbot" element={<RecoverbotModule />} />
              <Route path="/painscan" element={<PainscanModule />} />
              <Route path="/caregap" element={<CareGapModule />} />
              <Route path="/dashboard" element={<DashboardModule />} />
              <Route path="/control" element={<ControlCenter />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App
