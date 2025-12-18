'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Settings,
  Tablet,
  LogOut,
  X,
} from 'lucide-react'
import AnimaJetLogo from '@/components/branding/AnimaJetLogo'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/admin/borne', label: 'Borne Photo', icon: Tablet },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

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

            {/* Logout button */}
            <div className="flex items-center gap-2">
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
        <nav className="md:hidden border-t border-[rgba(255,255,255,0.05)] px-2 py-2 overflow-x-auto">
          <div className="flex gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                      : 'text-[#B0B0B5] hover:bg-[#2E2E33]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="pb-16">{children}</main>

      {/* Footer */}
      <Footer fixed />

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowLogoutModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-[#D4AF37]/20 shadow-2xl overflow-hidden"
            >
              {/* Gold accent line */}
              <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

              {/* Close button */}
              <button
                onClick={() => setShowLogoutModal(false)}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Content */}
              <div className="p-6">
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <LogOut className="h-8 w-8 text-red-400" />
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-white text-center mb-2">
                  Déconnexion
                </h2>

                {/* Message */}
                <p className="text-gray-400 text-center text-sm mb-6">
                  Êtes-vous sûr de vouloir vous déconnecter ?<br />
                  <span className="text-[#D4AF37]/80">Vos données d&apos;événement sont sauvegardées et ne seront pas perdues.</span>
                </p>

                {/* Buttons */}
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
    </div>
  )
}
