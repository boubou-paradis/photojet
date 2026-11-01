// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import sharp from 'sharp'

/**
 * Incruste le calque dans les pixels d'une copie de la photo (JPEG).
 * Le calque est carré et recadré sur la photo : pas de raccords de tuiles, et pas
 * de texte rendu sur le serveur (aucune police fiable sur Vercel).
 */
export async function applyWatermark(source: Buffer, calque: Buffer, largeur?: number): Promise<Buffer> {
  const image = sharp(source, { failOn: 'none' }).rotate()
  const base = await (largeur
    ? image.resize({ width: largeur, withoutEnlargement: true })
    : image
  ).toBuffer()

  const { width, height } = await sharp(base).metadata()
  const cote = Math.max(width, height)
  const motif = await sharp(calque)
    .resize(cote, cote)
    .extract({ left: 0, top: 0, width, height })
    .png()
    .toBuffer()

  return sharp(base).composite([{ input: motif }]).jpeg({ quality: 85 }).toBuffer()
}
