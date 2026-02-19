import { useState } from 'react'
import { EditorLayout } from './components/layout/EditorLayout'
import { LandingPage } from './pages/LandingPage'
import { WatermarkPage } from './pages/WatermarkPage'

type Page = 'home' | 'videomaker' | 'watermark'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  if (page === 'videomaker') return <EditorLayout onBack={() => setPage('home')} />
  if (page === 'watermark') return <WatermarkPage onBack={() => setPage('home')} />
  return <LandingPage onNavigate={(p) => setPage(p)} />
}
