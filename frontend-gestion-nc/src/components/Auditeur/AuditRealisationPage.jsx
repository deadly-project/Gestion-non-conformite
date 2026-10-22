import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_ACTION, TYPES_ACTION, formaterDate } from "../constantes";
import ConstatsAudit from "./ConstatsAudit";
import { RESULTATS_TRAITEMENT, STATUTS_AUDIT, TYPES_AUDIT, TYPES_CONSTAT } from "./libelles";
import "../Declarant/nc.css";
import "./audits.css";
import "./AuditRealisationPage.css";

const RAFRAICHISSEMENT_MS = 30000;

const formDepuisDetail = (d) => ({
    compteRendu: d.compteRendu ?? "",
    traitementRealise: d.traitementRealise ?? "",
    resultat: d.audit.resultatTraitement ?? "",
});

/**
 * Réalisation d'un audit par l'auditeur : démarrer, consigner les constats, décrire l'audit,
 * enregistrer le traitement constaté sur le terrain, puis terminer (validation de l'auditeur).
 */
export default function AuditRealisationPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [detail, setDetail] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [message, setMessage] = useState("");
    const [occupe, setOccupe] = useState(false);

    const [form, setForm] = useState({ compteRendu: "", traitementRealise: "", resultat: "" });
    const [nouveauType, setNouveauType] = useState("ECART");
    const [nouvelleDescription, setNouvelleDescription] = useState("");
    const [confirmerFin, setConfirmerFin] = useState(false);

    const charger = useCallback(async (initialiserFormulaire) => {
        try {
            const d = await apiRequest(`/api/audits/${id}`);
            setDetail(d);
            if (initialiserFormulaire) setForm(formDepuisDetail(d));
            setErreur("");
        } catch (e) {
            setErreur(e.message || "Impossible de charger cet audit.");
        } finally {
            setChargement(false);
        }
    }, [id]);

    useEffect(() => {
        setChargement(true);
        charger(true);
    }, [charger]);

    // Rafraîchissement silencieux (commentaires du responsable qualité) : le formulaire n'est jamais écrasé
    useEffect(() => {
        const surRafraichissement = () => charger(false);
        const minuterie = setInterval(surRafraichissement, RAFRAICHISSEMENT_MS);
        window.addEventListener("focus", surRafraichissement);
        return () => {
            clearInterval(minuterie);
            window.removeEventListener("focus", surRafraichissement);
        };
    }, [charger]);

    /** Appel d'une action : la réponse est l'audit à jour. Renvoie true en cas de succès. */
    async function executer(chemin, options, { reinitialiserFormulaire = false } = {}) {
        setOccupe(true);
        setErreur("");
        setMessage("");
        try {
            const d = await apiRequest(`/api/audits/${id}${chemin}`, options);
            setDetail(d);
            if (reinitialiserFormulaire) setForm(formDepuisDetail(d));
            return true;
        } catch (e) {
            setErreur(e.message || "L'action a échoué.");
            return false;
        } finally {
            setOccupe(false);
        }
    }

    const corpsCompteRendu = () => JSON.stringify({
        compteRendu: form.compteRendu,
        traitementRealise: form.traitementRealise,
        resultatTraitement: form.resultat || null,
    });

    const demarrer = async () => {
        if (await executer("/demarrer", { method: "POST" })) setMessage("Audit démarré.");
    };

    async function enregistrer() {
        const ok = await executer("/compte-rendu", { method: "PUT", body: corpsCompteRendu() }, { reinitialiserFormulaire: true });
        if (ok) setMessage("Brouillon enregistré.");
    }

    function demanderFin() {
        setErreur("");
        if (!form.compteRendu.trim()) {
            setErreur("Le compte rendu de l'audit est obligatoire.");
            return;
        }
        if (detail.audit.etape && !form.traitementRealise.trim()) {
            setErreur("Décrivez le traitement constaté sur le terrain.");
            return;
        }
        if (detail.audit.etape && !form.resultat) {
            setErreur("Indiquez si le traitement est réalisé, partiellement réalisé ou non réalisé.");
            return;
        }
        setConfirmerFin(true);
    }

    async function terminer() {
        const ok = await executer("/terminer", { method: "POST", body: corpsCompteRendu() }, { reinitialiserFormulaire: true });
        setConfirmerFin(false);
        if (ok) setMessage("Audit terminé : vos constats et le traitement constaté ont été transmis au responsable qualité.");
    }

    async function ajouterConstat(event) {
        event.preventDefault();
        if (!nouvelleDescription.trim()) return;
        const ok = await executer("/constats", {
            method: "POST",
            body: JSON.stringify({ type: nouveauType, description: nouvelleDescription.trim() }),
        });
        if (ok) setNouvelleDescription("");
    }

    const modifierConstat = (constat, valeurs) =>
        executer(`/constats/${constat.id}`, { method: "PUT", body: JSON.stringify(valeurs) });

    const supprimerConstat = (constat) => executer(`/constats/${constat.id}`, { method: "DELETE" });

    if (chargement) return <main className="nc-page"><p>Chargement...</p></main>;
    if (!detail) {
        return (
            <main className="nc-page">
                <p className="nc-erreur" role="alert">{erreur || "Audit introuvable."}</p>
                <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => navigate("/auditeur/audits")}>← Mes audits</button>
            </main>
        );
    }

    const audit = detail.audit;
    const etape = audit.etape;
    const nc = audit.nc;
    const peutSaisir = detail.modifiable && audit.statut === "EN_COURS";
    const termine = audit.statut === "TERMINE";

    return (
        <main className="nc-page">
            <button type="button" className="nc-btn nc-btn-secondaire area-retour" onClick={() => navigate("/auditeur/audits")}>
                ← Mes audits
            </button>

            <header className="area-entete">
                <h1>{audit.titre}</h1>
                <span className={`aud-badge aud-badge--${audit.statut}`}>{STATUTS_AUDIT[audit.statut] ?? audit.statut}</span>
                {audit.resultatTraitement && (
                    <span className={`aud-badge aud-badge--${audit.resultatTraitement}`}>
                        {RESULTATS_TRAITEMENT[audit.resultatTraitement]}
                    </span>
                )}
            </header>

            <p className="area-meta">
                Prévu le {formaterDate(audit.date)} · Audit {(TYPES_AUDIT[audit.typeAudit] ?? "").toLowerCase()}
                {audit.processus ? ` · Processus : ${audit.processus}` : ""}
                {audit.dateRealisation ? ` · Réalisé le ${formaterDate(audit.dateRealisation)}` : ""}
            </p>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {message && <p className="nc-succes" role="status">{message}</p>}
            {!detail.modifiable && detail.motifBlocage && !termine && (
                <p className="aud-bandeau aud-bandeau--alerte">{detail.motifBlocage}</p>
            )}
            {termine && (
                <p className="aud-bandeau">Cet audit est terminé : il est en lecture seule. Le responsable qualité peut commenter vos constats.</p>
            )}

            {etape && (
                <section className="nc-section area-section" aria-labelledby="area-titre-etape">
                    <h2 id="area-titre-etape">Étape CAPA auditée</h2>
                    <p className="area-etape-ref">
                        <strong>{nc?.reference}</strong> · Étape {etape.numero} · {TYPES_ACTION[etape.type] ?? etape.type}
                        {" · "}<span className={`aud-badge aud-badge--${etape.statut}`}>{STATUTS_ACTION[etape.statut] ?? etape.statut}</span>
                    </p>
                    {nc?.titre && <p className="area-etape-nc">Non-conformité : {nc.titre}</p>}
                    <p className="area-etape-description">{etape.description}</p>
                    <p className="area-meta">Échéance de l'action : {formaterDate(etape.dateEcheance)}</p>
                </section>
            )}

            {audit.statut === "PLANIFIE" && detail.modifiable && (
                <div className="area-demarrage">
                    <p>Cet audit n'est pas encore démarré. Démarrez-le pour consigner vos constats et le compte rendu.</p>
                    <button type="button" className="nc-btn" disabled={occupe} onClick={demarrer}>Démarrer l'audit</button>
                </div>
            )}

            <section className="nc-section area-section" aria-labelledby="area-titre-constats">
                <h2 id="area-titre-constats">Constats ({detail.constats.length})</h2>
                <ConstatsAudit
                    constats={detail.constats}
                    onModifier={peutSaisir ? modifierConstat : undefined}
                    onSupprimer={peutSaisir ? supprimerConstat : undefined}
                />

                {peutSaisir && (
                    <form className="area-nouveau-constat" onSubmit={ajouterConstat}>
                        <h3>Nouveau constat</h3>
                        <div className="aud-champ">
                            <label htmlFor="area-type-constat">Type</label>
                            <select id="area-type-constat" value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} disabled={occupe}>
                                {Object.entries(TYPES_CONSTAT).map(([code, libelle]) => (
                                    <option key={code} value={code}>{libelle}</option>
                                ))}
                            </select>
                        </div>
                        <div className="aud-champ">
                            <label htmlFor="area-description-constat">Description *</label>
                            <textarea
                                id="area-description-constat"
                                rows={3}
                                value={nouvelleDescription}
                                onChange={(e) => setNouvelleDescription(e.target.value)}
                                placeholder="Ce que vous avez observé sur le terrain..."
                                maxLength={4000}
                                disabled={occupe}
                            />
                        </div>
                        <button type="submit" className="nc-btn" disabled={occupe || !nouvelleDescription.trim()}>Ajouter le constat</button>
                    </form>
                )}
            </section>

            <section className="nc-section area-section" aria-labelledby="area-titre-cr">
                <h2 id="area-titre-cr">Compte rendu de l'audit</h2>

                <div className="aud-champ">
                    <label htmlFor="area-compte-rendu">Description de l'audit réalisé {peutSaisir && "*"}</label>
                    <textarea
                        id="area-compte-rendu"
                        rows={5}
                        value={form.compteRendu}
                        onChange={(e) => setForm({ ...form, compteRendu: e.target.value })}
                        placeholder="Déroulement, périmètre audité, personnes rencontrées, documents consultés..."
                        maxLength={8000}
                        disabled={!peutSaisir || occupe}
                    />
                </div>

                {etape && (
                    <>
                        <div className="aud-champ">
                            <label htmlFor="area-traitement">Traitement constaté sur le terrain {peutSaisir && "*"}</label>
                            <textarea
                                id="area-traitement"
                                rows={4}
                                value={form.traitementRealise}
                                onChange={(e) => setForm({ ...form, traitementRealise: e.target.value })}
                                placeholder="Ce qui a été réellement fait pour traiter cette étape, avec les preuves vues..."
                                maxLength={8000}
                                disabled={!peutSaisir || occupe}
                            />
                        </div>

                        <div className="aud-champ">
                            <fieldset disabled={!peutSaisir || occupe}>
                                <legend>Résultat du traitement {peutSaisir && "*"}</legend>
                                <div className="aud-options">
                                    {Object.entries(RESULTATS_TRAITEMENT).map(([code, libelle]) => (
                                        <label key={code} className="aud-option">
                                            <input
                                                type="radio"
                                                name="resultat"
                                                value={code}
                                                checked={form.resultat === code}
                                                onChange={() => setForm({ ...form, resultat: code })}
                                            />
                                            {libelle}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            {peutSaisir && (
                                <p className="area-aide">« Traitement réalisé » rend l'étape validable par le responsable qualité.</p>
                            )}
                        </div>
                    </>
                )}

                {peutSaisir && !confirmerFin && (
                    <div className="area-actions">
                        <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={enregistrer}>
                            Enregistrer le brouillon
                        </button>
                        <button type="button" className="nc-btn" disabled={occupe} onClick={demanderFin}>
                            Terminer l'audit
                        </button>
                    </div>
                )}

                {peutSaisir && confirmerFin && (
                    <div className="area-confirmation" role="alertdialog" aria-labelledby="area-confirmation-titre">
                        <h3 id="area-confirmation-titre">Terminer cet audit ?</h3>
                        <p>
                            Vous validez {detail.constats.length} constat(s) et le traitement constaté
                            {form.resultat ? ` (« ${RESULTATS_TRAITEMENT[form.resultat]} »)` : ""}.
                            L'audit ne sera plus modifiable.
                        </p>
                        <div className="area-actions">
                            <button type="button" className="nc-btn" disabled={occupe} onClick={terminer}>
                                {occupe ? "Enregistrement..." : "Confirmer la fin de l'audit"}
                            </button>
                            <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={() => setConfirmerFin(false)}>
                                Annuler
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}