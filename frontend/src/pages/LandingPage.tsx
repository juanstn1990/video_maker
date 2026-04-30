import { Link } from 'react-router-dom'
import { AdminPanel } from '../components/ruleta/AdminPanel'

export function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center bg-gray-950 px-4 py-12"
      style={{ background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0a0a0f 60%)' }}
    >
      {/* Brand header */}
      <div className="flex flex-col items-center mb-14 select-none">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-900/50">
            CL
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Creaciones <span className="text-indigo-400">Lalis</span>
          </h1>
        </div>
        <p className="text-gray-500 text-sm">Suite de herramientas creativas</p>
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
        {/* Video Maker */}
        <Link
          to="/videomaker"
          className="group relative flex flex-col items-start gap-4 p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-indigo-500 hover:bg-gray-800 transition-all duration-200 text-left shadow-lg hover:shadow-indigo-900/20 hover:shadow-xl"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl group-hover:bg-indigo-600/30 transition-colors">
            🎬
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
              Video Maker
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Crea videos con imágenes, audio, subtítulos y transiciones.
            </p>
          </div>
          <div className="mt-auto w-full flex items-center justify-between">
            <span className="text-xs text-indigo-500 font-medium uppercase tracking-wider">
              Abrir
            </span>
            <span className="text-gray-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
          </div>
          <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 ring-indigo-500/30 transition-all" />
        </Link>

        {/* Marca de Agua */}
        <Link
          to="/watermark"
          className="group relative flex flex-col items-start gap-4 p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-indigo-500 hover:bg-gray-800 transition-all duration-200 text-left shadow-lg hover:shadow-indigo-900/20 hover:shadow-xl"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl group-hover:bg-indigo-600/30 transition-colors">
            🎵
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
              Marca de Agua
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Agrega marca de agua de audio a tus canciones cada N segundos.
            </p>
          </div>
          <div className="mt-auto w-full flex items-center justify-between">
            <span className="text-xs text-indigo-500 font-medium uppercase tracking-wider">
              Abrir
            </span>
            <span className="text-gray-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
          </div>
          <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 ring-indigo-500/30 transition-all" />
        </Link>
        {/* Ruleta de Premios */}
        <Link
          to="/ruleta"
          className="group relative flex flex-col items-start gap-4 p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-indigo-500 hover:bg-gray-800 transition-all duration-200 text-left shadow-lg hover:shadow-indigo-900/20 hover:shadow-xl"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl group-hover:bg-indigo-600/30 transition-colors">
            🎡
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
              Ruleta de Premios
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Ingresa tu código y gira la ruleta para ganar descuentos y premios de lalala music.
            </p>
          </div>
          <div className="mt-auto w-full flex items-center justify-between">
            <span className="text-xs text-indigo-500 font-medium uppercase tracking-wider">
              Abrir
            </span>
            <span className="text-gray-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
          </div>
          <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 ring-indigo-500/30 transition-all" />
        </Link>

        {/* Avatar Story Creator */}
        <Link
          to="/avatar-story"
          className="group relative flex flex-col items-start gap-4 p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-purple-500 hover:bg-gray-800 transition-all duration-200 text-left shadow-lg hover:shadow-purple-900/20 hover:shadow-xl"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:bg-purple-600/30 transition-colors">
            🎭
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
              Avatar Story Creator
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Sube una foto, ingresa tu historia o canción y genera escenas con avatar + prompts para PixVerse.
            </p>
          </div>
          <div className="mt-auto w-full flex items-center justify-between">
            <span className="text-xs text-purple-500 font-medium uppercase tracking-wider">
              Abrir
            </span>
            <span className="text-gray-600 group-hover:text-purple-400 transition-colors text-lg">→</span>
          </div>
          <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 ring-purple-500/30 transition-all" />
        </Link>

        {/* Biblioteca */}
        <Link
          to="/biblioteca"
          className="group relative flex flex-col items-start gap-4 p-6 rounded-2xl border border-gray-800 bg-gray-900 hover:border-indigo-500 hover:bg-gray-800 transition-all duration-200 text-left shadow-lg hover:shadow-indigo-900/20 hover:shadow-xl"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-2xl group-hover:bg-indigo-600/30 transition-colors">
            📚
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
              Biblioteca
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Busca y descarga canciones entregadas por celular o nombre. Historial completo con fecha y hora.
            </p>
          </div>
          <div className="mt-auto w-full flex items-center justify-between">
            <span className="text-xs text-indigo-500 font-medium uppercase tracking-wider">
              Abrir
            </span>
            <span className="text-gray-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
          </div>
          <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-1 ring-indigo-500/30 transition-all" />
        </Link>
      </div>

      {/* Admin panel for generating codes - más prominente */}
      <div className="w-full max-w-5xl mt-16">
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-pink-900/40 border border-indigo-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">⚙️ Panel Administrativo</h2>
            <p className="text-gray-400">Genera códigos para la Ruleta de Premios</p>
          </div>
          <AdminPanel alwaysOpen={true} />
        </div>
      </div>

      <p className="mt-12 text-xs text-gray-700">© 2026 Creaciones Lalis</p>
    </div>
  )
}
