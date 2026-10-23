// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Polices des modèles AnimaJet (licence OFL), chargées seulement par l'écran
// des modèles : le texte est dessiné sur un canvas avec ces familles.

import { Bebas_Neue, Cormorant_Garamond, Great_Vibes, Inter } from 'next/font/google'
import type { PresetFonts } from '@/lib/borne-templates/presets'

const greatVibes = Great_Vibes({ weight: '400', subsets: ['latin'], display: 'swap' })
const cormorant = Cormorant_Garamond({ weight: '500', style: ['normal', 'italic'], subsets: ['latin'], display: 'swap' })
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap' })
const inter = Inter({ weight: ['600', '700'], subsets: ['latin'], display: 'swap' })

export const PRESET_FONTS: PresetFonts = {
  script: greatVibes.style.fontFamily,
  serif: cormorant.style.fontFamily,
  display: bebas.style.fontFamily,
  sans: inter.style.fontFamily,
}

/** Attend que les polices soient prêtes avant de dessiner (sinon police de secours). */
export async function loadPresetFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load(`132px ${PRESET_FONTS.script}`),
    document.fonts.load(`500 46px ${PRESET_FONTS.serif}`),
    document.fonts.load(`italic 500 120px ${PRESET_FONTS.serif}`),
    document.fonts.load(`150px ${PRESET_FONTS.display}`),
    document.fonts.load(`700 40px ${PRESET_FONTS.sans}`),
    document.fonts.load(`600 40px ${PRESET_FONTS.sans}`),
  ])
}
