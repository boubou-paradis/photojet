'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'
import ProtectedContact, { ProtectedEmail } from '@/components/ProtectedContact'

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#1A1A1E] text-white font-[family-name:var(--font-montserrat)]">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#D4AF37] hover:text-[#F4E4BC] transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#D4AF37] mb-2">Mentions Légales</h1>
        <p className="text-gray-400 mb-8">Dernière mise à jour : Janvier 2025</p>

        <div className="space-y-10 text-gray-300 leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">1. Éditeur du site</h2>
            <p className="mb-4">Le site animajet.fr est édité par :</p>
            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
              <p className="font-semibold text-white mb-2">MG Events Animation</p>
              <p>Micro-entreprise</p>
              <p>Guillaume Morel</p>
              <p>10 Lan Lande des Couëdies</p>
              <p>35600 Bains-sur-Oust</p>
              <p>France</p>
              <p className="mt-3"><ProtectedContact type="email" /></p>
              <p><ProtectedContact type="phone" /></p>
              <p className="mt-3"><ProtectedContact type="siret" /></p>
              <p>Code APE : 9329Z (Autres activités récréatives et de loisirs)</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">2. Directeur de la publication</h2>
            <p>Guillaume Morel</p>
            <p><ProtectedContact type="email" /></p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">3. Hébergement</h2>
            <p className="mb-4">Le site est hébergé par :</p>
            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
              <p className="font-semibold text-white">Vercel Inc.</p>
              <p>340 S Lemon Ave #4133</p>
              <p>Walnut, CA 91789</p>
              <p>États-Unis</p>
              <p className="mt-2"><a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">https://vercel.com</a></p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">4. Propriété intellectuelle</h2>
            <p className="mb-4">
              L&apos;ensemble du contenu du site animajet.fr (textes, images, logos, vidéos, structure, design) est la propriété exclusive de MG Events Animation, sauf mention contraire.
            </p>
            <p className="mb-4">
              Toute reproduction, représentation, modification, publication, transmission ou dénaturation, totale ou partielle, du site ou de son contenu, par quelque procédé que ce soit, et sur quelque support que ce soit, est interdite sans l&apos;autorisation écrite préalable de MG Events Animation.
            </p>
            <p>
              Le logo et la marque AnimaJet sont la propriété de MG Events Animation.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">5. Données personnelles</h2>
            <p className="mb-4">
              La collecte et le traitement des données personnelles sont effectués conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
            </p>
            <p className="mb-4">
              Pour plus d&apos;informations, consultez notre{' '}
              <Link href="/confidentialite" className="text-[#D4AF37] hover:underline">
                Politique de Confidentialité
              </Link>.
            </p>
            <p className="mb-2">Conformément à la réglementation en vigueur, vous disposez des droits suivants :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Droit d&apos;accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l&apos;effacement</li>
              <li>Droit à la portabilité</li>
              <li>Droit d&apos;opposition</li>
            </ul>
            <p className="mt-4">
              Pour exercer ces droits, contactez-nous à : <ProtectedEmail />
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">6. Cookies</h2>
            <p className="mb-2">Le site animajet.fr utilise des cookies pour :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Assurer le bon fonctionnement du site</li>
              <li>Mémoriser vos préférences</li>
              <li>Réaliser des statistiques de visite</li>
            </ul>
            <p className="mt-4">Vous pouvez configurer votre navigateur pour refuser les cookies.</p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">7. Limitation de responsabilité</h2>
            <p className="mb-4">
              MG Events Animation s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur le site. Toutefois, MG Events Animation ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition.
            </p>
            <p className="mb-2">MG Events Animation décline toute responsabilité :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Pour toute interruption du site</li>
              <li>Pour toute survenance de bugs</li>
              <li>Pour tout dommage résultant d&apos;une intrusion frauduleuse d&apos;un tiers</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">8. Liens hypertextes</h2>
            <p>
              Le site peut contenir des liens vers d&apos;autres sites. MG Events Animation n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">9. Droit applicable</h2>
            <p>
              Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-[#242428] rounded-lg p-6 border border-[#D4AF37]/20">
            <h2 className="text-xl font-semibold text-[#D4AF37] mb-4">Contact</h2>
            <p className="mb-2">Pour toute question concernant ces mentions légales :</p>
            <p><ProtectedContact type="email" /></p>
            <p><ProtectedContact type="phone" /></p>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  )
}
