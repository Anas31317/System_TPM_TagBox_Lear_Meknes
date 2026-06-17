# ============================================
# Tag Box Lear — Connexion à la base MySQL
# Gère la connexion à tagbox_lear
# ============================================

import mysql.connector
from config import Config


def get_connection():
    """
    Établit une connexion MySQL à la base 'tagbox_lear'.

    Retour : objet connexion (à fermer avec .close() après usage).
    Les credentials viennent de config.py (variables d'env).

    Utilisé dans toutes les routes pour exécuter des requêtes.
    """
    return mysql.connector.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
    )
