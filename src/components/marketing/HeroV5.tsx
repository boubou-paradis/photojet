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
}

export default function HeroV5({
  trialEmail,
  setTrialEmail,
  trialLoading,
  trialSuccess,
  error,
  setError,
  onTrialRequest,
}: HeroV5Props) {
  return (
    <section className="relative min-h-[82vh] flex items-center overflow-hidden">
      {/* Background - Clean, minimal */}
      <div className="absolute inset-0 bg-[#0D0D0F]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,26,30,1)_0%,rgba(13,13,15,1)_100%)]" />
        {/* Subtle gold accent - very discreet */}
        <div className="absolute top-1/3 left-1/3 w-[600px] h-[600px] bg-[#D4AF37]/[0.02] rounded-full blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[1fr,0.85fr] gap-16 lg:gap-20 items-center">

          {/* Left Column - Primary focus */}
          <div className="hero-fade-in space-y-8">
            {/* Logo - Discreet branding */}
            <div className="w-[180px] lg:w-[200px] opacity-90">
              <Image
                src="/brand/animajet_logo_ultraclean_hero.png"
                alt="AnimaJet"
                width={200}
                height={50}
                className="w-full h-auto"
                priority
              />
            </div>

            {/* Headline - Primary visual focus */}
            <div className="space-y-5">
              <h1 className="text-4xl lg:text-5xl xl:text-[3.25rem] font-bold text-white leading-[1.1] tracking-tight">
                Vos invités participent,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]">
                  votre soirée décolle
                </span>
              </h1>
              <p className="text-lg lg:text-xl text-[#9A9A9F] leading-relaxed max-w-[520px]">
                QR code instantané, écran géant, participation en direct.
                <span className="text-white font-medium"> Sans appli.</span>
              </p>
            </div>

            {/* Value props for PROs */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#7A7A7F]">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#D4AF37]" />
                DJ & animateurs
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#D4AF37]" />
                Événements corporate
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#D4AF37]" />
                Mariages & soirées
              </span>
            </div>

            {/* Trial Form - Conversion focus */}
            <div className="bg-[#141416] rounded-2xl p-6 border border-[#2A2A2E] max-w-[440px] shadow-xl">
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
                      className="pl-12 h-14 text-base bg-[#0D0D0F] border-[#2E2E33] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 text-white placeholder:text-gray-600 rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={() => onTrialRequest(trialEmail)}
                    disabled={trialLoading || !trialEmail}
                    className="w-full h-14 text-base bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] hover:brightness-110 text-[#0D0D0F] font-bold rounded-xl shadow-[0_4px_24px_rgba(212,175,55,0.25)] transition-all focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141416]"
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

          {/* Right Column - Product Mock (secondary) */}
          <div className="hidden lg:block relative hero-fade-in opacity-80" style={{ animationDelay: '200ms' }}>
            {/* Very subtle glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.04)_0%,transparent_70%)]" />

            {/* TV/Monitor Mock */}
            <div className="relative animate-float">
              <div className="relative bg-[#0A0A0C] rounded-xl border border-white/[0.06] shadow-2xl overflow-hidden">
                {/* Monitor bezel */}
                <div className="h-6 bg-[#151517] flex items-center px-3 border-b border-white/[0.04]">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                  </div>
                  <span className="ml-3 text-[9px] text-white/30">Quiz Live - 12 participants</span>
                </div>

                {/* Screen */}
                <div className="aspect-[16/10] bg-[#0D0D0F] p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#D4AF37]/20" />
                      <div className="h-1.5 w-20 bg-white/10 rounded" />
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[8px] text-emerald-400">LIVE</span>
                    </div>
                  </div>

                  {/* Game cards */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="aspect-[4/3] rounded bg-white/[0.02] border border-white/[0.04] p-2">
                        <div className="h-1 w-full bg-[#D4AF37]/20 rounded mb-2" />
                        <div className="h-1 w-2/3 bg-white/5 rounded" />
                      </div>
                    ))}
                  </div>

                  {/* Scoreboard */}
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded p-2.5">
                    <div className="text-[8px] text-white/30 uppercase tracking-wider mb-2">Classement</div>
                    <div className="space-y-1.5">
                      {[
                        { rank: 1, name: 'Marie L.', score: 850 },
                        { rank: 2, name: 'Thomas B.', score: 720 },
                        { rank: 3, name: 'Julie M.', score: 680 },
                      ].map((p) => (
                        <div key={p.rank} className="flex items-center gap-2 text-[9px]">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] font-bold">
                            {p.rank}
                          </span>
                          <span className="text-white/50 flex-1">{p.name}</span>
                          <span className="font-mono text-[#D4AF37]/70">{p.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Smartphone with QR */}
              <div className="absolute -right-2 -bottom-1 w-20">
                <div className="bg-[#0A0A0C] rounded-lg border border-white/[0.06] p-1.5 shadow-lg">
                  <div className="h-2 flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-white/10 rounded-full" />
                  </div>
                  <div className="aspect-square bg-white rounded p-1">
                    <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-[1px]">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={`${
                            [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 19, 20, 22, 23, 24].includes(i)
                              ? 'bg-[#1A1A1E]'
                              : 'bg-gray-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[5px] text-center text-white/30 mt-1">Scan to join</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
