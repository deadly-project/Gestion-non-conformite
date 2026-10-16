// Jeton de session PROPRE À L'ONGLET.
//
// sessionStorage est isolé par onglet : chaque onglet garde son propre jeton, donc son
// propre utilisateur. Il survit au rechargement de la page, mais disparaît à la
// fermeture de l'onglet (déconnexion automatique).

const CLE_TOKEN = "smq_access_token";

/** Événement émis quand le serveur refuse le jeton (expiré, invalide, compte désactivé). */
export const SESSION_EXPIREE = "smq:session-expiree";

export function lireToken() {
    try {
        return sessionStorage.getItem(CLE_TOKEN);
    } catch {
        return null;
    }
}

export function enregistrerToken(token) {
    try {
        sessionStorage.setItem(CLE_TOKEN, token);
    } catch (erreur) {
        console.error("Impossible d'enregistrer la session :", erreur);
    }
}

export function effacerToken() {
    try {
        sessionStorage.removeItem(CLE_TOKEN);
    } catch {
        // rien à faire
    }
}