import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import App from './App.jsx'
import { TenantProvider } from './tenant/TenantContext.jsx'
import { ToastProvider } from './Components/Common/Toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TenantProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TenantProvider>
  </StrictMode>,
)
