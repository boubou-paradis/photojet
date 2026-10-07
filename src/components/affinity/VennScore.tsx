// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Deux cercles dont le chevauchement suit le pourcentage de points communs.
// Même dessin pour deux scores égaux : aucun rang suggéré.

interface VennScoreProps {
  /** 0 à 100. `null` : cercles séparés (aucun point commun affichable). */
  score: number | null
  width?: number
}

export default function VennScore({ score, width = 58 }: VennScoreProps) {
  const height = Math.round(width * 0.69)
  const r = height * 0.38
  const cx = width / 2
  const cy = height / 2
  const distance = score === null ? 2.2 * r : 2 * r * (1 - (score / 100) * 0.75)
  const x1 = cx - distance / 2
  const x2 = cx + distance / 2
  const clipId = `venn-${score ?? 'none'}-${width}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="flex-none">
      <defs>
        <clipPath id={clipId}>
          <circle cx={x1} cy={cy} r={r} />
        </clipPath>
      </defs>
      {score !== null && <circle cx={x2} cy={cy} r={r} fill="#D4AF37" opacity={0.85} clipPath={`url(#${clipId})`} />}
      <circle cx={x1} cy={cy} r={r} fill="none" stroke="#D4AF37" strokeWidth={2.5} />
      <circle cx={x2} cy={cy} r={r} fill="none" stroke="#8B5CF6" strokeWidth={2.5} />
    </svg>
  )
}
