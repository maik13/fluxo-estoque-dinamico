import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/theme.css'
import './styles/gantt-print.css'
import './styles/pontualidade-print.css'

createRoot(document.getElementById("root")!).render(<App />);
