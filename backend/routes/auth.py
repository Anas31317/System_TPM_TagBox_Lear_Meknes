# ============================================
# Routes d'authentification
# Endpoint : POST /api/auth/login
# ============================================

from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash

from db import get_connection

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authentifie un utilisateur (opérateur, technicien, ou chef_equipe).

    Request body :
        {
            "matricule": "04721",      # 4-6 chiffres
            "password": "1234",         # mot de passe en clair
            "role": "operateur"         # l'un de : operateur, technicien, chef_equipe
        }

    Réponse en cas de succès (200) :
        {
            "ok": true,
            "user": {
                "matricule": "04721",
                "nom": "Opérateur Cutting",
                "role": "operateur"
            }
        }

    Réponse en cas d'erreur :
        - 400 : matricule, password ou role manquants
        - 401 : matricule n'existe pas, ou rôle/password incorrect
    """
    # Récupérer et valider les données du formulaire
    data = request.get_json(silent=True) or {}
    matricule = str(data.get('matricule', '')).strip()
    password = data.get('password', '')
    role = data.get('role', '')

    # Vérifier que tous les champs obligatoires sont présents et valides
    if not matricule or not password or role not in ('operateur', 'technicien', 'chef_equipe'):
        return jsonify(ok=False, error='invalid_request'), 400

    # Chercher l'utilisateur en base par matricule
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)  # dictionary=True : résultat en dict au lieu de tuple
        cur.execute(
            "SELECT matricule, nom, `role`, mot_de_passe FROM utilisateurs WHERE matricule = %s",
            (matricule,)
        )
        user = cur.fetchone()
    finally:
        conn.close()

    # Vérifier que l'utilisateur existe, que le rôle correspond, et que le password est correct
    # check_password_hash : compare le mot de passe en clair avec le hash stocké en BD
    if not user or user['role'] != role or not check_password_hash(user['mot_de_passe'], password):
        return jsonify(ok=False, error='invalid_credentials'), 401

    # Succès : retourner les données de l'utilisateur (sans le mot de passe!)
    return jsonify(ok=True, user={
        'matricule': user['matricule'],
        'nom': user['nom'],
        'role': user['role'],
    })
