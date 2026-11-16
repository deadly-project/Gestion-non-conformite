import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import Modal from "../Modal";
import { STATUTS_DOCUMENT, TYPES_DOCUMENT, formaterDate, formaterTaille, nomComplet } from "../constantes";
import { estAffichable, ouvrirFichierDocument } from "./documentsApi";
import "../Declarant/nc.css";
import "./documents.css";

const TAILLE_PAGE = 10;

/** Valeurs de la vue : ACTIFS (hors archives), ARCHIVES (obsolètes), TOUS. */
function Carte({ classe, libelle, valeur, actif, onClick }) {
    return (
        <button type="button" className={`doc-stat doc-stat--${classe}`} aria-pressed={actif} onClick={onClick}>
            <span className="doc-stat-libelle">{libelle}</span>
            <span className="doc-stat-valeur">{valeur ?? "—"}</span>
        </button>
    );
}

export function DocumentDetail({ id, onFermer }) {
    const [doc, setDoc] = useState(null);
    const [erreur, setErreur] = useState("");

    useEffect(() => {
        apiRequest(`/api/documents-qualite/${id}`).then(setDoc).catch((e) => setErreur(e.message));
    }, [id]);

    const ouvrir = (telecharger) =>
        ouvrirFichierDocument(doc, telecharger).catch((e) => setErreur(e.message));

    return (
        <Modal titre={doc ? `${doc.reference} — ${doc.titre}` : "Document"} onFermer={onFermer} largeur="moyen"
               pied={doc && (
                   <div className="nc-actions">
                       {estAffichable(doc) && (
                           <button type="button" className="nc-btn" onClick={() => ouvrir(false)}>Afficher</button>
                       )}
                       <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => ouvrir(true)}>
                           Télécharger
                       </button>
                   </div>
               )}>
            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {!doc && !erreur && <p>Chargement...</p>}
            {doc && (
                <dl className="nc-resume">
                    <div><dt>Référence</dt><dd className="doc-reference">{doc.reference}</dd></div>
                    <div><dt>Type</dt><dd>{TYPES_DOCUMENT[doc.typeDocument] ?? doc.typeDocument}</dd></div>
                    <div><dt>Statut</dt>
                        <dd><span className={`nc-badge doc-badge-statut-${doc.statut}`}>{STATUTS_DOCUMENT[doc.statut] ?? doc.statut}</span></dd></div>
                    <div><dt>Version</dt><dd>{doc.version}</dd></div>
                    <div><dt>Processus</dt><dd>{doc.processus ? `${doc.processus.code} — ${doc.processus.libelle}` : "—"}</dd></div>
                    <div><dt>Ajouté par</dt><dd>{doc.createur ? nomComplet(doc.createur) : "—"}</dd></div>
                    <div><dt>Date d'ajout</dt><dd>{formaterDate(doc.dateCreation)}</dd></div>
                    <div><dt>Dernière modification</dt><dd>{formaterDate(doc.dateModification) || "—"}</dd></div>
                    <div><dt>En vigueur depuis</dt><dd>{formaterDate(doc.dateApplication) || "—"}</dd></div>
                    <div><dt>Fichier</dt><dd>{doc.nomFichier} ({formaterTaille(doc.tailleOctets)})</dd></div>
                    <div style={{ gridColumn: "1 / -1" }}><dt>Description</dt>
                        <dd style={{ whiteSpace: "pre-wrap" }}>{doc.description || "—"}</dd></div>
                </dl>
            )}
        </Modal>
    );
}

/**
 * Liste des documents avec recherche et filtres (processus, type, statut, archives).
 *  - mode « bibliotheque » : tableau de bord (compteurs cliquables) + consultation ;
 *  - mode « gestion »      : mêmes filtres + actions réservées au responsable qualité (rendues par actionsLigne).
 * cleRechargement : à incrémenter pour recharger la liste après une modification.
 */
export default function DocumentsExplorateur({ mode = "bibliotheque", droits, cleRechargement = 0, actionsLigne }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const voir = searchParams.get("voir");

    const [processus, setProcessus] = useState([]);
    const [stats, setStats] = useState(null);
    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");

    const [recherche, setRecherche] = useState("");
    const [q, setQ] = useState("");
    const [processusId, setProcessusId] = useState("");
    const [type, setType] = useState("");
    const [statut, setStatut] = useState("");
    const [vue, setVue] = useState("ACTIFS");
    const [page, setPage] = useState(0);

    const archivesPossibles = Boolean(droits?.consulterArchives);

    useEffect(() => {
        apiRequest("/api/referentiels/processus").then((d) => setProcessus(d || [])).catch(() => {});
    }, []);

    // Recherche différée : pas de requête à chaque frappe
    useEffect(() => {
        const t = setTimeout(() => { setQ(recherche.trim()); setPage(0); }, 300);
        return () => clearTimeout(t);
    }, [recherche]);

    useEffect(() => {
        if (mode !== "bibliotheque") return;
        apiRequest("/api/documents-qualite/statistiques").then(setStats).catch(() => setStats(null));
    }, [mode, cleRechargement]);

    const charger = useCallback(async () => {
        const params = new URLSearchParams({ vue, page, taille: TAILLE_PAGE });
        if (q) params.set("q", q);
        if (processusId) params.set("processusId", processusId);
        if (type) params.set("type", type);
        if (statut) params.set("statut", statut);
        try {
            setChargement(true);
            setDonnees(await apiRequest(`/api/documents-qualite?${params}`));
            setErreur("");
        } catch (e) {
            setErreur(e.message || "Impossible de charger les documents.");
        } finally {
            setChargement(false);
        }
    }, [q, processusId, type, statut, vue, page]);

    useEffect(() => { charger(); }, [charger, cleRechargement]);

    function choisirVue(nouvelle, nouveauStatut = "") {
        setVue(nouvelle);
        setStatut(nouveauStatut);
        setPage(0);
    }

    function reinitialiser() {
        setRecherche(""); setQ(""); setProcessusId(""); setType(""); setStatut(""); setVue("ACTIFS"); setPage(0);
    }

    const fermerDetail = () => {
        const suivant = new URLSearchParams(searchParams);
        suivant.delete("voir");
        setSearchParams(suivant, { replace: true });
    };

    const statutsProposes = vue === "ARCHIVES" ? [] : ["EN_VIGUEUR", "EN_REVISION"];
    const documents = donnees?.contenu ?? [];

    return (
        <>
            {mode === "bibliotheque" && (
                <section className="doc-stats" aria-label="Tableau de bord documentaire">
                    <Carte classe="total" libelle="Documents" valeur={stats?.total}
                           actif={vue === (archivesPossibles ? "TOUS" : "ACTIFS") && !statut}
                           onClick={() => choisirVue(archivesPossibles ? "TOUS" : "ACTIFS")} />
                    <Carte classe="vigueur" libelle="En vigueur" valeur={stats?.enVigueur}
                           actif={statut === "EN_VIGUEUR"} onClick={() => choisirVue("ACTIFS", "EN_VIGUEUR")} />
                    <Carte classe="revision" libelle="En révision" valeur={stats?.enRevision}
                           actif={statut === "EN_REVISION"} onClick={() => choisirVue("ACTIFS", "EN_REVISION")} />
                    {archivesPossibles && (
                        <Carte classe="obsolete" libelle="Obsolètes" valeur={stats?.obsolete}
                               actif={vue === "ARCHIVES"} onClick={() => choisirVue("ARCHIVES")} />
                    )}
                </section>
            )}

            <section className="doc-filtres" aria-label="Filtres">
                <h2>Filtrer les documents</h2>
                {archivesPossibles && (
                    <div className="doc-onglets" role="tablist">
                        {[["ACTIFS", "Documents actifs"], ["ARCHIVES", "Archives"], ["TOUS", "Tous"]].map(([code, libelle]) => (
                            <button key={code} type="button" role="tab" className="doc-onglet"
                                    aria-selected={vue === code} onClick={() => choisirVue(code)}>
                                {libelle}
                            </button>
                        ))}
                    </div>
                )}
                <div className="doc-filtres-grille">
                    <div className="nc-champ">
                        <label htmlFor="doc-q">Rechercher</label>
                        <input id="doc-q" type="search" value={recherche} placeholder="Référence, titre, description, fichier..."
                               onChange={(e) => setRecherche(e.target.value)} />
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-processus">Par processus</label>
                        <select id="doc-processus" value={processusId}
                                onChange={(e) => { setProcessusId(e.target.value); setPage(0); }}>
                            <option value="">Tous les processus</option>
                            {processus.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.libelle}</option>)}
                        </select>
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-type">Par catégorie</label>
                        <select id="doc-type" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
                            <option value="">Toutes les catégories</option>
                            {Object.entries(TYPES_DOCUMENT).map(([code, l]) => <option key={code} value={code}>{l}</option>)}
                        </select>
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-statut">Par statut</label>
                        <select id="doc-statut" value={statut} disabled={vue === "ARCHIVES"}
                                onChange={(e) => { setStatut(e.target.value); setPage(0); }}>
                            <option value="">{vue === "ARCHIVES" ? "Obsolète" : "Tous les statuts"}</option>
                            {(vue === "TOUS" ? Object.keys(STATUTS_DOCUMENT) : statutsProposes).map((code) => (
                                <option key={code} value={code}>{STATUTS_DOCUMENT[code]}</option>
                            ))}
                        </select>
                    </div>
                    <div className="nc-actions">
                        <button type="button" className="nc-btn nc-btn-secondaire" onClick={reinitialiser}>Réinitialiser</button>
                    </div>
                </div>
            </section>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

            {chargement && !donnees ? (
                <p>Chargement...</p>
            ) : documents.length === 0 ? (
                <p className="nc-aide">Aucun document ne correspond à ces critères.</p>
            ) : (
                <div className="nc-tableau-conteneur">
                    <table className="nc-tableau">
                        <thead>
                            <tr>
                                <th>Référence</th><th>Titre</th><th>Catégorie</th><th>Processus</th>
                                <th>Statut</th><th>Mis à jour</th><th>Fichier</th>
                                {mode === "gestion" && <th>Gestion</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((d) => (
                                <tr key={d.id} className={d.statut === "OBSOLETE" ? "doc-ligne-obsolete" : ""}>
                                    <td className="doc-reference">{d.reference}</td>
                                    <td className="doc-titre-cellule">
                                        <strong>{d.titre}</strong>
                                        {d.description && <div className="nc-aide">{d.description}</div>}
                                    </td>
                                    <td><span className={`nc-badge doc-badge-type-${d.typeDocument}`}>{TYPES_DOCUMENT[d.typeDocument] ?? d.typeDocument}</span></td>
                                    <td>{d.processus ? d.processus.libelle : "—"}</td>
                                    <td><span className={`nc-badge doc-badge-statut-${d.statut}`}>{STATUTS_DOCUMENT[d.statut] ?? d.statut}</span></td>
                                    <td>{formaterDate(d.dateModification || d.dateCreation)}</td>
                                    <td>
                                        <div className="doc-actions">
                                            <button type="button" className="nc-btn nc-btn-petit nc-btn-secondaire"
                                                    onClick={() => setSearchParams({ voir: d.id }, { replace: true })}>Détails</button>
                                            {estAffichable(d) && (
                                                <button type="button" className="nc-btn nc-btn-petit nc-btn-secondaire"
                                                        onClick={() => ouvrirFichierDocument(d).catch((e) => setErreur(e.message))}>Afficher</button>
                                            )}
                                            <button type="button" className="nc-btn nc-btn-petit"
                                                    onClick={() => ouvrirFichierDocument(d, true).catch((e) => setErreur(e.message))}>Télécharger</button>
                                        </div>
                                    </td>
                                    {mode === "gestion" && <td>{actionsLigne?.(d)}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {donnees && donnees.totalPages > 1 && (
                <div className="nc-pagination">
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" disabled={page === 0}
                            onClick={() => setPage(page - 1)}>Précédent</button>
                    <span>Page {donnees.page + 1} / {donnees.totalPages} ({donnees.total} documents)</span>
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                            disabled={page + 1 >= donnees.totalPages} onClick={() => setPage(page + 1)}>Suivant</button>
                </div>
            )}

            {voir && <DocumentDetail id={voir} onFermer={fermerDetail} />}
        </>
    );
}