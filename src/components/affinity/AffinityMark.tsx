// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Signature visuelle de Matching : deux cercles qui se chevauchent (or et
// violet). La zone commune, c'est le point commun.

interface AffinityMarkProps {
  /** Hauteur en px ; la largeur suit. */
  size?: number
  className?: string
}

export default function AffinityMark({ size = 16, className }: AffinityMarkProps) {
  const stroke = Math.max(1.5, size / 8)
  const r = size / 2 - stroke / 2
  return (
    <svg width={size * 1.6} height={size} viewBox={`0 0 ${size * 1.6} ${size}`} className={className} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D4AF37" strokeWidth={stroke} />
      <circle cx={size * 1.1} cy={size / 2} r={r} fill="none" stroke="#8B5CF6" strokeWidth={stroke} />
    </svg>
  )
}
