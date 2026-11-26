// Maquette : barre du haut + pied de page communs + icônes (tracés Lucide simplifiés). Aucune donnée réelle.
const ICONES = {
  dash: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tablette: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sortie: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  manette: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><rect x="2" y="6" width="20" height="12" rx="6"/>',
  ecran: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  invites: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  bulle: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  bouclier_off: '<path d="m2 2 20 20"/><path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.7 9a1 1 0 0 0 .6 0 13 13 0 0 0 4-2.3"/><path d="M9.3 3.5 11.4 2.2a1 1 0 0 1 1.2 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1v7a9 9 0 0 1-.3 2.1"/>',
  eclair: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  copier: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  ouvrir: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  imprimante: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  calendrier: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  carte: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  note: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  poubelle: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  dossier: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  ouverture: '<circle cx="12" cy="12" r="10"/><path d="m14.3 8 5.7 9.9M9.7 8h11.5M7.4 12l5.7-9.9M9.7 16 4 6.1M14.3 16H2.8M16.6 12l-5.7 9.9"/>',
  retour: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  fichier: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  coche: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.6-1.7h2c3.1 0 5.6-2.5 5.6-5.6C22 6 17.5 2 12 2z"/>',
  affiche: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10M7 11h10M7 15h6"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  etoile: '<path d="M12 3 14.5 9 21 9.5 16 14l1.5 6.5L12 17l-5.5 3.5L8 14 3 9.5 9.5 9z"/>',
};
function ico(n) { return `<svg class="i" viewBox="0 0 24 24">${ICONES[n] || ''}</svg>`; }
document.querySelectorAll('[data-i]').forEach((el) => el.insertAdjacentHTML('afterbegin', ico(el.dataset.i)));

const page = document.body.dataset.page;
document.querySelector('#barre').outerHTML = `
<header class="barre">
  <a class="logo" href="tableau-de-bord.html"><img src="assets/logo-embleme.png" alt=""><span><b>Anima</b>Jet</span></a>
  <nav class="nav">
    <a href="tableau-de-bord.html" class="${page === 'dash' ? 'actif' : ''}">${ico('dash')}Tableau de bord</a>
    <a href="#">${ico('tablette')}AnimaBooth</a>
    <a href="parametres.html" class="${page === 'param' ? 'actif' : ''}">${ico('reglages')}Paramètres</a>
  </nav>
  <div class="droite-barre"><button class="btn-deco">${ico('sortie')}Déconnexion</button></div>
</header>`;
document.querySelector('#pied').outerHTML = `
<footer class="pied">
  <span>© 2026 AnimaJet</span>
  <nav><a href="#">Événementiel</a><a href="#">Mariage</a><a href="#">Entreprise</a><a href="#">DJ</a><a href="#">Mentions légales</a><a href="#">CGV</a><a href="#">Confidentialité</a></nav>
  <span style="width:110px"></span>
</footer>`;
