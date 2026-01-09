'use client'

import Image from 'next/image'
import { Loader2, ArrowRight, Check, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HeroV5Props {
  trialEmail: string
  setTrialEmail: (email: string) => void
  trialLoading: boolean
  trialSuccess: boolean
  error: string | null
  setError: (error: string | null) => void
  onTrialRequest: (email: string) => void
  // Optional SEO customization
  headline?: string
  highlightedText?: string
  subtitle?: string
  targets?: string[]
}

// Default values for the main landing page
const defaultTargets = [
  'DJ & animateurs',
  'Événements privés',
  'Bars & restaurants',
  'Campings',
  'Entreprises',
]

export default function HeroV5({
  trialEmail,
  setTrialEmail,
  trialLoading,
  trialSuccess,
  error,
  setError,
  onTrialRequest,
  headline = 'Vos clients participent,',
  highlightedText = 'vos prestations décollent',
  subtitle = 'QR code instantané, écran géant, participation en direct.',
  targets = defaultTargets,
}: HeroV5Props) {
  return (
    <section className="relative min-h-[65vh] flex items-center overflow-hidden content-layer">
      {/* Hero-specific glow - slightly brighter than rest of page */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-[#D4AF37]/[0.03] rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left Column - Text */}
          <div className="hero-fade-in space-y-6">
            {/* Logo - Discreet branding */}
            <div className="w-[200px] lg:w-[240px] opacity-90">
              <Image
                src="/brand/animajet_logo_ultraclean_hero.png"
                alt="AnimaJet"
                width={240}
                height={60}
                className="w-full h-auto"
                priority
              />
            </div>

            {/* Headline - Primary visual focus */}
            <div className="space-y-4">
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white leading-[1.1] tracking-tight">
                {headline}
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]">
                  {highlightedText}
                </span>
              </h1>
              <p className="text-base lg:text-lg text-[#9A9A9F] leading-relaxed max-w-[480px]">
                {subtitle}
                <span className="text-white font-medium"> Sans appli.</span>
              </p>
            </div>

            {/* Value props for PROs */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#7A7A7F]">
              {targets.map((target, index) => (
                <span key={index} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                  {target}
                </span>
              ))}
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="hero-fade-in" style={{ animationDelay: '100ms' }}>
            {/* Trial Form - Conversion focus */}
            <div className="card-float rounded-2xl p-6 border-[#2A2A2E] max-w-[420px] lg:ml-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Essai gratuit 24h</h3>
                  <p className="text-xs text-[#6B6B70] mt-0.5">Accès complet par email (lun → jeu)</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400 uppercase">
                  Gratuit
                </span>
              </div>

              {trialSuccess ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Email envoyé !</p>
                  <p className="text-sm text-gray-500 mt-1">Vérifiez votre boîte de réception</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="votre@email.com"
                      value={trialEmail}
                      onChange={(e) => {
                        setTrialEmail(e.target.value)
                        setError(null)
                      }}
                      className="pl-12 h-13 text-base bg-[#0D0D0F] border-[#2E2E33] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 text-white placeholder:text-gray-600 rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={() => onTrialRequest(trialEmail)}
                    disabled={trialLoading || !trialEmail}
                    className="w-full h-13 text-base bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] hover:brightness-110 text-[#0D0D0F] font-bold rounded-xl shadow-[0_4px_24px_rgba(212,175,55,0.25)] transition-all focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416]"
                  >
                    {trialLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Recevoir mon accès
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                  {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                  )}
                  <div className="flex items-center justify-center gap-4 pt-1 text-xs text-[#6B6B70]">
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                      Sans carte bancaire
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                      Accès immédiat
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
