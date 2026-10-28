import { useMemo } from "react";

/**
 * Détails d'une entrée d'historique.
 *  - Nouveau format  : { avant: {...tous les champs}, apres: {...}, contexte: {...} }
 *    -> tableau champ par champ (id, nom, prénom...) avec la valeur avant et après ;
 *  - Ancien format (champs à plat) : simples pastilles, comme avant.
 */

const LIBELLES_CHAMPS = {
    id: "Identifiant",
    nom: "Nom",
    prenom: "Prénom",
    email: "Email",
    matricule: "Matricule",
    role: "Rôle",
    actif: "Compte actif",
    dateCreation: "Date de création",
    dateModification: "Date de modification",
    statut: "Statut",
    titre: "Titre",
    reference: "Référence",
    code: "Code",
    libelle: "Libellé",
    description: "Description",
    descriptionDetaillee: "Description détaillée",
    graviteDeclaree: "Gravité déclarée",
    gravite: "Gravité",
    dateDetection: "Date de détection",
    dateEcheance: "Date d'échéance",
    declarantId: "Déclarant (id)",
    responsableId: "Responsable (id)",
    auditeurId: "Auditeur (id)",
    processusId: "Processus (id)",
    ncId: "Non-conformité (id)",
    auditId: "Audit (id)",
    constatId: "Constat (id)",
    actionCapaId: "Étape CAPA (id)",
    utilisateurId: "Utilisateur (id)",
    traiteParId: "Traité par (id)",
    motDePasseModifie: "Mot de passe modifié",
};

function libelleChamp(cle) {
    if (LIBELLES_CHAMPS[cle]) return LIBELLES_CHAMPS[cle];
    const texte = cle.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    return texte.charAt(0).toUpperCase() + texte.slice(1);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/;

function formaterValeur(valeur) {
    if (valeur === null || valeur === undefined || valeur === "") return "—";
    if (typeof valeur === "boolean") return valeur ? "Oui" : "Non";
    if (typeof valeur === "string" && ISO_DATE.test(valeur)) {
        const date = new Date(valeur);
        if (!isNaN(date.getTime())) {
            return valeur.includes("T")
                ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })
                : date.toLocaleDateString("fr-FR");
        }
    }
    if (typeof valeur === "object") return JSON.stringify(valeur, null, 1);
    return String(valeur);
}

const estObjet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Nouveau format : au moins un des deux états est un objet (création : avant = null ; suppression : apres = null). */
function estComparaison(details) {
    return Boolean(details) && ("avant" in details || "apres" in details)
        && (estObjet(details.avant) || estObjet(details.apres));
}

function Comparaison({ avant, apres }) {
    const lignes = useMemo(() => {
        const cles = [...new Set([...Object.keys(apres ?? {}), ...Object.keys(avant ?? {})])];
        return cles.map((cle) => {
            const a = avant ? avant[cle] : undefined;
            const b = apres ? apres[cle] : undefined;
            return {
                cle,
                avant: formaterValeur(a),
                apres: formaterValeur(b),
                modifie: JSON.stringify(a ?? null) !== JSON.stringify(b ?? null),
            };
        });
    }, [avant, apres]);

    const nbModifies = lignes.filter((l) => l.modifie).length;
    const creation = !avant;
    const suppression = !apres;
    const resume = creation
        ? `Valeurs enregistrées (${lignes.length} champs)`
        : suppression
            ? `Valeurs supprimées (${lignes.length} champs)`
            : `Avant / après : ${nbModifies} champ${nbModifies > 1 ? "s" : ""} modifié${nbModifies > 1 ? "s" : ""} sur ${lignes.length}`;

    return (
        <details className="histo-compare" open={!creation && !suppression && nbModifies > 0 && nbModifies <= 4}>
            <summary>{resume}</summary>
            <div className="histo-compare-scroll">
                <table className="histo-compare-table">
                    <thead>
                        <tr>
                            <th>Champ</th>
                            {!creation && <th>Avant</th>}
                            {!suppression && <th>Après</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {lignes.map((l) => (
                            <tr key={l.cle} className={l.modifie && !creation && !suppression ? "est-modifie" : ""}>
                                <th scope="row">{libelleChamp(l.cle)}</th>
                                {!creation && <td className="val-avant">{l.avant}</td>}
                                {!suppression && <td className="val-apres">{l.apres}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function Pastilles({ donnees }) {
    const entrees = Object.entries(donnees ?? {});
    if (entrees.length === 0) return null;
    return (
        <div className="histo-tl-details">
            {entrees.map(([cle, valeur]) => {
                const texte = formaterValeur(valeur);
                return (
                    <span key={cle} className="histo-detail-chip" title={texte}>
                        <span className="histo-detail-chip-cle">{libelleChamp(cle)}</span>
                        <span className="histo-detail-chip-val">
                            {texte.length > 50 ? texte.slice(0, 50) + "…" : texte}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

export default function HistoriqueDetails({ details }) {
    if (!details || Object.keys(details).length === 0) return null;

    if (estComparaison(details)) {
        return (
            <>
                <Comparaison avant={details.avant} apres={details.apres} />
                <Pastilles donnees={details.contexte} />
            </>
        );
    }
    // Entrées anciennes, enregistrées avant la comparaison complète
    return <Pastilles donnees={details} />;
}
