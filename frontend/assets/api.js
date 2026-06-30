/* ============================================
   Tag Box Lear — Client API (couche d'accès)
   Centralise tous les appels fetch() vers le backend Flask.
   Interface unique : window.TagBoxAPI (exposée globalement).
   ============================================ */

(function () {

  // Adresse du backend Flask
  // Par défaut : localhost:5000 (WAMP local)
  // Peut être écrasée via window.TAGBOX_API_BASE si le serveur est sur une autre machine du réseau
  // Exemple : window.TAGBOX_API_BASE = 'http://prod-server:5000/api'
  const API_BASE = window.TAGBOX_API_BASE || 'http://127.0.0.1:5000/api';

  // Fonction utilitaire : effectue une requête HTTP vers l'API (fetch wrapper)
  // - Ajoute automatiquement l'header Content-Type: application/json
  // - Gère les erreurs réseau (network_error)
  // - Gère les erreurs serveur 5xx (server_error)
  // - Retourne toujours un objet JSON (même en cas d'erreur)
  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options  // Permet de passer method, body, etc.
      });
    } catch (e) {
      // Erreur réseau (pas de réponse du serveur)
      throw new Error('network_error');
    }
    // Si 5xx : le serveur a un problème (exception non gérée, etc.)
    if (res.status >= 500) {
      throw new Error('server_error');
    }
    return res.json();
  }

  // Constructeur de query string : transforme un objet params en ?key=value&key2=value2
  // Ignore les valeurs undefined, null, ou vides pour éviter les paramètres parasites
  // Exemple : { statut: 'ouvert', matricule: '', type: undefined } → '?statut=ouvert'
  function buildQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      // Ne pas ajouter les valeurs vides
      if (value !== undefined && value !== null && value !== '') search.set(key, value);
    });
    const qs = search.toString();
    return qs ? `?${qs}` : '';  // Retourne '?...' ou '' si aucun param
  }

  // Objet exposé globalement : window.TagBoxAPI
  // Contient tous les endpoints de l'API Flask utilisés par le frontend
  // Chaque méthode retourne une Promise (utiliser .then() ou await)
  const TagBoxAPI = {

    // Liste les machines groupées par zone (A ou B)
    // Retour : { A: ["A01", "A02", ...], B: ["B01", ...] }
    // Utilisé pour le dropdown "Machine" dans le formulaire de l'opérateur
    getMachines() {
      return request('/machines');
    },

    // Authentifie un utilisateur (opérateur, technicien, ou chef_equipe)
    // Retour en cas de succès : { ok: true, user: { matricule, nom, role } }
    // Retour en cas d'erreur : { ok: false, error: '...' }
    // Utilisé dans index.html lors du clic sur le bouton "Se connecter"
    login(matricule, password, role) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ matricule, password, role })
      });
    },

    // Crée un nouveau ticket (signalement d'une anomalie)
    // Tous les paramètres sont obligatoires
    // Retour : { ok: true, ticket: { id, matricule, machine, ... } }
    // Utilisé par le formulaire operateur.html (bouton "Envoyer le signalement")
    createTicket({ matricule, machine, type, description, date, heure }) {
      return request('/tickets', {
        method: 'POST',
        body: JSON.stringify({ matricule, machine, type, description, date, heure })
      });
    },

    // Liste les tickets avec filtres optionnels
    // Paramètres optionnels :
    //   statut: 'ouvert' ou 'resolu'
    //   matricule: '04721' (pour récupérer juste les tickets d'un opérateur)
    //   type: 'sec', 'mai', 'pro', ou 'tous' (défaut)
    // Retour : array de tickets [ { id, matricule, machine, type, description, ... } ]
    // Utilisé par toutes les pages pour lister les tickets
    getTickets({ statut, matricule, type } = {}) {
      return request(`/tickets${buildQuery({ statut, matricule, type })}`);
    },

    // Assigne un ticket à un technicien (prise en charge)
    // Le technicien se déclare responsable : son nom s'affiche chez les autres
    // Retour : { ok: true, ticket: { ... matricule_technicien_assigne, nom_technicien_assigne } }
    assignTicket(id, matricule_technicien) {
      return request(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'assigner', matricule_technicien })
      });
    },

    // Marque un ticket comme résolu par un technicien
    // Paramètres optionnels : matricule_technicien, action_effectuee
    // Retour : { ok: true, ticket: { ... statut: 'resolu', date_resolution, ... } }
    // Utilisé par technicien.html lors du clic "Résoudre"
    resolveTicket(id, extra = {}) {
      return request(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(extra)
      });
    },

    // Récupère les statistiques des tickets ouverts par type
    // Retour : { total: 5, sec: 1, mai: 3, pro: 1 }
    // Utilisé par le dashboard (stats en haut des pages) - rafraîchissement auto toutes les 15s
    getStats() {
      return request('/tickets/stats');
    }
  };

  window.TagBoxAPI = TagBoxAPI;
})();
