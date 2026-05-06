// Utilitaires pour le Pass Événement Week-end
// Fenêtre d'accès : vendredi 12h00 → lundi 12h00 (Europe/Paris)
// Fichier sans dépendance Node.js → importable côté client et serveur

/**
 * Calcule la date de fin du pass = prochain lundi 12h00 Europe/Paris (converti UTC)
 */
export function computePassValidityUntil(fromUTC: Date = new Date()): Date {
  const parisLocal = new Date(fromUTC.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const dow = parisLocal.getDay() // 0=Dim, 1=Lun, ..., 6=Sam
  const h = parisLocal.getHours()

  let daysToAdd: number
  if (dow === 1 && h < 12) {
    daysToAdd = 0   // Ce lundi avant 12h → ce lundi 12h
  } else if (dow === 1) {
    daysToAdd = 7   // Lundi après 12h → lundi prochain
  } else if (dow === 0) {
    daysToAdd = 1   // Dimanche → demain
  } else {
    daysToAdd = (8 - dow) % 7 // Autres jours → prochain lundi
  }

  const targetParis = new Date(parisLocal)
  targetParis.setDate(targetParis.getDate() + daysToAdd)
  targetParis.setHours(12, 0, 0, 0)

  // Recalculer l'offset Paris à la date cible (gestion heure d'été)
  const targetApprox = new Date(fromUTC.getTime() + daysToAdd * 86_400_000)
  const targetParisApprox = new Date(targetApprox.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const offsetMs = targetApprox.getTime() - targetParisApprox.getTime()

  return new Date(targetParis.getTime() + offsetMs)
}

/**
 * Vérifie si on est dans la fenêtre d'achat (vendredi 12h → lundi 12h Paris)
 */
export function isWeekendPassAvailable(): boolean {
  const paris = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const dow = paris.getDay()
  const h = paris.getHours()

  if (dow === 5 && h >= 12) return true  // Vendredi après 12h
  if (dow === 6) return true              // Samedi
  if (dow === 0) return true              // Dimanche
  if (dow === 1 && h < 12) return true   // Lundi avant 12h
  return false
}

/**
 * Retourne le prochain vendredi 12h Paris (pour afficher "disponible à partir de...")
 */
export function getNextWeekendPassStart(): Date {
  const now = new Date()
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const dow = paris.getDay()
  const h = paris.getHours()

  let daysToFriday: number
  if (dow === 5 && h < 12) {
    daysToFriday = 0   // Ce vendredi avant 12h
  } else if (dow === 5) {
    daysToFriday = 7   // Vendredi prochain
  } else {
    daysToFriday = (5 - dow + 7) % 7 || 7
  }

  const targetParis = new Date(paris)
  targetParis.setDate(targetParis.getDate() + daysToFriday)
  targetParis.setHours(12, 0, 0, 0)

  const targetApprox = new Date(now.getTime() + daysToFriday * 86_400_000)
  const targetParisApprox = new Date(targetApprox.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const offsetMs = targetApprox.getTime() - targetParisApprox.getTime()

  return new Date(targetParis.getTime() + offsetMs)
}

/**
 * Formate une date en heure Paris lisible (ex: "lundi 12 mai à 12h00")
 */
export function formatPassDate(date: Date): string {
  return date.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
