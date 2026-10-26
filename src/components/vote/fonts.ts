// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Polices propres à AnimaVote (chargées seulement sur ses pages), celles de
// la maquette validée : Lilita One + Kaushan Script pour le logo, Unbounded
// pour les grands textes de scène, Manrope pour l'interface.

import { Kaushan_Script, Lilita_One, Manrope, Unbounded } from 'next/font/google'

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-av-logo' })
const kaushan = Kaushan_Script({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-av-script' })
const unbounded = Unbounded({ weight: ['600', '800', '900'], subsets: ['latin'], display: 'swap', variable: '--font-av-stage' })
const manrope = Manrope({ weight: ['400', '500', '700', '800'], subsets: ['latin'], display: 'swap', variable: '--font-av-ui' })

/** À poser sur la racine de chaque écran AnimaVote. */
export const voteFontVars = `${lilita.variable} ${kaushan.variable} ${unbounded.variable} ${manrope.variable}`
