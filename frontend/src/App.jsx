import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import ScribeAIModule from './modules/scribe'
import RecoverbotModule from './modules/recoverbot'
import PainscanModule from './modules/painscan'
import CareGapModule from './modules/caregap'
import OrchestratorModule from './modules/orchestrator'
import CommHubModule from './modules/commhub'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-surface-50">
          {/* Simple Top Navigation */}
          <nav className="bg-white border-b border-surface-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <span className="text-xl font-bold text-primary-600 tracking-tight">MediLoop</span>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    <a href="/scribe" className="border-primary-500 text-surface-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      ScribeAI
                    </a>
                    <a href="/recoverbot" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      RecoverBot
                    </a>
                    <a href="/painscan" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      PainScan
                    </a>
                    <a href="/caregap" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      CareGap
                    </a>
                    <a href="/orchestrator" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      🧠 Orchestrator
                    </a>
                    <a href="/commhub" className="border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                      📲 CommHub
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <main className="max-w-7xl auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Navigate to="/scribe" replace />} />
              <Route path="/scribe" element={<ScribeAIModule />} />
              <Route path="/recoverbot" element={<RecoverbotModule />} />
              <Route path="/painscan" element={<PainscanModule />} />
              <Route path="/caregap" element={<CareGapModule />} />
              <Route path="/orchestrator" element={<OrchestratorModule />} />
              <Route path="/commhub" element={<CommHubModule />} />
              <Route path="*" element={
                <div className="text-center py-12">
                  <h2 className="text-base font-semibold text-primary-600">404</h2>
                  <p className="mt-1 text-sm text-surface-500">Page under construction by other developers.</p>
                </div>
              } />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
