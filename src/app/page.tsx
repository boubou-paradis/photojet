'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || code.length !== 4) {
      setError('Entrez un code a 4 chiffres')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, expires_at, is_active')
        .eq('code', code)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setError('Code invalide ou session expiree')
        return
      }

      const now = new Date()
      const expiresAt = new Date(data.expires_at)
      if (expiresAt < now) {
        setError('Cette session a expire')
        return
      }

      router.push(`/invite/${code}`)
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[#1A1A1E]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#D4AF37]/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-block mb-6"
          >
            <Image
              src="/logo.png"
              alt="PhotoJet"
              width={180}
              height={180}
              className="mx-auto drop-shadow-2xl"
              priority
            />
          </motion.div>
          <p className="text-[#B0B0B5] mt-2">
            Partagez vos photos en temps reel
          </p>
        </div>

        {/* Card */}
        <div className="card-gold rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#B0B0B5] mb-2 block">
                Code de l&apos;evenement
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="1234"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setCode(value)
                  setError(null)
                }}
                className="text-center text-2xl font-mono tracking-widest h-14 bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-[#6B6B70]"
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
              disabled={loading || code.length !== 4}
              className="w-full h-12 bg-gold-gradient hover:opacity-90 text-[#1A1A1E] font-semibold transition-all hover:glow-gold disabled:opacity-50"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Rejoindre
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.1)] text-center">
            <p className="text-sm text-[#6B6B70]">
              Scannez le QR code de l&apos;evenement ou entrez le code a 4 chiffres
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-[#6B6B70] mt-8">
          Organisateur ?{' '}
          <a href="/admin/dashboard" className="text-[#D4AF37] hover:text-[#F4D03F] transition-colors">
            Acceder au dashboard
          </a>
        </p>
      </motion.div>
    </div>
  )
}
