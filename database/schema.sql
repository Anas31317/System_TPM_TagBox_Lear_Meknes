-- ============================================
-- Tag Box Lear — Schéma de base de données MySQL
-- ============================================

CREATE DATABASE IF NOT EXISTS tagbox_lear
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tagbox_lear;

-- ---------- Utilisateurs (opérateurs et techniciens) ----------
-- `role` est un mot réservé en MySQL 8 (gestion des rôles) : il doit être
-- entouré de backticks partout où il est utilisé dans les requêtes SQL.
CREATE TABLE IF NOT EXISTS utilisateurs (
  matricule    VARCHAR(6) PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL,
  `role`       ENUM('operateur', 'technicien', 'chef_equipe') NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Machines / postes ----------
CREATE TABLE IF NOT EXISTS machines (
  code VARCHAR(10) PRIMARY KEY,
  zone VARCHAR(10) NOT NULL
);

-- ---------- Tickets (signalements) ----------
CREATE TABLE IF NOT EXISTS tickets (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  matricule_operateur  VARCHAR(6) NOT NULL,
  machine              VARCHAR(10) NOT NULL,
  type_probleme        ENUM('sec', 'mai', 'pro') NOT NULL,
  description          TEXT NOT NULL,
  date_signalement     DATE NOT NULL,
  heure_signalement    VARCHAR(5) NOT NULL,
  statut               ENUM('ouvert', 'resolu') NOT NULL DEFAULT 'ouvert',
  matricule_technicien VARCHAR(6) DEFAULT NULL,
  date_resolution      DATE DEFAULT NULL,
  heure_resolution     VARCHAR(5) DEFAULT NULL,
  action_effectuee     TEXT DEFAULT NULL,
  FOREIGN KEY (matricule_operateur) REFERENCES utilisateurs(matricule),
  FOREIGN KEY (matricule_technicien) REFERENCES utilisateurs(matricule),
  FOREIGN KEY (machine) REFERENCES machines(code)
);
