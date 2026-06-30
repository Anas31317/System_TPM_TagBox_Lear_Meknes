// ============================================
// Tag Box Lear — Page chef d'équipe (chef_equipe.html)
// Vue supervision en lecture seule — le chef d'équipe ne peut pas résoudre les tickets.
// Fonctionnalités :
//   - Onglet 1 : Tickets ouverts (avec info assignation technicien)
//   - Onglet 2 : Tickets résolus + export CSV
//   - Onglet 3 : Analyse (graphiques + tableaux — uniquement sur cet onglet)
// Rafraîchissement automatique toutes les 15 secondes.
// ============================================

// ---------- Session ----------
const session = TagBoxApp.requireSession('chef_equipe');
TagBoxApp.startClock(['live-clock']);

let currentTab = 'open';
let currentFilters = { open: 'tous', resolved: 'tous' };

// Instances Chart.js stockées pour pouvoir les détruire avant recréation
// (Chart.js ne met pas à jour un graphique, il faut en créer un nouveau)
const charts = { evolution: null, types: null };

// Cache des derniers tickets chargés :
// - lastResolvedTickets : utilisé pour l'export CSV (évite un appel API supplémentaire)
// - lastAnalyticsTickets : évite de recharger du serveur à chaque changement de date
let lastResolvedTickets = [];
let lastAnalyticsTickets = [];

let analyticsDateFrom = null;
let analyticsDateTo = null;
let resolvedChefDateFrom = null;
let resolvedChefDateTo = null;

const typeMeta = () => ({
  sec: { icon: 'ti-shield-exclamation', cls: 'sec', badge: 'badge-sec', label: TagBoxApp.t('badgeSec') },
  mai: { icon: 'ti-tool',              cls: 'mai', badge: 'badge-mai', label: TagBoxApp.t('badgeMai') },
  pro: { icon: 'ti-settings-2',        cls: 'pro', badge: 'badge-pro', label: TagBoxApp.t('badgePro') }
});

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Stats ----------
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

// ---------- Rendu d'une liste de tickets (lecture seule) ----------
// Similaire à technicien.js mais sans boutons d'action.
// Pour les tickets ouverts : affiche "Pris en charge par [nom]" si un technicien est assigné.
// Pour les tickets résolus : affiche action effectuée + technicien résolveur.
function renderTicketList(containerId, tickets, resolved) {
  const t = TagBoxApp.t;
  const list = document.getElementById(containerId);
  const meta = typeMeta();
  list.innerHTML = '';

  tickets.forEach(ticket => {
    const m = meta[ticket.type];
    const el = document.createElement('div');
    el.className = `ticket ${ticket.priorite}`;
    el.dataset.type = ticket.type;
    if (resolved) el.style.opacity = '0.6';

    const dateLabel = ticket.date === todayStr() ? t('today') : ticket.date;

    let resolutionInfo = '';

    // Ticket ouvert avec technicien assigné : afficher qui s'en occupe
    if (!resolved && ticket.matricule_technicien_assigne) {
      const assignedName = ticket.nom_technicien_assigne || ticket.matricule_technicien_assigne;
      resolutionInfo += `<div class="ticket-resolved-by">${t('assignedBy')} <strong>${escapeHtml(assignedName)}</strong></div>`;
    }

    // Ticket résolu : afficher action + technicien résolveur + date de résolution
    if (resolved) {
      if (ticket.action_effectuee) {
        resolutionInfo += `<div class="ticket-action">${t('actionEffectueeShort')} : ${escapeHtml(ticket.action_effectuee)}</div>`;
      }
      if (ticket.matricule_technicien) {
        const resDateLabel = ticket.date_resolution === todayStr() ? t('today') : ticket.date_resolution;
        const techLabel = ticket.nom_technicien
          ? `${escapeHtml(ticket.nom_technicien)} (${t('matriculeShort')} ${ticket.matricule_technicien})`
          : `${t('matriculeShort')} ${ticket.matricule_technicien}`;
        resolutionInfo += `<div class="ticket-resolved-by">${t('resolvedBy')} ${techLabel} — ${resDateLabel} ${t('at')} ${ticket.heure_resolution}</div>`;
      }
    }

    el.innerHTML = `
      <div class="ticket-type-icon ${m.cls}"><i class="ti ${m.icon}" aria-hidden="true"></i></div>
      <div class="ticket-body">
        <div class="ticket-machine">${t('machineLabel')} ${ticket.machine} — ${t('matriculeShort')} ${ticket.matricule}</div>
        <div class="ticket-desc">${escapeHtml(ticket.description)}</div>
        <div class="ticket-meta">${dateLabel} ${t('at')} ${ticket.heure}</div>
        ${resolutionInfo}
      </div>
      <div class="ticket-right">
        <span class="badge-type ${m.badge}">${m.label}</span>
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

  // Filtre par date côté client
  if (resolvedChefDateFrom && resolvedChefDateTo) {
    tickets = tickets.filter(t => t.date >= resolvedChefDateFrom && t.date <= resolvedChefDateTo);
  }

  // Conserver pour l'export CSV (pas de second appel API nécessaire)
  lastResolvedTickets = tickets;
  renderTicketList('ticket-list-resolved', tickets, true);

  const empty = document.getElementById('empty-resolved');
  if (tickets.length === 0) {
    empty.textContent = t('noResolvedTickets');
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
  }
}

// ---------- Export CSV ----------
// Échappe les valeurs CSV : entoure de guillemets si la valeur contient ; " ou retour à la ligne
function csvEscape(value) {
  const str = String(value ?? '');
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Génère et télécharge le fichier CSV des tickets résolus visibles à l'écran.
// Le BOM (﻿) en début de fichier est nécessaire pour que Excel (Windows) détecte l'UTF-8.
// Séparateur ";" (standard Excel France) au lieu de "," (standard anglophone).
function exportResolvedCSV() {
  const t = TagBoxApp.t;
  if (lastResolvedTickets.length === 0) {
    TagBoxApp.showToast(t('noDataToExport'), 'error');
    return;
  }
  const meta = typeMeta();
  const headers = [
    t('machineLabel'), t('csvType'), t('description'),
    t('csvDate'), t('csvHeure'), t('csvMatriculeOp'),
    t('resolvedBy'), t('csvDateResolution'), t('csvHeureResolution'),
    t('actionEffectueeShort')
  ];
  const rows = lastResolvedTickets.map(tk => [
    tk.machine,
    meta[tk.type] ? meta[tk.type].label : tk.type,
    tk.description,
    tk.date,
    tk.heure,
    tk.matricule,
    tk.nom_technicien ? `${tk.nom_technicien} (${tk.matricule_technicien})` : (tk.matricule_technicien || ''),
    tk.date_resolution || '',
    tk.heure_resolution || '',
    tk.action_effectuee || ''
  ]);

  const csvContent = '﻿' + [headers, ...rows]
    .map(row => row.map(csvEscape).join(';'))
    .join('\r\n');

  // Créer un lien de téléchargement temporaire et cliquer dessus programmatiquement
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tickets_resolus_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // libérer la mémoire
}

// ---------- Analyse ----------
// Pipeline analytique :
//   loadAnalytics() → charge TOUS les tickets (ouverts + résolus) depuis l'API
//                  → stocke dans lastAnalyticsTickets
//   updateAnalyticsCharts() → filtre par date → redistribue aux 4 rendus
//   onAnalyticsDateRangeChange() → déclenche updateAnalyticsCharts() sans rechargement réseau
//
// Ce design permet de changer la plage de dates instantanément (pas d'appel API)
// en gardant tous les tickets en mémoire côté client.

// Formater une date YYYY-MM-DD en "DD/MM" ou "Aujourd'hui"
function formatDayLabel(dateStr) {
  if (dateStr === todayStr()) return TagBoxApp.t('today');
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

// Filtre un tableau de tickets entre deux dates incluses (comparaison de strings YYYY-MM-DD)
function filterTicketsByDateRange(tickets, dateFrom, dateTo) {
  return tickets.filter(t => {
    const ticketDate = t.date;
    return ticketDate >= dateFrom && ticketDate <= dateTo;
  });
}

// Charge tous les tickets (sans filtre de statut) et lance la mise à jour des graphiques
async function loadAnalytics() {
  let tickets;
  try {
    tickets = await TagBoxAPI.getTickets(); // tous statuts confondus
  } catch (e) {
    TagBoxApp.showToast("Impossible de charger les données d'analyse.", 'error');
    return;
  }
  lastAnalyticsTickets = tickets;
  updateAnalyticsCharts();
}

// Applique le filtre de date et redessine les 4 composants analytiques
function updateAnalyticsCharts() {
  const filtered = filterTicketsByDateRange(lastAnalyticsTickets, analyticsDateFrom, analyticsDateTo);
  renderEvolutionChart(filtered);
  renderTypesChart(filtered);
  renderMachinesTable(filtered);
  renderTechsTable(filtered);
}

// Appelé quand l'utilisateur change le sélecteur de date dans l'onglet Analyse
function onAnalyticsDateRangeChange() {
  analyticsDateFrom = document.getElementById('analytics-date-from').value;
  analyticsDateTo = document.getElementById('analytics-date-to').value;
  updateAnalyticsCharts(); // pas d'appel réseau — on re-filtre les données en mémoire
}

// Graphique en barres : signalements créés vs résolus par jour sur la plage
// Utilise Chart.js (chargé via CDN dans le HTML)
function renderEvolutionChart(tickets) {
  const t = TagBoxApp.t;
  const dateFrom = new Date(analyticsDateFrom);
  const dateTo = new Date(analyticsDateTo);

  // Générer toutes les dates de la plage (y compris les jours sans signalement)
  const days = [];
  for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0]);
  }

  // Compter par jour : signalés = date_signalement, résolus = date_resolution
  const signales = days.map(day => tickets.filter(tk => tk.date === day).length);
  const resolus  = days.map(day => tickets.filter(tk => tk.date_resolution === day).length);

  // Détruire l'instance précédente avant d'en créer une nouvelle
  // (Chart.js ne permet pas la mise à jour d'un graphique monté sur le même canvas)
  if (charts.evolution) charts.evolution.destroy();

  charts.evolution = new Chart(document.getElementById('chart-evolution'), {
    type: 'bar',
    data: {
      labels: days.map(formatDayLabel),
      datasets: [
        { label: t('seriesSignales'), data: signales, backgroundColor: '#1A3A6B' },
        { label: t('seriesResolus'),  data: resolus,  backgroundColor: '#2E7D32' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, // axe Y entier uniquement
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Graphique donut : répartition des tickets RÉSOLUS par type (sec/mai/pro)
function renderTypesChart(tickets) {
  const t = TagBoxApp.t;
  const counts = { sec: 0, mai: 0, pro: 0 };
  tickets.forEach(tk => {
    // Compter uniquement les tickets résolus (les ouverts sont déjà dans les stats)
    if (tk.statut === 'resolu' && counts[tk.type] !== undefined) counts[tk.type]++;
  });

  if (charts.types) charts.types.destroy();
  charts.types = new Chart(document.getElementById('chart-types'), {
    type: 'doughnut',
    data: {
      labels: [t('badgeSec'), t('badgeMai'), t('badgePro')],
      datasets: [{
        data: [counts.sec, counts.mai, counts.pro],
        backgroundColor: ['#C8102E', '#E6820A', '#2E7D32'] // rouge, orange, vert (charte Lear)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Table "Machines à surveiller" : top 6 machines par nombre total de signalements
// Tous statuts confondus (ouverts + résolus) pour identifier les postes problématiques
function renderMachinesTable(tickets) {
  const t = TagBoxApp.t;

  // Regrouper par machine : { "A01": { sec: 2, mai: 1, pro: 0, total: 3 }, ... }
  const byMachine = {};
  tickets.forEach(tk => {
    if (!byMachine[tk.machine]) byMachine[tk.machine] = { sec: 0, mai: 0, pro: 0, total: 0 };
    if (byMachine[tk.machine][tk.type] !== undefined) byMachine[tk.machine][tk.type]++;
    byMachine[tk.machine].total++;
  });

  // Trier par total décroissant et garder les 6 premières
  const rows = Object.entries(byMachine)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  const tbody = document.querySelector('#table-machines tbody');
  tbody.innerHTML = '';
  rows.forEach(([machine, c]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${machine}</td><td>${c.total}</td><td>${c.sec}</td><td>${c.mai}</td><td>${c.pro}</td>`;
    tbody.appendChild(tr);
  });

  const empty = document.getElementById('empty-machines');
  if (rows.length === 0) {
    empty.textContent = t('noAnalyticsData');
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
  }
}

// Table "Charge par technicien" : nombre de tickets résolus par technicien, trié décroissant
// Permet au chef d'équipe de voir la répartition du travail entre techniciens
function renderTechsTable(tickets) {
  const t = TagBoxApp.t;

  // Regrouper par matricule_technicien (uniquement les tickets résolus)
  const byTech = {};
  tickets.forEach(tk => {
    if (tk.statut === 'resolu' && tk.matricule_technicien) {
      if (!byTech[tk.matricule_technicien]) {
        byTech[tk.matricule_technicien] = { count: 0, nom: tk.nom_technicien };
      }
      byTech[tk.matricule_technicien].count++;
    }
  });

  const rows = Object.entries(byTech).sort((a, b) => b[1].count - a[1].count);

  const tbody = document.querySelector('#table-techs tbody');
  tbody.innerHTML = '';
  rows.forEach(([matricule, data]) => {
    const tr = document.createElement('tr');
    const label = data.nom ? `${data.nom} (${matricule})` : matricule;
    tr.innerHTML = `<td>${escapeHtml(label)}</td><td>${data.count}</td>`;
    tbody.appendChild(tr);
  });

  const empty = document.getElementById('empty-techs');
  if (rows.length === 0) {
    empty.textContent = t('noAnalyticsData');
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
  }
}

// ---------- Onglets ----------
function showTab(tab) {
  currentTab = tab;
  document.getElementById('tab-open').classList.toggle('active', tab === 'open');
  document.getElementById('tab-resolved').classList.toggle('active', tab === 'resolved');
  document.getElementById('tab-analytics').classList.toggle('active', tab === 'analytics');
  document.getElementById('view-open').style.display = tab === 'open' ? '' : 'none';
  document.getElementById('view-resolved').style.display = tab === 'resolved' ? '' : 'none';
  document.getElementById('view-analytics').style.display = tab === 'analytics' ? '' : 'none';
  if (tab === 'open') {
    loadOpenTickets();
  } else if (tab === 'resolved') {
    // Lire les dates du sélecteur avant de charger
    resolvedChefDateFrom = document.getElementById('resolved-tickets-date-from-chef').value;
    resolvedChefDateTo = document.getElementById('resolved-tickets-date-to-chef').value;
    loadResolvedTickets();
  } else {
    // Lire les dates du sélecteur analytique avant de charger
    analyticsDateFrom = document.getElementById('analytics-date-from').value;
    analyticsDateTo = document.getElementById('analytics-date-to').value;
    loadAnalytics();
  }
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

  document.getElementById('t-zone').textContent = t('zoneChefEquipe');
  document.getElementById('lang-label').textContent = t('langLabel');
  document.getElementById('t-logout').textContent = t('logout');
  document.getElementById('role-badge').textContent = t('chef_equipe');
  if (session && session.matricule) {
    const fullName = [session.prenom, session.nom].filter(Boolean).join(' ');
    document.getElementById('user-matricule-label').innerHTML =
      `<strong>${session.matricule}</strong>${fullName ? ` — ${fullName}` : ''}`;
  }

  document.getElementById('tab-open').textContent = t('tabEnCours');
  document.getElementById('tab-resolved').textContent = t('tabResolus');
  document.getElementById('tab-analytics').textContent = t('tabAnalyse');
  document.getElementById('t-stat-total').textContent = t('statTotal');
  document.getElementById('t-stat-sec').textContent = t('statSec');
  document.getElementById('t-stat-mai').textContent = t('statMai');
  document.getElementById('t-stat-pro').textContent = t('statPro');
  document.getElementById('t-section-open').textContent = t('sectionEnAttente');
  document.getElementById('t-section-resolved').textContent = t('sectionResolus');
  document.getElementById('t-section-analytics').textContent = t('sectionAnalyse');

  ['filter-row-open', 'filter-row-resolved'].forEach(rowId => {
    const row = document.getElementById(rowId);
    row.querySelector('[data-filter="tous"]').textContent = t('filterTous');
    row.querySelector('[data-filter="sec"]').textContent = t('filterSec');
    row.querySelector('[data-filter="mai"]').textContent = t('filterMai');
    row.querySelector('[data-filter="pro"]').textContent = t('filterPro');
  });

  document.getElementById('t-chart-evolution-title').textContent = t('chartEvolutionTitle');
  document.getElementById('t-chart-types-title').textContent = t('chartTypesTitle');
  document.getElementById('t-table-machines-title').textContent = t('tableMachinesTitle');
  document.getElementById('t-table-techs-title').textContent = t('tableTechsTitle');
  document.getElementById('th-machine').textContent = t('machineLabel');
  document.getElementById('th-total').textContent = t('colTotal');
  document.getElementById('th-sec').textContent = t('badgeSec');
  document.getElementById('th-mai').textContent = t('badgeMai');
  document.getElementById('th-pro').textContent = t('badgePro');
  document.getElementById('th-technicien').textContent = t('technicien');
  document.getElementById('th-tickets-resolus').textContent = t('colTicketsResolus');
  document.getElementById('t-export-csv').textContent = 'Export CSV (.csv)';
  document.getElementById('t-date-from').textContent = t('dateFrom');
  document.getElementById('t-date-to').textContent = t('dateTo');
  document.getElementById('analytics-date-from').title = t('dateFrom');
  document.getElementById('analytics-date-to').title = t('dateTo');
  document.getElementById('t-date-from-resolved').textContent = t('dateFrom');
  document.getElementById('t-date-to-resolved').textContent = t('dateTo');
  document.getElementById('resolved-tickets-date-from-chef').title = t('dateFrom');
  document.getElementById('resolved-tickets-date-to-chef').title = t('dateTo');

  // Rafraîchir la vue active dans la nouvelle langue
  if (currentTab === 'open') loadOpenTickets();
  else if (currentTab === 'resolved') loadResolvedTickets();
  else loadAnalytics();
}

function toggleLang() {
  const current = TagBoxApp.getLang();
  TagBoxApp.setLang(current === 'fr' ? 'ar' : 'fr');
  applyTranslations();
}

// ---------- Init ----------
function initAnalyticsDateRange() {
  const today = todayStr();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  analyticsDateFrom = sevenDaysAgoStr;
  analyticsDateTo = today;

  document.getElementById('analytics-date-from').value = sevenDaysAgoStr;
  document.getElementById('analytics-date-to').value = today;

  // Mettre à jour les variables de date et redessiner les graphiques sans recharger du serveur
  document.getElementById('analytics-date-from').addEventListener('change', onAnalyticsDateRangeChange);
  document.getElementById('analytics-date-to').addEventListener('change', onAnalyticsDateRangeChange);
}

function initResolvedChefDateRange() {
  const today = todayStr();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  resolvedChefDateFrom = sevenDaysAgoStr;
  resolvedChefDateTo = today;

  document.getElementById('resolved-tickets-date-from-chef').value = sevenDaysAgoStr;
  document.getElementById('resolved-tickets-date-to-chef').value = today;

  document.getElementById('resolved-tickets-date-from-chef').addEventListener('change', () => {
    resolvedChefDateFrom = document.getElementById('resolved-tickets-date-from-chef').value;
    resolvedChefDateTo = document.getElementById('resolved-tickets-date-to-chef').value;
    if (resolvedChefDateFrom && resolvedChefDateTo) loadResolvedTickets();
  });

  document.getElementById('resolved-tickets-date-to-chef').addEventListener('change', () => {
    resolvedChefDateFrom = document.getElementById('resolved-tickets-date-from-chef').value;
    resolvedChefDateTo = document.getElementById('resolved-tickets-date-to-chef').value;
    if (resolvedChefDateFrom && resolvedChefDateTo) loadResolvedTickets();
  });
}

refreshStats();
initAnalyticsDateRange();
initResolvedChefDateRange();
applyTranslations();

// ---------- Rafraîchissement automatique (15s) ----------
// Toujours actif (pas de modale à protéger sur cette page — lecture seule)
// Pausé seulement si la fenêtre est masquée (onglet inactif)
setInterval(() => {
  if (document.hidden) return;
  refreshStats();
  if (currentTab === 'open') loadOpenTickets();
  else if (currentTab === 'resolved') loadResolvedTickets();
  else loadAnalytics();
}, 15000);
