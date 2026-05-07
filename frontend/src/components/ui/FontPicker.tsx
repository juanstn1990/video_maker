import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useFontAtlas } from '../../fonts/use-font-atlas'
import { loadFullFont } from '../../fonts/google-fonts'
import { SYSTEM_FONTS } from '../../fonts/system-fonts'
import type { FontAtlasEntry } from '../../fonts/types'

const ROW_HEIGHT = 40
const PREVIEW_SCALE = 0.8
const LIST_HEIGHT = 280
const OVERSCAN = 10

interface FontPickerProps {
  value: string
  onChange: (fontFamily: string) => void
  label?: string
}

export function FontPicker({ value, onChange, label }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { atlas, status, fontNames, retry } = useFontAtlas({ open })

  const filteredFonts = useMemo(() => {
    if (!search) return fontNames
    const q = search.toLowerCase()
    return fontNames.filter((n) => n.toLowerCase().includes(q))
  }, [fontNames, search])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setScrollTop(0)
      return
    }
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = useCallback(
    async (family: string) => {
      if (!SYSTEM_FONTS.has(family)) {
        try {
          await loadFullFont({ family })
        } catch {
          // ignore, fall back to system default
        }
      }
      onChange(family)
      setOpen(false)
    },
    [onChange],
  )

  // Virtualization math
  const totalHeight = filteredFonts.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(
    filteredFonts.length - 1,
    Math.ceil((scrollTop + LIST_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
  )

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-xs text-gray-400 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
      >
        <span className="truncate" style={{ fontFamily: value }}>
          {value || 'Seleccionar fuente'}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar fuente..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setScrollTop(0)
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>

          {status === 'loading' && (
            <div className="py-8 text-center text-sm text-gray-400">Cargando fuentes…</div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-gray-400 text-center">Error al cargar previews.</p>
              <button
                onClick={retry}
                className="text-xs px-3 py-1.5 border border-gray-600 rounded hover:bg-gray-800"
              >
                Reintentar
              </button>
            </div>
          )}

          {status === 'idle' && filteredFonts.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              No se encontraron fuentes.
            </div>
          )}

          {status === 'idle' && atlas && filteredFonts.length > 0 && (
            <div
              style={{ height: LIST_HEIGHT, overflowY: 'auto' }}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            >
              <div style={{ height: totalHeight, position: 'relative' }}>
                {Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
                  const idx = startIndex + i
                  const fontName = filteredFonts[idx]
                  if (!fontName) return null
                  const entry = atlas.fonts[fontName]
                  const isSelected = fontName === value
                  const isSystem = SYSTEM_FONTS.has(fontName)

                  return (
                    <button
                      key={fontName}
                      type="button"
                      onClick={() => handleSelect(fontName)}
                      style={{
                        position: 'absolute',
                        top: idx * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: ROW_HEIGHT,
                      }}
                      className={`flex items-center px-3 w-full cursor-pointer transition-colors ${
                        isSelected ? 'bg-gray-700' : 'hover:bg-gray-800'
                      }`}
                    >
                      <div className="overflow-hidden min-w-0 flex items-center">
                        {isSystem ? (
                          <span
                            className="text-xl text-white/85"
                            style={{ fontFamily: fontName }}
                          >
                            {fontName}
                          </span>
                        ) : entry ? (
                          <FontSpritePreview entry={entry} />
                        ) : (
                          <span className="text-sm text-white/70">{fontName}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FontSpritePreview({ entry }: { entry: FontAtlasEntry }) {
  return (
    <div
      className="shrink-0"
      style={{
        width: entry.w * PREVIEW_SCALE,
        height: ROW_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: entry.w,
          height: ROW_HEIGHT,
          backgroundColor: 'white',
          WebkitMaskImage: `url(/fonts/font-chunk-${entry.ch}.avif)`,
          WebkitMaskPosition: `-${entry.x}px -${entry.y}px`,
          WebkitMaskRepeat: 'no-repeat',
          maskImage: `url(/fonts/font-chunk-${entry.ch}.avif)`,
          maskPosition: `-${entry.x}px -${entry.y}px`,
          maskRepeat: 'no-repeat',
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: 'left center',
        }}
      />
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg
      className="size-3.5 opacity-50 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.5 10.5L13.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
