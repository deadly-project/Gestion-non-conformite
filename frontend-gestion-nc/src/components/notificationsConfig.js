/**
 * Page cible d'une notification selon le rôle de l'utilisateur.
 * Retourne null quand il n'existe pas de page utile (la notification est alors seulement marquée comme lue).
 *
 * Pour changer la page ouverte depuis une notification, c'est le seul endroit à modifier.
 */
export function lienNotification(notification, role) {
    const { type, entite, entiteId } = notification;

    // Informations personnelles : tous les rôles
    if (type === "PROFIL_MODIFIE" || type === "MOT_DE_PASSE_MODIFIE") return "/parametres";

    switch (role) {
        case "ADMINISTRATEUR":
            if (entite === "UTILISATEUR") return "/admin/utilisateurs";
            if (type === "DEMANDE_REINIT_RECUE") return "/admin/reinitialisations";
            return null;

        case "RESPONSABLE_QUALITE":
            if (entite !== "NON_CONFORMITE" || !entiteId) return null;
            // Déclaration ou modification : la NC est ouverte en visualisation dans la liste
            if (type === "NC_DECLAREE" || type === "NC_MODIFIEE") {
                return `/responsable/non-conformites?visualiser=${entiteId}`;
            }
            // Tout le reste (audits, constats, clôture, échéances) : suivi terrain de la NC (SuiviCapaPage)
            return `/responsable/nc/${entiteId}/suivi`;

        case "AUDITEUR":
            if (entite === "AUDIT") return entiteId ? `/auditeur/audits/${entiteId}` : "/auditeur/audits";
            return "/auditeur/audits";

        case "DECLARANT":
            // Visualisation seule de la déclaration, sans accès au traitement
            if (entite === "NON_CONFORMITE" && entiteId) return `/declarant/non-conformites?voir=${entiteId}`;
            return null;

        default:
            return null;
    }
}

/** Famille visuelle d'une notification (couleur de la pastille). */
export function categorieNotification(type) {
    if (type === "NC_ECHEANCE_DEPASSEE" || type === "NC_SANS_TRAITEMENT" || type === "DEMANDE_REINIT_REFUSEE"
        || type === "AUDIT_RETIRE" || type === "UTILISATEUR_DESACTIVE") return "alerte";
    if (type === "NC_CLOTUREE" || type === "AUDIT_TERMINE" || type === "DEMANDE_REINIT_VALIDEE"
        || type === "UTILISATEUR_ACTIVE") return "succes";
    return "info";
}

/** « à l'instant », « il y a 5 min », « hier »... */
export function tempsRelatif(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    const secondes = Math.round((Date.now() - date.getTime()) / 1000);
    if (secondes < 60) return "à l'instant";
    const minutes = Math.floor(secondes / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const heures = Math.floor(minutes / 60);
    if (heures < 24) return `il y a ${heures} h`;
    const jours = Math.floor(heures / 24);
    if (jours === 1) return "hier";
    if (jours < 7) return `il y a ${jours} j`;
    return date.toLocaleDateString("fr-FR");
}
