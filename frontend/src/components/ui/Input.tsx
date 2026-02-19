import { type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs text-gray-400 font-medium">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={clsx(
          'bg-gray-800 border border-gray-600 text-gray-100 text-sm rounded px-2 py-1.5',
          'placeholder:text-gray-500 focus:outline-none focus:border-indigo-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
      />
    </div>
  )
}
