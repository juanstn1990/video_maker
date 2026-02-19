import { type SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-xs text-gray-400 font-medium">
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...props}
        className={clsx(
          'bg-gray-800 border border-gray-600 text-gray-100 text-sm rounded px-2 py-1.5',
          'focus:outline-none focus:border-indigo-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
