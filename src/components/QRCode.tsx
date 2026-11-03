// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import QRCodeLib, { type QRCodeProps } from 'react-qr-code'

/**
 * QR code marqué `data-qr` : le filigrane d'essai découpe un trou autour de
 * chaque élément marqué, pour qu'il reste toujours scannable.
 * Utiliser ce composant plutôt que `react-qr-code` directement.
 */
export default function QRCode(props: Omit<QRCodeProps, 'ref'>) {
  return <QRCodeLib data-qr="" {...props} />
}
