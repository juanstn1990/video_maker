import { useRef } from 'react'
import { clsx } from 'clsx'

interface ColorInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

export function ColorInput({ label, value, onChange, className }: ColorInputProps) {
  const colorRef = useRef<HTMLInputElement>(null)
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <span className="text-xs text-gray-400 font-medium">{label}</span>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => colorRef.current?.click()}
          className="w-7 h-7 rounded border border-gray-600 flex-shrink-0 cursor-pointer"
          style={{ backgroundColor: value }}
        />
        <input
          ref={colorRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="bg-gray-800 border border-gray-600 text-gray-100 text-xs rounded px-2 py-1 w-24 font-mono focus:outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  )
}
