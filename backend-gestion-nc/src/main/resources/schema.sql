-- Évolutions de schéma appliquées au démarrage (idempotent).
-- La référence d'une NC est désormais attribuée par le responsable qualité :
-- les déclarations peuvent donc rester sans référence.

-- Idempotent : retirer la contrainte NOT NULL est sans effet si elle est déjà absente.
ALTER TABLE non_conformites ALTER COLUMN reference DROP NOT NULL;

-- Preuves / pièces jointes rattachées à un constat d'audit (facultatives).
CREATE TABLE IF NOT EXISTS constat_pieces_jointes (
    id BIGSERIAL PRIMARY KEY,
    constat_id BIGINT NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    nom_original VARCHAR(255),
    file_type VARCHAR(5) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    taille_octets BIGINT NOT NULL,
    uploaded_by BIGINT,
    date_creation TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT constat_pieces_jointes_constat_fk
        FOREIGN KEY (constat_id) REFERENCES constats_audit(id) ON DELETE CASCADE,
    CONSTRAINT constat_pieces_jointes_uploaded_by_fk
        FOREIGN KEY (uploaded_by) REFERENCES users(id),
    CONSTRAINT constat_pieces_jointes_file_type_check
        CHECK (file_type IN ('PHOTO', 'PDF')),
    CONSTRAINT constat_pieces_jointes_taille_check
        CHECK (taille_octets > 0)
);

CREATE INDEX IF NOT EXISTS idx_constat_pj_constat
    ON constat_pieces_jointes (constat_id, file_type);
