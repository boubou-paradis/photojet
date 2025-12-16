'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  ArrowRight,
  Loader2,
  Check,
  Camera,
  Tv,
  QrCode,
  Gamepad2,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { ShutterIcon } from '@/components/branding/PhotoJetLogo'
import Footer from '@/components/Footer'

const PRICE = 29.90

const features = [
  { icon: Camera, text: 'Photos illimitées' },
  { icon: Tv, text: 'Diaporama en direct' },
  { icon: QrCode, text: 'QR codes personnalisés' },
  { icon: Gamepad2, text: '7 jeux interactifs' },
]

// Floating particles configuration
const particles = [
  { id: 1, size: 4, left: '10%', top: '20%', className: 'particle-1' },
  { id: 2, size: 6, left: '85%', top: '15%', className: 'particle-2' },
  { id: 3, size: 3, left: '70%', top: '60%', className: 'particle-3' },
  { id: 4, size: 5, left: '15%', top: '70%', className: 'particle-4' },
  { id: 5, size: 4, left: '90%', top: '80%', className: 'particle-5' },
  { id: 6, size: 3, left: '5%', top: '50%', className: 'particle-2' },
  { id: 7, size: 5, left: '50%', top: '85%', className: 'particle-1' },
  { id: 8, size: 4, left: '30%', top: '10%', className: 'particle-3' },
]

export default function Home() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || code.length !== 4) {
      setError('Entrez un code à 4 caractères')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, expires_at, is_active')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setError('Code invalide ou session expirée')
        return
      }

      const now = new Date()
      const expiresAt = new Date(data.expires_at)
      if (expiresAt < now) {
        setError('Cette session a expiré')
        return
      }

      router.push(`/invite/${code.toUpperCase()}`)
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!email) {
      setError('Entrez votre email')
      return
    }

    setCheckoutLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, promoCode }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Erreur lors du paiement')
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background - Plus sombre avec gradient radial subtil */}
      <div className="fixed inset-0 bg-[#0f0f12]">
        {/* Gradient radial central doré subtil */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.06) 0%, transparent 50%)'
          }}
        />
        {/* Lueur supérieure */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[#D4AF37]/8 blur-[150px] rounded-full" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className={`particle ${particle.className}`}
            style={{
              width: particle.size,
              height: particle.size,
              left: particle.left,
              top: particle.top,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      {/* Decorative elements - Plus grands et plus subtils */}
      <div className="fixed top-16 left-8 opacity-[0.03] spin-very-slow hidden md:block">
        <ShutterIcon size={180} />
      </div>
      <div className="fixed bottom-16 right-8 opacity-[0.04] spin-very-slow hidden md:block" style={{ animationDirection: 'reverse' }}>
        <ShutterIcon size={160} />
      </div>
      <div className="fixed top-1/2 left-4 opacity-[0.025] spin-very-slow hidden lg:block" style={{ animationDelay: '-20s' }}>
        <ShutterIcon size={120} />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Logo avec effet glow - Plus grand, sans fond */}
            <motion.div
              className="flex flex-col items-center justify-center mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="logo-glow mb-6">
                <Image
                  src="/photojet_logo_clean.png"
                  alt="PhotoJet"
                  width={300}
                  height={300}
                  className="w-[200px] md:w-[250px] lg:w-[300px] h-auto"
                  priority
                />
              </div>

              {/* Tagline avec animation */}
              <motion.p
                className="text-lg text-gray-400 max-w-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                L&apos;animation de vos événements, simplifiée
              </motion.p>
            </motion.div>

            {/* Features */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-2xl mx-auto">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex flex-col items-center gap-2 p-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20">
                    <feature.icon className="h-6 w-6 text-[#D4AF37]" />
                  </div>
                  <span className="text-sm text-gray-400">{feature.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="animate-bounce"
            >
              <ArrowRight className="h-6 w-6 text-[#D4AF37] rotate-90 mx-auto" />
            </motion.div>
          </motion.div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Un prix simple, tout inclus
              </h2>
              <p className="text-gray-400 text-lg">
                Pas de surprise, pas de frais cachés
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Pricing Card - Avec glow doré */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-8 relative overflow-hidden border border-[#D4AF37]/30 shadow-2xl shadow-black/50"
                style={{ boxShadow: '0 0 40px rgba(212, 175, 55, 0.1), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
              >
                <div className="absolute top-0 right-0 bg-[#D4AF37] text-[#0f0f12] px-4 py-1 rounded-bl-xl font-bold text-sm">
                  TOUT INCLUS
                </div>

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">Abonnement Mensuel</h3>
                  <p className="text-gray-400">Tout ce dont vous avez besoin</p>
                </div>

                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl font-bold text-white">{PRICE.toFixed(2).replace('.', ',')}€</span>
                  <span className="text-gray-500">/mois</span>
                </div>

                <ul className="space-y-4 mb-8">
                  {[
                    'Photos et messages illimités',
                    'Diaporama en direct HD',
                    'Borne photo intégrée',
                    '7 jeux interactifs',
                    'QR codes personnalisés',
                    'Modération des contenus',
                    'Téléchargement album ZIP',
                    'Support prioritaire',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-400">
                      <Check className="h-5 w-5 text-[#D4AF37] flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Checkout Form */}
                <div className="space-y-4">
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-[#1A1A1E] border-[#3a3a3a] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-gray-500 input-gold"
                  />

                  {showPromo ? (
                    <Input
                      type="text"
                      placeholder="Code promo (optionnel)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="h-12 bg-[#1A1A1E] border-[#3a3a3a] focus:border-[#D4AF37] text-white uppercase placeholder:text-gray-500 input-gold"
                    />
                  ) : (
                    <button
                      onClick={() => setShowPromo(true)}
                      className="text-sm text-[#D4AF37] hover:text-[#F4E4BC] transition-colors"
                    >
                      J&apos;ai un code promo
                    </button>
                  )}

                  {error && (
                    <p className="text-sm text-[#E53935] text-center">{error}</p>
                  )}

                  <Button
                    onClick={handleCheckout}
                    disabled={checkoutLoading || !email}
                    className="w-full h-14 btn-shimmer text-[#0f0f12] font-semibold text-lg border-0"
                  >
                    {checkoutLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        S&apos;abonner maintenant
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-600 text-center">
                    Paiement sécurisé par Stripe. Annulable à tout moment.
                  </p>
                </div>
              </motion.div>

              {/* Join Session Card - Premium Style */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-8 border border-[#D4AF37]/20 shadow-2xl shadow-black/50"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/30">
                    <QrCode className="h-8 w-8 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Vous êtes invité ?</h3>
                  <p className="text-gray-400">
                    Entrez le code de l&apos;événement pour partager vos photos
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="text"
                    maxLength={4}
                    placeholder="CODE"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase())
                      setError(null)
                    }}
                    className="text-center text-3xl font-mono tracking-[0.3em] h-16 bg-[#1A1A1E] border-[#3a3a3a] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white uppercase placeholder:text-gray-500 input-gold"
                  />

                  <Button
                    type="submit"
                    disabled={loading || code.length !== 4}
                    className="w-full h-14 btn-shimmer text-[#0f0f12] font-semibold text-lg border-0"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Rejoindre l&apos;événement
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-6">
                  Scannez le QR code ou entrez le code à 4 caractères
                </p>

                <div className="mt-8 pt-8 border-t border-[#D4AF37]/10">
                  <p className="text-center text-sm text-gray-500">
                    Déjà abonné ?{' '}
                    <a href="/login" className="text-[#D4AF37] hover:text-[#F4E4BC] transition-colors font-medium">
                      Se connecter
                    </a>
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Footer - Plus discret */}
        <footer className="mt-auto pb-4">
          <div className="text-center text-xs text-gray-600">
            <Footer />
          </div>
        </footer>
      </div>
    </div>
  )
}
