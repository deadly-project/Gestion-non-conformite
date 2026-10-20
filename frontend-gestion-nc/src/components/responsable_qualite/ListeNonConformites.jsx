import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, GRAVITES, formaterDate } from "../constantes";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";
import VisualisationNcModal from "./VisualisationNcModal";
import TraitementNcModal from "./TraitementNcModal";
import AvancementNcModal from "./AvancementNcModal";
import "../Declarant/nc.css";

const TAILLE_PAGE = 10;

export default function ListeNonConformites({ utilisateur }) {
    const navigate = useNavigate();
    const [saisie, setSaisie] = useState("");
    const [recherche, setRecherche] = useState("");
    const [statut, setStatut] = useState("");
    const [page, setPage] = useState(0);

    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [info, setInfo] = useState("");
    const [version, setVersion] = useState(0);

    const [ncVisualisation, setNcVisualisation] = useState(null);
    const [ncTraitement, setNcTraitement] = useState(null);
    const [ncAvancement, setNcAvancement] = useState(null);

    useNotificationsAdmin({
        topic: "/topic/admin/nc",
        onMessage: (nouvelleNc) => {
            setInfo(`Nouvelle non-conformité déclarée : ${nouvelleNc.reference}`);
            setVersion((v) => v + 1);
        }
    });

    useEffect(() => {
        const minuteur = setTimeout(() => { setRecherche(saisie.trim()); setPage(0); }, 350);
        return () => clearTimeout(minuteur);
    }, [saisie]);

    useEffect(() => {
        let actif = true;
        setChargement(true);
        const parametres = new URLSearchParams({ statut, q: recherche, page: String(page), taille: String(TAILLE_PAGE) });
        apiRequest(`/api/non-conformites?${parametres}`)
            .then((resultat) => { if (actif) { setDonnees(resultat); setErreur(""); } })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les non-conformités."); })
            .finally(() => { if (actif) setChargement(false); });
        return () => { actif = false; };
    }, [statut, recherche, page, version]);

    function apresTraitement(detail) {
        setNcTraitement(null);
        setInfo(`Le traitement de ${detail.reference} a été enregistré.`);
        setVersion((v) => v + 1);
    }

    return (
        <main className="nc-page">
            <h1>Suivi des non-conformités</h1>

            <div className="nc-barre">
                <div className="nc-champ">
                    <label htmlFor="recherche">Rechercher</label>
                    <input id="recherche" type="search" value={saisie} placeholder="Titre, référence..." onChange={(e) => setSaisie(e.target.value)} />
                </div>
                <div className="nc-champ">
                    <label htmlFor="filtreStatut">Statut</label>
                    <select id="filtreStatut" value={statut} onChange={(e) => { setStatut(e.target.value); setPage(0); }}>
                        <option value="">Tous</option>
                        {Object.entries(STATUTS_NC).map(([code, libelle]) => (<option key={code} value={code}>{libelle}</option>))}
                    </select>
                </div>
                <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => setVersion((v) => v + 1)}>Actualiser</button>
            </div>

            {info && <p className="nc-succes">{info}</p>}
            {erreur && <p className="nc-erreur">{erreur}</p>}

            <div className="nc-tableau-conteneur">
                <table className="nc-tableau">
                    <thead>
                        <tr>
                            <th>Référence</th>
                            <th>Titre</th>
                            <th>Statut</th>
                            <th>Date</th>
                            <th>Auteur</th>
                            <th>Service</th>
                            <th>Gravité</th>
                            <th>Actions & Liens</th>
                        </tr>
                    </thead>
                    <tbody>
                        {chargement && !donnees && <tr><td colSpan={8}>Chargement...</td></tr>}
                        {donnees && donnees.contenu.length === 0 && <tr><td colSpan={8}>Aucune non-conformité trouvée.</td></tr>}
                        {donnees?.contenu.map((nc) => {
                            const gravite = nc.gravite || nc.graviteDeclaree;
                            return (
                                <tr key={nc.id}>
                                    <td>{nc.reference}</td>
                                    <td>{nc.titre}</td>
                                    <td><span className={`nc-badge nc-badge-${nc.statut}`}>{STATUTS_NC[nc.statut] ?? nc.statut}</span></td>
                                    <td>{formaterDate(nc.dateDetection)}</td>
                                    <td>{nc.auteurPrenom} {nc.auteurNom}</td>
                                    <td>{nc.service}</td>
                                    <td><span className={`nc-badge nc-badge-${gravite}`}>{GRAVITES[gravite] ?? gravite}</span></td>
                                    <td>
                                        <div className="nc-actions" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setNcVisualisation(nc.id)}>Visualiser</button>
                                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setNcAvancement(nc.id)}>Avancement</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modale de Visualisation enrichie avec les boutons Traitement, CAPA et Analyse dans le pied */}
            {/* Modale de Visualisation */}
            {ncVisualisation && (
                <VisualisationNcModal 
                    ncId={ncVisualisation} 
                    onFermer={() => setNcVisualisation(null)} 
                    onOuvrirTraitement={(id) => {
                        setNcVisualisation(null); // Ferme la visualisation
                        setNcTraitement(id);     // Ouvre le traitement
                    }}
                />
            )}

            {/* Modale d'Avancement */}
            {ncAvancement && (
                <AvancementNcModal 
                    ncId={ncAvancement} 
                    onFermer={() => setNcAvancement(null)} 
                />
            )}

            {/* Modale de Traitement */}
            {ncTraitement && (
                <TraitementNcModal 
                    ncId={ncTraitement} 
                    utilisateur={utilisateur} 
                    onFermer={() => setNcTraitement(null)} 
                    onEnregistre={apresTraitement} 
                />
            )}
        </main>
    );
}