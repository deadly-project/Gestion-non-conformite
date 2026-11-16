import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_ACTION, STATUTS_NC, TYPES_ACTION, dateAujourdhui, formaterDate, nomComplet } from "../constantes";
import "../Declarant/nc.css";
import "./CapaPage.css";
import "./ListeCapaPage.css";

/** Résultat d'une étape : efficace (vert), non efficace (rouge), pas encore évaluée (neutre). */
function etatEtape(c) {
    if (c.efficace === true) return "efficace";
    if (c.efficace === false) return "inefficace";
    return "attente";
}

const LIBELLE_ETAT = { efficace: "Efficace", inefficace: "Non efficace", attente: "Non évaluée" };

/**
 * Actions correctives et préventives, regroupées par non-conformité :
 * chaque NC est un grand titre (référence + titre) et ses étapes CAPA forment une frise numérotée,
 * à la manière d'un historique de commits.
 */
export default function ListeCapaPage() {
    const navigate = useNavigate();
    const [capa, setCapa] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [recherche, setRecherche] = useState("");
    const [type, setType] = useState("");
    const [statut, setStatut] = useState("");
    const aujourdhui = dateAujourdhui();

    useEffect(() => {
        let actif = true;
        apiRequest("/api/capa")
            .then((donnees) => { if (actif) { setCapa(donnees || []); setErreur(""); } })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les actions CAPA."); })
            .finally(() => { if (actif) setChargement(false); });
        return () => { actif = false; };
    }, []);

    const groupes = useMemo(() => {
        const texteRecherche = recherche.trim().toLowerCase();
        const visibles = capa.filter((c) => {
            if (type && c.type !== type) return false;
            if (statut && c.statut !== statut) return false;
            if (!texteRecherche) return true;
            return [c.ncReference, c.ncTitre, c.description, c.responsable?.nom, c.responsable?.prenom]
                .join(" ").toLowerCase().includes(texteRecherche);
        });

        const parNc = new Map();
        for (const c of visibles) {
            if (!parNc.has(c.ncId)) {
                parNc.set(c.ncId, { ncId: c.ncId, reference: c.ncReference, titre: c.ncTitre, statut: c.ncStatut, etapes: [] });
            }
            parNc.get(c.ncId).etapes.push(c);
        }
        // Étapes dans l'ordre du plan (numéro conservé même filtré) ; NC les plus récentes en premier
        return [...parNc.values()]
            .map((g) => ({ ...g, etapes: g.etapes.sort((a, b) => a.numero - b.numero) }))
            .sort((a, b) => b.ncId - a.ncId);
    }, [capa, recherche, type, statut]);

    return (
        <main className="nc-page">
            <h1>Actions correctives et préventives (CAPA)</h1>
            <p className="nc-aide">
                Chaque non-conformité regroupe ses étapes CAPA, numérotées dans l'ordre du plan d'actions.
                Cliquez sur une étape pour ouvrir son suivi terrain.
            </p>

            <div className="nc-barre">
                <div className="nc-champ">
                    <label htmlFor="filtre-capa">Rechercher</label>
                    <input id="filtre-capa" type="search" value={recherche} placeholder="NC, action, responsable..."
                           onChange={(e) => setRecherche(e.target.value)} />
                </div>
                <div className="nc-champ">
                    <label htmlFor="filtre-type">Type</label>
                    <select id="filtre-type" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="">Tous les types</option>
                        {Object.entries(TYPES_ACTION).map(([code, l]) => <option key={code} value={code}>{l}</option>)}
                    </select>
                </div>
                <div className="nc-champ">
                    <label htmlFor="filtre-statut">Statut</label>
                    <select id="filtre-statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
                        <option value="">Tous les statuts</option>
                        {Object.entries(STATUTS_ACTION).map(([code, l]) => <option key={code} value={code}>{l}</option>)}
                    </select>
                </div>
                <button type="button" className="nc-btn nc-btn-secondaire"
                        onClick={() => { setRecherche(""); setType(""); setStatut(""); }}>
                    Réinitialiser
                </button>
            </div>

            <ul className="capa-legende" aria-label="Légende">
                <li><span className="capa-legende-point capa-etat--efficace" /> Efficace</li>
                <li><span className="capa-legende-point capa-etat--inefficace" /> Non efficace</li>
                <li><span className="capa-legende-point capa-etat--attente" /> Pas encore évaluée</li>
            </ul>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {chargement ? (
                <p>Chargement...</p>
            ) : groupes.length === 0 ? (
                <p className="nc-aide">Aucune action CAPA ne correspond à ces critères.</p>
            ) : (
                groupes.map((g) => (
                    <section key={g.ncId} className="capa-nc">
                        <header className="capa-nc-entete">
                            <div>
                                <h2 className="capa-nc-titre">
                                    <span className="capa-nc-reference">{g.reference || "Référence non attribuée"}</span>
                                    {g.titre}
                                </h2>
                            </div>
                            <span className="nc-badge">{STATUTS_NC[g.statut] ?? g.statut}</span>
                        </header>

                        <ol className="capa-frise">
                            {g.etapes.map((c) => {
                                const etat = etatEtape(c);
                                const echue = c.dateEcheance && c.dateEcheance < aujourdhui && c.statut !== "VERIFIEE";
                                return (
                                    <li key={c.id} className={`capa-frise-item capa-etat--${etat}`}>
                                        <span className="capa-frise-noeud" aria-hidden="true">{c.numero}</span>
                                        <button type="button" className="capa-frise-carte"
                                                onClick={() => navigate(`/responsable/nc/${c.ncId}/suivi?etape=${c.id}`)}
                                                title="Ouvrir le suivi terrain de cette étape">
                                            <div className="capa-frise-haut">
                                                <strong>Étape {c.numero}</strong>
                                                <span className={`capa-type capa-type--${c.type}`}>{TYPES_ACTION[c.type] ?? c.type}</span>
                                                <span className="nc-badge">{STATUTS_ACTION[c.statut] ?? c.statut}</span>
                                                <span className={`capa-resultat capa-resultat--${etat}`}>{LIBELLE_ETAT[etat]}</span>
                                            </div>
                                            <p className="capa-frise-description">{c.description}</p>
                                            <div className="capa-frise-bas">
                                                <span>{c.responsable ? nomComplet(c.responsable) : "Non assigné"}</span>
                                                <span>Échéance : {formaterDate(c.dateEcheance)}</span>
                                                {echue && <span className="capa-carte-alerte">Échéance dépassée</span>}
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                ))
            )}
        </main>
    );
}