// ============================================
// Tag Box Lear — Page opérateur (operateur.html)
// Permet à l'opérateur de :
//   - Créer un signalement (machine, type, description)
//   - Consulter son historique de signalements
// ============================================

// ---------- Session ----------
// requireSession vérifie que l'utilisateur est connecté avec le bon rôle.
// Si ce n'est pas le cas, il redirige automatiquement vers index.html
const session = TagBoxApp.requireSession('operateur');

// ---------- Init ----------
const pad = n => String(n).padStart(2, '0'); // "9" → "09" pour l'affichage HH:MM:SS
TagBoxApp.startClock(['live-clock']); // Horloge dans la topbar

// Deuxième horloge dans le champ "heure du signalement" (lecture seule)
// Distinct de la topbar pour que les deux soient synchronisés
function tickTimeDisplay() {
  const now = new Date();
  document.getElementById('time-display').textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
tickTimeDisplay();
setInterval(tickTimeDisplay, 1000);

// Date du jour pré-remplie au format ISO (YYYY-MM-DD) attendu par l'input type="date"
document.getElementById('date-input').value = new Date().toISOString().split('T')[0];

// Pré-remplir le matricule depuis la session et afficher le nom complet dans la topbar
if (session && session.matricule) {
  document.getElementById('i-matricule').value = session.matricule;
  const fullName = [session.prenom, session.nom].filter(Boolean).join(' ');
  document.getElementById('user-matricule-label').innerHTML =
    `<strong>${session.matricule}</strong>${fullName ? ` — ${fullName}` : ''}`;
}

// ---------- Dropdown machines ----------
// Charge la liste des machines depuis l'API et construit le dropdown dynamiquement.
// Les zones sont triées dans un ordre métier défini (A, B, TW, Artos, Heavy),
// pas par ordre alphabétique — pour correspondre à la disposition physique de l'usine.
async function buildMachineOptions() {
  const select = document.getElementById('i-machine');
  // Vider les optgroups existants (utile si la fonction est rappelée)
  select.querySelectorAll('optgroup').forEach(g => g.remove());
  try {
    const zones = await TagBoxAPI.getMachines();

    // Ordre d'affichage métier (sinon alphabétique par défaut)
    const zoneOrder = ['A', 'B', 'TW', 'Artos', 'Heavy'];
    const sortedZones = Object.keys(zones).sort((a, b) => {
      const ia = zoneOrder.indexOf(a);
      const ib = zoneOrder.indexOf(b);
      // Les zones inconnues (pas dans zoneOrder) vont en dernier, triées entre elles
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    sortedZones.forEach(zone => {
      const group = document.createElement('optgroup');
      group.label = `Zone ${zone}`;
      zones[zone].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  } catch (e) {
    TagBoxApp.showToast('Impossible de charger la liste des machines.', 'error');
  }
}
buildMachineOptions();

// ---------- Onglets ----------
function showTab(tab) {
  const isNew = tab === 'new';
  document.getElementById('tab-new').classList.toggle('active', isNew);
  document.getElementById('tab-mine').classList.toggle('active', !isNew);
  document.getElementById('view-new').style.display = isNew ? '' : 'none';
  document.getElementById('view-mine').style.display = isNew ? 'none' : '';
  // Charger les tickets uniquement quand on bascule sur l'onglet "Mes signalements"
  if (!isNew) {
    myTicketsDateFrom = document.getElementById('my-tickets-date-from').value;
    myTicketsDateTo = document.getElementById('my-tickets-date-to').value;
    loadMyTickets();
  }
}

// ---------- Sélecteur de type ----------
let selectedType = null; // 'sec', 'mai', ou 'pro' — null si aucun n'est sélectionné
function selectType(el) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedType = el.dataset.type; // lire la valeur depuis data-type="sec|mai|pro"
  setFieldError('type', null);    // effacer l'erreur éventuelle
}

// ---------- Validation ----------
// Affiche ou masque un message d'erreur sous un champ du formulaire
function setFieldError(field, message) {
  const errEl = document.getElementById(`err-${field}`);
  if (!errEl) return;
  if (message) {
    errEl.textContent = message;
    errEl.classList.add('visible');
  } else {
    errEl.classList.remove('visible');
  }
  if (field === 'machine') document.getElementById('i-machine').classList.toggle('invalid', !!message);
  if (field === 'problem') document.getElementById('i-problem').classList.toggle('invalid', !!message);
}

// ---------- Soumission du formulaire ----------
document.getElementById('ticket-form').addEventListener('submit', async function (e) {
  e.preventDefault(); // bloquer le rechargement de page par défaut du formulaire HTML
  const t = TagBoxApp.t;

  const matricule = document.getElementById('i-matricule').value.trim();
  const machine = document.getElementById('i-machine').value;
  const problem = document.getElementById('i-problem').value.trim();

  // Valider les 3 champs obligatoires avant d'envoyer
  let valid = true;
  if (!machine) { setFieldError('machine', t('errMachine')); valid = false; }
  else setFieldError('machine', null);

  if (!selectedType) { setFieldError('type', t('errType')); valid = false; }
  else setFieldError('type', null);

  if (!problem) { setFieldError('problem', t('errProblem')); valid = false; }
  else setFieldError('problem', null);

  if (!valid) return;

  // Désactiver le bouton pour éviter les doublons
  const btn = document.getElementById('submit-btn');
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="loading-spinner"></span> <span>${t('sending')}</span>`;

  // Capturer l'heure exacte d'envoi (pas celle affichée en temps réel)
  const now = new Date();
  const heure = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = document.getElementById('date-input').value || now.toISOString().split('T')[0];

  try {
    await TagBoxAPI.createTicket({ matricule, machine, type: selectedType, description: problem, date, heure });
    TagBoxApp.showToast(t('successSent'), 'success');
    resetForm();
  } catch (err) {
    TagBoxApp.showToast('Erreur lors de l\'envoi.', 'error');
  } finally {
    // Réactiver le bouton dans tous les cas (succès ou erreur)
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
});

function resetForm() {
  document.getElementById('i-machine').value = '';
  document.getElementById('i-problem').value = '';
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  selectedType = null;
  setFieldError('machine', null);
  setFieldError('type', null);
  setFieldError('problem', null);
}

// ---------- Mes signalements ----------
let myTicketsDateFrom = null;
let myTicketsDateTo = null;

// Charge et affiche tous les signalements de l'opérateur connecté.
// Le filtre par date est appliqué côté client (les données arrivent toutes du serveur,
// puis on filtre en JS) — acceptable car un opérateur n'a jamais beaucoup de tickets.
async function loadMyTickets() {
  const t = TagBoxApp.t;
  const list = document.getElementById('my-ticket-list');
  const empty = document.getElementById('my-empty');
  list.innerHTML = '';

  let tickets;
  try {
    // Récupérer uniquement les tickets de cet opérateur (filtrage côté serveur par matricule)
    tickets = await TagBoxAPI.getTickets({ matricule: session.matricule });
  } catch (e) {
    TagBoxApp.showToast('Impossible de charger vos signalements.', 'error');
    return;
  }

  // Filtre date côté client (les strings YYYY-MM-DD se comparent directement)
  if (myTicketsDateFrom && myTicketsDateTo) {
    tickets = tickets.filter(t => t.date >= myTicketsDateFrom && t.date <= myTicketsDateTo);
  }

  if (tickets.length === 0) {
    empty.textContent = t('noTickets');
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  // Métadonnées visuelles par type (icône Tabler, classe CSS, badge, label traduit)
  const typeMeta = {
    sec: { icon: 'ti-shield-exclamation', cls: 'sec', badge: 'badge-sec', label: t('badgeSec') },
    mai: { icon: 'ti-tool',              cls: 'mai', badge: 'badge-mai', label: t('badgeMai') },
    pro: { icon: 'ti-settings-2',        cls: 'pro', badge: 'badge-pro', label: t('badgePro') }
  };

  tickets.forEach(ticket => {
    const meta = typeMeta[ticket.type];
    const isResolved = ticket.statut === 'resolu';
    const statusLabel = isResolved ? t('statusResolu') : t('statusOuvert');
    const statusColor = isResolved ? 'var(--color-green)' : 'var(--lear-red)';

    const el = document.createElement('div');
    el.className = `ticket ${ticket.priorite}`; // classe priorite = urgent/moyen/normal → couleur bordure gauche
    el.style.cursor = 'default'; // pas cliquable (lecture seule)
    if (isResolved) el.style.opacity = '0.6'; // atténuer visuellement les tickets résolus

    el.innerHTML = `
      <div class="ticket-type-icon ${meta.cls}"><i class="ti ${meta.icon}" aria-hidden="true"></i></div>
      <div class="ticket-body">
        <div class="ticket-machine">${t('machineLabel')} ${ticket.machine}</div>
        <div class="ticket-desc">${escapeHtml(ticket.description)}</div>
        <div class="ticket-meta">${ticket.date === todayStr() ? t('today') : ticket.date} ${t('at')} ${ticket.heure}</div>
      </div>
      <div class="ticket-right">
        <span class="badge-type ${meta.badge}">${meta.label}</span>
        <span style="font-size:11px; font-weight:500; color:${statusColor};">${statusLabel}</span>
      </div>
    `;
    list.appendChild(el);
  });
}

function todayStr() {
  return new Date().toISOString().split('T')[0]; // format YYYY-MM-DD pour comparer aux dates BD
}

// Protection XSS : passe le texte utilisateur par un nœud texte DOM
// pour que les caractères spéciaux (<, >, &, ") soient échappés avant injection dans le HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Traductions ----------
// Appelée à l'init et à chaque changement de langue (FR ↔ AR)
function applyTranslations() {
  const t = TagBoxApp.t;
  const lang = TagBoxApp.getLang();
  const app = document.getElementById('app');
  lang === 'ar' ? app.classList.add('ar') : app.classList.remove('ar');
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.getElementById('t-zone').textContent = t('zoneOperateur');
  document.getElementById('lang-label').textContent = t('langLabel');
  document.getElementById('t-logout').textContent = t('logout');
  document.getElementById('role-badge').textContent = t('operateur');
  if (session && session.matricule) {
    const fullName = [session.prenom, session.nom].filter(Boolean).join(' ');
    document.getElementById('user-matricule-label').innerHTML =
      `<strong>${session.matricule}</strong>${fullName ? ` — ${fullName}` : ''}`;
  }

  document.getElementById('tab-new').textContent = t('tab1');
  document.getElementById('tab-mine').textContent = t('tab2');
  document.getElementById('t-title').textContent = t('title');
  document.getElementById('t-sub').textContent = t('sub');
  document.getElementById('t-matricule').textContent = t('matricule');
  document.getElementById('i-matricule').placeholder = t('matriculePh');
  document.getElementById('t-machine').textContent = t('machine');
  document.getElementById('t-select-default').textContent = t('selectDef');
  document.getElementById('t-date').textContent = t('date');
  document.getElementById('t-date-note').textContent = t('dateNote');
  document.getElementById('t-type').textContent = t('type');
  document.getElementById('t-sec-label').textContent = t('secLabel');
  document.getElementById('t-sec-desc').textContent = t('secDesc');
  document.getElementById('t-mai-label').textContent = t('maiLabel');
  document.getElementById('t-mai-desc').textContent = t('maiDesc');
  document.getElementById('t-pro-label').textContent = t('proLabel');
  document.getElementById('t-pro-desc').textContent = t('proDesc');
  document.getElementById('t-problem').textContent = t('problem');
  document.getElementById('i-problem').placeholder = t('problemPh');
  document.getElementById('t-submit-text').textContent = t('submit');
  document.getElementById('t-my-title').textContent = t('myTicketsTitle');
  document.getElementById('t-my-sub').textContent = t('myTicketsSub');

  const myDateLabels = document.querySelectorAll('#view-mine .date-range-selector label');
  if (myDateLabels.length >= 2) {
    myDateLabels[0].textContent = t('dateFrom');
    myDateLabels[1].textContent = t('dateTo');
  }

  // Re-afficher les erreurs dans la nouvelle langue si des champs sont déjà invalides
  setFieldError('machine', document.getElementById('err-machine').classList.contains('visible') ? t('errMachine') : null);
  setFieldError('type',    document.getElementById('err-type').classList.contains('visible')    ? t('errType')    : null);
  setFieldError('problem', document.getElementById('err-problem').classList.contains('visible') ? t('errProblem') : null);

  // Rafraîchir la liste si l'onglet "Mes signalements" est actif
  if (document.getElementById('view-mine').style.display !== 'none') {
    loadMyTickets();
  }
}

function toggleLang() {
  const current = TagBoxApp.getLang();
  TagBoxApp.setLang(current === 'fr' ? 'ar' : 'fr');
  applyTranslations();
}

// ---------- Init date range "Mes signalements" ----------
// Par défaut : afficher les 7 derniers jours au chargement de la page
function initMyTicketsDateRange() {
  const today = todayStr();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  myTicketsDateFrom = sevenDaysAgoStr;
  myTicketsDateTo = today;

  document.getElementById('my-tickets-date-from').value = sevenDaysAgoStr;
  document.getElementById('my-tickets-date-to').value = today;

  // Recharger les tickets dès que l'une des deux dates change
  document.getElementById('my-tickets-date-from').addEventListener('change', () => {
    myTicketsDateFrom = document.getElementById('my-tickets-date-from').value;
    myTicketsDateTo = document.getElementById('my-tickets-date-to').value;
    if (myTicketsDateFrom && myTicketsDateTo) loadMyTickets();
  });

  document.getElementById('my-tickets-date-to').addEventListener('change', () => {
    myTicketsDateFrom = document.getElementById('my-tickets-date-from').value;
    myTicketsDateTo = document.getElementById('my-tickets-date-to').value;
    if (myTicketsDateFrom && myTicketsDateTo) loadMyTickets();
  });
}

initMyTicketsDateRange();
applyTranslations();
