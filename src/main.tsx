import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthGate from './components/Auth/AuthGate'
import { installApiFetchGuard } from './services/session'
import logoUrl from './assets/logo.png'

const favicon = document.getElementById('favicon') as HTMLLinkElement | null
if (favicon) {
  favicon.href = logoUrl
}

document.title = 'Chlio'

// Must run before anything calls the API: adds the CSRF header and turns 401s into the sign-in screen.
installApiFetchGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
)
