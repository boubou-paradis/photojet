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
    <section className="relative min-h-[78vh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0D0D0F]">
        {/* Radial gradient center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,26,30,1)_0%,rgba(13,13,15,1)_100%)]" />
        {/* Gold orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#D4AF37]/[0.03] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-[#D4AF37]/[0.04] rounded-full blur-[80px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-[#D4AF37]/[0.02] rounded-full blur-[60px] animate-pulse-slow" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left Column */}
          <div className="hero-fade-in space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">SaaS B2B</span>
            </div>

            {/* Logo */}
            <div className="w-[240px] lg:w-[300px]">
              <Image
                src="/brand/animajet_logo_ultraclean_hero.png"
                alt="AnimaJet"
                width={300}
                height={80}
                className="w-full h-auto"
                priority
              />
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-3xl lg:text-4xl xl:text-[2.75rem] font-bold text-white leading-[1.15] tracking-tight">
                Vos invités participent,
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]">
                  votre soirée décolle
                </span>
              </h1>
              <p className="text-base lg:text-lg text-[#B0B0B5] leading-relaxed max-w-[480px]">
                QR code instantané, écran géant, scores en direct. Sans appli.
              </p>
            </div>

            {/* Trust Pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { icon: '📱', label: 'Sans appli' },
                { icon: '⚡', label: 'QR code instantané' },
                { icon: '🛡️', label: 'Anti-triche' },
              ].map((pill) => (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-sm text-[#B0B0B5]"
                >
                  <span className="text-xs">{pill.icon}</span>
                  {pill.label}
                </span>
              ))}
            </div>

            {/* Trial Form */}
            <div className="bg-[#1A1A1E]/80 backdrop-blur-sm rounded-2xl p-5 border border-[#D4AF37]/20 max-w-[420px]">
              <div className="space-y-1 mb-4">
                <h3 className="text-base font-semibold text-white">Essai gratuit 24h</h3>
                <p className="text-xs text-[#6B6B70]">Accès par email (lun → jeu)</p>
              </div>

              {trialSuccess ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-emerald-400 font-medium text-sm">Email envoyé !</p>
                  <p className="text-xs text-gray-500 mt-1">Vérifiez votre boîte de réception</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="votre@email.com"
                      value={trialEmail}
                      onChange={(e) => {
                        setTrialEmail(e.target.value)
                        setError(null)
                      }}
                      className="pl-10 h-12 bg-[#0D0D0F] border-[#2E2E33] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-gray-600 rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={() => onTrialRequest(trialEmail)}
                    disabled={trialLoading || !trialEmail}
                    className="w-full h-12 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] hover:opacity-90 text-[#0D0D0F] font-semibold rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1A1E]"
                  >
                    {trialLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Recevoir mon accès
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                  {error && (
                    <p className="text-xs text-red-500 text-center">{error}</p>
                  )}
                  <p className="text-[11px] text-center text-[#6B6B70]">
                    Sans carte bancaire • Accès immédiat
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Product Mock */}
          <div className="hidden lg:block relative hero-fade-in" style={{ animationDelay: '150ms' }}>
            {/* Glow behind mock */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.08)_0%,transparent_60%)] blur-xl" />

            {/* TV/Monitor Mock */}
            <div className="relative animate-float">
              <div className="relative bg-[#0D0D0F] rounded-2xl border border-[#D4AF37]/15 shadow-2xl overflow-hidden">
                {/* Monitor bezel */}
                <div className="h-7 bg-gradient-to-b from-[#242428] to-[#1A1A1E] flex items-center px-3 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#E53935]/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFC107]/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#4CAF50]/70" />
                  </div>
                  <span className="ml-3 text-[10px] text-gray-600">AnimaJet - Quiz Live</span>
                </div>

                {/* Screen */}
                <div className="aspect-[16/10] bg-[#1A1A1E] p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-[#D4AF37]/20 border border-[#D4AF37]/30" />
                      <div className="space-y-1">
                        <div className="h-1.5 w-16 bg-white/20 rounded" />
                        <div className="h-1 w-10 bg-white/10 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] text-emerald-400 font-medium">LIVE</span>
                    </div>
                  </div>

                  {/* Game cards grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="aspect-[4/3] rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 flex flex-col justify-between"
                      >
                        <div className="h-1 w-full bg-[#D4AF37]/30 rounded" />
                        <div className="space-y-0.5">
                          <div className="h-1 w-3/4 bg-white/10 rounded" />
                          <div className="h-1 w-1/2 bg-white/5 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Scoreboard */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">Classement</span>
                      <span className="text-[9px] text-[#D4AF37]">12 joueurs</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { rank: 1, name: 'Marie L.', score: 850, color: '#D4AF37' },
                        { rank: 2, name: 'Thomas B.', score: 720, color: '#C0C0C0' },
                        { rank: 3, name: 'Julie M.', score: 680, color: '#CD7F32' },
                      ].map((p) => (
                        <div key={p.rank} className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                            style={{ backgroundColor: `${p.color}20`, color: p.color }}
                          >
                            {p.rank}
                          </span>
                          <span className="text-[10px] text-white/70 flex-1">{p.name}</span>
                          <span className="text-[10px] font-mono text-[#D4AF37]">{p.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monitor stand */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-3 bg-gradient-to-b from-[#242428] to-[#1A1A1E] rounded-b-lg" />
              </div>

              {/* Smartphone with QR */}
              <div className="absolute -right-4 -bottom-2 w-24 animate-float" style={{ animationDelay: '500ms' }}>
                <div className="bg-[#0D0D0F] rounded-xl border border-[#D4AF37]/15 p-1.5 shadow-xl">
                  {/* Notch */}
                  <div className="h-2.5 flex justify-center mb-1">
                    <div className="w-8 h-1 bg-[#242428] rounded-full" />
                  </div>
                  {/* QR */}
                  <div className="aspect-square bg-white rounded-lg p-1.5 mb-1">
                    <div className="w-full h-full grid grid-cols-5 grid-rows-5 gap-[1px]">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-[1px] ${
                            [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 19, 20, 22, 23, 24].includes(i)
                              ? 'bg-[#1A1A1E]'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[6px] text-center text-gray-500">Scan to join</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
