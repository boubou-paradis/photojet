'use client'

import Image from 'next/image'
import { Loader2, ArrowRight, Check, Mail, Play } from 'lucide-react'
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
          src="/hero-animajet-1.jpg"
          alt="AnimaJet — animations interactives pour DJ et professionnels de l'événementiel"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Overlay sombre uniforme : transforme le visuel en ambiance dorée premium
            et garantit la lisibilité du titre, du formulaire et du lien de connexion */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(8,8,14,0.93) 0%, rgba(8,8,14,0.82) 55%, rgba(8,8,14,0.78) 100%)',
          }}
        />
        {/* Vignette douce pour le contraste des bords */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, rgba(8,8,14,0.55) 100%)',
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
                🎧 Développé par un DJ animateur, pour les pros
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.08] tracking-tight">
              Le logiciel d&apos;animation interactive{' '}
              <span className="text-gold-gradient">pour DJ et événements.</span>
            </h1>

            {/* Description */}
            <p className="text-lg lg:text-xl text-gray-300 leading-relaxed max-w-[500px]">
              Quiz, blind test, photos en direct et jeux sur écran géant. Vos invités participent depuis leur téléphone.{' '}
              <span className="text-white font-medium">Sans application.</span>
            </p>

            {/* CTAs principaux */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <a
                href="#essai"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold text-base hover:brightness-110 shadow-[0_4px_24px_rgba(212,175,55,0.3)] transition-all"
              >
                Essayer gratuitement
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="/#video"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/25 bg-white/5 text-white font-semibold text-base hover:bg-white/10 hover:border-white/40 backdrop-blur-sm transition-all"
              >
                <Play className="h-5 w-5 fill-current" />
                Voir la démo
              </a>
            </div>

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
          <div id="essai" className="w-full max-w-[420px] mx-auto lg:mx-0 lg:ml-auto space-y-3 scroll-mt-24">
            {/* Form card — visible to all */}
            <div
              className="rounded-2xl p-6 border border-[#2A2A2E]"
              style={{ background: 'rgba(13,13,15,0.80)', backdropFilter: 'blur(16px)' }}
            >
                <div className="mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 mb-3">
                    <span className="text-[#D4AF37] text-xs font-bold tracking-wide">🎁 24H GRATUITES</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Commencer votre essai gratuit</h3>
                  <p className="text-xs text-[#6B6B70] mt-0.5">Sans carte bancaire — accès 24h en semaine</p>
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
                        24h en semaine
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                        Sans carte bancaire
                      </span>
                    </div>
                  </div>
                )}
            </div>

            {/* Login link — discret */}
            <p className="text-center text-sm text-gray-400">
              Déjà abonné ?{' '}
              <a href="/login" className="text-[#D4AF37] hover:text-[#F4D03F] font-medium transition-colors">
                Se connecter
              </a>
            </p>
          </div>

        </div>
      </div>

      {/* Logo Bretagne — coin bas droit */}
      <div className="absolute bottom-6 right-6 z-20">
        <img src="/images/logo bretagne.png" alt="Logo Bretagne" className="h-24 w-auto object-contain opacity-95" />
      </div>
    </section>
  )
}
