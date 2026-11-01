// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { TrialWatermarkProvider } from '@/components/TrialWatermark'
import { isTrialCode } from '@/lib/watermark/access'

// Le layout enveloppe tous les écrans de /live (diaporama, lobby, jeux, résultats)
// sans toucher à la page ni aux jeux.
export default async function LiveLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const watermark = await isTrialCode(code)

  return (
    <TrialWatermarkProvider code={code} initial={watermark}>
      {children}
    </TrialWatermarkProvider>
  )
}
