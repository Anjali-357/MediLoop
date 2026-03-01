import React, { useContext } from 'react'
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

// Removed ProtectedRoute so users can view pages without starting a consultation

function AppContent() {
  const { currentPatient, alerts, removeAlert } = useContext(AppContext);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-50 relative">
        {/* Global Toast Alerts */}
        {alerts && alerts.length > 0 && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map(alert => (
              <AlertToast key={alert.id} alert={alert} onClose={() => removeAlert(alert.id)} />
            ))}
          </div>
        )}

        <nav className="bg-white border-b border-surface-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-primary-600 tracking-tight">MediLoop</span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <NavLink to="/dashboard" className={({ isActive }) => `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive ? 'border-primary-500 text-surface-900' : 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}`}>
                    📊 Dashboard
                  </NavLink>
                  <NavLink to="/scribe" className={({ isActive }) => `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive ? 'border-primary-500 text-surface-900' : 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}`}>
                    🎙️ ScribeAI
                  </NavLink>
                  <NavLink to="/recoverbot" className={({ isActive }) => `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive ? 'border-primary-500 text-surface-900' : 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}`}>
                    🤖 RecoverBot
                  </NavLink>
                  <NavLink to="/control" className={({ isActive }) => `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive ? 'border-primary-500 text-surface-900' : 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}`}>
                    ⚡ Control Center
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-surface-50">
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
    </BrowserRouter >
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
