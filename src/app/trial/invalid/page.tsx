// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, Mail, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TrialInvalidPage() {
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
          <div className="h-1 bg-gradient-to-r from-red-500 via-red-400 to-red-500" />

          <div className="p-8">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 border-2 border-red-500/50 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-4">
              Lien invalide ou expiré
            </h1>

            {/* Description */}
            <p className="text-gray-400 mb-6 leading-relaxed">
              Ce lien d&apos;essai n&apos;est plus valide.
              <br />
              Demandez un nouvel accès ou abonnez-vous !
            </p>

            {/* CTAs */}
            <div className="space-y-3">
              <Link href="/#pricing">
                <Button className="w-full h-12 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold rounded-xl">
                  <Mail className="h-5 w-5 mr-2" />
                  Demander un nouvel essai
                </Button>
              </Link>

              <Link href="/#pricing">
                <Button
                  variant="outline"
                  className="w-full h-12 border-white/20 text-white hover:bg-white/5 font-semibold rounded-xl"
                >
                  S&apos;abonner - 29,90€/mois
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
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
