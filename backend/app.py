# ============================================
# Tag Box Lear — Backend Flask
# Serveur API pour la gestion des signalements TPM
# Port 5000 (localhost)
# ============================================

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from mysql.connector import Error as MySQLError

from routes.auth import auth_bp
from routes.machines import machines_bp
from routes.tickets import tickets_bp

# Charger les variables d'environnement depuis .env
load_dotenv()

# Créer l'application Flask
app = Flask(__name__)

# Activer CORS (partage d'origines croisées) pour permettre les requêtes depuis le frontend
# ⚠️ À restreindre en production (voir README)
CORS(app)

# Enregistrer les blueprints (groupes d'endpoints) avec leurs préfixes d'URL
# /api/auth → authentification (login)
# /api/tickets → gestion des tickets (CRUD, stats)
# /api/machines → liste des machines (dropdown)
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tickets_bp, url_prefix='/api/tickets')
app.register_blueprint(machines_bp, url_prefix='/api/machines')


# Gestionnaire d'erreurs MySQL : capture les erreurs de connexion/requête BD
# Retourne une réponse JSON et log l'erreur pour le débogage
@app.errorhandler(MySQLError)
def handle_db_error(err):
    app.logger.error('Erreur MySQL : %s', err)
    return jsonify(ok=False, error='database_error'), 500


# Endpoint de santé : permet de vérifier que le serveur est accessible
# Utilisé par les outils de monitoring ou pour les tests simples
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify(ok=True)


# Point d'entrée : lance le serveur Flask
# host='0.0.0.0' : écoute sur toutes les interfaces (localhost + réseau local)
# port=5000 : le frontend et les tests accèdent via http://127.0.0.1:5000
# debug=True : recharge auto et stack traces détaillées (désactiver en production)
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
