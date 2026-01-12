'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Loader2, LogIn, ArrowLeft, Sparkles, Lock, Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { checkAccess } from '@/lib/trial'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Handle URL messages (trial activation, etc.)
  useEffect(() => {
    const message = searchParams.get('message')
    const emailParam = searchParams.get('email')

    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }

    switch (message) {
      case 'trial_activated':
        setSuccessMessage('Votre compte essai 24h a ete cree ! Vos identifiants vous ont ete envoyes par email. Connectez-vous pour commencer.')
        toast.success('Compte cree avec succes !')
        break
      case 'trial_already_activated':
        setSuccessMessage('Votre compte essai existe deja. Connectez-vous avec vos identifiants.')
        break
      case 'account_exists':
        setSuccessMessage('Un compte existe deja avec cet email. Connectez-vous avec vos identifiants.')
        break
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      setError('Remplissez tous les champs')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email ou mot de passe incorrect')
        } else {
          setError(authError.message)
        }
        return
      }

      if (data.user) {
        // Check subscription status
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', data.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Check if user is owner (unlimited access)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        // Use the trial access logic
        const accessResult = checkAccess(subscription, profile?.role)

        if (!accessResult.canAccess) {
          if (accessResult.status === 'weekend_blocked') {
            // Let them through, the admin layout will show the weekend block modal
            toast.info('Essai en cours - disponible en semaine uniquement')
            router.push('/admin/dashboard')
            return
          }

          setError(accessResult.message)
          await supabase.auth.signOut()
          return
        }

        if (subscription?.status === 'past_due') {
          toast.warning('Votre paiement est en retard. Mettez a jour vos informations de paiement.')
        }

        if (accessResult.status === 'valid_trial') {
          toast.success(`Bienvenue ! ${accessResult.message}`)
        } else {
          toast.success('Bienvenue !')
        }
        router.push('/admin/dashboard')
      }
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back link */}
        <motion.a
          href="/"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-[#D4AF37] transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Retour
        </motion.a>

        {/* Card with glow effect */}
        <div className="relative">
          {/* Glow behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#D4AF37]/20 via-amber-500/10 to-[#D4AF37]/20 rounded-3xl blur-xl opacity-50" />

          <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-[#D4AF37]/20 overflow-hidden">
            {/* Top golden line */}
            <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

            <div className="p-8">
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
                className="text-center mb-8"
              >
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-[#D4AF37]/20 blur-2xl rounded-full" />
                  <Image
                    src="/images/animajet_logo_principal.png"
                    alt="AnimaJet"
                    width={140}
                    height={140}
                    className="relative z-10 drop-shadow-2xl"
                  />
                </div>

                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold text-white mt-6 flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-6 w-6 text-[#D4AF37]" />
                  Connexion
                  <Sparkles className="h-6 w-6 text-[#D4AF37]" />
                </motion.h1>
                <p className="text-gray-500 text-sm mt-2">
                  Accedez a votre dashboard
                </p>
              </motion.div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <label className="text-sm font-medium text-gray-400 mb-2 block flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#D4AF37]" />
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-[#0D0D0F] border-white/10 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-gray-600 rounded-xl"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <label className="text-sm font-medium text-gray-400 mb-2 block flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#D4AF37]" />
                    Mot de passe
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-[#0D0D0F] border-white/10 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-gray-600 rounded-xl"
                  />
                </motion.div>

                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-sm text-green-400 text-center bg-green-500/10 py-3 px-4 rounded-lg border border-green-500/20 flex items-start gap-2"
                  >
                    <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>{successMessage}</span>
                  </motion.div>
                )}

                {error && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-sm text-red-500 text-center bg-red-500/10 py-2 px-4 rounded-lg border border-red-500/20"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25 transition-all hover:shadow-[#D4AF37]/40 hover:scale-[1.02]"
                  >
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="h-5 w-5 mr-2" />
                        Se connecter
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Bottom link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-8 pt-6 border-t border-white/5 text-center"
              >
                <p className="text-sm text-gray-500">
                  Pas encore de compte ?{' '}
                  <a href="/#pricing" className="text-[#D4AF37] hover:text-[#F4D03F] transition-colors font-semibold">
                    S&apos;abonner
                  </a>
                </p>
              </motion.div>
            </div>

            {/* Bottom golden line */}
            <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
