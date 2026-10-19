export const STATUTS_NC = {
    EN_ATTENTE: "En attente",
    OUVERT: "Ouvert",
    EN_COURS_D_ANALYSE: "En cours d'analyse",
    EN_TRAITEMENT: "En traitement",
    CLOTUREE: "Clôturée",
};

export const ORDRE_STATUT = {
    EN_ATTENTE: 0,
    OUVERT: 1,
    EN_COURS_D_ANALYSE: 2,
    EN_TRAITEMENT: 3,
    CLOTUREE: 4,
};

/** Statuts proposés dans le formulaire de traitement (la clôture se fait plus tard). */
export const STATUTS_TRAITEMENT = ["OUVERT", "EN_COURS_D_ANALYSE", "EN_TRAITEMENT"];

export const GRAVITES = {
    MINEURE: "Mineure",
    MAJEURE: "Majeure",
    CRITIQUE: "Critique",
};

export const BRANCHES = [
    { code: "MATIERE", libelle: "Matière" },
    { code: "MATERIEL", libelle: "Matériel" },
    { code: "MAIN_D_OEUVRE", libelle: "Main-d'œuvre" },
    { code: "METHODE", libelle: "Méthode" },
    { code: "MILIEU", libelle: "Milieu" },
];

export const TYPES_ACTION = {
    CORRECTIVE: "Corrective",
    PREVENTIVE: "Préventive",
};

export const STATUTS_ACTION = {
    A_FAIRE: "À faire",
    EN_COURS: "En cours",
    TERMINEE: "Terminée",
    VERIFIEE: "Vérifiée",
};

// Mêmes limites que le serveur (PieceJointeService)
export const MAX_IMAGES = 6;
export const TAILLE_MAX_IMAGE = 8 * 1024 * 1024;
export const TAILLE_MAX_PDF = 10 * 1024 * 1024;
export const TYPES_IMAGES = ["image/jpeg", "image/png", "image/webp"];

export function dateAujourdhui() {
    return new Date().toLocaleDateString("en-CA"); // AAAA-MM-JJ, heure locale
}

export function formaterDate(valeur) {
    if (!valeur) return "";
    const date = new Date(valeur);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
}

export function nomComplet(utilisateur) {
    return utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : "";
}

export function formaterTaille(octets) {
    if (octets == null) return "";
    return octets > 1024 * 1024
        ? `${(octets / (1024 * 1024)).toFixed(1)} Mo`
        : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}