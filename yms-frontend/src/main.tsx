import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import AuthProvider from './contexts/AuthContext.tsx'
import WorkspaceProvider from './contexts/WorkspaceContext.tsx'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                {/* 인증 사용자 범위 안에서 현재 Workspace 상태를 공유합니다. */}
                <WorkspaceProvider>
                    <App />
                </WorkspaceProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
)
