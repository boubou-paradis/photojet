'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'

export default function CGVPage() {
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

        <h1 className="text-3xl sm:text-4xl font-bold text-[#D4AF37] mb-2">Conditions Générales de Vente</h1>
        <p className="text-gray-400 mb-8">Dernière mise à jour : Janvier 2025</p>

        <div className="space-y-10 text-gray-300 leading-relaxed">
          {/* Article 1 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 1 - Objet</h2>
            <p className="mb-4">Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre :</p>

            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20 mb-4">
              <p className="font-semibold text-white mb-2">Le Prestataire :</p>
              <p>MG Events Animation</p>
              <p>Guillaume Morel</p>
              <p>10 Lan Lande des Couëdies</p>
              <p>35600 Bains-sur-Oust</p>
              <p>SIRET : 499 112 308 00030</p>
              <p>Email : <a href="mailto:animajet3@gmail.com" className="text-[#D4AF37] hover:underline">animajet3@gmail.com</a></p>
              <p className="mt-3 italic text-gray-400">Ci-après dénommé &quot;AnimaJet&quot;</p>
            </div>

            <p><strong className="text-white">Et</strong> toute personne physique ou morale souscrivant à un abonnement sur le site animajet.fr, ci-après dénommée &quot;le Client&quot;.</p>
          </section>

          {/* Article 2 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 2 - Description du service</h2>
            <p className="mb-4">
              AnimaJet est une plateforme web (SaaS) proposant des jeux interactifs destinés à l&apos;animation d&apos;événements (mariages, anniversaires, soirées d&apos;entreprise, etc.).
            </p>
            <p className="mb-2">Le service comprend :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>L&apos;accès à 7 jeux interactifs (Roue de la Destinée, Photo Mystère, Blind Test, Quiz, Vote Photo, Défis Photo, Le Bon Ordre)</li>
              <li>La fonction Borne Photo avec partage en direct</li>
              <li>Un tableau de bord de gestion</li>
              <li>Les mises à jour de la plateforme</li>
            </ul>
          </section>

          {/* Article 3 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 3 - Accès au service</h2>

            <h3 className="text-lg font-semibold text-white mb-2">3.1 Conditions d&apos;accès</h3>
            <p className="mb-2">L&apos;accès au service nécessite :</p>
            <ul className="list-disc ml-6 space-y-1 mb-4">
              <li>Une connexion internet</li>
              <li>Un appareil compatible (ordinateur, tablette, smartphone)</li>
              <li>Un écran ou vidéoprojecteur pour l&apos;affichage des jeux</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">3.2 Création de compte</h3>
            <p>
              Le Client doit créer un compte en fournissant des informations exactes et à jour. Le Client est responsable de la confidentialité de ses identifiants de connexion.
            </p>
          </section>

          {/* Article 4 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 4 - Tarifs et paiement</h2>

            <h3 className="text-lg font-semibold text-white mb-2">4.1 Prix</h3>
            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20 mb-4">
              <p className="text-2xl font-bold text-[#D4AF37]">29,90 € TTC par mois</p>
              <p className="text-sm text-gray-400 mt-1">TVA non applicable, article 293 B du CGI (micro-entreprise).</p>
            </div>
            <p className="mb-4">
              Les prix peuvent être modifiés à tout moment. Les modifications tarifaires s&apos;appliquent aux nouveaux abonnements et aux renouvellements.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">4.2 Paiement</h3>
            <p className="mb-4">
              Le paiement s&apos;effectue par carte bancaire via la plateforme sécurisée Stripe. Le paiement est dû à la souscription puis à chaque date anniversaire mensuelle.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">4.3 Facturation</h3>
            <p>Une facture est envoyée par email à chaque paiement.</p>
          </section>

          {/* Article 5 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 5 - Durée et résiliation</h2>

            <h3 className="text-lg font-semibold text-white mb-2">5.1 Durée</h3>
            <p className="mb-4">
              L&apos;abonnement est conclu pour une durée d&apos;un mois, renouvelable tacitement par périodes successives d&apos;un mois.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">5.2 Résiliation par le Client</h3>
            <p className="mb-4">
              Le Client peut résilier son abonnement à tout moment depuis son espace client ou en contactant <a href="mailto:animajet3@gmail.com" className="text-[#D4AF37] hover:underline">animajet3@gmail.com</a>.
            </p>
            <p className="mb-4">
              La résiliation prend effet à la fin de la période en cours. Aucun remboursement prorata temporis n&apos;est effectué.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">5.3 Résiliation par AnimaJet</h3>
            <p className="mb-2">AnimaJet se réserve le droit de résilier l&apos;abonnement en cas de :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Non-paiement</li>
              <li>Violation des présentes CGV</li>
              <li>Utilisation abusive ou frauduleuse du service</li>
            </ul>
          </section>

          {/* Article 6 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 6 - Droit de rétractation</h2>

            <h3 className="text-lg font-semibold text-white mb-2">6.1 Délai de rétractation</h3>
            <p className="mb-4">
              Conformément à l&apos;article L221-18 du Code de la consommation, le Client dispose d&apos;un délai de 14 jours à compter de la souscription pour exercer son droit de rétractation, sans avoir à justifier de motif.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">6.2 Exercice du droit de rétractation</h3>
            <p className="mb-4">
              Pour exercer ce droit, le Client doit envoyer une demande claire à : <a href="mailto:animajet3@gmail.com" className="text-[#D4AF37] hover:underline">animajet3@gmail.com</a>
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">6.3 Remboursement</h3>
            <p className="mb-4">
              En cas de rétractation, AnimaJet remboursera le Client dans un délai de 14 jours suivant la réception de la demande.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">6.4 Exception</h3>
            <p>
              Si le Client a commencé à utiliser le service pendant le délai de rétractation, il sera redevable d&apos;un montant proportionnel au service fourni.
            </p>
          </section>

          {/* Article 7 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 7 - Obligations du Client</h2>
            <p className="mb-2">Le Client s&apos;engage à :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Utiliser le service conformément à sa destination</li>
              <li>Ne pas tenter de contourner les mesures de sécurité</li>
              <li>Ne pas revendre ou sous-licencier le service</li>
              <li>Ne pas diffuser de contenu illicite via la plateforme</li>
              <li>Respecter les droits de propriété intellectuelle</li>
            </ul>
          </section>

          {/* Article 8 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 8 - Obligations d&apos;AnimaJet</h2>
            <p className="mb-2">AnimaJet s&apos;engage à :</p>
            <ul className="list-disc ml-6 space-y-1">
              <li>Fournir un service conforme à la description</li>
              <li>Assurer la maintenance et les mises à jour de la plateforme</li>
              <li>Mettre en œuvre les moyens nécessaires pour assurer la disponibilité du service</li>
              <li>Protéger les données personnelles du Client</li>
            </ul>
          </section>

          {/* Article 9 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 9 - Disponibilité du service</h2>
            <p className="mb-4">
              AnimaJet s&apos;efforce d&apos;assurer une disponibilité du service 24h/24 et 7j/7.
            </p>
            <p className="mb-4">
              Toutefois, AnimaJet ne peut garantir une disponibilité sans interruption et se réserve le droit d&apos;interrompre temporairement le service pour des opérations de maintenance.
            </p>
            <p>
              AnimaJet ne saurait être tenu responsable des interruptions dues à des causes indépendantes de sa volonté (coupure internet, panne serveur tiers, etc.).
            </p>
          </section>

          {/* Article 10 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 10 - Responsabilité</h2>

            <h3 className="text-lg font-semibold text-white mb-2">10.1 Limitation de responsabilité</h3>
            <p className="mb-4">
              La responsabilité d&apos;AnimaJet est limitée au montant des sommes versées par le Client au cours des 12 derniers mois.
            </p>
            <p className="mb-2">AnimaJet ne saurait être tenu responsable :</p>
            <ul className="list-disc ml-6 space-y-1 mb-4">
              <li>Des dommages indirects</li>
              <li>Des pertes de données</li>
              <li>Du manque à gagner</li>
              <li>De l&apos;utilisation faite par le Client du service</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">10.2 Force majeure</h3>
            <p>
              AnimaJet ne saurait être tenu responsable en cas de force majeure telle que définie par la jurisprudence française.
            </p>
          </section>

          {/* Article 11 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 11 - Propriété intellectuelle</h2>
            <p className="mb-4">
              Le service AnimaJet, son interface, ses fonctionnalités et son code source sont la propriété exclusive de MG Events Animation.
            </p>
            <p>
              L&apos;abonnement confère au Client un droit d&apos;utilisation personnel, non exclusif et non transférable du service.
            </p>
          </section>

          {/* Article 12 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 12 - Données personnelles</h2>
            <p>
              Les données personnelles collectées sont traitées conformément à notre{' '}
              <Link href="/confidentialite" className="text-[#D4AF37] hover:underline">
                Politique de Confidentialité
              </Link>{' '}
              et au RGPD.
            </p>
          </section>

          {/* Article 13 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 13 - Support Client</h2>
            <p className="mb-4">
              Le support client est accessible par email à : <a href="mailto:animajet3@gmail.com" className="text-[#D4AF37] hover:underline">animajet3@gmail.com</a>
            </p>
            <p>AnimaJet s&apos;engage à répondre dans un délai raisonnable.</p>
          </section>

          {/* Article 14 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 14 - Modification des CGV</h2>
            <p className="mb-4">
              AnimaJet se réserve le droit de modifier les présentes CGV à tout moment.
            </p>
            <p className="mb-4">
              Les modifications seront notifiées par email au Client et entreront en vigueur 30 jours après leur notification.
            </p>
            <p>
              Si le Client n&apos;accepte pas les nouvelles CGV, il peut résilier son abonnement avant leur entrée en vigueur.
            </p>
          </section>

          {/* Article 15 */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">Article 15 - Droit applicable et litiges</h2>
            <p className="mb-4">Les présentes CGV sont soumises au droit français.</p>
            <p className="mb-4">En cas de litige, les parties s&apos;engagent à rechercher une solution amiable.</p>
            <p className="mb-4">À défaut, les tribunaux français seront seuls compétents.</p>

            <div className="bg-[#242428] rounded-lg p-4 border border-[#D4AF37]/20">
              <h3 className="text-lg font-semibold text-white mb-2">Médiation</h3>
              <p className="mb-2">
                Conformément à l&apos;article L612-1 du Code de la consommation, le Client peut recourir gratuitement à un médiateur de la consommation en cas de litige.
              </p>
              <p>
                Médiateur : CM2C - 14 rue Saint Jean - 75017 Paris -{' '}
                <a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">
                  www.cm2c.net
                </a>
              </p>
            </div>
          </section>

          {/* Article 16 - Contact */}
          <section className="bg-[#242428] rounded-lg p-6 border border-[#D4AF37]/20">
            <h2 className="text-xl font-semibold text-[#D4AF37] mb-4">Article 16 - Contact</h2>
            <p className="mb-4">Pour toute question relative aux présentes CGV :</p>
            <p className="font-semibold text-white">MG Events Animation</p>
            <p>Guillaume Morel</p>
            <p>10 Lan Lande des Couëdies</p>
            <p>35600 Bains-sur-Oust</p>
            <p className="mt-2">Email : <a href="mailto:animajet3@gmail.com" className="text-[#D4AF37] hover:underline">animajet3@gmail.com</a></p>
            <p>Téléphone : 06 48 10 61 66</p>
            <p>Site : <a href="https://animajet.fr" className="text-[#D4AF37] hover:underline">animajet.fr</a></p>
          </section>

          {/* Acceptance notice */}
          <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4 text-center">
            <p className="text-white font-medium">
              En souscrivant à AnimaJet, le Client reconnaît avoir pris connaissance des présentes CGV et les accepter sans réserve.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
