import { apiBlob } from "../../api/api";

const AFFICHABLES = ["application/pdf", "image/png", "image/jpeg", "text/plain"];

export const estAffichable = (doc) => AFFICHABLES.includes(doc?.mimeType);

/**
 * Affiche (nouvel onglet, si le format s'y prête) ou télécharge le fichier d'un document.
 * Le fichier est protégé : il est récupéré avec l'en-tête Authorization puis servi en blob.
 */
export async function ouvrirFichierDocument(doc, telecharger = false) {
    const afficher = !telecharger && estAffichable(doc);
    // La fenêtre s'ouvre tout de suite (geste utilisateur) pour ne pas être bloquée après l'attente réseau
    const fenetre = afficher ? window.open("", "_blank") : null;
    try {
        const blob = await apiBlob(`/api/documents-qualite/${doc.id}/fichier${telecharger ? "?telecharger=true" : ""}`);
        const url = URL.createObjectURL(blob);
        if (fenetre) {
            fenetre.location.href = url;
        } else {
            const lien = document.createElement("a");
            lien.href = url;
            lien.download = doc.nomFichier || `${doc.reference}`;
            document.body.appendChild(lien);
            lien.click();
            lien.remove();
        }
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) {
        if (fenetre) fenetre.close();
        throw e;
    }
}