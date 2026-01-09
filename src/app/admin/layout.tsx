'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Settings,
  Tablet,
  LogOut,
  X,
  Clock,
  Gift,
  Sparkles,
} from 'lucide-react'
import AnimaJetLogo from '@/components/branding/AnimaJetLogo'
import Footer from '@/components/Footer'
import WeekendBlockModal from '@/components/WeekendBlockModal'
import { createClient } from '@/lib/supabase'
import { isWeekend, isTokenExpired, formatTimeRemaining } from '@/lib/trial'
import { Subscription } from '@/types/database'
import { toast } from 'sonner'

const navItems = [
  { href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/borne', label: 'Borne Photo', icon: Tablet },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
]

// Helper to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [userRole, setUserRole] = useState<string | undefined>(undefined)
  const [showWeekendBlock, setShowWeekendBlock] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [isTrialUser, setIsTrialUser] = useState(false)
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null)
  const [trialEmail, setTrialEmail] = useState<string | null>(null)

  // Show welcome toast for trial users
  useEffect(() => {
    if (searchParams.get('trial') === 'active') {
      toast.success('Bienvenue ! Votre essai gratuit de 24h est actif.')
    }
  }, [searchParams])

  // Check access on mount
  useEffect(() => {
    async function checkUserAccess() {
      const supabase = createClient()

      // First, check if user has trial cookies
      const trialToken = getCookie('trial_token')
      const trialExpires = getCookie('trial_expires_at')
      const trialUserEmail = getCookie('trial_email')

      if (trialToken && trialExpires) {
        // User is in trial mode
        setIsTrialUser(true)
        setTrialExpiresAt(trialExpires)
        setTrialEmail(trialUserEmail)

        // Check if trial is expired
        if (isTokenExpired(trialExpires)) {
          router.push('/trial/expired')
          return
        }

        // Check if it's weekend
        if (isWeekend()) {
          setShowWeekendBlock(true)
        }

        setAccessChecked(true)
        return
      }

      // No trial cookies, check for authenticated user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // No trial and no auth, redirect to home
        router.push('/')
        return
      }

      // Fetch user profile for role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setUserRole(profile?.role)

      // Fetch subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      setSubscription(sub)

      // Check if owner (always has access)
      if (profile?.role === 'owner') {
        setAccessChecked(true)
        return
      }

      // Check subscription status
      if (!sub || sub.status !== 'active') {
        router.push('/?access=expired')
        return
      }

      setAccessChecked(true)
    }

    checkUserAccess()

    // Re-check access every minute (for trial expiration)
    const interval = setInterval(checkUserAccess, 60000)
    return () => clearInterval(interval)
  }, [router])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      // Clear trial cookies
      document.cookie = 'trial_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
      document.cookie = 'trial_email=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
      document.cookie = 'trial_expires_at=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'

      // Sign out from Supabase if authenticated
      const supabase = createClient()
      await supabase.auth.signOut()

      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  const handleSubscribe = () => {
    router.push('/#pricing')
  }

  // Calculate trial time remaining
  const trialTimeRemaining = trialExpiresAt ? formatTimeRemaining(trialExpiresAt) : null

  return (
    <div className="min-h-screen bg-[#1A1A1E]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1A1A1E]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/admin/dashboard" className="flex items-center">
              <AnimaJetLogo size="md" variant="horizontal" />
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'text-[#D4AF37]'
                        : 'text-[#B0B0B5] hover:text-white hover:bg-[#2E2E33]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Trial banner + Logout button */}
            <div className="flex items-center gap-2">
              {/* Trial status banner */}
              {isTrialUser && trialTimeRemaining && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <Gift className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-emerald-400 font-medium">
                    Essai : {trialTimeRemaining}
                  </span>
                  <button
                    onClick={handleSubscribe}
                    className="text-xs text-[#D4AF37] hover:text-[#F4D03F] font-semibold ml-1"
                  >
                    S&apos;abonner
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
              {/* Mobile logout button */}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="sm:hidden flex items-center justify-center p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden border-t border-[rgba(255,255,255,0.05)] bg-[#1A1A1E]">
          <div className="flex justify-around py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'text-[#D4AF37]'
                      : 'text-[#6B6B70] hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Mobile trial banner */}
          {isTrialUser && trialTimeRemaining && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-500/10 border-t border-emerald-500/20">
              <Gift className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-emerald-400">
                Essai : {trialTimeRemaining}
              </span>
              <button
                onClick={handleSubscribe}
                className="text-xs text-[#D4AF37] font-semibold ml-2 flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                S&apos;abonner
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {accessChecked ? children : (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#242428] rounded-2xl border border-white/10 shadow-xl max-w-sm w-full overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">Déconnexion</h3>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                  <LogOut className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-gray-300 mb-6">
                  Êtes-vous sûr de vouloir vous déconnecter ?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 px-4 py-2.5 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-lg font-medium transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loggingOut ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Déconnexion...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        Se déconnecter
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekend Block Modal */}
      <WeekendBlockModal
        isOpen={showWeekendBlock}
        trialExpiresAt={trialExpiresAt}
        onSubscribe={handleSubscribe}
      />
    </div>
  )
}
