'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'

export default function ConfidentialitePage() {
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

        <h1 className="text-3xl sm:text-4xl font-bold text-[#D4AF37] mb-2">Politique de Confidentialité</h1>
        <p className="text-gray-400 mb-8">Dernière mise à jour : Janvier 2025</p>

        <div className="space-y-10 text-gray-300 leading-relaxed">
          {/* Introduction */}
          <section className="bg-[#242428] rounded-lg p-6 border border-[#D4AF37]/20">
            <h2 className="text-xl font-semibold text-[#D4AF37] mb-4">Introduction</h2>
            <p className="mb-4">
              MG Events Animation, éditeur du site animajet.fr, s&apos;engage à protéger la vie privée des utilisateurs de son service.
            </p>
            <p>
              La présente Politique de Confidentialité décrit comment nous collectons, utilisons et protégeons vos données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
            </p>
          </section>

          {/* Section 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">1. Responsable du traitement</h2>
            <p className="mb-4">Le responsable du traitement des données est :</p>
            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
              <p className="font-semibold text-white">MG Events Animation</p>
              <p>Guillaume Morel</p>
              <p>10 Lan Lande des Couëdies</p>
              <p>35600 Bains-sur-Oust</p>
              <p className="mt-2">Email : <a href="mailto:mg.events35@gmail.com" className="text-[#D4AF37] hover:underline">mg.events35@gmail.com</a></p>
              <p>Téléphone : 06 48 10 61 66</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">2. Données collectées</h2>

            <h3 className="text-lg font-semibold text-white mb-2">2.1 Données fournies par l&apos;utilisateur</h3>
            <ul className="list-disc ml-6 space-y-1 mb-4">
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Numéro de téléphone (optionnel)</li>
              <li>Informations de paiement (traitées par Stripe)</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">2.2 Données collectées automatiquement</h3>
            <ul className="list-disc ml-6 space-y-1 mb-4">
              <li>Adresse IP</li>
              <li>Type de navigateur</li>
              <li>Pages visitées</li>
              <li>Date et heure de connexion</li>
              <li>Données de session</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">2.3 Données liées à l&apos;utilisation du service</h3>
            <ul className="list-disc ml-6 space-y-1">
              <li>Photos uploadées par les invités (borne photo)</li>
              <li>Configurations des jeux</li>
              <li>Statistiques d&apos;utilisation</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">3. Finalités du traitement</h2>
            <p className="mb-4">Vos données sont collectées pour :</p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#D4AF37]/30">
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Finalité</th>
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Base légale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr><td className="py-3 px-4">Création et gestion de votre compte</td><td className="py-3 px-4">Exécution du contrat</td></tr>
                  <tr><td className="py-3 px-4">Fourniture du service AnimaJet</td><td className="py-3 px-4">Exécution du contrat</td></tr>
                  <tr><td className="py-3 px-4">Traitement des paiements</td><td className="py-3 px-4">Exécution du contrat</td></tr>
                  <tr><td className="py-3 px-4">Envoi d&apos;emails de service (confirmation, factures)</td><td className="py-3 px-4">Exécution du contrat</td></tr>
                  <tr><td className="py-3 px-4">Support client</td><td className="py-3 px-4">Intérêt légitime</td></tr>
                  <tr><td className="py-3 px-4">Amélioration du service</td><td className="py-3 px-4">Intérêt légitime</td></tr>
                  <tr><td className="py-3 px-4">Envoi de newsletters (si consentement)</td><td className="py-3 px-4">Consentement</td></tr>
                  <tr><td className="py-3 px-4">Respect des obligations légales</td><td className="py-3 px-4">Obligation légale</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">4. Destinataires des données</h2>
            <p className="mb-4">Vos données peuvent être transmises à :</p>
            <ul className="list-disc ml-6 space-y-1 mb-4">
              <li><strong className="text-white">Stripe</strong> : pour le traitement des paiements</li>
              <li><strong className="text-white">Vercel</strong> : pour l&apos;hébergement du site</li>
              <li><strong className="text-white">Supabase</strong> : pour le stockage des données</li>
              <li><strong className="text-white">Resend</strong> : pour l&apos;envoi d&apos;emails</li>
            </ul>
            <p className="mb-4">Ces prestataires sont soumis à des obligations de confidentialité et de sécurité.</p>
            <p className="font-semibold text-white">Nous ne vendons jamais vos données à des tiers.</p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">5. Transferts hors UE</h2>
            <p className="mb-2">Certains de nos prestataires sont situés aux États-Unis. Les transferts de données sont encadrés par :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Les Clauses Contractuelles Types de la Commission Européenne</li>
              <li>Le Data Privacy Framework (DPF) pour les prestataires certifiés</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">6. Durée de conservation</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#D4AF37]/30">
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Type de données</th>
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Durée de conservation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr><td className="py-3 px-4">Données de compte</td><td className="py-3 px-4">Durée de l&apos;abonnement + 3 ans</td></tr>
                  <tr><td className="py-3 px-4">Données de facturation</td><td className="py-3 px-4">10 ans (obligation légale)</td></tr>
                  <tr><td className="py-3 px-4">Photos uploadées</td><td className="py-3 px-4">30 jours après l&apos;événement</td></tr>
                  <tr><td className="py-3 px-4">Logs de connexion</td><td className="py-3 px-4">1 an</td></tr>
                  <tr><td className="py-3 px-4">Cookies</td><td className="py-3 px-4">13 mois maximum</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">À l&apos;issue de ces délais, les données sont supprimées ou anonymisées.</p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">7. Vos droits</h2>
            <p className="mb-4">Conformément au RGPD, vous disposez des droits suivants :</p>

            <div className="space-y-4">
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.1 Droit d&apos;accès</h3>
                <p>Vous pouvez obtenir une copie de vos données personnelles.</p>
              </div>
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.2 Droit de rectification</h3>
                <p>Vous pouvez demander la correction de données inexactes.</p>
              </div>
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.3 Droit à l&apos;effacement</h3>
                <p>Vous pouvez demander la suppression de vos données (sauf obligation légale de conservation).</p>
              </div>
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.4 Droit à la limitation</h3>
                <p>Vous pouvez demander la limitation du traitement de vos données.</p>
              </div>
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.5 Droit à la portabilité</h3>
                <p>Vous pouvez récupérer vos données dans un format structuré.</p>
              </div>
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.6 Droit d&apos;opposition</h3>
                <p>Vous pouvez vous opposer au traitement de vos données pour des raisons légitimes.</p>
              </div>
              <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
                <h3 className="font-semibold text-white mb-1">7.7 Droit de retrait du consentement</h3>
                <p>Vous pouvez retirer votre consentement à tout moment (newsletters, etc.).</p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">8. Exercer vos droits</h2>
            <p className="mb-4">Pour exercer vos droits, contactez-nous :</p>
            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
              <p><strong className="text-white">Email :</strong> <a href="mailto:mg.events35@gmail.com" className="text-[#D4AF37] hover:underline">mg.events35@gmail.com</a></p>
              <p className="mt-3"><strong className="text-white">Courrier :</strong></p>
              <p>MG Events Animation</p>
              <p>Guillaume Morel</p>
              <p>10 Lan Lande des Couëdies</p>
              <p>35600 Bains-sur-Oust</p>
            </div>
            <p className="mt-4">Nous répondrons dans un délai d&apos;un mois maximum.</p>
            <p className="mt-2">En cas de doute sur votre identité, nous pourrons vous demander une copie d&apos;une pièce d&apos;identité.</p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">9. Sécurité des données</h2>
            <p className="mb-4">Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Chiffrement SSL/TLS des communications</li>
              <li>Stockage sécurisé des mots de passe (hashage)</li>
              <li>Accès restreint aux données personnelles</li>
              <li>Sauvegardes régulières</li>
              <li>Mises à jour de sécurité</li>
            </ul>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">10. Cookies</h2>

            <h3 className="text-lg font-semibold text-white mb-2">10.1 Qu&apos;est-ce qu&apos;un cookie ?</h3>
            <p className="mb-4">Un cookie est un petit fichier déposé sur votre appareil lors de la visite d&apos;un site.</p>

            <h3 className="text-lg font-semibold text-white mb-2">10.2 Cookies utilisés</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#D4AF37]/30">
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Cookie</th>
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Finalité</th>
                    <th className="text-left py-3 px-4 text-[#D4AF37] font-semibold">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr><td className="py-3 px-4">Session</td><td className="py-3 px-4">Maintien de la connexion</td><td className="py-3 px-4">Session</td></tr>
                  <tr><td className="py-3 px-4">Préférences</td><td className="py-3 px-4">Mémoriser vos choix</td><td className="py-3 px-4">1 an</td></tr>
                  <tr><td className="py-3 px-4">Analytics</td><td className="py-3 px-4">Statistiques de visite</td><td className="py-3 px-4">13 mois</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">10.3 Gestion des cookies</h3>
            <p>Vous pouvez configurer votre navigateur pour refuser les cookies. Cela peut affecter le fonctionnement du site.</p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">11. Photos uploadées (Borne Photo)</h2>
            <p className="mb-2">Les photos uploadées par les invités via la fonction Borne Photo :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Sont stockées temporairement pour l&apos;affichage en direct</li>
              <li>Sont automatiquement supprimées 30 jours après l&apos;événement</li>
              <li>Ne sont pas utilisées à d&apos;autres fins</li>
              <li>Peuvent être supprimées à tout moment par l&apos;organisateur</li>
            </ul>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">12. Mineurs</h2>
            <p>
              Le service AnimaJet est destiné aux professionnels de l&apos;événementiel. Nous ne collectons pas sciemment de données de mineurs de moins de 16 ans.
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">13. Réclamation</h2>
            <p className="mb-4">
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL :
            </p>
            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
              <p className="font-semibold text-white">CNIL</p>
              <p>3 Place de Fontenoy</p>
              <p>TSA 80715</p>
              <p>75334 Paris Cedex 07</p>
              <p className="mt-2">
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">
                  www.cnil.fr
                </a>
              </p>
            </div>
          </section>

          {/* Section 14 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">14. Modification de la politique</h2>
            <p className="mb-4">
              Cette politique peut être modifiée à tout moment. En cas de modification substantielle, nous vous en informerons par email.
            </p>
            <p>La date de dernière mise à jour est indiquée en haut du document.</p>
          </section>

          {/* Section 15 - Contact */}
          <section className="bg-[#242428] rounded-lg p-6 border border-[#D4AF37]/20">
            <h2 className="text-xl font-semibold text-[#D4AF37] mb-4">15. Contact</h2>
            <p className="mb-4">Pour toute question concernant cette politique :</p>
            <p className="font-semibold text-white">MG Events Animation</p>
            <p>Guillaume Morel</p>
            <p>10 Lan Lande des Couëdies</p>
            <p>35600 Bains-sur-Oust</p>
            <p className="mt-2">Email : <a href="mailto:mg.events35@gmail.com" className="text-[#D4AF37] hover:underline">mg.events35@gmail.com</a></p>
            <p>Téléphone : 06 48 10 61 66</p>
            <p>Site : <a href="https://animajet.fr" className="text-[#D4AF37] hover:underline">animajet.fr</a></p>
          </section>

          {/* Acceptance notice */}
          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4 text-center">
            <p className="text-white font-medium">
              En utilisant AnimaJet, vous reconnaissez avoir pris connaissance de cette Politique de Confidentialité.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
