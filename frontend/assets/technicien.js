// ============================================
// Tag Box Lear — Page technicien (technicien.html)
// Permet au technicien de :
//   - Voir tous les tickets ouverts en temps réel
//   - Prendre en charge un ticket (pour éviter les doublons entre techniciens)
//   - Marquer un ticket comme résolu avec description de l'action effectuée
//   - Consulter l'historique des tickets résolus
// Rafraîchissement automatique toutes les 15 secondes.
// ============================================

// ---------- Session ----------
const session = TagBoxApp.requireSession('technicien');
TagBoxApp.startClock(['live-clock']);

let currentTab = 'open'; // onglet actif : 'open' ou 'resolved'
let currentFilters = { open: 'tous', resolved: 'tous' }; // filtre par type par onglet
let resolvedTicketsDateFrom = null;
let resolvedTicketsDateTo = null;

// typeMeta est une fonction (pas une constante) car les labels traduits doivent
// être réévalués à chaque changement de langue
const typeMeta = () => ({
  sec: { icon: 'ti-shield-exclamation', cls: 'sec', badge: 'badge-sec', label: TagBoxApp.t('badgeSec') },
  mai: { icon: 'ti-tool',              cls: 'mai', badge: 'badge-mai', label: TagBoxApp.t('badgeMai') },
  pro: { icon: 'ti-settings-2',        cls: 'pro', badge: 'badge-pro', label: TagBoxApp.t('badgePro') }
});

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Protection XSS : échappe les caractères spéciaux avant injection HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Stats ----------
// Met à jour les 4 compteurs en haut de page (total, sec, mai, pro)
// Appelée au chargement et toutes les 15s
async function refreshStats() {
  try {
    const stats = await TagBoxAPI.getStats();
    document.getElementById('count-total').textContent = stats.total;
    document.getElementById('count-sec').textContent = stats.sec;
    document.getElementById('count-mai').textContent = stats.mai;
    document.getElementById('count-pro').textContent = stats.pro;
  } catch (e) {
    TagBoxApp.showToast('Impossible de charger les statistiques.', 'error');
  }
}

// ---------- Rendu d'une liste de tickets ----------
// Génère et injecte les cartes ticket dans le DOM.
// `resolved` : true pour l'onglet "Tickets résolus", false pour "Tickets en cours"
// Pour les tickets ouverts, affiche un bouton selon l'état d'assignation :
//   - Pas assigné      → bouton "Prendre en charge" (bleu)
//   - Assigné à moi    → badge vert + bouton "Résoudre"
//   - Assigné à un autre → badge gris (lecture seule, aucun bouton)
// Ce mécanisme évite que deux techniciens interviennent sur le même ticket
function renderTicketList(containerId, tickets, resolved) {
  const t = TagBoxApp.t;
  const list = document.getElementById(containerId);
  const meta = typeMeta();
  list.innerHTML = '';

  tickets.forEach(ticket => {
    const m = meta[ticket.type];
    const el = document.createElement('div');
    el.className = `ticket ${ticket.priorite}`; // bordure gauche colorée selon priorité
    el.dataset.type = ticket.type;
    if (resolved) el.style.opacity = '0.6'; // tickets résolus plus discrets visuellement

    const dateLabel = ticket.date === todayStr() ? t('today') : ticket.date;

    // Construire la zone d'action selon l'état du ticket
    let actionHtml;
    if (resolved) {
      // Ticket déjà résolu — bouton désactivé en lecture seule
      actionHtml = `<button class="resolve-btn done"><i class="ti ti-check" aria-hidden="true"></i> ${t('resolved')}</button>`;
    } else if (!ticket.matricule_technicien_assigne) {
      // Ticket libre — n'importe quel technicien peut le prendre en charge
      actionHtml = `<button class="assign-btn" onclick="claimTicket(${ticket.id})"><i class="ti ti-user-plus" aria-hidden="true"></i> ${t('assignTicket')}</button>`;
    } else if (ticket.matricule_technicien_assigne === session.matricule) {
      // Ticket assigné à moi — je peux le résoudre
      actionHtml = `
        <span class="badge-assigned-me">${t('assignedByYou')}</span>
        <button class="resolve-btn" onclick="openResolveModal(${ticket.id})"><i class="ti ti-check" aria-hidden="true"></i> ${t('resolve')}</button>`;
    } else {
      // Ticket assigné à un autre technicien — lecture seule, afficher son nom
      const assignedName = ticket.nom_technicien_assigne || ticket.matricule_technicien_assigne;
      actionHtml = `<span class="badge-assigned-other">${t('assignedBy')} ${escapeHtml(assignedName)}</span>`;
    }

    el.innerHTML = `
      <div class="ticket-type-icon ${m.cls}"><i class="ti ${m.icon}" aria-hidden="true"></i></div>
      <div class="ticket-body">
        <div class="ticket-machine">${t('machineLabel')} ${ticket.machine} — ${t('matriculeShort')} ${ticket.matricule}</div>
        <div class="ticket-desc">${escapeHtml(ticket.description)}</div>
        <div class="ticket-meta">${dateLabel} ${t('at')} ${ticket.heure}</div>
        ${resolved && ticket.action_effectuee
          ? `<div class="ticket-action">${t('actionEffectueeShort')} : ${escapeHtml(ticket.action_effectuee)}</div>`
          : ''
        }
      </div>
      <div class="ticket-right">
        <span class="badge-type ${m.badge}">${m.label}</span>
        ${actionHtml}
      </div>
    `;
    list.appendChild(el);
  });
}

// ---------- Chargement des tickets ----------
async function loadOpenTickets() {
  const t = TagBoxApp.t;
  const filter = currentFilters.open;
  let tickets;
  try {
    tickets = await TagBoxAPI.getTickets({ statut: 'ouvert', type: filter });
  } catch (e) {
    TagBoxApp.showToast('Impossible de charger les signalements.', 'error');
    return;
  }
  renderTicketList('ticket-list-open', tickets, false);

  const empty = document.getElementById('empty-open');
  if (tickets.length === 0) {
    empty.textContent = t('noOpenTickets');
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
  }
}

async function loadResolvedTickets() {
  const t = TagBoxApp.t;
  const filter = currentFilters.resolved;
  let tickets;
  try {
    tickets = await TagBoxAPI.getTickets({ statut: 'resolu', type: filter });
  } catch (e) {
    TagBoxApp.showToast('Impossible de charger les signalements.', 'error');
    return;
  }

  // Filtre par date côté client (les strings YYYY-MM-DD sont comparables lexicographiquement)
  if (resolvedTicketsDateFrom && resolvedTicketsDateTo) {
    tickets = tickets.filter(t => t.date >= resolvedTicketsDateFrom && t.date <= resolvedTicketsDateTo);
  }

  renderTicketList('ticket-list-resolved', tickets, true);

  const empty = document.getElementById('empty-resolved');
  if (tickets.length === 0) {
    empty.textContent = t('noResolvedTickets');
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
  }
}

// ---------- Prise en charge d'un ticket ----------
// Le technicien se déclare responsable du ticket.
// Après l'appel API, la liste est rechargée pour que tous les autres techniciens
// voient immédiatement le changement à leur prochain rafraîchissement (15s)
async function claimTicket(id) {
  try {
    await TagBoxAPI.assignTicket(id, session.matricule);
    await loadOpenTickets(); // rafraîchir pour afficher le badge "Vous gérez ce ticket"
  } catch (e) {
    TagBoxApp.showToast('Erreur lors de la prise en charge.', 'error');
  }
}

// ---------- Résolution d'un ticket ----------
let pendingResolveId = null; // ID du ticket en attente de confirmation

function openResolveModal(id) {
  pendingResolveId = id;
  document.getElementById('modal-action-input').value = '';
  document.getElementById('resolve-modal-overlay').classList.add('open');
  document.getElementById('modal-action-input').focus();
}

function closeResolveModal() {
  pendingResolveId = null;
  document.getElementById('resolve-modal-overlay').classList.remove('open');
}

async function confirmResolve() {
  if (pendingResolveId === null) return;
  const id = pendingResolveId;
  const actionInput = document.getElementById('modal-action-input');
  const action = actionInput.value.trim();
  const confirmBtn = document.getElementById('modal-confirm-btn');
  const originalContent = confirmBtn.innerHTML;
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="loading-spinner"></span>';

  try {
    await TagBoxAPI.resolveTicket(id, {
      matricule_technicien: session.matricule,
      action_effectuee: action || null // champ optionnel — null si vide
    });
    TagBoxApp.showToast(TagBoxApp.getLang() === 'ar' ? 'تم وضع علامة "محلول" على البلاغ.' : 'Ticket marqué résolu.', 'success');
    closeResolveModal();
    // Rafraîchir stats ET liste pour que le ticket disparaisse immédiatement
    await refreshStats();
    await loadOpenTickets();
  } catch (e) {
    TagBoxApp.showToast('Erreur lors de la mise à jour.', 'error');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalContent;
  }
}

// ---------- Onglets ----------
function showTab(tab) {
  currentTab = tab;
  const isOpen = tab === 'open';
  document.getElementById('tab-open').classList.toggle('active', isOpen);
  document.getElementById('tab-resolved').classList.toggle('active', !isOpen);
  document.getElementById('view-open').style.display = isOpen ? '' : 'none';
  document.getElementById('view-resolved').style.display = isOpen ? 'none' : '';
  if (isOpen) loadOpenTickets(); else loadResolvedTickets();
}

// ---------- Filtres ----------
function setFilter(tab, type, el) {
  currentFilters[tab] = type;
  const row = document.getElementById(tab === 'open' ? 'filter-row-open' : 'filter-row-resolved');
  row.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'open') loadOpenTickets(); else loadResolvedTickets();
}

// ---------- Traductions ----------
function applyTranslations() {
  const t = TagBoxApp.t;
  const lang = TagBoxApp.getLang();
  const app = document.getElementById('app');
  lang === 'ar' ? app.classList.add('ar') : app.classList.remove('ar');
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.getElementById('t-zone').textContent = t('zoneTechnicien');
  document.getElementById('lang-label').textContent = t('langLabel');
  document.getElementById('t-logout').textContent = t('logout');
  document.getElementById('role-badge').textContent = t('technicien');
  if (session && session.matricule) {
    const fullName = [session.prenom, session.nom].filter(Boolean).join(' ');
    document.getElementById('user-matricule-label').innerHTML =
      `<strong>${session.matricule}</strong>${fullName ? ` — ${fullName}` : ''}`;
  }

  document.getElementById('tab-open').textContent = t('tabEnCours');
  document.getElementById('tab-resolved').textContent = t('tabResolus');
  document.getElementById('t-stat-total').textContent = t('statTotal');
  document.getElementById('t-stat-sec').textContent = t('statSec');
  document.getElementById('t-stat-mai').textContent = t('statMai');
  document.getElementById('t-stat-pro').textContent = t('statPro');
  document.getElementById('t-section-open').textContent = t('sectionEnAttente');
  document.getElementById('t-section-resolved').textContent = t('sectionResolus');

  ['filter-row-open', 'filter-row-resolved'].forEach(rowId => {
    const row = document.getElementById(rowId);
    row.querySelector('[data-filter="tous"]').textContent = t('filterTous');
    row.querySelector('[data-filter="sec"]').textContent = t('filterSec');
    row.querySelector('[data-filter="mai"]').textContent = t('filterMai');
    row.querySelector('[data-filter="pro"]').textContent = t('filterPro');
  });

  const resolvedDateLabels = document.querySelectorAll('#view-resolved .date-range-selector label');
  if (resolvedDateLabels.length >= 2) {
    resolvedDateLabels[0].textContent = t('dateFrom');
    resolvedDateLabels[1].textContent = t('dateTo');
  }

  document.getElementById('modal-title').textContent = t('resolveModalTitle');
  document.getElementById('modal-label').textContent = t('actionEffectueeLabel');
  document.getElementById('modal-action-input').placeholder = t('actionEffectueePh');
  document.getElementById('modal-cancel-btn').textContent = t('cancel');
  document.getElementById('modal-confirm-label').textContent = t('confirm');

  // Rafraîchir la liste dans la nouvelle langue (les labels des badges changent)
  if (currentTab === 'open') loadOpenTickets(); else loadResolvedTickets();
}

function toggleLang() {
  const current = TagBoxApp.getLang();
  TagBoxApp.setLang(current === 'fr' ? 'ar' : 'fr');
  applyTranslations();
}

// ---------- Init date range "Tickets résolus" ----------
function initResolvedTicketsDateRange() {
  const today = todayStr();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  resolvedTicketsDateFrom = sevenDaysAgoStr;
  resolvedTicketsDateTo = today;

  document.getElementById('resolved-tickets-date-from').value = sevenDaysAgoStr;
  document.getElementById('resolved-tickets-date-to').value = today;

  document.getElementById('resolved-tickets-date-from').addEventListener('change', () => {
    resolvedTicketsDateFrom = document.getElementById('resolved-tickets-date-from').value;
    resolvedTicketsDateTo = document.getElementById('resolved-tickets-date-to').value;
    if (resolvedTicketsDateFrom && resolvedTicketsDateTo) loadResolvedTickets();
  });

  document.getElementById('resolved-tickets-date-to').addEventListener('change', () => {
    resolvedTicketsDateFrom = document.getElementById('resolved-tickets-date-from').value;
    resolvedTicketsDateTo = document.getElementById('resolved-tickets-date-to').value;
    if (resolvedTicketsDateFrom && resolvedTicketsDateTo) loadResolvedTickets();
  });
}

// ---------- Init ----------
refreshStats();
initResolvedTicketsDateRange();
applyTranslations();

// ---------- Rafraîchissement automatique (15s) ----------
// Se déclenche toutes les 15s sauf si :
//   - La fenêtre est masquée (onglet inactif) → inutile de charger en arrière-plan
//   - Une modale est ouverte → éviter que la liste se rafraîchisse pendant la saisie de l'action
setInterval(() => {
  if (document.hidden) return;
  if (document.getElementById('resolve-modal-overlay').classList.contains('open')) return;
  refreshStats();
  if (currentTab === 'open') loadOpenTickets(); else loadResolvedTickets();
}, 15000);
