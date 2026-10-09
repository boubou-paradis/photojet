// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Polices propres à AnimaBuzz (chargées seulement sur ses pages) :
// Archivo Black pour les grands textes de jeu (« LUNA ! », « BUZZ ! »),
// Lilita One + Kaushan Script pour le logo validé (reproduction de la carte).
// Inter et Playfair viennent déjà du layout racine.

import { Archivo_Black, Kaushan_Script, Lilita_One } from 'next/font/google'

const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-bz-display' })
const lilita = Lilita_One({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-bz-title' })
const kaushan = Kaushan_Script({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-bz-script' })

/** À poser sur la racine de chaque écran AnimaBuzz. */
export const buzzerFontVars = `${archivo.variable} ${lilita.variable} ${kaushan.variable}`
