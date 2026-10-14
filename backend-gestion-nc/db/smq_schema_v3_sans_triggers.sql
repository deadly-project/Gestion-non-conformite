-- =====================================================================
--  SMQ - Modèle de données v3.1 (PostgreSQL 13+)
--  SANS triggers ni fonctions : le SQL ne contient que la structure
--  (tables, clés, contraintes déclaratives, index, vues).
--
--  Règles métier portées par le BACKEND (Spring Boot) :
--    - référence NC-AAAA-NNN (table nc_compteurs)
--    - calcul de date_echeance (ouverture + délai)
--    - clôture d'une NC seulement si toutes les CAPA sont vérifiées et efficaces
--    - réouverture : nb_reouvertures + 1, date_cloturation remise à NULL, motif obligatoire
--    - historique des statuts (avec auteur) et journal des actions
--    - limites des pièces jointes : 6 photos + 1 PDF, types MIME, taille
--    - date_modification (Hibernate @UpdateTimestamp)
--
--  Conformité au cahier des charges :
--    - le déclarant saisit : processus concerné, description, gravité, pièces jointes
--    - le responsable qualifie : gravité retenue, catégorie, responsable, délai, auditeur
--    - catégories de NC et processus = référentiels gérés par l'administrateur
--    - CAPA : responsable, échéance, statut, vérification d'efficacité
--    - constat d'audit -> plan de traitement (CAPA) et/ou NC d'origine
--    - 4 profils : DECLARANT, RESPONSABLE_QUALITE, AUDITEUR, ADMINISTRATEUR
--      (tout employé peut déclarer : règle appliquée dans le backend)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users (un seul rôle par utilisateur ; date_naissance supprimée en v3.1)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom                VARCHAR(100) NOT NULL,
    prenom             VARCHAR(100) NOT NULL,
    email              VARCHAR(255) NOT NULL UNIQUE,
    matricule          VARCHAR(50)  NOT NULL UNIQUE,
    mot_de_passe       VARCHAR(255) NOT NULL,              -- hash BCrypt
    role               VARCHAR(20)  NOT NULL
                       CHECK (role IN ('DECLARANT','RESPONSABLE_QUALITE','AUDITEUR','ADMINISTRATEUR')),
    actif              BOOLEAN NOT NULL DEFAULT TRUE,      -- désactiver plutôt que supprimer
    date_creation      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification  TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. Référentiels gérés par l'administrateur
-- ---------------------------------------------------------------------
CREATE TABLE processus (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30)  NOT NULL UNIQUE,
    libelle     VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    actif       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE categories_nc (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code    VARCHAR(30)  NOT NULL UNIQUE,
    libelle VARCHAR(150) NOT NULL UNIQUE,
    actif   BOOLEAN NOT NULL DEFAULT TRUE
);

-- Compteur annuel pour la référence NC-AAAA-NNN (incrémenté par le backend,
-- sous verrou, dans la transaction de création de la NC)
CREATE TABLE nc_compteurs (
    annee          INT PRIMARY KEY,
    dernier_numero INT NOT NULL DEFAULT 0 CHECK (dernier_numero >= 0)
);

-- ---------------------------------------------------------------------
-- 3. Audits, constats et commentaires
-- ---------------------------------------------------------------------
CREATE TABLE audits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre              VARCHAR(200) NOT NULL,
    processus_id       UUID NOT NULL REFERENCES processus(id),
    type_audit         VARCHAR(10)  NOT NULL CHECK (type_audit IN ('INTERNE','EXTERNE')),
    auditeur_id        UUID NOT NULL REFERENCES users(id),
    date_planifiee     DATE NOT NULL,
    date_realisation   DATE,
    statut             VARCHAR(10) NOT NULL DEFAULT 'PLANIFIE'
                       CHECK (statut IN ('PLANIFIE','EN_COURS','TERMINE')),
    date_creation      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification  TIMESTAMP
);

CREATE TABLE constats_audit (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id            UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    type_constat        VARCHAR(15) NOT NULL
                        CHECK (type_constat IN ('ECART','POINT_FORT','REMARQUE')),
    description_constat TEXT NOT NULL,
    auteur_id           UUID NOT NULL REFERENCES users(id),
    date_constat        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE commentaires_constats (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    constat_id       UUID NOT NULL REFERENCES constats_audit(id) ON DELETE CASCADE,
    auteur_id        UUID NOT NULL REFERENCES users(id),
    commentaire      TEXT NOT NULL,
    date_commentaire TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 4. Non-conformités
--    Déclarant : titre, date, processus, description, gravité déclarée
--    Responsable : gravité retenue, catégorie, responsable, auditeur, délai
-- ---------------------------------------------------------------------
CREATE TABLE non_conformites (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference                    VARCHAR(20) NOT NULL UNIQUE,     -- NC-2025-007 (backend)
    titre                        VARCHAR(200) NOT NULL,
    date_detection               DATE NOT NULL,
    declarant_id                 UUID NOT NULL REFERENCES users(id),
    processus_id                 UUID NOT NULL REFERENCES processus(id),
    categorie_id                 UUID REFERENCES categories_nc(id), -- fixée à la qualification
    description_detaillee        TEXT NOT NULL,
    gravite_declaree             VARCHAR(10) NOT NULL
                                 CHECK (gravite_declaree IN ('MINEURE','MAJEURE','CRITIQUE')),
    gravite                      VARCHAR(10)                      -- retenue par le responsable
                                 CHECK (gravite IN ('MINEURE','MAJEURE','CRITIQUE')),
    statut                       VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                                 CHECK (statut IN ('EN_ATTENTE','OUVERT','EN_COURS_D_ANALYSE',
                                                   'EN_TRAITEMENT','CLOTUREE')),
    responsable_id               UUID REFERENCES users(id),       -- responsable de traitement
    auditeur_id                  UUID REFERENCES users(id),       -- auditeur attribué
    constat_origine_id           UUID REFERENCES constats_audit(id),
    delais_jours                 INT CHECK (delais_jours > 0),
    date_echeance                DATE,                            -- ouverture + délai (backend)
    date_ouverture               TIMESTAMP,
    date_commencement_traitement TIMESTAMP,
    date_cloturation             TIMESTAMP,                       -- NULL si non clôturée / réouverte
    nb_reouvertures              INT NOT NULL DEFAULT 0 CHECK (nb_reouvertures >= 0),
    date_creation                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification            TIMESTAMP,
    CHECK (date_cloturation IS NULL OR statut = 'CLOTUREE')
);

-- Historique des statuts (alimenté par le backend) : base du calcul exact des KPIs
CREATE TABLE nc_statut_historique (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nc_id           UUID NOT NULL REFERENCES non_conformites(id) ON DELETE CASCADE,
    ancien_statut   VARCHAR(20),
    nouveau_statut  VARCHAR(20) NOT NULL,
    commentaire     TEXT,                                  -- motif (obligatoire à la réouverture)
    auteur_id       UUID REFERENCES users(id),
    date_changement TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 5. Pièces jointes (fichiers hors base ; limites contrôlées par le backend)
-- ---------------------------------------------------------------------
CREATE TABLE nc_attachments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nc_id         UUID NOT NULL REFERENCES non_conformites(id) ON DELETE CASCADE,
    file_url      VARCHAR(500) NOT NULL,     -- clé relative : nc/<nc_id>/<uuid>.jpg
    nom_original  VARCHAR(255),
    file_type     VARCHAR(5)   NOT NULL CHECK (file_type IN ('PHOTO','PDF')),
    mime_type     VARCHAR(100) NOT NULL,
    taille_octets BIGINT NOT NULL CHECK (taille_octets > 0),
    uploaded_by   UUID REFERENCES users(id),
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 6. Analyse des causes : Ishikawa (5M) x 5 Pourquoi
-- ---------------------------------------------------------------------
CREATE TABLE ishikawa_analyses (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nc_id                UUID NOT NULL REFERENCES non_conformites(id) ON DELETE CASCADE,
    branche              VARCHAR(15) NOT NULL
                         CHECK (branche IN ('MATIERE','MATERIEL','MAIN_D_OEUVRE','METHODE','MILIEU')),
    pourquoi_1           TEXT,
    pourquoi_2           TEXT,
    pourquoi_3           TEXT,
    pourquoi_4           TEXT,
    pourquoi_5           TEXT,
    cause_racine_validee TEXT,
    auteur_id            UUID REFERENCES users(id),
    date_modification    TIMESTAMP,
    UNIQUE (nc_id, branche)
);

-- ---------------------------------------------------------------------
-- 7. Actions correctives et préventives (CAPA)
--    Rattachée à une NC et/ou à un constat d'audit (plan de traitement)
-- ---------------------------------------------------------------------
CREATE TABLE actions_capa (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nc_id                  UUID REFERENCES non_conformites(id) ON DELETE CASCADE,
    constat_id             UUID REFERENCES constats_audit(id) ON DELETE CASCADE,
    type_action            VARCHAR(10) NOT NULL CHECK (type_action IN ('CORRECTIVE','PREVENTIVE')),
    description            TEXT NOT NULL,
    responsable_action_id  UUID NOT NULL REFERENCES users(id),
    statut_action          VARCHAR(10) NOT NULL DEFAULT 'A_FAIRE'
                           CHECK (statut_action IN ('A_FAIRE','EN_COURS','TERMINEE','VERIFIEE')),
    date_echeance          DATE NOT NULL,
    date_realisation       DATE,
    date_verification      TIMESTAMP,
    verificateur_id        UUID REFERENCES users(id),
    efficace               BOOLEAN,
    commentaire_efficacite TEXT,
    date_creation          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification      TIMESTAMP,
    CHECK (nc_id IS NOT NULL OR constat_id IS NOT NULL),
    CHECK (statut_action <> 'VERIFIEE'
           OR (date_verification IS NOT NULL AND verificateur_id IS NOT NULL AND efficace IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- 8. Gestion documentaire qualité
-- ---------------------------------------------------------------------
CREATE TABLE documents_qualite (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(50)  NOT NULL UNIQUE,            -- ex : PR-PROD-001
    titre             VARCHAR(255) NOT NULL,
    type_document     VARCHAR(15)  NOT NULL
                      CHECK (type_document IN ('PROCEDURE','INSTRUCTION','ENREGISTREMENT')),
    processus_id      UUID NOT NULL REFERENCES processus(id),
    statut            VARCHAR(12)  NOT NULL DEFAULT 'EN_VIGUEUR'
                      CHECK (statut IN ('EN_VIGUEUR','EN_REVISION','OBSOLETE')),
    version           VARCHAR(10)  NOT NULL DEFAULT '1.0',
    file_url          VARCHAR(500) NOT NULL,
    nom_original      VARCHAR(255),
    mime_type         VARCHAR(100),
    taille_octets     BIGINT,
    auteur_id         UUID NOT NULL REFERENCES users(id),
    date_application  DATE,
    date_creation     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 9. Notifications
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          VARCHAR(30) NOT NULL
                  CHECK (type IN ('ASSIGNATION','ECHEANCE_PROCHE','ECHEANCE_DEPASSEE',
                                  'CHANGEMENT_STATUT','AUDIT_PLANIFIE','AUTRE')),
    message       TEXT NOT NULL,
    entite        VARCHAR(30),
    entite_id     UUID,
    lue           BOOLEAN NOT NULL DEFAULT FALSE,
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 10. Journal des actions (alimenté par le backend)
-- ---------------------------------------------------------------------
CREATE TABLE historique_actions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id       UUID REFERENCES users(id),            -- NULL = action système
    action_type          VARCHAR(40) NOT NULL,
    entite_concernee     VARCHAR(30) NOT NULL,
    entite_id            UUID,
    details_modification JSONB,                                -- {"avant": {...}, "apres": {...}}
    date_action          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 11. Index de performance
-- ---------------------------------------------------------------------
CREATE INDEX idx_nc_statut        ON non_conformites(statut);
CREATE INDEX idx_nc_declarant     ON non_conformites(declarant_id);
CREATE INDEX idx_nc_responsable   ON non_conformites(responsable_id);
CREATE INDEX idx_nc_processus     ON non_conformites(processus_id);
CREATE INDEX idx_nc_categorie     ON non_conformites(categorie_id);
CREATE INDEX idx_nc_echeance      ON non_conformites(date_echeance);
CREATE INDEX idx_nc_histo_nc      ON nc_statut_historique(nc_id, date_changement);
CREATE INDEX idx_nc_attach_nc     ON nc_attachments(nc_id, file_type);
CREATE INDEX idx_capa_nc          ON actions_capa(nc_id);
CREATE INDEX idx_capa_constat     ON actions_capa(constat_id);
CREATE INDEX idx_capa_responsable ON actions_capa(responsable_action_id);
CREATE INDEX idx_capa_echeance    ON actions_capa(date_echeance) WHERE statut_action <> 'VERIFIEE';
CREATE INDEX idx_audits_processus ON audits(processus_id, date_planifiee);
CREATE INDEX idx_constats_audit   ON constats_audit(audit_id);
CREATE INDEX idx_docs_processus   ON documents_qualite(processus_id, statut);
CREATE INDEX idx_notif_user       ON notifications(user_id, lue);
CREATE INDEX idx_histo_entite     ON historique_actions(entite_concernee, entite_id);
CREATE INDEX idx_histo_user       ON historique_actions(utilisateur_id, date_action);

-- ---------------------------------------------------------------------
-- 12. Vues du dashboard (KPIs)
--     "Traitée dans les délais" = statut actuel CLOTUREE avec
--     date_cloturation <= date_echeance. Une NC réouverte n'est plus
--     comptée tant qu'elle n'est pas de nouveau clôturée.
-- ---------------------------------------------------------------------
CREATE VIEW v_kpi_taux_delais AS
SELECT
    COUNT(*) FILTER (WHERE statut = 'CLOTUREE')                          AS nc_cloturees,
    COUNT(*) FILTER (WHERE statut = 'CLOTUREE'
                       AND date_cloturation::date <= date_echeance)      AS nc_dans_les_delais,
    ROUND(100.0 * COUNT(*) FILTER (WHERE statut = 'CLOTUREE'
                                     AND date_cloturation::date <= date_echeance)
          / NULLIF(COUNT(*) FILTER (WHERE statut = 'CLOTUREE'), 0), 1)   AS taux_dans_les_delais_pct
FROM non_conformites;

CREATE VIEW v_kpi_recurrence_processus AS
SELECT p.id AS processus_id, p.libelle AS processus,
       COUNT(*) AS nb_nc, SUM(nc.nb_reouvertures) AS nb_reouvertures
FROM non_conformites nc
JOIN processus p ON p.id = nc.processus_id
GROUP BY p.id, p.libelle;

CREATE VIEW v_kpi_delai_moyen AS
SELECT p.libelle AS processus,
       ROUND(AVG(EXTRACT(EPOCH FROM (nc.date_cloturation - nc.date_ouverture)) / 86400)::numeric, 1)
           AS delai_moyen_jours
FROM non_conformites nc
JOIN processus p ON p.id = nc.processus_id
WHERE nc.statut = 'CLOTUREE' AND nc.date_ouverture IS NOT NULL
GROUP BY p.libelle;

CREATE VIEW v_kpi_avancement_audits AS
SELECT EXTRACT(YEAR FROM date_planifiee)::int AS annee,
       COUNT(*) AS audits_planifies,
       COUNT(*) FILTER (WHERE statut = 'TERMINE') AS audits_termines,
       ROUND(100.0 * COUNT(*) FILTER (WHERE statut = 'TERMINE') / COUNT(*), 1) AS avancement_pct
FROM audits
GROUP BY EXTRACT(YEAR FROM date_planifiee);

CREATE VIEW v_capa_en_retard AS
SELECT id, nc_id, constat_id, type_action, responsable_action_id, date_echeance,
       (CURRENT_DATE - date_echeance) AS jours_de_retard
FROM actions_capa
WHERE statut_action <> 'VERIFIEE' AND date_echeance < CURRENT_DATE;

-- ---------------------------------------------------------------------
-- 13. Données de référence (exemples, à adapter par l'administrateur)
-- ---------------------------------------------------------------------
INSERT INTO categories_nc (code, libelle) VALUES
    ('PRODUIT',     'Non-conformité produit'),
    ('PROCESS',     'Non-conformité processus'),
    ('SECURITE',    'Sécurité / Environnement'),
    ('DOCUMENT',    'Documentaire'),
    ('FOURNISSEUR', 'Fournisseur');

INSERT INTO nc_compteurs (annee, dernier_numero)
VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::int, 0);