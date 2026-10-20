import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { BRANCHES } from "../constantes";
import "../Declarant/nc.css";

const POURQUOI = [1, 2, 3, 4, 5];

export default function AnalyseCausesPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [analyses, setAnalyses] = useState({});
    const [brancheActive, setBrancheActive] = useState(BRANCHES[0].code);
    const [chargement, setChargement] = useState(true);
    const [enregistrement, setEnregistrement] = useState(false);
    const [erreur, setErreur] = useState("");
    const [succes, setSucces] = useState("");

    useEffect(() => {
        apiRequest(`/api/non-conformites/${id}`)
            .then((d) => {
                setDetail(d);
                const mapAnalyses = {};
                BRANCHES.forEach((b) => {
                    mapAnalyses[b.code] = { pourquoi1: "", pourquoi2: "", pourquoi3: "", pourquoi4: "", pourquoi5: "", causeRacineValidee: "" };
                });
                (d.analyses || []).forEach((a) => {
                    mapAnalyses[a.branche] = {
                        pourquoi1: a.pourquoi1 ?? "", pourquoi2: a.pourquoi2 ?? "", pourquoi3: a.pourquoi3 ?? "",
                        pourquoi4: a.pourquoi4 ?? "", pourquoi5: a.pourquoi5 ?? "",
                        causeRacineValidee: a.causeRacineValidee ?? "",
                    };
                });
                setAnalyses(mapAnalyses);
            })
            .catch((e) => setErreur(e.message || "Erreur lors du chargement."))
            .finally(() => setChargement(false));
    }, [id]);

    function majAnalyse(branche, champ, valeur) {
        setAnalyses((prev) => ({
            ...prev,
            [branche]: {
                ...prev[branche],
                [champ]: valeur
            }
        }));
        setSucces("");
    }

    async function enregistrerAnalyse(event) {
        event.preventDefault();
        setEnregistrement(true);
        setErreur("");
        setSucces("");

        try {
            // Reconstitution du payload complet requis par l'API de traitement
            const analysesDto = BRANCHES.map((b) => ({
                branche: b.code,
                ...analyses[b.code]
            }));

            const etapesCapaDto = (detail.etapesCapa || []).map((e) => ({
                id: e.id,
                type: e.type,
                description: e.description,
                responsableId: e.responsable?.id,
                dateEcheance: e.dateEcheance,
            }));

            const corps = {
                gravite: detail.gravite || detail.graviteDeclaree,
                categorieId: detail.categorieId,
                statut: detail.statut,
                auditeurId: detail.auditeur?.id || null,
                delaisJours: detail.delaisJours || 30,
                analyses: analysesDto,
                etapesCapa: etapesCapaDto,
            };

            const resultatMaj = await apiRequest(`/api/non-conformites/${id}/traitement`, {
                method: "PUT",
                body: JSON.stringify(corps),
            });

            setDetail(resultatMaj);
            setSucces("L'analyse des causes a été enregistrée avec succès.");
        } catch (err) {
            setErreur(err.message || "Erreur lors de l'enregistrement de l'analyse.");
        } finally {
            setEnregistrement(false);
        }
    }

    if (chargement) return <main className="nc-page"><p>Chargement...</p></main>;
    if (erreur && !detail) return <main className="nc-page"><p className="nc-erreur">{erreur}</p></main>;

    return (
        <main className="nc-page">
            <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
                ← Retour au suivi
            </button>
            
            <h1>Analyse des causes : {detail?.reference}</h1>
            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", border: "1px solid #e2e8f0" }}>
                <p><strong>Titre :</strong> {detail?.titre}</p>
                <p><strong>Auditeur attribué :</strong> {detail?.auditeur ? `${detail.auditeur.prenom} ${detail.auditeur.nom} (M°: ${detail.auditeur.matricule})` : "Aucun auditeur attribué"}</p>
            </div>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {succes && <p className="nc-succes" role="status">{succes}</p>}

            <form onSubmit={enregistrerAnalyse}>
                <section className="nc-section">
                    <div className="nc-onglets" role="tablist" aria-label="Branches d'Ishikawa">
                        {BRANCHES.map((b) => {
                            const remplie = analyses[b.code] && Object.values(analyses[b.code]).some((v) => v.trim() !== "");
                            return (
                                <button key={b.code} type="button" role="tab" className="nc-onglet"
                                    aria-selected={brancheActive === b.code}
                                    onClick={() => setBrancheActive(b.code)}>
                                    {b.libelle}{remplie ? " ✓" : ""}
                                </button>
                            );
                        })}
                    </div>

                    <div className="nc-pourquoi" role="tabpanel" style={{ marginTop: "1rem" }}>
                        {POURQUOI.map((n) => (
                            <div className="nc-champ" key={n}>
                                <label htmlFor={`pourquoi-${brancheActive}-${n}`}>Pourquoi {n}</label>
                                <textarea
                                    id={`pourquoi-${brancheActive}-${n}`}
                                    rows={2}
                                    maxLength={2000}
                                    value={analyses[brancheActive]?.[`pourquoi${n}`] || ""}
                                    onChange={(e) => majAnalyse(brancheActive, `pourquoi${n}`, e.target.value)}
                                    placeholder={`Saisir le pourquoi ${n} pour cette branche...`}
                                />
                            </div>
                        ))}
                        <div className="nc-champ">
                            <label htmlFor={`cause-${brancheActive}`}>Cause racine retenue pour cette branche</label>
                            <textarea
                                id={`cause-${brancheActive}`}
                                rows={2}
                                maxLength={2000}
                                value={analyses[brancheActive]?.causeRacineValidee || ""}
                                onChange={(e) => majAnalyse(brancheActive, "causeRacineValidee", e.target.value)}
                                placeholder="Saisir la cause racine validée..."
                            />
                        </div>
                    </div>
                </section>

                <div className="nc-actions" style={{ marginTop: "1.5rem" }}>
                    <button type="submit" className="nc-btn" disabled={enregistrement}>
                        {enregistrement ? "Enregistrement en cours..." : "Enregistrer l'analyse"}
                    </button>
                </div>
            </form>
        </main>
    );
}