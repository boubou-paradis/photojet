// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { isTrialCode } from '@/lib/watermark/access'

export default async function InviteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const watermark = await isTrialCode(code)

  return (
    <>
      {watermark && (
        <div className="text-center py-1 px-2 bg-[#D4AF37]/10 text-[#D4AF37] text-xs border-b border-[#D4AF37]/25">
          Version d&apos;essai AnimaJet
        </div>
      )}
      {children}
    </>
  )
}
