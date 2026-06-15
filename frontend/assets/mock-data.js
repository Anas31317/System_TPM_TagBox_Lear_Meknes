/* ============================================
   Tag Box Lear — Couche de données simulée
   À remplacer plus tard par des appels API
   (fetch vers un backend connecté à MySQL).
   Toutes les fonctions sont déjà asynchrones
   (Promises) pour matcher la future API.
   ============================================ */

(function () {

  // ---------- Données de référence ----------

  const ZONES = {
    A: ['A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16'],
    B: ['B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16']
  };

  // Annuaire simplifié matricule -> infos utilisateur (mock)
  const USERS = {
    '04721': { matricule: '04721', role: 'operateur', nom: 'Op. Cutting' },
    '04512': { matricule: '04512', role: 'operateur', nom: 'Op. Zone A' },
    '03187': { matricule: '03187', role: 'operateur', nom: 'Op. Zone B' },
    '05934': { matricule: '05934', role: 'operateur', nom: 'Op. Zone A' },
    '07201': { matricule: '07201', role: 'operateur', nom: 'Op. Zone B' },
    '08823': { matricule: '08823', role: 'technicien', nom: 'Technicien' }
  };

  // Tickets simulés (équivalent table `tickets` en MySQL)
  let TICKETS = [
    {
      id: 1,
      matricule: '04512',
      machine: 'A07',
      type: 'sec',
      description: "Fuite d'huile sous la presse hydraulique, sol glissant",
      date: '2026-06-15',
      heure: '07:42',
      statut: 'ouvert',
      priorite: 'urgent'
    },
    {
      id: 2,
      matricule: '03187',
      machine: 'B03',
      type: 'mai',
      description: "Bruit anormal au démarrage de la machine",
      date: '2026-06-15',
      heure: '08:15',
      statut: 'ouvert',
      priorite: 'moyen'
    },
    {
      id: 3,
      matricule: '05934',
      machine: 'A12',
      type: 'mai',
      description: "Capteur de position défaillant, arrêts intempestifs",
      date: '2026-06-15',
      heure: '09:03',
      statut: 'ouvert',
      priorite: 'moyen'
    },
    {
      id: 4,
      matricule: '07201',
      machine: 'B11',
      type: 'pro',
      description: "Cadence réduite depuis ce matin, pièces non conformes",
      date: '2026-06-15',
      heure: '09:31',
      statut: 'ouvert',
      priorite: 'normal'
    },
    {
      id: 5,
      matricule: '04721',
      machine: 'A03',
      type: 'mai',
      description: "Vibration anormale sur le convoyeur en sortie de poste",
      date: '2026-06-14',
      heure: '14:20',
      statut: 'resolu',
      priorite: 'moyen'
    }
  ];

  let nextId = 6;

  // ---------- Helpers ----------

  // Simule une petite latence réseau
  function delay(value, ms = 250) {
    return new Promise(resolve => setTimeout(() => resolve(value), ms));
  }

  function priorityFromType(type) {
    if (type === 'sec') return 'urgent';
    if (type === 'mai') return 'moyen';
    return 'normal';
  }

  // ---------- "API" exposée ----------

  const TagBoxAPI = {

    ZONES,

    /**
     * Vérifie un matricule et renvoie les infos utilisateur + rôle.
     * Backend futur : POST /api/auth/login { matricule }
     */
    login(matricule) {
      const user = USERS[matricule];
      if (!user) {
        // Matricule inconnu : on accepte quand même côté opérateur
        // (le mockup ne bloque pas la saisie), mais on ne connaît pas le rôle.
        return delay({ ok: true, user: { matricule, role: 'operateur', nom: 'Opérateur' } });
      }
      return delay({ ok: true, user });
    },

    /**
     * Crée un nouveau signalement.
     * Backend futur : POST /api/tickets
     */
    createTicket({ matricule, machine, type, description, date, heure }) {
      const ticket = {
        id: nextId++,
        matricule,
        machine,
        type,
        description,
        date,
        heure,
        statut: 'ouvert',
        priorite: priorityFromType(type)
      };
      TICKETS.unshift(ticket);
      return delay({ ok: true, ticket });
    },

    /**
     * Liste tous les tickets (filtrable par statut / matricule).
     * Backend futur : GET /api/tickets?statut=...&matricule=...
     */
    getTickets({ statut, matricule, type } = {}) {
      let result = TICKETS.slice();
      if (statut) result = result.filter(t => t.statut === statut);
      if (matricule) result = result.filter(t => t.matricule === matricule);
      if (type && type !== 'tous') result = result.filter(t => t.type === type);
      // Plus récents en premier
      result.sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
      return delay(result);
    },

    /**
     * Marque un ticket comme résolu.
     * Backend futur : PATCH /api/tickets/:id { statut: 'resolu' }
     */
    resolveTicket(id) {
      const ticket = TICKETS.find(t => t.id === id);
      if (ticket) ticket.statut = 'resolu';
      return delay({ ok: !!ticket, ticket });
    },

    /**
     * Statistiques rapides pour le tableau de bord technicien.
     * Backend futur : GET /api/tickets/stats
     */
    getStats() {
      const open = TICKETS.filter(t => t.statut === 'ouvert');
      const stats = {
        total: open.length,
        sec: open.filter(t => t.type === 'sec').length,
        mai: open.filter(t => t.type === 'mai').length,
        pro: open.filter(t => t.type === 'pro').length
      };
      return delay(stats);
    }
  };

  window.TagBoxAPI = TagBoxAPI;
})();
