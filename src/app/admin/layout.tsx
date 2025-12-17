'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Settings,
  Tablet,
  ExternalLink,
} from 'lucide-react'
import AnimaJetLogo from '@/components/branding/AnimaJetLogo'
import Footer from '@/components/Footer'

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

            {/* Mobile menu & quick actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm text-[#B0B0B5] hover:text-[#D4AF37] transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Accueil</span>
              </Link>
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
    </div>
  )
}
