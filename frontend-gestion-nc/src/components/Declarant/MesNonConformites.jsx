import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, GRAVITES, formaterDate } from "../constantes";
import VisualisationNcModal from "../responsable_qualite/VisualisationNcModal";
import "./nc.css";

export default function MesNonConformites({ utilisateur }) {
    const navigate = useNavigate();
    const [liste, setListe] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    
    // États pour la modale de modification et la modale de visualisation
    const [ncSelectionnee, setNcSelectionnee] = useState(null);
    const [ncVisualisationId, setNcVisualisationId] = useState(null);

    // Formulaire de modification
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
                dateDetection: ncSelectionnee.dateDetection,
                reference: ncSelectionnee.reference
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
        <main className="nc-page">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Mes non-conformités déclarées</h1>
                <button type="button" className="nc-btn" onClick={() => navigate("/declarant/non-conformites/nouvelle")}>
                    + Déclarer une NC
                </button>
            </div>

            {succes && <p className="nc-succes">{succes}</p>}
            {erreur && <p className="nc-erreur">{erreur}</p>}

            {chargement ? (
                <p>Chargement...</p>
            ) : (
                <div className="nc-tableau-conteneur">
                    <table className="nc-tableau">
                        <thead>
                            <tr>
                                <th>Référence</th>
                                <th>Titre</th>
                                <th>Date</th>
                                <th>Statut</th>
                                <th>Gravité</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {liste.length === 0 ? (
                                <tr><td colSpan={6}>Vous n'avez déclaré aucune non-conformité.</td></tr>
                            ) : (
                                liste.map((nc) => {
                                    const gravite = nc.gravite || nc.graviteDeclaree;
                                    return (
                                        <tr key={nc.id}>
                                            <td>{nc.reference}</td>
                                            <td>{nc.titre}</td>
                                            <td>{formaterDate(nc.dateDetection)}</td>
                                            <td><span className={`nc-badge nc-badge-${nc.statut}`}>{STATUTS_NC[nc.statut] ?? nc.statut}</span></td>
                                            <td><span className={`nc-badge nc-badge-${gravite}`}>{GRAVITES[gravite] ?? gravite}</span></td>
                                            <td>
                                                <div className="nc-actions" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                                    {/* Bouton de visualisation identique au rôle responsable qualité */}
                                                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setNcVisualisationId(nc.id)}>
                                                        Visualiser
                                                    </button>

                                                    {nc.statut === "EN_ATTENTE" ? (
                                                        <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => preparerModification(nc)}>
                                                            Modifier
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: "0.85em", color: "#64748b", alignSelf: "center" }}>🔒 Verrouillé</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de visualisation détaillée de la NC */}
            {ncVisualisationId && (
                <VisualisationNcModal ncId={ncVisualisationId} onFermer={() => setNcVisualisationId(null)} />
            )}

            {/* Modal de modification simple */}
            {ncSelectionnee && (
                <div className="nc-overlay">
                    <div className="nc-modal nc-modal-large" style={{ background: "#fff", padding: "2rem", borderRadius: "8px" }}>
                        <h2>Modifier la non-conformité : {ncSelectionnee.reference}</h2>
                        <form onSubmit={soumettreModification}>
                            <div className="nc-champ" style={{ marginBottom: "1rem" }}>
                                <label>Titre</label>
                                <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} required style={{ width: "100%", padding: "8px" }} />
                            </div>
                            <div className="nc-champ" style={{ marginBottom: "1rem" }}>
                                <label>Description détaillée</label>
                                <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required style={{ width: "100%", padding: "8px" }} />
                            </div>
                            <div className="nc-champ" style={{ marginBottom: "1rem" }}>
                                <label>Gravité déclarée</label>
                                <select value={gravite} onChange={(e) => setGravite(e.target.value)} style={{ width: "100%", padding: "8px" }}>
                                    {Object.entries(GRAVITES).map(([code, libelle]) => (
                                        <option key={code} value={code}>{libelle}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: "flex", gap: "10px", marginTop: "1.5rem" }}>
                                <button type="submit" className="nc-btn">Enregistrer les modifications</button>
                                <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => setNcSelectionnee(null)}>Annuler</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}