import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { EditorLayout } from './components/layout/EditorLayout'
import { LandingPage } from './pages/LandingPage'
import { WatermarkPage } from './pages/WatermarkPage'
import { RuletaPage } from './pages/RuletaPage'
import { BibliotecaPage } from './pages/BibliotecaPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/videomaker" element={<EditorLayout />} />
        <Route path="/watermark" element={<WatermarkPage />} />
        <Route path="/ruleta" element={<RuletaPage />} />
        <Route path="/biblioteca" element={<BibliotecaPage />} />
      </Routes>
    </BrowserRouter>
  )
}
