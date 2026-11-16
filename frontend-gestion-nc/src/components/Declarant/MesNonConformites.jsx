import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, GRAVITES, formaterDate } from "../constantes";
import VisualisationNcModal from "../responsable_qualite/VisualisationNcModal";
import { 
    FiPlus, 
    FiEye, 
    FiEdit2, 
    FiLock, 
    FiCalendar, 
    FiAlertTriangle, 
    FiFileText 
} from "react-icons/fi";
import "./MesNonConformites.css";

// Fonction pour formater la date en mode "il y a X..." ou date classique si > 7 jours
// Formate une date en mode "il y a X..." ou date classique si > 7 jours
function formaterDateRelative(dateString) {
    if (!dateString) return "";

    // new Date() gère nativement l'ISO 8601 (Z, offset ±HH:MM, millis…)
    const dateCible = new Date(dateString);
    if (Number.isNaN(dateCible.getTime())) return formaterDate(dateString);

    const diffSecondes = Math.floor((Date.now() - dateCible.getTime()) / 1000);

    // Sécurité : date "future" (dérive d'horloge serveur/client) → on affiche la date réelle
    if (diffSecondes < 0) {
        const absSec = Math.abs(diffSecondes);
        if (absSec < 60) return "à l'instant";
        // au-delà, on considère que c'est une vraie date future → date classique
        return formaterDate(dateString);
    }

    if (diffSecondes < 60) {
        return `il y a ${diffSecondes} seconde${diffSecondes > 1 ? "s" : ""}`;
    }

    const diffMinutes = Math.floor(diffSecondes / 60);
    if (diffMinutes < 60) {
        return `il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    }

    const diffHeures = Math.floor(diffMinutes / 60);
    if (diffHeures < 24) {
        return `il y a ${diffHeures} heure${diffHeures > 1 ? "s" : ""}`;
    }

    const diffJours = Math.floor(diffHeures / 24);
    if (diffJours <= 7) {
        return `il y a ${diffJours} jour${diffJours > 1 ? "s" : ""}`;
    }

    return formaterDate(dateString);
}

export default function MesNonConformites({ utilisateur }) {
    const navigate = useNavigate();
    const [parametresUrl, setParametresUrl] = useSearchParams();
    const [liste, setListe] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    
    const [ncSelectionnee, setNcSelectionnee] = useState(null);
    const [ncVisualisationId, setNcVisualisationId] = useState(null);

    const [titre, setTitre] = useState("");
    const [description, setDescription] = useState("");
    const [gravite, setGravite] = useState("MINEURE");
    const [succes, setSucces] = useState("");

    const chargerDonnees = async () => {
        try {
            setChargement(true);
            const data = await apiRequest(`/api/non-conformites/mes-nc`);
            setListe(data);
        } catch (err) {
            setErreur(err.message || "Erreur lors du chargement de vos non-conformités.");
        } finally {
            setChargement(false);
        }
    };

    useEffect(() => {
        chargerDonnees();
    }, []);

    useEffect(() => {
        const id = Number(parametresUrl.get("voir"));
        if (id > 0) {
            setNcVisualisationId(id);
            setParametresUrl({}, { replace: true });
        }
    }, [parametresUrl, setParametresUrl]);

    function preparerModification(nc) {
        setNcSelectionnee(nc);
        setTitre(nc.titre);
        setDescription(nc.descriptionDetaillee);
        setGravite(nc.graviteDeclaree);
        setSucces("");
    }

    async function soumettreModification(e) {
        e.preventDefault();
        try {
            const corps = {
                titre,
                descriptionDetaillee: description,
                graviteDeclaree: gravite,
                dateDetection: ncSelectionnee.dateDetection
            };

            await apiRequest(`/api/non-conformites/${ncSelectionnee.id}/declarant`, {
                method: "PUT",
                body: JSON.stringify(corps),
            });

            setSucces("Modification enregistrée et transmise en temps réel !");
            setNcSelectionnee(null);
            chargerDonnees();
        } catch (err) {
            setErreur(err.message || "Erreur lors de la modification.");
        }
    }

    return (
        <main className="mync-nc-page">
            <div className="mync-header">
                <h1>Mes non-conformités</h1>
                <button
                    type="button"
                    className="mync-nc-btn"
                    onClick={() => navigate("/declarant/non-conformites/nouvelle")}
                >
                    <FiPlus className="mync-btn-icon" /> <span>Déclarer une NC</span>
                </button>
            </div>

            {succes && <p className="mync-nc-succes">{succes}</p>}
            {erreur && <p className="mync-nc-erreur">{erreur}</p>}

            {chargement ? (
                <p className="mync-chargement">Chargement...</p>
            ) : (
                <div className="mync-liste-conteneur">
                    {liste.length === 0 ? (
                        <div className="mync-vide">
                            Vous n'avez déclaré aucune non-conformité.
                        </div>
                    ) : (
                        liste.map((nc) => {
                            const graviteItem = nc.gravite || nc.graviteDeclaree;
                            return (
                                <div key={nc.id} className="mync-carte-item">
                                    {/* Ligne du haut : Référence à gauche, Statut en haut à droite */}
                                    <div className="mync-item-top">
                                        <div className="mync-item-reference">
                                            <FiFileText className="mync-ref-icon" />
                                            {nc.reference || (
                                                <span className="mync-ref-attente">
                                                    En attente d'attribution
                                                </span>
                                            )}
                                        </div>
                                        <span className={`mync-nc-badge mync-nc-badge-${nc.statut}`}>
                                            {STATUTS_NC[nc.statut] ?? nc.statut}
                                        </span>
                                    </div>

                                    {/* Corps : Titre et Gravité en dessous du titre */}
                                    <div className="mync-item-corps">
                                        <h3 className="mync-item-titre">{nc.titre}</h3>
                                        <div className="mync-item-gravite-wrap">
                                            <span className={`mync-nc-badge mync-nc-badge-${graviteItem}`}>
                                                <FiAlertTriangle style={{ marginRight: '3px' }} />
                                                {GRAVITES[graviteItem] ?? graviteItem}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Ligne du bas : Actions à gauche, Date relative en bas à droite */}
                                    <div className="mync-item-footer">
                                        <div className="mync-nc-actions">
                                            <button
                                                type="button"
                                                className="mync-nc-btn mync-nc-btn-secondaire mync-nc-btn-petit"
                                                onClick={() => setNcVisualisationId(nc.id)}
                                                title="Visualiser"
                                            >
                                                <FiEye /> <span>Visualiser</span>
                                            </button>

                                            {nc.statut === "EN_ATTENTE" ? (
                                                <button
                                                    type="button"
                                                    className="mync-nc-btn mync-nc-btn-secondaire mync-nc-btn-petit"
                                                    onClick={() => preparerModification(nc)}
                                                    title="Modifier"
                                                >
                                                    <FiEdit2 /> <span>Modifier</span>
                                                </button>
                                            ) : (
                                                <span className="mync-verrouille" title="Modifications verrouillées">
                                                    <FiLock /> <span>Verrouillé</span>
                                                </span>
                                            )}
                                        </div>

                                        <div className="mync-item-date" title={formaterDate(nc.dateCreation || nc.dateDetection)}>
                                            <FiCalendar />
                                            <span>{formaterDateRelative(nc.dateCreation || nc.dateDetection)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modal de visualisation détaillée de la NC */}
            {ncVisualisationId && (
                <VisualisationNcModal
                    ncId={ncVisualisationId}
                    actionsResponsable={false}
                    onFermer={() => setNcVisualisationId(null)}
                />
            )}

            {/* Modal de modification simple */}
            {ncSelectionnee && (
                <div className="mync-nc-overlay" onClick={() => setNcSelectionnee(null)}>
                    <div
                        className="mync-nc-modal mync-nc-modal-large"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2>Modifier la non-conformité : {ncSelectionnee.reference || "Brouillon"}</h2>
                        <form onSubmit={soumettreModification}>
                            <div className="mync-nc-champ">
                                <label>Titre</label>
                                <input
                                    type="text"
                                    value={titre}
                                    onChange={(e) => setTitre(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mync-nc-champ">
                                <label>Description détaillée</label>
                                <textarea
                                    rows={4}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mync-nc-champ">
                                <label>Gravité déclarée</label>
                                <select
                                    value={gravite}
                                    onChange={(e) => setGravite(e.target.value)}
                                >
                                    {Object.entries(GRAVITES).map(([code, libelle]) => (
                                        <option key={code} value={code}>
                                            {libelle}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mync-modal-actions">
                                <button type="submit" className="mync-nc-btn">
                                    Enregistrer les modifications
                                </button>
                                <button
                                    type="button"
                                    className="mync-nc-btn mync-nc-btn-secondaire"
                                    onClick={() => setNcSelectionnee(null)}
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}