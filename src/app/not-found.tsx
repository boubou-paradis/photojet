// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import Link from 'next/link'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'

// Page 404 personnalisée : Next.js renvoie bien le statut HTTP 404 et ajoute
// automatiquement un meta robots noindex. On conserve la navigation du site
// et on propose les pages principales pour retenir le visiteur.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0D0D0F] text-white flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-xl text-center space-y-6">
          <p className="text-7xl font-black text-gold-gradient">404</p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
            Cette page n&apos;existe pas (ou plus)
          </h1>
          <p className="text-gray-300 leading-relaxed">
            L&apos;adresse demandée est introuvable. Retrouvez l&apos;essentiel d&apos;AnimaJet
            ci-dessous, ou repartez de la page d&apos;accueil.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold hover:brightness-110 transition-all"
            >
              Retour à l&apos;accueil
            </Link>
            <Link
              href="/fonctionnalites"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/25 bg-white/5 font-semibold hover:bg-white/10 transition-all"
            >
              Voir les fonctionnalités
            </Link>
          </div>
          <p className="text-sm text-gray-400 pt-4">
            Ou explorez :{' '}
            <Link href="/animation-mariage-interactive" className="text-[#E5C349] hover:underline">animation de mariage</Link>,{' '}
            <Link href="/quiz-interactif" className="text-[#E5C349] hover:underline">quiz interactif</Link>,{' '}
            <Link href="/blind-test-musical" className="text-[#E5C349] hover:underline">blind test musical</Link>,{' '}
            <Link href="/partage-photo-evenement" className="text-[#E5C349] hover:underline">partage photo en direct</Link>{' '}
            ou le <Link href="/blog" className="text-[#E5C349] hover:underline">blog</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
