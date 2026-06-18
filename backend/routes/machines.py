# ============================================
# Routes des machines
# Endpoint : GET /api/machines
# ============================================

from flask import Blueprint, jsonify

from db import get_connection

machines_bp = Blueprint('machines', __name__)


@machines_bp.route('', methods=['GET'])
def list_machines():
    """
    Liste toutes les machines groupées par zone (A ou B).

    Retour :
        {
            "A": ["A01", "A02", "A03", ...],
            "B": ["B01", "B02", "B07", ...]
        }

    Utilisé par le dropdown "Machine" dans le formulaire de l'opérateur.
    Machines triées par code pour faciliter la lecture.
    """
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        # Récupérer toutes les machines triées par code
        cur.execute("SELECT code, zone FROM machines ORDER BY code")
        rows = cur.fetchall()
    finally:
        conn.close()

    # Regrouper par zone : {"A": [codes], "B": [codes]}
    zones = {}
    for row in rows:
        # setdefault : crée la clé si elle n'existe pas, retourne la liste
        zones.setdefault(row['zone'], []).append(row['code'])

    return jsonify(zones)
