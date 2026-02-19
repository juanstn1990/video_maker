import { type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  displayValue?: string | number
}

export function Slider({ label, displayValue, className, id, ...props }: SliderProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex justify-between items-center">
          <label htmlFor={inputId} className="text-xs text-gray-400 font-medium">
            {label}
          </label>
          {displayValue !== undefined && (
            <span className="text-xs text-gray-300 tabular-nums">{displayValue}</span>
          )}
        </div>
      )}
      <input
        id={inputId}
        type="range"
        {...props}
        className={clsx(
          'w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer',
          'accent-indigo-500',
          className,
        )}
      />
    </div>
  )
}
