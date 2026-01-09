// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, Sparkles, Calendar, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BlockedWeekendPage() {
  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg text-center"
      >
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/logo.png"
            alt="AnimaJet"
            width={150}
            height={150}
            className="mx-auto"
          />
        </div>

        {/* Card */}
        <div className="bg-[#1A1A1E] rounded-2xl border border-orange-500/30 overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500" />

          <div className="p-8">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-500/10 border-2 border-orange-500/50 flex items-center justify-center">
              <Clock className="h-10 w-10 text-orange-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-4">
              Essai non disponible le week-end
            </h1>

            {/* Description */}
            <p className="text-gray-400 mb-6 leading-relaxed">
              L&apos;essai gratuit 24h est réservé aux tests en semaine
              <br />
              <span className="text-gray-500">(lundi - jeudi)</span>
            </p>

            {/* Pricing highlight */}
            <div className="bg-gradient-to-r from-[#D4AF37]/10 via-amber-500/5 to-[#D4AF37]/10 rounded-xl p-6 mb-6 border border-[#D4AF37]/30">
              <p className="text-sm text-gray-400 mb-2">
                Pour animer vos événements du week-end :
              </p>
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="text-4xl font-bold text-white">29,90€</span>
                <span className="text-gray-400">/mois</span>
              </div>
              <p className="text-sm text-[#D4AF37]">Sans engagement - Annulable à tout moment</p>
            </div>

            {/* CTA */}
            <Link href="/#pricing">
              <Button className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25">
                <Sparkles className="h-5 w-5 mr-2" />
                S&apos;abonner maintenant
              </Button>
            </Link>

            {/* Tip */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-start gap-3 text-left bg-[#2E2E33] rounded-lg p-4">
                <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">Astuce</p>
                  <p className="text-xs text-gray-400">
                    Testez toutes les fonctionnalités en semaine pour être prêt le jour J !
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back link */}
        <p className="mt-6 text-sm text-gray-500">
          <Link href="/" className="text-[#D4AF37] hover:text-[#F4D03F]">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
