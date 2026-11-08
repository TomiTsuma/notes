import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import logoUrl from './assets/logo.png'

const favicon = document.getElementById('favicon') as HTMLLinkElement | null
if (favicon) {
  favicon.href = logoUrl
}

document.title = 'Chlio'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
