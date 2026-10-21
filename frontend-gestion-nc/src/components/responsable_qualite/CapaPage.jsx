import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_ACTION, TYPES_ACTION, dateAujourdhui, formaterDate, nomComplet } from "../constantes";
import CalendrierAudits, { jourIso } from "./CalendrierAudits";
import usePlanningAudit from "./usePlanningAudit";
import "../Declarant/nc.css";
import "./CapaPage.css";

/** Carte compacte d'une étape CAPA ; elle se glisse sur un jour du calendrier. */
function CarteEtape({ etape, numero, joursPlanifies, aujourdhui, onGlisserDebut, onGlisserFin }) {
    const echeance = jourIso(etape.dateEcheance);
    const echue = Boolean(echeance) && echeance < aujourdhui;
    const statut = etape.statut ?? etape.statutAction;

    function debutGlisser(event) {
        event.dataTransfer.setData("text/plain", String(etape.id));
        event.dataTransfer.effectAllowed = "copy";
        onGlisserDebut(etape);
    }

    return (
        <article
            className={`capa-carte${echue ? " capa-carte--echue" : ""}`}
            draggable={!echue}
            onDragStart={debutGlisser}
            onDragEnd={onGlisserFin}
        >
            <header className="capa-carte-entete">
                <strong>Étape {numero}</strong>
                <span className={`capa-type capa-type--${etape.type}`}>{TYPES_ACTION[etape.type] ?? etape.type}</span>
                <span className="nc-badge">{STATUTS_ACTION[statut] ?? statut}</span>
            </header>

            <p className="capa-carte-description">{etape.description}</p>

            <div className="capa-carte-infos">
                <span>Responsable : {etape.responsable ? nomComplet(etape.responsable) : "Non assigné"}</span>
                <span>Échéance : {formaterDate(etape.dateEcheance)}</span>
            </div>

            <div className="capa-carte-planning">
                {joursPlanifies.length === 0 ? (
                    <span className="capa-aucun-jour">Pas encore planifiée</span>
                ) : (
                    joursPlanifies.map((jour) => <span key={jour} className="capa-jour-tag">{formaterDate(jour)}</span>)
                )}
            </div>

            {echue && <p className="capa-carte-alerte">Échéance dépassée : planification impossible.</p>}
        </article>
    );
}

export default function CapaPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [utilisateurCourant, setUtilisateurCourant] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [enregistrement, setEnregistrement] = useState(false);

    // Ajout d'une nouvelle étape
    const [enAjout, setEnAjout] = useState(false);
    const [nouveauType, setNouveauType] = useState("CORRECTIVE");
    const [nouvelleDescription, setNouvelleDescription] = useState("");
    const [nouvelleEcheance, setNouvelleEcheance] = useState("");

    // Calendrier d'audits : étape en cours de glissement + planning enregistré
    const [etapeGlissee, setEtapeGlissee] = useState(null);
    const { planning, erreur: erreurPlanning, planifier, retirer } = usePlanningAudit(id);

    useEffect(() => {
        let actif = true;
        Promise.all([
            apiRequest(`/api/non-conformites/${id}`),
            apiRequest("/api/auth/me").catch(() => null),
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
            // Payload complet requis par l'API de traitement pour ne rien écraser
            const etapesActuelles = (detail.etapesCapa || []).map((e) => ({
                id: e.id,
                type: e.type,
                description: e.description,
                responsableId: e.responsable?.id,
                dateEcheance: e.dateEcheance,
            }));

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
                analyses: (detail.analyses || []).map((a) => ({
                    branche: a.branche,
                    pourquoi1: a.pourquoi1,
                    pourquoi2: a.pourquoi2,
                    pourquoi3: a.pourquoi3,
                    pourquoi4: a.pourquoi4,
                    pourquoi5: a.pourquoi5,
                    causeRacineValidee: a.causeRacineValidee,
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
    const aujourdhui = dateAujourdhui();

    // étape -> jours planifiés (triés), pour l'affichage sur les cartes
    const joursParEtape = new Map();
    planning.forEach((p) => {
        const jours = joursParEtape.get(p.etapeId) || [];
        jours.push(jourIso(p.date));
        joursParEtape.set(p.etapeId, jours.sort());
    });

    const avertissement = detail?.auditeur
        ? ""
        : "Aucun auditeur n'est attribué à cette non-conformité : la planification sera refusée tant qu'il n'y en a pas.";

    return (
        <main className="nc-page">
            <button type="button" className="nc-btn nc-btn-secondaire capa-retour" onClick={() => navigate(-1)}>
                ← Retour au suivi
            </button>

            <h1>Plan d'actions (CAPA) : {detail?.reference}</h1>
            <div className="capa-resume">
                <p><strong>Titre :</strong> {detail?.titre}</p>
                <p>
                    <strong>Auditeur attribué :</strong>{" "}
                    {detail?.auditeur
                        ? `${detail.auditeur.prenom} ${detail.auditeur.nom} (M°: ${detail.auditeur.matricule})`
                        : "Aucun auditeur attribué"}
                </p>
            </div>

            {/* Étapes CAPA (gauche) et calendrier (droite) côte à côte pour faciliter le glisser-déposer */}
            <div className="capa-espace">
                <section className="nc-section capa-colonne" aria-labelledby="capa-titre-liste">
                    <h2 id="capa-titre-liste" className="capa-titre-colonne">Étapes CAPA</h2>
                    <p className="capa-aide">Glissez une étape sur un jour du calendrier.</p>

                    {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
                    {erreurPlanning && <p className="nc-erreur" role="alert">{erreurPlanning}</p>}

                    {etapes.length === 0 && !enAjout ? (
                        <p className="nc-aide">Aucune étape CAPA enregistrée pour le moment.</p>
                    ) : (
                        <div className="capa-liste">
                            {etapes.map((etape, index) => (
                                <CarteEtape
                                    key={etape.id ?? index}
                                    etape={etape}
                                    numero={index + 1}
                                    joursPlanifies={joursParEtape.get(etape.id) || []}
                                    aujourdhui={aujourdhui}
                                    onGlisserDebut={setEtapeGlissee}
                                    onGlisserFin={() => setEtapeGlissee(null)}
                                />
                            ))}
                        </div>
                    )}

                    {enAjout ? (
                        <form className="capa-formulaire" onSubmit={sauvegarderNouvelleEtape}>
                            <h3>Nouvelle étape CAPA</h3>

                            <div className="nc-champ capa-champ">
                                <label htmlFor="capa-type">Type d'action</label>
                                <select id="capa-type" value={nouveauType} onChange={(e) => setNouveauType(e.target.value)}>
                                    {Object.entries(TYPES_ACTION).map(([code, libelle]) => (
                                        <option key={code} value={code}>{libelle}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="nc-champ capa-champ">
                                <label htmlFor="capa-description">Action à mener *</label>
                                <textarea
                                    id="capa-description"
                                    rows={3}
                                    value={nouvelleDescription}
                                    onChange={(e) => setNouvelleDescription(e.target.value)}
                                    placeholder="Décrivez l'action corrective ou préventive..."
                                    required
                                />
                            </div>

                            <div className="nc-champ capa-champ">
                                <label htmlFor="capa-echeance">Échéance *</label>
                                <input
                                    id="capa-echeance"
                                    type="date"
                                    value={nouvelleEcheance}
                                    min={aujourdhui}
                                    onChange={(e) => setNouvelleEcheance(e.target.value)}
                                    required
                                />
                            </div>

                            <p className="nc-aide">
                                Responsable assigné : <strong>{utilisateurCourant ? nomComplet(utilisateurCourant) : "Utilisateur courant"} (Figé)</strong>
                            </p>

                            <div className="capa-formulaire-actions">
                                <button type="submit" className="nc-btn" disabled={enregistrement}>
                                    {enregistrement ? "Enregistrement..." : "Enregistrer cette étape"}
                                </button>
                                <button type="button" className="nc-btn nc-btn-secondaire" disabled={enregistrement} onClick={() => setEnAjout(false)}>
                                    Annuler
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="capa-ajout">
                            <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => setEnAjout(true)}>
                                + Ajouter une étape CAPA
                            </button>
                        </div>
                    )}
                </section>

                <CalendrierAudits
                    etapes={etapes}
                    planning={planning}
                    etapeGlissee={etapeGlissee}
                    avertissement={avertissement}
                    onPlanifier={planifier}
                    onRetirer={retirer}
                />
            </div>
        </main>
    );
}