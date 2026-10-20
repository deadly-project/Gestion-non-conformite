import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_ACTION, TYPES_ACTION, dateAujourdhui, formaterDate, nomComplet } from "../constantes";
import "../Declarant/nc.css";

export default function CapaPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [utilisateurCourant, setUtilisateurCourant] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [enregistrement, setEnregistrement] = useState(false);

    // État pour l'ajout d'une nouvelle étape inline
    const [enAjout, setEnAjout] = useState(false);
    const [nouveauType, setNouveauType] = useState("CORRECTIVE");
    const [nouvelleDescription, setNouvelleDescription] = useState("");
    const [nouvelleEcheance, setNouvelleEcheance] = useState("");

    useEffect(() => {
        let actif = true;
        Promise.all([
            apiRequest(`/api/non-conformites/${id}`),
            apiRequest("/api/auth/me").catch(() => null)
        ])
            .then(([d, user]) => {
                if (!actif) return;
                setDetail(d);
                setUtilisateurCourant(user);
            })
            .catch((e) => {
                if (actif) setErreur(e.message || "Erreur de chargement.");
            })
            .finally(() => {
                if (actif) setChargement(false);
            });
        return () => { actif = false; };
    }, [id]);

    async function sauvegarderNouvelleEtape(event) {
        event.preventDefault();
        if (!nouvelleDescription.trim() || !nouvelleEcheance) {
            alert("Veuillez remplir la description et l'échéance.");
            return;
        }

        setEnregistrement(true);
        setErreur("");

        try {
            // Reconstitution du payload complet requis par l'API de traitement pour ne rien écraser
            const etapesActuelles = (detail.etapesCapa || []).map((e) => ({
                id: e.id,
                type: e.type,
                description: e.description,
                responsableId: e.responsable?.id,
                dateEcheance: e.dateEcheance,
            }));

            // Ajout de la nouvelle étape à la suite
            const nouvelleEtapeDto = {
                id: null,
                type: nouveauType,
                description: nouvelleDescription.trim(),
                responsableId: utilisateurCourant?.id,
                dateEcheance: nouvelleEcheance,
            };

            const corps = {
                gravite: detail.gravite || detail.graviteDeclaree,
                categorieId: detail.categorieId,
                statut: detail.statut,
                auditeurId: detail.auditeur?.id || null,
                delaisJours: detail.delaisJours || 30,
                analyses: (detail.analyses || []).map(a => ({
                    branche: a.branche,
                    pourquoi1: a.pourquoi1,
                    pourquoi2: a.pourquoi2,
                    pourquoi3: a.pourquoi3,
                    pourquoi4: a.pourquoi4,
                    pourquoi5: a.pourquoi5,
                    causeRacineValidee: a.causeRacineValidee
                })),
                etapesCapa: [...etapesActuelles, nouvelleEtapeDto],
            };

            const resultatMaj = await apiRequest(`/api/non-conformites/${id}/traitement`, {
                method: "PUT",
                body: JSON.stringify(corps),
            });

            setDetail(resultatMaj);
            setEnAjout(false);
            setNouvelleDescription("");
            setNouvelleEcheance("");
            setNouveauType("CORRECTIVE");
        } catch (err) {
            setErreur(err.message || "Erreur lors de l'ajout de l'étape CAPA.");
        } finally {
            setEnregistrement(false);
        }
    }

    if (chargement) return <main className="nc-page"><p>Chargement...</p></main>;
    if (erreur && !detail) return <main className="nc-page"><p className="nc-erreur">{erreur}</p></main>;

    const etapes = detail?.etapesCapa || [];

    return (
        <main className="nc-page">
            <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
                ← Retour au suivi
            </button>

            <h1>Plan d'actions (CAPA) : {detail?.reference}</h1>
            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", border: "1px solid #e2e8f0" }}>
                <p><strong>Titre :</strong> {detail?.titre}</p>
                <p><strong>Auditeur attribué :</strong> {detail?.auditeur ? `${detail.auditeur.prenom} ${detail.auditeur.nom} (M°: ${detail.auditeur.matricule})` : "Aucun auditeur attribué"}</p>
            </div>

            <section className="nc-section">
                {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

                {etapes.length === 0 && !enAjout ? (
                    <p className="nc-aide">Aucune étape CAPA enregistrée pour le moment.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {etapes.map((e, index) => (
                            <div key={e.id || index}>
                                <div style={{ border: "1px solid #cbd5e1", padding: "15px", borderRadius: "8px", background: "#fff", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                        <strong>Étape {index + 1} ({e.type})</strong>
                                        <span className="nc-badge">{STATUTS_ACTION[e.statut] ?? e.statut}</span>
                                    </div>
                                    <p style={{ margin: "5px 0" }}>{e.description}</p>
                                    <div style={{ fontSize: "0.85em", color: "#64748b", display: "flex", justifyContent: "space-between", marginTop: "10px" }}>
                                        <span>Responsable : {e.responsable ? nomComplet(e.responsable) : "Non assigné"}</span>
                                        <span>Échéance : {formaterDate(e.dateEcheance)}</span>
                                    </div>
                                </div>
                                {(index < etapes.length - 1 || enAjout) && (
                                    <div style={{ textAlign: "center", fontSize: "1.5rem", color: "#94a3b8", margin: "5px 0" }}>
                                        ↓
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Formulaire d'ajout affiché à la suite si enAjout est actif */}
                {enAjout ? (
                    <form onSubmit={sauvegarderNouvelleEtape} style={{ border: "2px dashed #3b82f6", padding: "20px", borderRadius: "8px", background: "#eff6ff", marginTop: "1rem" }}>
                        <h3 style={{ marginTop: 0, color: "#1e40af" }}>Nouvelle étape CAPA</h3>
                        
                        <div className="nc-champ" style={{ marginBottom: "10px" }}>
                            <label>Type d'action</label>
                            value={nouveauType}
                            <select value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} style={{ width: "100%", padding: "8px" }}>
                                {Object.entries(TYPES_ACTION).map(([code, libelle]) => (
                                    <option key={code} value={code}>{libelle}</option>
                                ))}
                            </select>
                        </div>

                        <div className="nc-champ" style={{ marginBottom: "10px" }}>
                            <label>Action à mener *</label>
                            <textarea
                                rows={3}
                                value={nouvelleDescription}
                                onChange={(e) => setNouvelleDescription(e.target.value)}
                                placeholder="Décrivez l'action corrective ou préventive..."
                                required
                                style={{ width: "100%", padding: "8px" }}
                            />
                        </div>

                        <div className="nc-champ" style={{ marginBottom: "10px" }}>
                            <label>Échéance *</label>
                            <input
                                type="date"
                                value={nouvelleEcheance}
                                min={dateAujourdhui()}
                                onChange={(e) => setNouvelleEcheance(e.target.value)}
                                required
                                style={{ width: "100%", padding: "8px" }}
                            />
                        </div>

                        <p className="nc-aide" style={{ marginBottom: "15px" }}>
                            Responsable assigné : <strong>{utilisateurCourant ? nomComplet(utilisateurCourant) : "Utilisateur courant"} (Figé)</strong>
                        </p>

                        <div style={{ display: "flex", gap: "10px" }}>
                            <button type="submit" className="nc-btn" disabled={enregistrement}>
                                {enregistrement ? "Enregistrement..." : "Enregistrer cette étape"}
                            </button>
                            <button type="button" className="nc-btn nc-btn-secondaire" disabled={enregistrement} onClick={() => setEnAjout(false)}>
                                Annuler
                            </button>
                        </div>
                    </form>
                ) : (
                    <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                        <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => setEnAjout(true)}>
                            + Ajouter une étape CAPA à la suite
                        </button>
                    </div>
                )}
            </section>
        </main>
    );
}