import { ReactNode } from 'react'

interface SegmentControlProps<T extends string> {
    options: T[]
    value: T
    onChange: (val: T) => void
}

export function SegmentControl<T extends string>({ options, value, onChange }: SegmentControlProps<T>) {
    return (
        <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700 w-full overflow-hidden">
            {options.map((opt) => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={`flex-1 text-sm py-1.5 px-2 rounded-sm transition-all duration-200 ${value === opt
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                        }`}
                >
                    {opt}
                </button>
            ))}
        </div>
    )
}

interface FormRowProps {
    label?: string
    children: ReactNode
}

export function FormRow({ label, children }: FormRowProps) {
    return (
        <div className="flex flex-col gap-2">
            {label && <label className="text-sm font-semibold text-gray-300 tracking-wide">{label}</label>}
            {children}
        </div>
    )
}

// --- 추가 UI 컴포넌트 ---

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: { label: string; value: string }[]
}

export function Select({ options, className = '', ...props }: SelectProps) {
    const isPlaceholder = props.value === '';
    return (
        <div className="relative w-full">
            <select
                className={`appearance-none bg-gray-800 border border-gray-700 rounded-md pl-3 pr-10 py-2 text-sm outline-none cursor-pointer focus:border-blue-500 transition-colors w-full ${isPlaceholder ? 'text-gray-500' : 'text-gray-200'} ${className}`}
                {...props}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    )
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className = '', ...props }: InputProps) {
    return (
        <input
            className={`bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm outline-none text-gray-200 placeholder-gray-500 focus:border-blue-500 transition-colors w-full ${className}`}
            {...props}
        />
    )
}

interface ToggleSwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
    return (
        <label className="flex items-center cursor-pointer select-none space-x-2">
            {label && <span className="text-sm text-gray-400">{label}</span>}
            <div className="relative">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only"
                />
                <div
                    className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-700'
                        }`}
                />
                <div
                    className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${checked ? 'translate-x-4' : ''
                        }`}
                />
            </div>
        </label>
    )
}
