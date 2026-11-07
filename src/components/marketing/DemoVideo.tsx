// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Vidéo de présentation YouTube « AnimaJet, c'est quoi ? »
const YOUTUBE_ID = 'dd4hmO79Z6g'

/**
 * Lecteur YouTube affiché directement (vignette YouTube d'origine, sans illustration par-dessus).
 * loading="lazy" : le lecteur ne se charge qu'à l'approche de la section, la page reste rapide.
 */
export default function DemoVideo() {
  return (
    <div className="relative aspect-video rounded-3xl overflow-hidden border border-[#D4AF37]/25 shadow-[0_20px_60px_rgba(0,0,0,0.5)] bg-black">
      <iframe
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?rel=0&modestbranding=1`}
        title="AnimaJet, c'est quoi ? Jeux interactifs et animations pour DJ, campings et soirées privées"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  )
}
