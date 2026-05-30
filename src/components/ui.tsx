import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'merge' | 'danger' | 'ghost'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white border-transparent hover:brightness-110 active:brightness-95',
  secondary: 'bg-panel-2 hover:bg-edge text-gray-100 border-edge',
  merge: 'bg-merge text-white border-transparent hover:brightness-110 active:brightness-95',
  danger: 'bg-removed hover:brightness-110 text-white border-transparent',
  ghost: 'bg-transparent hover:bg-panel-2 text-gray-300 border-transparent',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Input({ className = '', label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-300">{label}</span>}
      <input
        className={`w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-gray-100 placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...rest}
      />
    </label>
  )
}

export function Textarea({ className = '', label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-300">{label}</span>}
      <textarea
        className={`w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-gray-100 placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...rest}
      />
    </label>
  )
}

export function Select({ className = '', label, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-gray-300">{label}</span>}
      <select
        className={`w-full rounded-md border border-edge bg-ink px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-edge bg-panel p-5 shadow-card ${className}`}>{children}</div>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-edge px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

export function GitBranchIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  )
}
