'use client'

import { useState, useEffect } from 'react'

// Values pre-encoded as reversed char codes - no plain text in bundle
// To update: run encodeContact('value') in browser console
function decodeContact(encoded: string): string {
  return encoded
    .split('-')
    .reverse()
    .map((code) => String.fromCharCode(Number(code)))
    .join('')
}

// Pre-encoded (no plain text strings in source)
const ENCODED = {
  // animajet3@gmail.com
  email: '109-111-99-46-108-105-97-109-103-64-51-116-101-106-97-109-105-110-97',
  // 06 48 10 61 66
  phone: '54-54-32-49-54-32-48-49-32-56-52-32-54-48',
  // 499 112 308 00030
  siret: '48-51-48-48-48-32-56-48-51-32-50-49-49-32-57-57-52',
}

interface ProtectedContactProps {
  type: 'email' | 'phone' | 'siret'
  showLabel?: boolean
  label?: string
  className?: string
  linkClassName?: string
}

export default function ProtectedContact({
  type,
  showLabel = true,
  label,
  className = '',
  linkClassName = 'text-[#D4AF37] hover:underline',
}: ProtectedContactProps) {
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    // Decode only on client-side, after mount
    // Small delay to further defeat bots that execute JS immediately
    const t = setTimeout(() => {
      setValue(decodeContact(ENCODED[type]))
    }, 100)
    return () => clearTimeout(t)
  }, [type])

  const defaultLabels = {
    email: 'Email',
    phone: 'Téléphone',
    siret: 'SIRET',
  }

  const displayLabel = label ?? defaultLabels[type]

  if (!value) {
    return (
      <span className={className}>
        {showLabel && `${displayLabel} : `}
        <span className="text-gray-500">Chargement...</span>
      </span>
    )
  }

  if (type === 'email') {
    return (
      <span className={className}>
        {showLabel && `${displayLabel} : `}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            window.location.href = `mailto:${value}`
          }}
          className={linkClassName}
        >
          {value}
        </a>
      </span>
    )
  }

  if (type === 'phone') {
    return (
      <span className={className}>
        {showLabel && `${displayLabel} : `}
        <span>{value}</span>
      </span>
    )
  }

  // siret
  return (
    <span className={className}>
      {showLabel && `${displayLabel} : `}
      <span>{value}</span>
    </span>
  )
}

// Inline version for use inside <p> tags - just the value, no wrapper
export function ProtectedEmail({ linkClassName = 'text-[#D4AF37] hover:underline' }: { linkClassName?: string }) {
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setValue(decodeContact(ENCODED.email)), 100)
    return () => clearTimeout(t)
  }, [])

  if (!value) return <span className="text-gray-500">...</span>

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        window.location.href = `mailto:${value}`
      }}
      className={linkClassName}
    >
      {value}
    </a>
  )
}
