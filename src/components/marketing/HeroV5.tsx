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
  isAdmin?: boolean
  // Optional props kept for compatibility with SEOLandingPage
  headline?: string
  highlightedText?: string
  subtitle?: string
  targets?: string[]
}

const targets = [
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
  isAdmin = false,
}: HeroV5Props) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-animajet.png"
          alt="AnimaJet hero"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Gradient overlay: dark on left for readability, lighter on right */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(10,10,20,0.88) 0%, rgba(10,10,20,0.65) 55%, rgba(10,10,20,0.35) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 pt-28">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">

          {/* Left column — text */}
          <div className="space-y-6">
            {/* Logo */}
            <div className="w-[200px] lg:w-[240px]">
              <Image
                src="/brand/animajet_logo_ultraclean_hero.png"
                alt="AnimaJet"
                width={240}
                height={60}
                className="w-full h-auto"
                priority
              />
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/10 backdrop-blur-sm">
              <span className="text-[#D4AF37] text-sm font-semibold tracking-wide">
                ⚡ L&apos;arme ultime des DJ &amp; animateurs
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.08] tracking-tight">
              En 2 minutes,<br />
              vos invités participent.
            </h1>

            {/* Subtitle in gold */}
            <p className="text-2xl lg:text-3xl font-bold text-[#D4AF37]">
              Vous animez. Ils s&apos;en souviennent.
            </p>

            {/* Description */}
            <p className="text-lg text-gray-300 leading-relaxed max-w-[480px]">
              QR code instantané, écran géant, jeux interactifs.{' '}
              <span className="text-white font-medium">Sans appli.</span>
            </p>

            {/* Target audience */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#9A9A9F]">
              {targets.map((target) => (
                <span key={target} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[#D4AF37] flex-shrink-0" />
                  {target}
                </span>
              ))}
            </div>
          </div>

          {/* Right column — login + form */}
          <div className="w-full max-w-[420px] mx-auto lg:mx-0 lg:ml-auto space-y-3">
            {/* Login link */}
            <a
              href="/login"
              className="flex items-center justify-center gap-2 font-bold transition-all px-6 py-3 text-sm text-[#D4AF37] hover:text-[#F4D03F] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 rounded-xl border border-[#D4AF37]/30 backdrop-blur-sm"
            >
              Déjà abonné ? Se connecter
              <ArrowRight className="h-4 w-4" />
            </a>

            {/* Form card — visible to all */}
            <div
              className="rounded-2xl p-6 border border-[#2A2A2E]"
              style={{ background: 'rgba(13,13,15,0.80)', backdropFilter: 'blur(16px)' }}
            >
                <div className="mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 mb-3">
                    <span className="text-[#D4AF37] text-xs font-bold tracking-wide">🎁 7 JOURS GRATUITS</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Commencer votre essai gratuit</h3>
                  <p className="text-xs text-[#6B6B70] mt-0.5">Sans carte bancaire — accès complet immédiat</p>
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
                        name="hero-trial-email"
                        autoComplete="off"
                        placeholder="votre@email.com"
                        value={trialEmail}
                        onChange={(e) => {
                          setTrialEmail(e.target.value)
                          setError(null)
                        }}
                        className="pl-12 h-12 text-base bg-[#0D0D0F] border-[#2E2E33] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 text-white placeholder:text-gray-600 rounded-xl"
                      />
                    </div>

                    <Button
                      onClick={() => onTrialRequest(trialEmail)}
                      disabled={trialLoading || !trialEmail}
                      className="w-full h-12 text-base bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] hover:brightness-110 text-[#0D0D0F] font-bold rounded-xl shadow-[0_4px_24px_rgba(212,175,55,0.25)] transition-all"
                    >
                      {trialLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Découvrir AnimaJet
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
                        7 jours offerts
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                        Sans carte bancaire
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
