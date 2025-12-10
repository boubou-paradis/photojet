'use client'

import { PhotoJetLoader } from '@/components/branding/PhotoJetLogo'

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
      <div className="relative z-10">
        <PhotoJetLoader size={80} />
      </div>
    </div>
  )
}
