# ============================================
# Routes des tickets (signalements)
# Endpoints : GET, POST, PATCH /api/tickets*
# ============================================

from datetime import datetime

from flask import Blueprint, request, jsonify

from db import get_connection

tickets_bp = Blueprint('tickets', __name__)

# Mappage type d'anomalie → priorité du ticket (pour le visuel frontend)
# Sec = urgent (red), Mai = moyen (orange), Pro = normal (green)
PRIORITES = {'sec': 'urgent', 'mai': 'moyen', 'pro': 'normal'}


def priorite_from_type(type_probleme):
    """Retourne la priorité visuelle (urgent/moyen/normal) selon le type d'anomalie."""
    return PRIORITES.get(type_probleme, 'normal')


def serialize_ticket(row):
    """
    Convertit une ligne de BD (dictionnaire) en ticket JSON pour le frontend.

    Transformations :
    - matricule_operateur → matricule
    - type_probleme → type
    - date/heure signalement et resolution en strings
    - Ajoute priorite (urgent/moyen/normal)
    - Inclut nom_technicien (résolveur) pour l'affichage

    Utilisé pour tous les retours JSON (GET, POST, PATCH).
    """
    return {
        'id': row['id'],
        'matricule': row['matricule_operateur'],
        'machine': row['machine'],
        'type': row['type_probleme'],
        'description': row['description'],
        'date': str(row['date_signalement']),
        'heure': row['heure_signalement'],
        'statut': row['statut'],
        'priorite': priorite_from_type(row['type_probleme']),
        'matricule_technicien': row.get('matricule_technicien'),
        'nom_technicien': row.get('nom_technicien'),
        'date_resolution': str(row['date_resolution']) if row.get('date_resolution') else None,
        'heure_resolution': row.get('heure_resolution'),
        'action_effectuee': row.get('action_effectuee'),
    }


@tickets_bp.route('', methods=['GET'])
def list_tickets():
    """
    Liste les tickets avec filtres optionnels.

    Query parameters (tous optionnels) :
        statut='ouvert' ou 'resolu'  → Filter par statut
        matricule='04721'             → Filter par opérateur (pour "Mes signalements")
        type='sec'/'mai'/'pro'/'tous' → Filter par type d'anomalie

    Exemple :
        GET /api/tickets?statut=ouvert → tous les signalements en attente
        GET /api/tickets?statut=resolu&type=sec → anomalies de sécurité résolues
        GET /api/tickets?matricule=04721 → tous les signalements de l'opérateur 04721

    Retour : array de tickets (voir serialize_ticket).

    Notes :
    - LEFT JOIN avec utilisateurs : pour afficher le nom du technicien qui a résolu
    - Trié par date/heure desc (plus récents en premier)
    """
    # Récupérer les filtres depuis la query string
    statut = request.args.get('statut')
    matricule = request.args.get('matricule')
    type_ = request.args.get('type')

    # Construire la requête SQL de manière dynamique (où 1=1 permet d'ajouter des AND facilement)
    query = """SELECT t.*, u.nom AS nom_technicien
               FROM tickets t
               LEFT JOIN utilisateurs u ON t.matricule_technicien = u.matricule
               WHERE 1=1"""
    params = []

    # Ajouter les filtres conditionnellement si fournis
    if statut:
        query += " AND t.statut = %s"
        params.append(statut)
    if matricule:
        query += " AND t.matricule_operateur = %s"
        params.append(matricule)
    if type_ and type_ != 'tous':
        query += " AND t.type_probleme = %s"
        params.append(type_)

    # Tri : plus récent en premier
    query += " ORDER BY t.date_signalement DESC, t.heure_signalement DESC"

    # Exécuter la requête
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(query, params)
        rows = cur.fetchall()
    finally:
        conn.close()

    # Sérialiser chaque ticket et retourner au frontend
    return jsonify([serialize_ticket(row) for row in rows])


@tickets_bp.route('', methods=['POST'])
def create_ticket():
    """
    Crée un nouveau ticket (signalement) par un opérateur.

    Request body (obligatoire) :
        {
            "matricule": "04721",              # opérateur qui signale
            "machine": "A01",                  # machine concernée
            "type": "sec",                     # sécurité, maintenance ou production
            "description": "Vis outil desserré",
            "date": "2026-06-15",              # date du signalement
            "heure": "08:45"                   # heure du signalement
        }

    Réponse (201) :
        {
            "ok": true,
            "ticket": { id, matricule, machine, type, description, date, heure, statut, priorite }
        }

    Erreur (400) :
        Si un champ obligatoire manque ou est vide.
    """
    # Récupérer les données du formulaire
    data = request.get_json(silent=True) or {}
    matricule = data.get('matricule')
    machine = data.get('machine')
    type_ = data.get('type')
    description = data.get('description')
    date = data.get('date')
    heure = data.get('heure')

    # Vérifier que tous les champs sont fournis
    if not all([matricule, machine, type_, description, date, heure]):
        return jsonify(ok=False, error='invalid_request'), 400

    # Insérer le ticket en base (statut par défaut = 'ouvert')
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO tickets
               (matricule_operateur, machine, type_probleme, description, date_signalement, heure_signalement)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (matricule, machine, type_, description, date, heure)
        )
        conn.commit()
        ticket_id = cur.lastrowid  # ID auto-généré du nouveau ticket
    finally:
        conn.close()

    # Retourner le ticket créé (201 = Created)
    return jsonify(ok=True, ticket={
        'id': ticket_id,
        'matricule': matricule,
        'machine': machine,
        'type': type_,
        'description': description,
        'date': date,
        'heure': heure,
        'statut': 'ouvert',
        'priorite': priorite_from_type(type_),
    }), 201


@tickets_bp.route('/stats', methods=['GET'])
def stats():
    """
    Statistiques des tickets ouverts par type d'anomalie.

    Retour :
        {
            "total": 5,       # total tickets ouverts
            "sec": 1,         # sécurité
            "mai": 3,         # maintenance
            "pro": 1          # production
        }

    Utilisé par le tableau de bord (stats en haut des pages technicien et chef_equipe).
    Rafraîchissement automatique toutes les 15s.
    """
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        # Grouper par type et compter (uniquement les tickets ouverts)
        cur.execute(
            """SELECT type_probleme, COUNT(*) AS total
               FROM tickets WHERE statut = 'ouvert'
               GROUP BY type_probleme"""
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    # Initialiser tous les types à 0, puis remplir avec les vrais comptes
    counts = {'sec': 0, 'mai': 0, 'pro': 0}
    for row in rows:
        counts[row['type_probleme']] = row['total']

    # Retourner stats : { "total": sum, "sec": count, "mai": count, "pro": count }
    return jsonify(total=sum(counts.values()), **counts)


@tickets_bp.route('/<int:ticket_id>', methods=['PATCH'])
def resolve_ticket(ticket_id):
    """
    Marque un ticket comme résolu par un technicien.

    Request body (optionnel) :
        {
            "matricule_technicien": "08823",
            "action_effectuee": "Vis outil ressérée"  # peut être null/absent
        }

    Logique :
    1. Récupère date/heure actuelles du serveur.
    2. Met à jour le ticket : statut='resolu', matricule_technicien, action_effectuee.
    3. Récupère le ticket mis à jour (avec le nom du technicien via JOIN).
    4. Retourne le ticket complet sérialisé.

    Réponse (200) :
        { "ok": true, "ticket": {...} }

    Erreur (404) :
        Si le ticket_id n'existe pas.
    """
    # Récupérer les données du body (matricule et action optionnels)
    data = request.get_json(silent=True) or {}
    matricule_technicien = data.get('matricule_technicien')
    action_effectuee = data.get('action_effectuee')

    # Capturer la date/heure actuelles du serveur pour tracer la résolution
    now = datetime.now()
    date_resolution = now.strftime('%Y-%m-%d')
    heure_resolution = now.strftime('%H:%M')

    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)

        # 1. UPDATE : marquer le ticket comme résolu et enregistrer les infos de résolution
        cur.execute(
            """UPDATE tickets
               SET statut = 'resolu',
                   matricule_technicien = %s,
                   date_resolution = %s,
                   heure_resolution = %s,
                   action_effectuee = %s
               WHERE id = %s""",
            (matricule_technicien, date_resolution, heure_resolution, action_effectuee, ticket_id)
        )
        conn.commit()
        updated = cur.rowcount > 0  # rowcount > 0 si une ligne a été modifiée

        # 2. Si la mise à jour a réussi, récupérer le ticket mis à jour avec nom du technicien
        if updated:
            cur.execute(
                """SELECT t.*, u.nom AS nom_technicien
                   FROM tickets t
                   LEFT JOIN utilisateurs u ON t.matricule_technicien = u.matricule
                   WHERE t.id = %s""",
                (ticket_id,)
            )
            row = cur.fetchone()
    finally:
        conn.close()

    # Si le ticket n'a pas été trouvé/mis à jour, retourner 404
    if not updated:
        return jsonify(ok=False), 404

    # Succès : retourner le ticket mis à jour
    return jsonify(ok=True, ticket=serialize_ticket(row))
