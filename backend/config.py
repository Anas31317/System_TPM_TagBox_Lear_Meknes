# ============================================
# Configuration de la base de données
# Charge les credentials depuis les variables d'environnement (.env)
# Fournit des valeurs par défaut pour le développement local
# ============================================

import os


class Config:
    """
    Configuration centrale pour la connexion MySQL.

    Les valeurs viennent des variables d'env (définies dans .env).
    Des valeurs par défaut sont fournies pour le dev local WAMP (localhost, root, pas de password).

    En production, créer un .env avec :
        DB_HOST=prod-server.com
        DB_PORT=3306
        DB_USER=prod_user
        DB_PASSWORD=strong_password_here
        DB_NAME=tagbox_lear
    """
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', 3306))
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_NAME = os.environ.get('DB_NAME', 'tagbox_lear')
