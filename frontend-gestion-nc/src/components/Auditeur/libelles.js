// Libellés et petits formateurs partagés par l'espace auditeur et le suivi qualité.

export const TYPES_AUDIT = { INTERNE: "Interne", EXTERNE: "Externe" };
export const STATUTS_AUDIT = { PLANIFIE: "Planifié", EN_COURS: "En cours", TERMINE: "Terminé" };
export const TYPES_CONSTAT = { ECART: "Écart", POINT_FORT: "Point fort", REMARQUE: "Remarque" };
export const RESULTATS_TRAITEMENT = {
    REALISE: "Traitement réalisé",
    PARTIEL: "Partiellement réalisé",
    NON_REALISE: "Non réalisé",
};

export const nomPersonne = (personne) => (personne ? `${personne.prenom} ${personne.nom}` : "—");

/** "2026-10-22T14:05:00" -> "22/10/2026 14:05" */
export function formaterDateHeure(valeur) {
    if (!valeur) return "";
    const date = new Date(valeur);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}