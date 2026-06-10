import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@petpals/theme/ThemeProvider.jsx'
import StoreDashboard from './components/StoreDashboard'
import { SupplierAppProvider } from './context/SupplierAppContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <SupplierAppProvider>
                <StoreDashboard />
            </SupplierAppProvider>
        </ThemeProvider>
    </React.StrictMode>,
)
