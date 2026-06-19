"""
Initialise la base avec des données de test.
Mot de passe pour tous les comptes de test : 1234
"""
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

from db import get_connection

load_dotenv()

USERS = [
    ('04721', 'Opérateur Cutting', 'operateur', '1234'),
    ('04512', 'Opérateur Cutting', 'operateur', '1234'),
    ('03187', 'Opérateur Cutting', 'operateur', '1234'),
    ('05934', 'Opérateur Cutting', 'operateur', '1234'),
    ('07201', 'Opérateur Cutting', 'operateur', '1234'),
    ('08823', 'Technicien Cutting', 'technicien', '1234'),
    ('09456', 'Chef Équipe Cutting', 'chef_equipe', '1234'),
]

MACHINES = (
    [(f'A{n:02d}', 'A') for n in range(1, 17)] +
    [(f'B{n:02d}', 'B') for n in range(1, 17)]
)

TICKETS = [
    ('04512', 'A07', 'sec', "Fuite d'huile sous la presse hydraulique, sol glissant", '2026-06-15', '07:42', 'ouvert'),
    ('03187', 'B03', 'mai', "Bruit anormal au démarrage de la machine", '2026-06-15', '08:15', 'ouvert'),
    ('05934', 'A12', 'mai', "Capteur de position défaillant, arrêts intempestifs", '2026-06-15', '09:03', 'ouvert'),
    ('07201', 'B11', 'pro', "Cadence réduite depuis ce matin, pièces non conformes", '2026-06-15', '09:31', 'ouvert'),
    ('04721', 'A03', 'mai', "Vibration anormale sur le convoyeur en sortie de poste", '2026-06-14', '14:20', 'resolu'),
]


def seed():
    conn = get_connection()
    cur = conn.cursor()

    for matricule, nom, role, password in USERS:
        cur.execute(
            """INSERT INTO utilisateurs (matricule, nom, `role`, mot_de_passe)
               VALUES (%s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE nom = VALUES(nom), `role` = VALUES(`role`), mot_de_passe = VALUES(mot_de_passe)""",
            (matricule, nom, role, generate_password_hash(password))
        )

    for code, zone in MACHINES:
        cur.execute(
            """INSERT INTO machines (code, zone) VALUES (%s, %s)
               ON DUPLICATE KEY UPDATE zone = VALUES(zone)""",
            (code, zone)
        )

    cur.execute("SELECT COUNT(*) FROM tickets")
    if cur.fetchone()[0] == 0:
        for matricule, machine, type_, description, date, heure, statut in TICKETS:
            cur.execute(
                """INSERT INTO tickets
                   (matricule_operateur, machine, type_probleme, description, date_signalement, heure_signalement, statut)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (matricule, machine, type_, description, date, heure, statut)
            )

    conn.commit()
    cur.close()
    conn.close()
    print("Base de données initialisée avec les données de test.")


if __name__ == '__main__':
    seed()
