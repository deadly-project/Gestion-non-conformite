import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_ACTION, STATUTS_NC, TYPES_ACTION, dateAujourdhui, formaterDate, nomComplet } from "../constantes";
import "../Declarant/nc.css";
import "./CapaPage.css";

/** Toutes les actions correctives et préventives attribuées (une ligne par étape CAPA). */
export default function ListeCapaPage() {
    const navigate = useNavigate();
    const [capa, setCapa] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [filtre, setFiltre] = useState("");
    const aujourdhui = dateAujourdhui();

    useEffect(() => {
        let actif = true;
        apiRequest("/api/capa")
            .then((donnees) => { if (actif) { setCapa(donnees || []); setErreur(""); } })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les actions CAPA."); })
            .finally(() => { if (actif) setChargement(false); });
        return () => { actif = false; };
    }, []);

    const visibles = capa.filter((c) => {
        const texte = [
            c.ncReference, c.ncTitre, c.description, c.responsable?.nom,
            c.responsable?.prenom, TYPES_ACTION[c.type], STATUTS_ACTION[c.statut],
        ].join(" ").toLowerCase();
        return texte.includes(filtre.trim().toLowerCase());
    });

    return (
        <main className="nc-page">
            <h1>Actions correctives et préventives (CAPA)</h1>
            <p className="nc-aide">
                Toutes les étapes CAPA attribuées. Cliquez sur une action pour ouvrir son suivi terrain.
            </p>

            <div className="nc-barre">
                <div className="nc-champ">
                    <label htmlFor="filtre-capa">Rechercher</label>
                    <input
                        id="filtre-capa"
                        type="search"
                        value={filtre}
                        placeholder="NC, action, responsable..."
                        onChange={(e) => setFiltre(e.target.value)}
                    />
                </div>
                <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => window.location.reload()}>
                    Actualiser
                </button>
            </div>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {chargement ? (
                <p>Chargement...</p>
            ) : visibles.length === 0 ? (
                <p className="nc-aide">Aucune action CAPA attribuée pour le moment.</p>
            ) : (
                <div className="nc-tableau-conteneur">
                    <table className="nc-tableau">
                        <thead>
                            <tr>
                                <th>NC</th>
                                <th>Étape</th>
                                <th>Type</th>
                                <th>Action</th>
                                <th>Responsable</th>
                                <th>Échéance</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibles.map((c) => {
                                const echue = c.dateEcheance && c.dateEcheance < aujourdhui && c.statut !== "VERIFIEE";
                                return (
                                    <tr
                                        key={c.id}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => navigate(`/responsable/nc/${c.ncId}/suivi?etape=${c.id}`)}
                                        title="Ouvrir le suivi terrain de cette action"
                                    >
                                        <td>
                                            <strong>{c.ncReference || "Non attribuée"}</strong>
                                            <div className="nc-aide">{c.ncTitre}</div>
                                            <span className="nc-aide">{STATUTS_NC[c.ncStatut] ?? c.ncStatut}</span>
                                        </td>
                                        <td>Étape {c.numero}</td>
                                        <td><span className={`capa-type capa-type--${c.type}`}>{TYPES_ACTION[c.type] ?? c.type}</span></td>
                                        <td>{c.description}</td>
                                        <td>{c.responsable ? nomComplet(c.responsable) : "Non assigné"}</td>
                                        <td>
                                            {formaterDate(c.dateEcheance)}
                                            {echue && <div className="capa-carte-alerte">Échéance dépassée</div>}
                                        </td>
                                        <td>
                                            <span className="nc-badge">{STATUTS_ACTION[c.statut] ?? c.statut}</span>
                                            {c.efficace != null && (
                                                <div className="nc-aide">{c.efficace ? "Efficace" : "Non efficace"}</div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
