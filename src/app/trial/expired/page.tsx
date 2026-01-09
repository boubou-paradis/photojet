// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Timer, Sparkles, Check, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TrialExpiredPage() {
  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
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
        <div className="bg-[#1A1A1E] rounded-2xl border border-red-500/30 overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

          <div className="p-8">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center">
              <Timer className="h-10 w-10 text-red-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-4">
              Votre essai de 24h est terminé
            </h1>

            {/* Description */}
            <p className="text-gray-400 mb-6 leading-relaxed">
              Vous avez pu découvrir AnimaJet,
              <br />
              maintenant passez à l&apos;action !
            </p>

            {/* Pricing highlight */}
            <div className="bg-gradient-to-r from-[#D4AF37]/10 via-amber-500/5 to-[#D4AF37]/10 rounded-xl p-6 mb-6 border border-[#D4AF37]/30">
              <div className="flex items-baseline justify-center gap-2 mb-4">
                <span className="text-4xl font-bold text-white">29,90€</span>
                <span className="text-gray-400">/mois</span>
              </div>

              <ul className="space-y-2 text-left mb-4">
                <li className="flex items-center gap-2 text-sm text-gray-400">
                  <Check className="h-4 w-4 text-[#D4AF37]" />
                  Utilisable 7j/7
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-400">
                  <Check className="h-4 w-4 text-[#D4AF37]" />
                  Tous vos événements
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-400">
                  <Check className="h-4 w-4 text-[#D4AF37]" />
                  Sans engagement
                </li>
              </ul>
            </div>

            {/* CTA */}
            <Link href="/#pricing">
              <Button className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25">
                <Sparkles className="h-5 w-5 mr-2" />
                S&apos;abonner maintenant
              </Button>
            </Link>

            {/* Motivation */}
            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="flex items-center justify-center gap-2 text-[#D4AF37]">
                <Rocket className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Lancez votre premier événement dès maintenant !
                </span>
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
