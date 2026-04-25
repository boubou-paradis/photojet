'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'
import ProtectedContact, { ProtectedEmail } from '@/components/ProtectedContact'

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#d1d5db] font-[family-name:var(--font-montserrat)]">
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
        <p className="text-gray-400 mb-10">Dernière mise à jour : avril 2026</p>

        <div className="space-y-12 leading-relaxed">

          {/* Article 1 — Éditeur */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              1. Éditeur du site
            </h2>
            <p className="mb-4">
              Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN),
              l&apos;éditeur du site www.animajet.fr est :
            </p>
            <div className="bg-[#13131f] rounded-lg p-5 border border-[#D4AF37]/20 space-y-1">
              <p className="font-semibold text-white">Guillaume Morel — Entrepreneur Individuel (EI)</p>
              <p>Nom commercial : MG Events</p>
              {/* TODO: Guillaume, vérifie que le numéro SIRET ci-dessous est bien le bon avant publication */}
              <p><ProtectedContact type="siret" /></p>
              <p>Adresse : 10 La Lande des Couédies, 35600 Bains-sur-Oust, France</p>
              <p><ProtectedContact type="phone" /></p>
              <p><ProtectedContact type="email" /></p>
              <p className="pt-1">Directeur de la publication : Guillaume Morel</p>
            </div>
          </section>

          {/* Article 2 — Hébergement */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              2. Hébergement
            </h2>
            <p className="mb-4">Le site est hébergé par :</p>
            <div className="bg-[#13131f] rounded-lg p-5 border border-[#D4AF37]/20 space-y-1">
              <p className="font-semibold text-white">Vercel Inc.</p>
              <p>340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</p>
              <p>
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF37] hover:underline"
                >
                  https://vercel.com
                </a>
              </p>
            </div>
          </section>

          {/* Article 3 — CGU */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-6">
              3. Conditions Générales d&apos;Utilisation
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.1 Objet</h3>
                <p>
                  AnimaJet est une plateforme en ligne (SaaS) d&apos;animations interactives destinée aux professionnels
                  de l&apos;événementiel (DJ, animateurs, organisateurs). Les présentes conditions régissent
                  l&apos;utilisation du service accessible à l&apos;adresse www.animajet.fr.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.2 Acceptation des conditions</h3>
                <p>
                  L&apos;utilisation du service implique l&apos;acceptation pleine et entière des présentes conditions
                  générales d&apos;utilisation. L&apos;éditeur se réserve le droit de modifier ces conditions à tout moment.
                  Les utilisateurs seront informés de toute modification par email ou notification sur la plateforme.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.3 Description du service</h3>
                <p className="mb-2">AnimaJet permet aux utilisateurs abonnés de :</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Créer et diffuser des animations interactives (Photo Mystère, Le Bon Ordre, Roue de la Destinée, Quiz)</li>
                  <li>Activer un système de partage de photos en live</li>
                  <li>Activer une borne photo numérique</li>
                  <li>Générer des QR codes permettant aux participants de rejoindre les animations depuis leur smartphone</li>
                  <li>Afficher les animations sur un écran géant ou vidéoprojecteur</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.4 Accès au service</h3>
                <p>
                  L&apos;accès au service nécessite une connexion internet. L&apos;éditeur s&apos;engage à mettre en
                  œuvre tous les moyens raisonnables pour assurer la disponibilité du service, sans toutefois garantir
                  une disponibilité permanente (voir article 4 — Limitation de responsabilité).
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.5 Abonnement et tarification</h3>
                <p className="mb-3">
                  L&apos;abonnement au service est proposé au tarif de{' '}
                  <span className="text-[#D4AF37] font-semibold">29,90€ TTC par mois</span>. Le paiement est géré par
                  Stripe (Stripe Inc., prestataire de paiement certifié PCI-DSS). L&apos;abonnement est sans engagement
                  et résiliable à tout moment depuis l&apos;espace utilisateur ou par demande à l&apos;éditeur.
                </p>
                <p>
                  Conformément à la loi n°2023-171 du 9 mars 2023 et au décret n°2023-417 du 1er juin 2023,
                  l&apos;utilisateur dispose d&apos;une fonctionnalité de résiliation accessible directement depuis
                  son espace personnel sur la plateforme.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">3.6 Droit de rétractation</h3>
                <p className="mb-3">
                  Conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation ne
                  s&apos;applique pas aux contrats de fourniture de contenu numérique non fourni sur un support
                  matériel dont l&apos;exécution a commencé avec l&apos;accord préalable exprès du consommateur et
                  pour lequel il a renoncé à son droit de rétractation.
                </p>
                <p>
                  Toutefois, l&apos;utilisateur peut résilier son abonnement à tout moment. La résiliation prend
                  effet à la fin de la période de facturation en cours.
                </p>
              </div>
            </div>
          </section>

          {/* Article 4 — Limitation de responsabilité */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-6">
              4. Limitation de responsabilité
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.1 Dépendance au réseau internet</h3>
                <p className="mb-2">
                  AnimaJet est une plateforme fonctionnant exclusivement via une connexion internet.
                  L&apos;éditeur ne saurait être tenu responsable :
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Des interruptions de service liées à des problèmes de connexion internet, de réseau mobile (3G/4G/5G), de Wi-Fi ou de toute infrastructure réseau sur le lieu de l&apos;événement</li>
                  <li>Des dysfonctionnements liés à l&apos;incompatibilité de certains appareils, navigateurs ou systèmes d&apos;exploitation des participants</li>
                  <li>De la qualité ou de la disponibilité du réseau internet sur le lieu de l&apos;événement, celle-ci relevant de la responsabilité de l&apos;organisateur ou du prestataire réseau</li>
                  <li>Des pertes de données, photos ou contenus partagés pendant un événement en cas de défaillance technique</li>
                  <li>Des dommages directs ou indirects résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utilisation du service</li>
                  <li>De toute perte financière, perte de clientèle ou préjudice commercial subi par l&apos;utilisateur du fait d&apos;un dysfonctionnement du service</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.2 Recommandations</h3>
                <p className="mb-2">
                  L&apos;utilisateur reconnaît que le bon fonctionnement d&apos;AnimaJet dépend de la qualité de la
                  connexion internet disponible sur le lieu de l&apos;événement. Il appartient à l&apos;utilisateur de :
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>S&apos;assurer de la disponibilité et de la stabilité de la connexion internet avant d&apos;utiliser le service</li>
                  <li>Tester la connexion internet sur le lieu de l&apos;événement avant le début de la prestation</li>
                  <li>Prévoir une solution de secours (partage de connexion mobile, routeur 4G, etc.)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.3 Force majeure</h3>
                <p>
                  L&apos;éditeur ne pourra être tenu responsable en cas de force majeure au sens de l&apos;article
                  1218 du Code civil, incluant notamment : coupure d&apos;électricité, défaillance du réseau internet,
                  catastrophe naturelle, pandémie, décision gouvernementale.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">4.4 Maintenance et indisponibilité</h3>
                <p>
                  L&apos;éditeur se réserve le droit d&apos;interrompre temporairement le service pour des raisons
                  de maintenance, de mise à jour ou d&apos;amélioration, sans que cela ouvre droit à une quelconque
                  indemnisation.
                </p>
              </div>
            </div>
          </section>

          {/* Article 5 — Propriété intellectuelle */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              5. Propriété intellectuelle
            </h2>
            <p className="mb-4">
              L&apos;ensemble des éléments du site AnimaJet (logo, textes, visuels, code source, base de données,
              animations, interfaces) sont la propriété exclusive de l&apos;éditeur et sont protégés par le Code de
              la propriété intellectuelle.
            </p>
            <p>
              Toute reproduction, représentation, modification, distribution ou exploitation, totale ou partielle,
              de ces éléments est strictement interdite sans autorisation préalable écrite de l&apos;éditeur,
              conformément aux articles L.335-2 et suivants du Code de la propriété intellectuelle.
            </p>
          </section>

          {/* Article 6 — RGPD */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-6">
              6. Données personnelles et RGPD
            </h2>
            <p className="mb-6">
              Conformément au Règlement Général sur la Protection des Données (UE) 2016/679 et à la loi n°78-17
              du 6 janvier 1978 modifiée (loi Informatique et Libertés) :
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.1 Responsable du traitement</h3>
                <div className="bg-[#13131f] rounded-lg p-4 border border-[#D4AF37]/20 space-y-1">
                  <p>Guillaume Morel — MG Events</p>
                  <p><ProtectedContact type="email" /></p>
                  <p><ProtectedContact type="phone" /></p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.2 Données collectées</h3>
                <p className="mb-2">Les données personnelles collectées sont :</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Adresse email (lors de l&apos;inscription)</li>
                  <li>Données de paiement (traitées par Stripe, non stockées sur nos serveurs)</li>
                  <li>Photos et contenus partagés par les participants lors des événements</li>
                  <li>Données de connexion et d&apos;utilisation (logs)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.3 Finalité du traitement</h3>
                <p className="mb-2">Les données sont collectées et traitées pour :</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>La gestion du compte utilisateur et de l&apos;abonnement</li>
                  <li>Le fonctionnement des animations interactives</li>
                  <li>L&apos;envoi de communications relatives au service (pas de prospection commerciale sans consentement)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.4 Base légale</h3>
                <p>
                  Le traitement des données repose sur l&apos;exécution du contrat d&apos;abonnement
                  (article 6.1.b du RGPD).
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.5 Durée de conservation</h3>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Données de compte : conservées pendant la durée de l&apos;abonnement et 30 jours après la résiliation</li>
                  <li>Photos partagées lors des événements : conservées 30 jours après l&apos;événement puis automatiquement supprimées</li>
                  <li>Données de facturation : conservées 10 ans conformément aux obligations comptables françaises (article L.123-22 du Code de commerce)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.6 Sous-traitants</h3>
                <p className="mb-2">Les données peuvent être traitées par les sous-traitants suivants :</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Vercel Inc. (hébergement) — États-Unis</li>
                  <li>Stripe Inc. (paiement) — États-Unis</li>
                  <li>Supabase Inc. (base de données) — États-Unis</li>
                </ul>
                <p className="mt-2">Ces transferts hors UE sont encadrés par le EU-US Data Privacy Framework.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.7 Droits de l&apos;utilisateur</h3>
                <p className="mb-2">
                  Conformément aux articles 15 à 22 du RGPD, l&apos;utilisateur dispose des droits suivants :
                </p>
                <ul className="list-disc ml-6 space-y-1 mb-3">
                  <li>Droit d&apos;accès à ses données personnelles</li>
                  <li>Droit de rectification des données inexactes</li>
                  <li>Droit à l&apos;effacement (droit à l&apos;oubli)</li>
                  <li>Droit à la limitation du traitement</li>
                  <li>Droit à la portabilité des données</li>
                  <li>Droit d&apos;opposition au traitement</li>
                </ul>
                <p>
                  Pour exercer ces droits, contactez : <ProtectedEmail /> ou <ProtectedContact type="phone" showLabel={false} />.
                  Réponse garantie sous 30 jours maximum.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">6.8 Réclamation</h3>
                <p className="mb-2">
                  En cas de litige relatif au traitement de vos données personnelles, vous pouvez introduire
                  une réclamation auprès de la Commission Nationale de l&apos;Informatique et des Libertés (CNIL) :
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>
                    Site :{' '}
                    <a
                      href="https://www.cnil.fr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#D4AF37] hover:underline"
                    >
                      www.cnil.fr
                    </a>
                  </li>
                  <li>Adresse : 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Article 7 — Cookies */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              7. Cookies
            </h2>
            <p>
              Le site AnimaJet utilise uniquement des cookies strictement nécessaires au fonctionnement du service
              (cookies de session, d&apos;authentification). Aucun cookie publicitaire ou de tracking tiers
              n&apos;est utilisé. Conformément à la directive ePrivacy et aux recommandations de la CNIL, les
              cookies strictement nécessaires ne requièrent pas le consentement préalable de l&apos;utilisateur.
            </p>
          </section>

          {/* Article 8 — Contenu généré par les utilisateurs */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              8. Contenu généré par les utilisateurs
            </h2>
            <p className="mb-4">
              Les photos et contenus partagés par les participants lors des événements sont sous la responsabilité
              de l&apos;organisateur de l&apos;événement. L&apos;éditeur met à disposition un système de modération
              permettant à l&apos;organisateur de filtrer les contenus inappropriés. L&apos;éditeur ne saurait être
              tenu responsable des contenus partagés par les participants.
            </p>
            <p>
              L&apos;éditeur se réserve le droit de supprimer tout contenu contraire à la loi française, aux bonnes
              mœurs ou aux présentes conditions d&apos;utilisation, sans préavis ni indemnisation.
            </p>
          </section>

          {/* Article 9 — Médiation */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              9. Médiation de la consommation
            </h2>
            <p className="mb-4">
              Conformément aux articles L.611-1 et suivants du Code de la consommation, en cas de litige non résolu
              directement avec l&apos;éditeur, l&apos;utilisateur consommateur peut recourir gratuitement à un
              médiateur de la consommation.
            </p>
            {/* TODO: Guillaume, inscris-toi sur la plateforme de la CECMC (https://www.economie.gouv.fr/mediation-conso)
                pour désigner un médiateur officiel et remplace ce bloc par ses coordonnées */}
            <div className="bg-[#13131f] rounded-lg p-4 border border-[#D4AF37]/20">
              <p className="text-gray-500 italic text-sm">
                Coordonnées du médiateur à compléter — en attente de désignation officielle.
              </p>
            </div>
          </section>

          {/* Article 10 — Droit applicable */}
          <section>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#D4AF37] mb-4">
              10. Droit applicable et juridiction compétente
            </h2>
            <p>
              Les présentes conditions sont régies par le droit français. En cas de litige, et à défaut de
              résolution amiable ou de médiation, les tribunaux de Rennes (Ille-et-Vilaine) seront seuls compétents.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-[#13131f] rounded-lg p-6 border border-[#D4AF37]/20">
            <h2 className="text-xl font-semibold text-[#D4AF37] mb-4">Contact</h2>
            <p className="mb-3">Pour toute question relative aux présentes mentions légales :</p>
            <p className="font-semibold text-white">MG Events — Guillaume Morel</p>
            <p>10 La Lande des Couédies, 35600 Bains-sur-Oust</p>
            <p className="mt-2"><ProtectedContact type="email" /></p>
            <p><ProtectedContact type="phone" /></p>
            <p>
              Site :{' '}
              <a href="https://animajet.fr" className="text-[#D4AF37] hover:underline">
                animajet.fr
              </a>
            </p>
          </section>

        </div>
      </div>

      <Footer />
    </div>
  )
}
