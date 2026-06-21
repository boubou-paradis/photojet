// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Crown, Users } from 'lucide-react'

/**
 * Vitrine produit du hero /quiz-mariage : reproduction fidèle de l'UI réelle
 * (écran joueur sur téléphone + classement live sur écran géant) dans des
 * cadres d'appareils CSS. Aucune capture externe : c'est l'interface réelle
 * d'AnimaJet, rejouée avec ses vrais tokens (dark + gold, tuiles Kahoot ▲◆●■).
 */

// Tuiles de réponse — couleurs/formes identiques à KahootAnswerCardHost.
type Tile = { color: string; icon: string; text: string; textColor: string; selected?: boolean }
const TILES: Tile[] = [
  { color: '#ff3355', icon: '▲', text: "À l'église", textColor: '#ffffff' },
  { color: '#2d7dff', icon: '◆', text: 'À la mairie', textColor: '#ffffff' },
  { color: '#ffcc33', icon: '●', text: 'Sur la plage', textColor: '#1a1a2e' },
  { color: '#33cc66', icon: '■', text: 'Au château', textColor: '#ffffff', selected: true },
]

// Classement live — médailles or/argent/bronze comme QuizPodiumPremium.
type Rank = { name: string; pts: string; medal?: string; crown?: boolean }
const RANKING: Rank[] = [
  { name: 'Sophie', pts: '2 400', medal: '#D4AF37', crown: true },
  { name: 'Marc', pts: '2 150', medal: '#C0C0C0' },
  { name: 'Léa', pts: '1 980', medal: '#CD7F32' },
  { name: 'Thomas', pts: '1 720' },
  { name: 'Inès', pts: '1 540' },
]

export default function QuizDeviceShowcase() {
  const reduce = useReducedMotion()

  const screenIn: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 28, rotateY: reduce ? 0 : -6 },
    show: {
      opacity: 1,
      y: 0,
      rotateY: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  }
  const phoneIn: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 40, scale: reduce ? 1 : 0.94 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <div className="flex justify-center lg:justify-end">
      {/* Boîte de réservation : clippe le contenu mis à l'échelle (le scale() ne réduit
          pas la boîte de layout) → empêche tout débordement horizontal sur mobile */}
      <div className="h-[290px] w-[340px] max-w-full overflow-hidden sm:h-[340px] sm:w-[400px] lg:h-[400px] lg:w-[470px]">
      <motion.div
        initial="hidden"
        animate="show"
        className="relative origin-top-left scale-[0.723] sm:scale-[0.851] lg:scale-100"
        style={{ width: 470, height: 400, perspective: 1200 }}
      >
        {/* Halo doré diffus derrière la scène */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 65% 40%, rgba(212,175,55,0.18), transparent 70%)',
            filter: 'blur(8px)',
          }}
        />

        {/* ── ÉCRAN GÉANT : classement en direct ── */}
        <motion.div
          variants={screenIn}
          className="absolute top-[18px] right-0"
          style={{ width: 320 }}
        >
          {/* Cadre écran */}
          <div
            className="rounded-[16px] p-[10px]"
            style={{
              background: 'linear-gradient(145deg, #2a2a30, #131316)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="rounded-[9px] overflow-hidden bg-[#0D0D0F] p-4">
              {/* En-tête */}
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-white text-[15px] font-semibold"
                  style={{ fontFamily: 'var(--font-playfair)' }}
                >
                  Classement en direct
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="text-red-400 text-[8px] font-bold tracking-wide">EN DIRECT</span>
                </span>
              </div>

              {/* Lignes de classement */}
              <div className="space-y-1.5">
                {RANKING.map((p, i) => {
                  const lead = i === 0
                  return (
                    <div
                      key={p.name}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                      style={{
                        background: lead ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)',
                        border: lead
                          ? '1px solid rgba(212,175,55,0.35)'
                          : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <span
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{
                          background: p.medal ? p.medal : 'rgba(255,255,255,0.08)',
                          color: p.medal ? '#1a1a1a' : '#9ca3af',
                        }}
                      >
                        {p.crown ? <Crown className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className="flex-1 truncate text-[12px] font-semibold text-white">
                        {p.name}
                      </span>
                      <span className="text-[12px] font-bold text-[#E5C349]">{p.pts} pts</span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex items-center justify-end">
                <span className="text-[8px] font-bold tracking-widest text-[#D4AF37]/60">
                  ANIMAJET
                </span>
              </div>
            </div>
          </div>
          {/* Pied / support de l'écran */}
          <div className="mx-auto h-3 w-10 bg-gradient-to-b from-[#26262b] to-[#161619]" />
          <div className="mx-auto h-1.5 w-24 rounded-b-md bg-[#1c1c20]" />
        </motion.div>

        {/* ── TÉLÉPHONE : écran joueur ── */}
        <motion.div
          variants={phoneIn}
          className="absolute bottom-0 left-0"
          style={{ width: 168 }}
        >
          <div
            className="rounded-[34px] p-[7px]"
            style={{
              background: 'linear-gradient(150deg, #2c2c33, #0e0e11)',
              boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <div className="relative rounded-[28px] overflow-hidden bg-[#0D0D0F]" style={{ aspectRatio: '9 / 19' }}>
              {/* Encoche */}
              <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-black/70" />

              <div className="flex h-full flex-col px-2.5 pt-5 pb-3">
                {/* Barre d'état du quiz */}
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[9px] font-bold text-[#D4AF37]">Question 3 / 10</span>
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-gray-400">
                    <Users className="h-2.5 w-2.5" />
                    24
                  </span>
                </div>

                {/* Carte question */}
                <div
                  className="mt-2.5 rounded-2xl border px-3 py-2.5 text-center"
                  style={{
                    background: 'linear-gradient(180deg, rgba(26,26,46,0.9), rgba(15,10,32,0.9))',
                    borderColor: 'rgba(212,175,55,0.3)',
                  }}
                >
                  <p className="text-[11px] font-black leading-tight text-white">
                    Où les mariés se sont-ils dit « oui » ?
                  </p>
                </div>

                {/* Grille de réponses 2×2 */}
                <div className="mt-3 grid flex-1 grid-cols-2 content-center gap-2">
                  {TILES.map((t) => (
                    <div
                      key={t.text}
                      className="relative flex items-center gap-1 rounded-xl px-2 py-2"
                      style={{
                        background: t.color,
                        color: t.textColor,
                        boxShadow: t.selected
                          ? '0 0 0 2px #0D0D0F, 0 0 0 4px rgba(255,255,255,0.85)'
                          : 'none',
                      }}
                    >
                      <span className="text-[10px] leading-none opacity-90">{t.icon}</span>
                      <span className="text-[9px] font-bold leading-tight">{t.text}</span>
                    </div>
                  ))}
                </div>

                {/* Confirmation */}
                <div className="mt-2.5 flex justify-center">
                  <span className="rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-[8px] font-bold text-green-400">
                    Réponse envoyée
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      </div>
    </div>
  )
}
