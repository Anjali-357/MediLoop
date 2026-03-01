import React, { useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AppProvider, AppContext } from './context/AppContext'
import ScribeAIModule from './modules/scribe'
import RecoverbotModule from './modules/recoverbot'
import PainscanModule from './modules/painscan'
import CareGapModule from './modules/caregap'
import DashboardModule from './modules/dashboard'
import ControlCenter from './modules/control'
import AlertToast from './components/AlertToast'

const ProtectedRoute = ({ children }) => {
  const { currentPatient } = useContext(AppContext);
  if (!currentPatient) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

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
                  <Link to="/scribe" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    🎙️ ScribeAI
                  </Link>
                  <Link to="/dashboard" className="border-primary-500 text-surface-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    📊 Dashboard
                  </Link>
                  <Link to="/control" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                    ⚡ Control Center
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="w-full flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-surface-50">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/scribe" element={<ProtectedRoute><ScribeAIModule /></ProtectedRoute>} />
            <Route path="/recoverbot" element={<ProtectedRoute><RecoverbotModule /></ProtectedRoute>} />
            <Route path="/painscan" element={<ProtectedRoute><PainscanModule /></ProtectedRoute>} />
            <Route path="/caregap" element={<ProtectedRoute><CareGapModule /></ProtectedRoute>} />
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
