import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import EntryScreen from './components/EntryScreen'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EntryScreen />
  </StrictMode>,
)
