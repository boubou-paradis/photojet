'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, LogIn, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { AnimaJetFullLogo } from '@/components/branding/AnimaJetLogo'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

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
          .select('status, current_period_end')
          .eq('user_id', data.user.id)
          .single()

        // Check if user is owner (unlimited access)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (profile?.role === 'owner') {
          toast.success('Bienvenue !')
          router.push('/admin/dashboard')
          return
        }

        if (!subscription || subscription.status === 'expired') {
          setError('Votre abonnement a expire. Reabonnez-vous pour continuer.')
          await supabase.auth.signOut()
          return
        }

        if (subscription.status === 'past_due') {
          toast.warning('Votre paiement est en retard. Mettez a jour vos informations de paiement.')
        }

        toast.success('Bienvenue !')
        router.push('/admin/dashboard')
      }
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
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
        className="max-w-sm w-full relative z-10"
      >
        {/* Back link */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[#6B6B70] hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </a>

        <div className="card-gold rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <AnimaJetFullLogo size={100} className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Connexion</h1>
            <p className="text-[#6B6B70] text-sm mt-1">
              Accedez a votre dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#B0B0B5] mb-2 block">
                Email
              </label>
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] text-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#B0B0B5] mb-2 block">
                Mot de passe
              </label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] text-white"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-[#E53935] text-center"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gold-gradient hover:opacity-90 text-[#1A1A1E] font-bold"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.1)] text-center">
            <p className="text-sm text-[#6B6B70]">
              Pas encore de compte ?{' '}
              <a href="/#pricing" className="text-[#D4AF37] hover:text-[#F4D03F] transition-colors">
                S&apos;abonner
              </a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
