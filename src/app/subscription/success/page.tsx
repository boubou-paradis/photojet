'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, Mail, Loader2 } from 'lucide-react'
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
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37] mx-auto mb-4" />
          <p className="text-white">Finalisation de votre abonnement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center p-4">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="card-gold rounded-2xl p-8 text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="h-12 w-12 text-green-500" />
          </motion.div>

          {/* Logo */}
          <Image
            src="/animajet_logo_principal.png"
            alt="AnimaJet"
            width={120}
            height={120}
            className="mx-auto w-28 h-28 object-contain mb-6"
          />

          <h1 className="text-2xl font-bold text-white mb-2">
            Bienvenue sur AnimaJet !
          </h1>

          <p className="text-[#B0B0B5] mb-8">
            Votre abonnement est actif. Vous allez recevoir un email avec vos identifiants de connexion.
          </p>

          {/* Email notice */}
          <div className="bg-[#1A1A1E] rounded-xl p-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Verifiez votre boite mail</p>
                <p className="text-sm text-[#6B6B70]">
                  Email + mot de passe + code session
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Button
              onClick={() => window.location.href = '/login'}
              className="w-full h-12 bg-gold-gradient hover:opacity-90 text-[#1A1A1E] font-bold"
            >
              Se connecter
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full h-12 border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]"
            >
              Retour a l&apos;accueil
            </Button>
          </div>

          <p className="text-xs text-[#6B6B70] mt-6">
            Pas recu l&apos;email ? Verifiez vos spams ou contactez le support.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
