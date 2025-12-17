'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, Mail, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading while webhook processes
    const timer = setTimeout(() => setLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center relative z-10"
        >
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-[#D4AF37] mx-auto" />
            <div className="absolute inset-0 h-16 w-16 animate-ping opacity-20 rounded-full bg-[#D4AF37] mx-auto" />
          </div>
          <p className="text-white mt-6 text-lg">Finalisation de votre abonnement...</p>
          <p className="text-gray-500 mt-2 text-sm">Cela ne prendra qu&apos;un instant</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-emerald-500/5 to-transparent rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full relative z-10"
      >
        {/* Card with glow effect */}
        <div className="relative">
          {/* Success glow */}
          <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/20 via-[#D4AF37]/10 to-emerald-500/20 rounded-3xl blur-xl opacity-60" />

          <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-emerald-500/20 overflow-hidden">
            {/* Top emerald line */}
            <div className="h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

            <div className="p-8 text-center">
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, duration: 0.8 }}
                className="relative w-24 h-24 mx-auto mb-6"
              >
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border-2 border-emerald-500/30">
                  <CheckCircle className="h-12 w-12 text-emerald-500" />
                </div>
              </motion.div>

              {/* Logo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative inline-block mb-6"
              >
                <div className="absolute inset-0 bg-[#D4AF37]/10 blur-2xl rounded-full" />
                <Image
                  src="/images/animajet_logo_principal.png"
                  alt="AnimaJet"
                  width={120}
                  height={120}
                  className="relative z-10"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold text-white mb-3 flex items-center justify-center gap-2"
              >
                <Sparkles className="h-6 w-6 text-[#D4AF37]" />
                Bienvenue !
                <Sparkles className="h-6 w-6 text-[#D4AF37]" />
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-400 mb-8"
              >
                Votre abonnement est actif. Vous allez recevoir un email avec vos identifiants de connexion.
              </motion.p>

              {/* Email notice */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-[#0D0D0F] rounded-xl p-4 mb-8 border border-[#D4AF37]/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-amber-600/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-[#D4AF37]" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">Verifiez votre boite mail</p>
                    <p className="text-sm text-gray-500">
                      Email + mot de passe + code session
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="space-y-3"
              >
                <Button
                  onClick={() => window.location.href = '/login'}
                  className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25 transition-all hover:shadow-[#D4AF37]/40"
                >
                  Se connecter
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="w-full h-12 border-white/10 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl"
                >
                  Retour a l&apos;accueil
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-gray-600 mt-6"
              >
                Pas recu l&apos;email ? Verifiez vos spams ou contactez le support.
              </motion.p>
            </div>

            {/* Bottom golden line */}
            <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
