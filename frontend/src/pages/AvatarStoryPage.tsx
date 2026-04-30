import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

interface AvatarScene {
  id: string
  number: number
  title: string
  narrative: string
  scenePrompt: string
  pixversePrompt: string
  detectedPersons: string[]
  generatedImageUrl?: string
  generating?: boolean
  generateError?: string
  generatedVideoUrl?: string
  generatingVideo?: boolean
  videoError?: string
}

interface PersonState {
  file: File | null
  preview: string | null
  avatarUrl: string | null
  uploading: boolean
  error: string
}

type Step = 1 | 2 | 3

export function AvatarStoryPage() {
  // Step 1
  const [step, setStep] = useState<Step>(1)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoId, setPhotoId] = useState<string>('')
  const [avatarDescription, setAvatarDescription] = useState('')
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Step 2
  const [storyText, setStoryText] = useState('')
  const [sceneCount, setSceneCount] = useState(5)
  const [generatingScenes, setGeneratingScenes] = useState(false)
  const [scenesError, setScenesError] = useState('')

  // Step 3
  const [scenes, setScenes] = useState<AvatarScene[]>([])
  const [personStates, setPersonStates] = useState<Record<string, PersonState>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // All unique persons required across all scenes
  const requiredPersons = Array.from(
    new Set(scenes.flatMap((s) => s.detectedPersons ?? []))
  )

  const handlePhotoChange = (file: File) => {
    setPhotoFile(file)
    setPhotoId('')
    setAvatarDescription('')
    setAvatarImageUrl(null)
    setAnalyzeError('')
    const reader = new FileReader()
    reader.onload = (e) => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handlePhotoChange(file)
  }, [])

  const analyzeAvatar = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setAnalyzeError('')
    setAvatarImageUrl(null)
    try {
      const form = new FormData()
      form.append('image', photoFile)
      const res = await fetch('/api/avatar/analyze', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al analizar')
      setAvatarDescription(data.avatarDescription)
      setAvatarImageUrl(data.avatarImageUrl)
      setPhotoId(data.photoId)
    } catch (err: any) {
      setAnalyzeError(err.message ?? 'Error inesperado')
    } finally {
      setAnalyzing(false)
    }
  }

  const generateScenes = async () => {
    if (!storyText.trim() || !avatarDescription) return
    setGeneratingScenes(true)
    setScenesError('')
    try {
      const res = await fetch('/api/avatar/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyText, sceneCount, avatarDescription }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar escenas')
      const scenes = (data.scenes as AvatarScene[]).map((s) => ({
        ...s,
        detectedPersons: s.detectedPersons ?? [],
      }))
      setScenes(scenes)
      // Init person states for newly detected persons
      const persons = Array.from(new Set(scenes.flatMap((s) => s.detectedPersons)))
      setPersonStates((prev) => {
        const next = { ...prev }
        for (const p of persons) {
          if (!next[p]) next[p] = { file: null, preview: null, avatarUrl: null, uploading: false, error: '' }
        }
        return next
      })
      setStep(3)
    } catch (err: any) {
      setScenesError(err.message ?? 'Error inesperado')
    } finally {
      setGeneratingScenes(false)
    }
  }

  const handlePersonPhoto = async (name: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) =>
      setPersonStates((prev) => ({
        ...prev,
        [name]: { ...prev[name], file, preview: e.target?.result as string, error: '' },
      }))
    reader.readAsDataURL(file)

    setPersonStates((prev) => ({ ...prev, [name]: { ...prev[name], file, uploading: true, error: '' } }))
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('name', name)
      form.append('mainPhotoId', photoId)
      const res = await fetch('/api/avatar/person-photo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      setPersonStates((prev) => ({
        ...prev,
        [name]: { ...prev[name], avatarUrl: data.personAvatarUrl, uploading: false },
      }))
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch' || err.message === 'fetch failed'
        ? 'Error de red. Intenta de nuevo.'
        : (err.message ?? 'Error')
      setPersonStates((prev) => ({
        ...prev,
        [name]: { ...prev[name], uploading: false, error: msg },
      }))
    }
  }

  const sceneCanGenerate = (scene: AvatarScene) => {
    const missing = (scene.detectedPersons ?? []).filter(
      (p) => !personStates[p]?.avatarUrl,
    )
    return missing.length === 0
  }

  const generateImage = async (scene: AvatarScene) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, generating: true, generateError: undefined } : s)),
    )
    try {
      const readyPersons = (scene.detectedPersons ?? []).filter(
        (p) => personStates[p]?.avatarUrl,
      )
      const res = await fetch('/api/avatar/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarDescription,
          scenePrompt: scene.scenePrompt,
          sceneId: scene.id,
          photoId,
          extraPersonNames: readyPersons,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar imagen')
      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id ? { ...s, generatedImageUrl: data.imageUrl, generating: false } : s,
        ),
      )
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id ? { ...s, generating: false, generateError: err.message ?? 'Error' } : s,
        ),
      )
    }
  }

  const generateAllImages = () => {
    scenes
      .filter((s) => !s.generatedImageUrl && !s.generating && sceneCanGenerate(s))
      .forEach(generateImage)
  }

  const generateVideo = async (scene: AvatarScene) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, generatingVideo: true, videoError: undefined } : s)),
    )
    try {
      const res = await fetch('/api/avatar/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixversePrompt: scene.pixversePrompt, sceneId: scene.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al generar video')
      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id ? { ...s, generatedVideoUrl: data.videoUrl, generatingVideo: false } : s,
        ),
      )
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id ? { ...s, generatingVideo: false, videoError: err.message ?? 'Error' } : s,
        ),
      )
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div
      className="min-h-screen bg-gray-950 text-white"
      style={{ background: 'radial-gradient(ellipse at top, #2d1b4b 0%, #0a0a0f 60%)' }}
    >
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          ← Inicio
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-lg">
            🎭
          </div>
          <h1 className="text-lg font-semibold">Avatar Story Creator</h1>
          <span className="text-xs text-purple-400 bg-purple-900/30 border border-purple-700/40 px-2 py-0.5 rounded-full">
            Dibujo animado
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="max-w-3xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s === 1) setStep(1)
                  if (s === 2 && photoId) setStep(2)
                  if (s === 3 && scenes.length > 0) setStep(3)
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  step === s
                    ? 'bg-purple-600 text-white'
                    : s < step
                    ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60 cursor-pointer'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? 'bg-white/20' : s < step ? 'bg-purple-500/40' : 'bg-gray-700'
                  }`}
                >
                  {s < step ? '✓' : s}
                </span>
                {s === 1 ? 'Avatar' : s === 2 ? 'Historia' : 'Escenas'}
              </button>
              {s < 3 && <div className="w-8 h-px bg-gray-700" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16">

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Sube una foto del personaje principal</h2>
              <p className="text-gray-400 text-sm">
                Grok transformará la foto en un avatar{' '}
                <span className="text-yellow-400 font-medium">dibujo animado Disney</span>. Ese avatar se
                reutilizará en cada escena para mantener consistencia visual.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Foto original</p>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => photoInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-56 bg-gray-900/50"
                >
                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={photoPreview} alt="Foto original" className="max-h-52 rounded-xl object-contain shadow-lg" />
                      <p className="text-gray-600 text-xs">Clic para cambiar</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-4xl">📷</div>
                      <p className="text-gray-400 text-sm text-center">Arrastra o haz clic para seleccionar</p>
                      <p className="text-gray-600 text-xs">JPG, PNG, WEBP — máx. 15 MB</p>
                    </>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoChange(f) }}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Avatar dibujo animado</p>
                <div className="border-2 border-purple-700/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 min-h-56 bg-purple-900/10">
                  {analyzing ? (
                    <>
                      <span className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      <p className="text-purple-400 text-sm text-center">Generando avatar...</p>
                      <p className="text-gray-600 text-xs">puede tardar 30-60 seg</p>
                    </>
                  ) : avatarImageUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={avatarImageUrl} alt="Avatar" className="w-52 h-52 rounded-xl object-cover shadow-lg ring-2 ring-purple-500/40" />
                      <p className="text-purple-400 text-xs font-medium">✓ Avatar listo</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-4xl opacity-30">🎭</div>
                      <p className="text-gray-600 text-sm text-center">El avatar aparecerá aquí</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {analyzeError && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">{analyzeError}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={analyzeAvatar}
                disabled={!photoFile || analyzing}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-colors"
              >
                {analyzing ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generando avatar...</>
                ) : avatarImageUrl ? 'Regenerar avatar' : 'Generar avatar dibujo animado'}
              </button>
              {avatarImageUrl && (
                <button onClick={() => setStep(2)} className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium text-sm transition-colors">
                  Continuar →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Historia o canción</h2>
              <p className="text-gray-400 text-sm">
                GPT-4o dividirá el texto en escenas. Si el texto menciona personas por nombre (papá, mamá, abuela…)
                podrás subir sus fotos para que{' '}
                <span className="text-yellow-400 font-medium">aparezcan como personajes animados</span>.
              </p>
            </div>

            {avatarImageUrl && (
              <div className="bg-gray-900/60 border border-purple-700/40 rounded-2xl p-5 flex gap-5 items-start">
                <img src={avatarImageUrl} alt="Avatar" className="w-24 h-24 rounded-xl object-cover ring-2 ring-purple-500/50 flex-shrink-0 shadow-lg" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Avatar principal</span>
                    <span className="text-xs text-green-400 bg-green-900/30 border border-green-700/40 px-2 py-0.5 rounded-full">✓ listo</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed italic">"{avatarDescription}"</p>
                  <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-purple-400 transition-colors">
                    ← Cambiar foto / regenerar avatar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">Texto de la historia o letra</label>
              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Pega aquí la letra de la canción o escribe la historia..."
                rows={10}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 text-sm resize-none focus:outline-none focus:border-purple-500 placeholder-gray-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-medium">
                Número de escenas: <span className="text-purple-400 font-bold">{sceneCount}</span>
              </label>
              <div className="flex items-center gap-4">
                <input type="range" min={2} max={15} value={sceneCount} onChange={(e) => setSceneCount(Number(e.target.value))} className="flex-1 accent-purple-500" />
                <span className="text-gray-400 text-sm w-16 text-center">{sceneCount} escenas</span>
              </div>
            </div>

            {scenesError && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-300 text-sm">{scenesError}</div>
            )}

            <button
              onClick={generateScenes}
              disabled={!storyText.trim() || generatingScenes}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-colors"
            >
              {generatingScenes ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generando escenas...</>
              ) : `Generar ${sceneCount} escenas`}
            </button>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && scenes.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold mb-1">{scenes.length} escenas listas</h2>
                <p className="text-gray-400 text-sm">
                  {requiredPersons.length > 0
                    ? 'Sube las fotos de los personajes detectados y luego genera las imágenes.'
                    : 'Genera las imágenes — el avatar se usa como referencia en cada escena.'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {avatarImageUrl && (
                  <img src={avatarImageUrl} alt="Avatar" className="w-8 h-8 rounded-lg object-cover ring-2 ring-purple-500/40" />
                )}
                <button
                  onClick={generateAllImages}
                  disabled={scenes.every((s) => s.generatedImageUrl || s.generating || !sceneCanGenerate(s))}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-colors"
                >
                  Generar todas
                </button>
                <button
                  onClick={() => scenes.filter((s) => s.generatedImageUrl).forEach((s, i) => {
                    setTimeout(() => downloadFile(s.generatedImageUrl!, `escena_${s.number}_imagen.png`), i * 300)
                  })}
                  disabled={scenes.every((s) => !s.generatedImageUrl)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium text-sm transition-colors"
                >
                  ⬇ Descargar todas
                </button>
              </div>
            </div>

            {/* Person photo upload slots */}
            {requiredPersons.length > 0 && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-sm font-semibold">👥 Personajes detectados en la historia</span>
                </div>
                <p className="text-amber-200/70 text-xs">
                  Sube una foto de cada persona para que Grok cree su avatar animado y lo incluya en las escenas correspondientes.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {requiredPersons.map((name) => {
                    const ps = personStates[name] ?? { file: null, preview: null, avatarUrl: null, uploading: false, error: '' }
                    return (
                      <PersonPhotoSlot
                        key={name}
                        name={name}
                        state={ps}
                        onFile={(file) => handlePersonPhoto(name, file)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-5">
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  personStates={personStates}
                  canGenerate={sceneCanGenerate(scene)}
                  copiedId={copiedId}
                  onGenerateImage={() => generateImage(scene)}
                  onGenerateVideo={() => generateVideo(scene)}
                  onCopy={copyToClipboard}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Person photo upload slot ─────────────────────────────────────────────────

function PersonPhotoSlot({
  name,
  state,
  onFile,
}: {
  name: string
  state: PersonState
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">{label}</p>
      <div
        onClick={() => !state.uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors min-h-36 ${
          state.avatarUrl
            ? 'border-green-600/50 bg-green-900/10'
            : state.uploading
            ? 'border-amber-600/40 bg-amber-900/10 cursor-not-allowed'
            : 'border-amber-700/40 hover:border-amber-500 bg-amber-900/10'
        }`}
      >
        {state.uploading ? (
          <>
            <span className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-xs text-amber-400">Creando avatar...</span>
          </>
        ) : state.avatarUrl ? (
          <div className="flex flex-col items-center gap-1">
            <img src={state.avatarUrl} alt={name} className="w-28 h-28 rounded-lg object-cover ring-2 ring-green-500/40" />
            <span className="text-xs text-green-400 font-medium">✓ listo</span>
          </div>
        ) : state.preview ? (
          <div className="flex flex-col items-center gap-1">
            <img src={state.preview} alt={name} className="w-28 h-28 rounded-lg object-cover opacity-50" />
            <span className="text-xs text-amber-400">Procesando...</span>
          </div>
        ) : (
          <>
            <div className="text-3xl opacity-50">📷</div>
            <span className="text-xs text-amber-300/60 text-center">Foto de {label}</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      </div>
      {state.error && (
        <div className="space-y-1">
          <p className="text-xs text-red-400">{state.error}</p>
          {state.file && (
            <button
              onClick={() => onFile(state.file!)}
              className="text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Scene card ───────────────────────────────────────────────────────────────

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function SceneCard({
  scene,
  personStates,
  canGenerate,
  copiedId,
  onGenerateImage,
  onGenerateVideo,
  onCopy,
}: {
  scene: AvatarScene
  personStates: Record<string, PersonState>
  canGenerate: boolean
  copiedId: string | null
  onGenerateImage: () => void
  onGenerateVideo: () => void
  onCopy: (text: string, id: string) => void
}) {
  const [showScenePrompt, setShowScenePrompt] = useState(false)
  const missingPersons = (scene.detectedPersons ?? []).filter((p) => !personStates[p]?.avatarUrl)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
        <span className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">
          {scene.number}
        </span>
        <h3 className="font-semibold text-white">{scene.title}</h3>
        {scene.detectedPersons?.length > 0 && (
          <div className="ml-auto flex items-center gap-1">
            {scene.detectedPersons.map((p) => (
              <span
                key={p}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  personStates[p]?.avatarUrl
                    ? 'text-green-400 bg-green-900/20 border-green-700/40'
                    : 'text-amber-400 bg-amber-900/20 border-amber-700/40'
                }`}
              >
                {personStates[p]?.avatarUrl ? '✓' : '⏳'} {p}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-gray-400 text-sm leading-relaxed">{scene.narrative}</p>

        {missingPersons.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-300 text-xs">
            Sube la foto de <strong>{missingPersons.join(', ')}</strong> para generar esta escena.
          </div>
        )}

        {/* Image area */}
        {scene.generatedImageUrl ? (
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-square">
              <img src={scene.generatedImageUrl} alt={scene.title} className="absolute inset-0 w-full h-full object-cover" />
              <button
                onClick={onGenerateImage}
                className="absolute top-2 right-2 px-3 py-1 bg-black/60 hover:bg-black/80 rounded-lg text-xs text-gray-300 transition-colors backdrop-blur-sm"
              >
                Regenerar
              </button>
            </div>
            {/* Image actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadFile(scene.generatedImageUrl!, `escena_${scene.number}_imagen.png`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors font-medium"
              >
                ⬇ Imagen
              </button>
              {!scene.generatedVideoUrl && (
                <button
                  onClick={onGenerateVideo}
                  disabled={scene.generatingVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs text-white transition-colors font-medium"
                >
                  {scene.generatingVideo ? (
                    <>
                      <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      Generando video... (2-4 min)
                    </>
                  ) : (
                    '▶ Generar video 7s'
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={onGenerateImage}
            disabled={scene.generating || !canGenerate}
            className="w-full h-44 border-2 border-dashed border-gray-700 hover:border-purple-500 disabled:border-gray-700 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors group disabled:cursor-not-allowed"
          >
            {scene.generating ? (
              <>
                <span className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Generando con Grok...</span>
                <span className="text-xs text-gray-600">puede tardar 20-40 segundos</span>
              </>
            ) : !canGenerate ? (
              <>
                <span className="text-4xl opacity-30">🔒</span>
                <span className="text-sm text-gray-600">Esperando fotos de personajes</span>
              </>
            ) : (
              <>
                <span className="text-4xl group-hover:scale-110 transition-transform">🎨</span>
                <span className="text-sm text-gray-500 group-hover:text-purple-400 transition-colors font-medium">
                  Generar imagen de escena
                </span>
                {scene.detectedPersons?.length > 0 && (
                  <span className="text-xs text-amber-400/70">incluye {scene.detectedPersons.join(' + ')}</span>
                )}
              </>
            )}
          </button>
        )}

        {scene.generateError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-300 text-xs">
            {scene.generateError}
          </div>
        )}

        {/* Video area */}
        {scene.generatedVideoUrl && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Video generado</p>
            <div className="rounded-xl overflow-hidden bg-black">
              <video
                src={scene.generatedVideoUrl}
                controls
                loop
                className="w-full rounded-xl"
                style={{ maxHeight: '500px' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadFile(scene.generatedVideoUrl!, `escena_${scene.number}_video.mp4`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded-lg text-xs text-white transition-colors font-medium"
              >
                ⬇ Descargar video
              </button>
              <button
                onClick={onGenerateVideo}
                disabled={scene.generatingVideo}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-xs text-gray-300 transition-colors"
              >
                {scene.generatingVideo ? (
                  <>
                    <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  'Regenerar video'
                )}
              </button>
            </div>
          </div>
        )}

        {scene.videoError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-300 text-xs">
            Video: {scene.videoError}
          </div>
        )}

        {/* Prompts */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Prompt video (xAI)</span>
            <button
              onClick={() => onCopy(scene.pixversePrompt, `pv-${scene.id}`)}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-xs text-blue-300 transition-colors font-medium"
            >
              {copiedId === `pv-${scene.id}` ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed font-mono whitespace-pre-wrap">{scene.pixversePrompt}</p>
        </div>

        <div>
          <button
            onClick={() => setShowScenePrompt((v) => !v)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            {showScenePrompt ? '▲' : '▼'} Prompt de imagen (Grok)
          </button>
          {showScenePrompt && (
            <div className="mt-2 bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-2">
              <button
                onClick={() => onCopy(scene.scenePrompt, `scene-${scene.id}`)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {copiedId === `scene-${scene.id}` ? '✓ Copiado' : 'Copiar prompt'}
              </button>
              <p className="text-gray-500 text-xs leading-relaxed font-mono">{scene.scenePrompt}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
