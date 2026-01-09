// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Sparkles, Calendar, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatTimeRemaining } from '@/lib/trial'

interface WeekendBlockModalProps {
  isOpen: boolean
  trialExpiresAt?: string | null
  onSubscribe: () => void
}

export default function WeekendBlockModal({
  isOpen,
  trialExpiresAt,
  onSubscribe,
}: WeekendBlockModalProps) {
  if (!isOpen) return null

  const timeRemaining = trialExpiresAt ? formatTimeRemaining(trialExpiresAt) : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-orange-500/30 shadow-2xl overflow-hidden"
        >
          {/* Top accent line */}
          <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500" />

          {/* Content */}
          <div className="p-8 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/10 border-2 border-orange-500/50 flex items-center justify-center">
                  <Clock className="h-10 w-10 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-3">
              Votre essai gratuit n&apos;est pas disponible le week-end
            </h2>

            {/* Description */}
            <p className="text-gray-400 mb-6 leading-relaxed">
              L&apos;essai 24h est réservé aux tests en semaine (lundi-jeudi).
              <br />
              Pour animer vos événements du week-end, passez à l&apos;abonnement :
            </p>

            {/* Trial info */}
            {timeRemaining && (
              <div className="bg-[#2E2E33] rounded-xl p-4 mb-6 border border-white/5">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <span>Temps d&apos;essai restant :</span>
                  <span className="font-bold text-orange-500">
                    {timeRemaining}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Revenez lundi pour continuer votre essai !
                </p>
              </div>
            )}

            {/* Price highlight */}
            <div className="bg-gradient-to-r from-[#D4AF37]/10 via-amber-500/5 to-[#D4AF37]/10 rounded-xl p-4 mb-6 border border-[#D4AF37]/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-[#D4AF37]" />
                <span className="text-3xl font-bold text-white">29,90€</span>
                <span className="text-gray-400">/mois</span>
              </div>
              <p className="text-sm text-[#D4AF37]">Sans engagement - Annulable à tout moment</p>
            </div>

            {/* CTA Button */}
            <Button
              onClick={onSubscribe}
              className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25 transition-all hover:shadow-[#D4AF37]/40 hover:scale-[1.02]"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              S&apos;abonner maintenant
            </Button>

            {/* Tip */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-start gap-3 text-left bg-[#2E2E33] rounded-lg p-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Astuce</p>
                  <p className="text-xs text-gray-400">
                    Testez toutes les fonctionnalités en semaine pour être prêt le jour J !
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
