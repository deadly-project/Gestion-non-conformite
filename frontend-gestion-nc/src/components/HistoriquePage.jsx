import { useEffect, useState } from "react";
import { apiRequest } from "../api/api";
import { formaterDate } from "./constantes";
import { formaterDateHeure } from "./Auditeur/libelles";
import "./Declarant/nc.css";

const TAILLE_PAGE = 20;

const LIBELLES_ACTION = {
    ADD_NC: "Ajout d'une non-conformité",
    UPDATE_NC: "Modification d'une non-conformité",
    CREATE_NC: "Création d'une non-conformité",
    TRAITEMENT_NC: "Traitement d'une non-conformité",
    CLOSE_NC: "Clôture d'une non-conformité",
    CLOTURER_NC: "Clôture d'une non-conformité",
    ADD_CAPA: "Ajout d'une action CAPA",
    UPDATE_CAPA: "Modification d'une action CAPA",
    VALIDATE_CAPA: "Validation d'une action CAPA",
    VALIDER_CAPA: "Validation d'une action CAPA",
    CANCEL_CAPA_VALIDATION: "Annulation de validation CAPA",
    ANNULER_VALIDATION_CAPA: "Annulation de validation CAPA",
    ADD_AUDIT: "Ajout d'un audit",
    ADD_AUDIT_PLANNING: "Planification d'un audit",
    DELETE_AUDIT_PLANNING: "Retrait d'un audit du planning",
    START_AUDIT: "Démarrage d'un audit",
    DEMARRER_AUDIT: "Démarrage d'un audit",
    UPDATE_AUDIT: "Mise à jour d'un audit",
    ENREGISTRER_COMPTE_RENDU: "Mise à jour d'un compte rendu",
    CLOSE_AUDIT: "Clôture d'un audit",
    TERMINER_AUDIT: "Clôture d'un audit",
    REOPEN_AUDIT: "Réouverture d'un audit",
    REOUVRIR_AUDIT: "Réouverture d'un audit",
    ADD_CONSTAT: "Ajout d'un constat",
    AJOUTER_CONSTAT: "Ajout d'un constat",
    UPDATE_CONSTAT: "Modification d'un constat",
    MODIFIER_CONSTAT: "Modification d'un constat",
    DELETE_CONSTAT: "Suppression d'un constat",
    SUPPRIMER_CONSTAT: "Suppression d'un constat",
    ADD_CONSTAT_ATTACHMENT: "Ajout d'une preuve de constat",
    ADD_COMMENT: "Ajout d'un commentaire",
    COMMENTER_CONSTAT: "Ajout d'un commentaire",
    ADD_USER: "Création d'un utilisateur",
    UPDATE_USER: "Modification d'un utilisateur",
    DISABLE_USER: "Désactivation d'un utilisateur",
    ENABLE_USER: "Réactivation d'un utilisateur",
    UPDATE_PROFILE: "Modification du profil",
    UPDATE_PASSWORD: "Changement de mot de passe",
    REQUEST_RESET_PASSWORD: "Demande de réinitialisation",
    VALIDATE_RESET_PASSWORD: "Validation de réinitialisation",
    REFUSE_RESET_PASSWORD: "Refus de réinitialisation",
    LOGIN: "Connexion",
};

function libelleAction(code) {
    return LIBELLES_ACTION[code] || code;
}

function afficherDetails(details) {
    if (!details || Object.keys(details).length === 0) return "—";
    return Object.entries(details).map(([cle, valeur]) => {
        const texte = valeur !== null && typeof valeur === "object" ? JSON.stringify(valeur) : String(valeur ?? "");
        return `${cle} : ${texte}`;
    }).join(" · ");
}

export default function HistoriquePage({ utilisateur }) {
    const estAdmin = utilisateur?.role === "ADMINISTRATEUR";
    const [donnees, setDonnees] = useState(null);
    const [options, setOptions] = useState({ typesAction: [], entites: [] });
    const [utilisateurs, setUtilisateurs] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [page, setPage] = useState(0);
    const [rafraichir, setRafraichir] = useState(0);

    const [filtres, setFiltres] = useState({
        utilisateurId: "",
        actionType: "",
        entite: "",
        debut: "",
        fin: "",
    });

    useEffect(() => {
        let actif = true;
        const parametres = new URLSearchParams({ page: String(page), taille: String(TAILLE_PAGE) });
        if (estAdmin && filtres.utilisateurId) parametres.set("utilisateurId", filtres.utilisateurId);
        if (filtres.actionType) parametres.set("actionType", filtres.actionType);
        if (filtres.entite) parametres.set("entite", filtres.entite);
        if (filtres.debut) parametres.set("debut", filtres.debut);
        if (filtres.fin) parametres.set("fin", filtres.fin);

        apiRequest(`/api/historique?${parametres}`)
            .then((resultat) => {
                if (!actif) return;
                setDonnees(resultat);
                setErreur("");
            })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger l'historique."); })
            .finally(() => { if (actif) setChargement(false); });

        return () => { actif = false; };
    }, [page, filtres, estAdmin, rafraichir]);

    function actualiser() {
        setChargement(true);
        setRafraichir((v) => v + 1);
    }


    useEffect(() => {
        apiRequest("/api/historique/options")
            .then((d) => setOptions(d || { typesAction: [], entites: [] }))
            .catch(() => {});
        if (estAdmin) {
            apiRequest("/api/utilisateurs")
                .then((d) => setUtilisateurs(Array.isArray(d) ? d : []))
                .catch(() => {});
        }
    }, [estAdmin]);

    function majFiltre(nom, valeur) {
        setChargement(true);
        setPage(0);
        setFiltres((f) => ({ ...f, [nom]: valeur }));
    }

    function reinitialiser() {
        setChargement(true);
        setPage(0);
        setFiltres({ utilisateurId: "", actionType: "", entite: "", debut: "", fin: "" });
    }

    return (
        <main className="nc-page">
            <h1>{estAdmin ? "Historique global des actions" : "Mon historique"}</h1>
            <p className="nc-aide">
                {estAdmin
                    ? "Toutes les actions effectuées dans l'application, avec filtres."
                    : "Vous ne voyez ici que les actions que vous avez vous-même effectuées."}
            </p>

            <div className="nc-barre" style={{ flexWrap: "wrap" }}>
                {estAdmin && (
                    <div className="nc-champ">
                        <label htmlFor="histo-utilisateur">Utilisateur</label>
                        <select id="histo-utilisateur" value={filtres.utilisateurId}
                            onChange={(e) => majFiltre("utilisateurId", e.target.value)}>
                            <option value="">Tous les utilisateurs</option>
                            {utilisateurs.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.prenom} {u.nom} — M° {u.matricule} ({u.role})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="nc-champ">
                    <label htmlFor="histo-type">Type d'action</label>
                    <select id="histo-type" value={filtres.actionType}
                        onChange={(e) => majFiltre("actionType", e.target.value)}>
                        <option value="">Tous les types</option>
                        {options.typesAction.map((type) => (
                            <option key={type} value={type}>{libelleAction(type)} ({type})</option>
                        ))}
                    </select>
                </div>

                <div className="nc-champ">
                    <label htmlFor="histo-entite">Entité</label>
                    <select id="histo-entite" value={filtres.entite}
                        onChange={(e) => majFiltre("entite", e.target.value)}>
                        <option value="">Toutes les entités</option>
                        {options.entites.map((entite) => (
                            <option key={entite} value={entite}>{entite}</option>
                        ))}
                    </select>
                </div>

                <div className="nc-champ">
                    <label htmlFor="histo-debut">Du</label>
                    <input id="histo-debut" type="date" value={filtres.debut}
                        onChange={(e) => majFiltre("debut", e.target.value)} />
                </div>

                <div className="nc-champ">
                    <label htmlFor="histo-fin">Au</label>
                    <input id="histo-fin" type="date" value={filtres.fin}
                        onChange={(e) => majFiltre("fin", e.target.value)} />
                </div>

                <button type="button" className="nc-btn nc-btn-secondaire" onClick={reinitialiser}>
                    Réinitialiser les filtres
                </button>
                <button type="button" className="nc-btn nc-btn-secondaire" onClick={actualiser}>
                    Actualiser
                </button>
            </div>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

            {chargement && !donnees ? (
                <p>Chargement...</p>
            ) : (
                <>
                    <div className="nc-tableau-conteneur">
                        <table className="nc-tableau">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    {estAdmin && <th>Utilisateur</th>}
                                    <th>Action</th>
                                    <th>Entité</th>
                                    <th>Détails</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(!donnees || donnees.contenu.length === 0) ? (
                                    <tr><td colSpan={estAdmin ? 5 : 4}>Aucune action enregistrée pour ces filtres.</td></tr>
                                ) : donnees.contenu.map((h) => (
                                    <tr key={h.id}>
                                        <td>{formaterDateHeure(h.date)}</td>
                                        {estAdmin && (
                                            <td>
                                                <strong>{h.utilisateurPrenom} {h.utilisateurNom}</strong>
                                                <div className="nc-aide">
                                                    {h.utilisateurMatricule ? `M° ${h.utilisateurMatricule} · ` : ""}
                                                    {h.utilisateurRole || ""}
                                                </div>
                                            </td>
                                        )}
                                        <td>
                                            <span className="nc-badge">{h.actionType}</span>
                                            <div className="nc-aide">{libelleAction(h.actionType)}</div>
                                        </td>
                                        <td>{h.entite}{h.entiteId ? ` #${h.entiteId}` : ""}</td>
                                        <td style={{ maxWidth: "420px", whiteSpace: "normal" }}>{afficherDetails(h.details)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {donnees && donnees.totalPages > 1 && (
                        <div className="nc-actions" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1rem" }}>
                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                disabled={page <= 0} onClick={() => { setChargement(true); setPage((p) => Math.max(0, p - 1)); }}>
                                ← Précédent
                            </button>
                            <span className="nc-aide">
                                Page {donnees.page + 1} / {donnees.totalPages} — {donnees.total} action(s)
                            </span>
                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                disabled={page + 1 >= donnees.totalPages} onClick={() => { setChargement(true); setPage((p) => p + 1); }}>
                                Suivant →
                            </button>
                        </div>
                    )}
                    {donnees && donnees.totalPages <= 1 && donnees.total > 0 && (
                        <p className="nc-aide">{donnees.total} action(s) — filtre du {formaterDate(filtres.debut) || "début"} au {formaterDate(filtres.fin) || "aujourd'hui"}</p>
                    )}
                </>
            )}
        </main>
    );
}
