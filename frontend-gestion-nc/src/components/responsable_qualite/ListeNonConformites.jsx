import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, GRAVITES, formaterDate } from "../constantes";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";
import TraitementNcModal from "./TraitementNcModal";
import AvancementNcModal from "./AvancementNcModal";
import "../Declarant/nc.css";

const TAILLE_PAGE = 10;

/** Liste des non-conformités du responsable qualité, avec mise à jour temps réel via WebSocket. */
export default function ListeNonConformites({ utilisateur }) {
    const [saisie, setSaisie] = useState("");
    const [recherche, setRecherche] = useState("");
    const [statut, setStatut] = useState("");
    const [page, setPage] = useState(0);

    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [info, setInfo] = useState("");
    const [version, setVersion] = useState(0);        // incrémenté pour recharger

    const [ncTraitee, setNcTraitee] = useState(null);       // id de la NC dans « Actions »
    const [ncAvancement, setNcAvancement] = useState(null); // id de la NC dans « Avancement »

    // Écoute des notifications en temps réel pour actualiser la liste automatiquement
    useNotificationsAdmin({
        topic: "/topic/admin/nc",
        onMessage: (nouvelleNc) => {
            setInfo(`Nouvelle non-conformité déclarée : ${nouvelleNc.reference}`);
            setVersion((v) => v + 1); // Déclenche le rechargement des données
        }
    });

    // La recherche n'est lancée que 350 ms après la dernière frappe
    useEffect(() => {
        const minuteur = setTimeout(() => { setRecherche(saisie.trim()); setPage(0); }, 350);
        return () => clearTimeout(minuteur);
    }, [saisie]);

    useEffect(() => {
        let actif = true;
        setChargement(true);

        const parametres = new URLSearchParams({
            statut, q: recherche, page: String(page), taille: String(TAILLE_PAGE),
        });
        apiRequest(`/api/non-conformites?${parametres}`)
            .then((resultat) => { if (actif) { setDonnees(resultat); setErreur(""); } })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les non-conformités."); })
            .finally(() => { if (actif) setChargement(false); });

        return () => { actif = false; };
    }, [statut, recherche, page, version]);

    const fermerTraitement = useCallback(() => setNcTraitee(null), []);
    const fermerAvancement = useCallback(() => setNcAvancement(null), []);

    function apresEnregistrement(detail) {
        setNcTraitee(null);
        setInfo(`Le traitement de ${detail.reference} a été enregistré.`);
        setVersion((v) => v + 1);
    }

    return (
        <main className="nc-page">
            <h1>Suivi des non-conformités</h1>

            <div className="nc-barre">
                <div className="nc-champ">
                    <label htmlFor="recherche">Rechercher</label>
                    <input id="recherche" type="search" value={saisie}
                        placeholder="Titre, référence, auteur, service..."
                        onChange={(e) => setSaisie(e.target.value)} />
                </div>

                <div className="nc-champ">
                    <label htmlFor="filtreStatut">Statut</label>
                    <select id="filtreStatut" value={statut}
                        onChange={(e) => { setStatut(e.target.value); setPage(0); }}>
                        <option value="">Tous</option>
                        {Object.entries(STATUTS_NC).map(([code, libelle]) => (
                            <option key={code} value={code}>{libelle}</option>
                        ))}
                    </select>
                </div>

                <button type="button" className="nc-btn nc-btn-secondaire"
                    onClick={() => setVersion((v) => v + 1)}>
                    Actualiser
                </button>
            </div>

            {info && <p className="nc-succes" role="status">{info}</p>}
            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

            <div className="nc-tableau-conteneur">
                <table className="nc-tableau">
                    <thead>
                        <tr>
                            <th>Référence</th>
                            <th>Titre</th>
                            <th>Statut</th>
                            <th>Date</th>
                            <th>Auteur</th>
                            <th>Service concerné</th>
                            <th>Gravité</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chargement && !donnees && (
                            <tr><td colSpan={8}>Chargement...</td></tr>
                        )}
                        {donnees && donnees.contenu.length === 0 && (
                            <tr><td colSpan={8}>Aucune non-conformité trouvée.</td></tr>
                        )}
                        {donnees?.contenu.map((nc) => {
                            const gravite = nc.gravite || nc.graviteDeclaree;
                            return (
                                <tr key={nc.id}>
                                    <td>{nc.reference}</td>
                                    <td>{nc.titre}</td>
                                    <td>
                                        <span className={`nc-badge nc-badge-${nc.statut}`}>
                                            {STATUTS_NC[nc.statut] ?? nc.statut}
                                        </span>
                                    </td>
                                    <td>{formaterDate(nc.dateDetection)}</td>
                                    <td>{nc.auteurPrenom} {nc.auteurNom}</td>
                                    <td>{nc.service}</td>
                                    <td>
                                        <span className={`nc-badge nc-badge-${gravite}`}>
                                            {GRAVITES[gravite] ?? gravite}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="nc-actions">
                                            <button type="button" className="nc-btn nc-btn-petit"
                                                disabled={nc.statut === "CLOTUREE"}
                                                onClick={() => setNcTraitee(nc.id)}>
                                                Actions
                                            </button>
                                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                                onClick={() => setNcAvancement(nc.id)}>
                                                Avancement
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {donnees && donnees.totalPages > 1 && (
                <div className="nc-pagination">
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                        disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        Précédent
                    </button>
                    <span>Page {donnees.page + 1} sur {donnees.totalPages} ({donnees.total} résultats)</span>
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                        disabled={page + 1 >= donnees.totalPages} onClick={() => setPage((p) => p + 1)}>
                        Suivant
                    </button>
                </div>
            )}

            {ncTraitee && (
                <TraitementNcModal
                    ncId={ncTraitee}
                    utilisateur={utilisateur}
                    onFermer={fermerTraitement}
                    onEnregistre={apresEnregistrement}
                />
            )}
            {ncAvancement && (
                <AvancementNcModal ncId={ncAvancement} onFermer={fermerAvancement} />
            )}
        </main>
    );
}