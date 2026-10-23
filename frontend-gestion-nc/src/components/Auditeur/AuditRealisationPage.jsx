import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_ACTION, TYPES_ACTION, formaterDate } from "../constantes";
import ConstatsAudit from "./ConstatsAudit";
import Modal from "../Modal";
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

const formVide = { compteRendu: "", traitementRealise: "", resultat: "" };

export default function AuditRealisationPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [detail, setDetail] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [message, setMessage] = useState("");
    const [occupe, setOccupe] = useState(false);

    const [form, setForm] = useState(formVide);
    const [nouveauType, setNouveauType] = useState("ECART");
    const [nouvelleDescription, setNouvelleDescription] = useState("");

    const [afficherModalSaisie, setAfficherModalSaisie] = useState(false);
    const [afficherModalConfirmation, setAfficherModalConfirmation] = useState(false);

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

    useEffect(() => {
        const surRafraichissement = () => charger(false);
        const minuterie = setInterval(surRafraichissement, RAFRAICHISSEMENT_MS);
        window.addEventListener("focus", surRafraichissement);
        return () => {
            clearInterval(minuterie);
            window.removeEventListener("focus", surRafraichissement);
        };
    }, [charger]);

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

    function ouvrirModalSaisie() {
        setErreur("");
        setMessage("");
        setForm(formDepuisDetail(detail));
        setAfficherModalSaisie(true);
    }

    async function enregistrerBrouillon() {
        const ok = await executer(
            "/compte-rendu",
            { method: "PUT", body: corpsCompteRendu() },
            { reinitialiserFormulaire: true }
        );
        if (ok) setMessage("Brouillon enregistré.");
    }

    function demanderConfirmation() {
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
        setAfficherModalConfirmation(true);
    }

    async function terminer() {
        const ok = await executer(
            "/terminer",
            { method: "POST", body: corpsCompteRendu() },
            { reinitialiserFormulaire: true }
        );
        setAfficherModalConfirmation(false);
        setAfficherModalSaisie(false);
        if (ok) setMessage("Audit terminé : vos constats et le traitement constaté ont été transmis au responsable qualité.");
    }

    async function reouvrir() {
        const ok = await executer("/reouvrir", { method: "POST" }, { reinitialiserFormulaire: true });
        if (ok) setMessage("Audit réouvert : vous pouvez reprendre le traitement avant l'échéance.");
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
    const echeanceNonDepassee = Boolean(etape?.dateEcheance)
        && new Date(`${etape.dateEcheance}T23:59:59`).getTime() >= Date.now();
    const peutReouvrir = termine && Boolean(etape)
        && ["PARTIEL", "NON_REALISE"].includes(audit.resultatTraitement)
        && echeanceNonDepassee && nc?.statut !== "CLOTUREE";

    const libelleResultat = RESULTATS_TRAITEMENT[form.resultat] ?? "Non défini";

    return (
        <main className="nc-page area-container">
            <button type="button" className="nc-btn nc-btn-secondaire area-retour" onClick={() => navigate("/auditeur/audits")}>
                ← Mes audits
            </button>

            {/* EN-TÊTE — carte hero */}
            <header className="area-card-header area-card-header--hero">
                <div className="area-hero-top">
                    <div className="area-header-top">
                        <span className={`area-badge area-badge--${audit.statut} area-badge--large`}>
                            Statut audit : {STATUTS_AUDIT[audit.statut] ?? audit.statut}
                        </span>
                        {audit.resultatTraitement && (
                            <span className={`area-badge area-badge--sub area-badge--${audit.resultatTraitement} area-badge--large`}>
                                Résultat : {RESULTATS_TRAITEMENT[audit.resultatTraitement]}
                            </span>
                        )}
                    </div>

                    {peutSaisir && (
                        <button
                            type="button"
                            className="nc-btn area-btn-terminer area-btn-terminer--hero"
                            disabled={occupe}
                            onClick={ouvrirModalSaisie}
                        >
                            <span className="area-btn-terminer-icon" aria-hidden="true">✓</span>
                            Terminer l'audit
                        </button>
                    )}
                </div>

                <h1 className="area-titre">Titre audit : {audit.titre}</h1>

                {/* Badges secondaires — alignés sur MesAuditsPage */}
                <div className="area-hero-badges">
                    <span className="area-badge-type-audit">
                        {(TYPES_AUDIT[audit.typeAudit] ?? audit.typeAudit ?? "").toLowerCase()}
                    </span>
                    {etape && (
                        <span className="area-badge-action">
                            {TYPES_ACTION[etape.type] ?? etape.type}
                        </span>
                    )}
                </div>

                {/* Pied meta : processus + date, façon maud-carte-pied */}
                <div className="area-hero-pied">
                    <span className="area-hero-processus">
                        <span className="area-icon-pin" aria-hidden="true">📍</span>
                        Processus : {audit.processus || "N/A"}
                    </span>
                    <span className="area-hero-date">
                        Prévu le : <strong>{formaterDate(audit.date)}</strong>
                        {audit.dateRealisation ? ` · Réalisé le : ${formaterDate(audit.dateRealisation)}` : ""}
                    </span>
                </div>

                {termine && (
                    <div className="area-etat-final">
                        <span className="area-etat-final-label">Description du Compte rendu :</span>
                        <p className="area-etat-final-texte">{audit.compteRendu || "Non renseigné"}</p>
                    </div>
                )}
            </header>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {message && <p className="nc-succes" role="status">{message}</p>}

            {!detail.modifiable && detail.motifBlocage && !termine && (
                <p className="aud-bandeau aud-bandeau--alerte">{detail.motifBlocage}</p>
            )}

            {termine && (
                <div className="area-bandeau-container">
                    <p className="aud-bandeau">Cet audit est terminé : le responsable qualité peut commenter vos constats.</p>
                    {etape && ["PARTIEL", "NON_REALISE"].includes(audit.resultatTraitement) && !peutReouvrir
                        && <p className="aud-bandeau">Réouverture impossible : vérifiez l'échéance du traitement et le statut de la non-conformité.</p>}
                    {peutReouvrir && (
                        <button type="button" className="nc-btn" disabled={occupe} onClick={reouvrir}>
                            Réouvrir l'audit
                        </button>
                    )}
                </div>
            )}

            {/* ÉTAPE CAPA AUDITÉE — carte façon maud-carte */}
            {etape && (
                <section className="area-section area-card-capa" aria-labelledby="area-titre-etape">
                    <div className="area-carte-ligne-titre">
                        <h2 id="area-titre-etape" className="area-carte-titre">
                            Étape CAPA n°{etape.numero}
                            {nc?.reference ? ` · Réf NC : ${nc.reference}` : ""}
                        </h2>
                        <span className={`aud-badge aud-badge--${etape.statut}`}>
                            {STATUTS_ACTION[etape.statut] ?? etape.statut}
                        </span>
                    </div>

                    <div className="area-carte-badges">
                        <span className="area-badge-type-action">
                            {TYPES_ACTION[etape.type] ?? etape.type}
                        </span>
                    </div>

                    {nc?.titre && (
                        <p className="area-etape-nc"><strong>Titre NC :</strong> {nc.titre}</p>
                    )}

                    <div className="area-carte-description">
                        <strong>Description de la CAPA : </strong>{etape.description}
                    </div>

                    <div className="area-carte-pied">
                        <span className="area-carte-echeance">
                            Échéance de l'action : <strong>{formaterDate(etape.dateEcheance)}</strong>
                        </span>
                    </div>
                </section>
            )}

            {/* DÉMARRAGE AUDIT */}
            {audit.statut === "PLANIFIE" && detail.modifiable && (
                <div className="area-demarrage">
                    <p>Cet audit n'est pas encore démarré. Démarrez-le pour consigner vos constats et le compte rendu.</p>
                    <button type="button" className="nc-btn area-btn-primaire" disabled={occupe} onClick={demarrer}>
                        Démarrer l'audit
                    </button>
                </div>
            )}

            {/* CONSTATS */}
            <section className="area-section" aria-labelledby="area-titre-constats">
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
                            <label htmlFor="area-type-constat">Type de constat</label>
                            <select id="area-type-constat" value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} disabled={occupe}>
                                {Object.entries(TYPES_CONSTAT).map(([code, libelle]) => (
                                    <option key={code} value={code}>{libelle}</option>
                                ))}
                            </select>
                        </div>
                        <div className="aud-champ">
                            <label htmlFor="area-description-constat">Description du constat *</label>
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
                        <button type="submit" className="nc-btn" disabled={occupe || !nouvelleDescription.trim()}>
                            Ajouter le constat
                        </button>
                    </form>
                )}
            </section>

            {/* MODALE 1 : SAISIE DU COMPTE RENDU */}
            {afficherModalSaisie && (
                <Modal
                    titre="Saisie du compte rendu de l'audit"
                    onFermer={() => setAfficherModalSaisie(false)}
                    largeur="large"
                    pied={
                        <>
                            <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={() => setAfficherModalSaisie(false)}>
                                Annuler
                            </button>
                            <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={enregistrerBrouillon}>
                                Enregistrer le brouillon
                            </button>
                            <button type="button" className="nc-btn area-btn-terminer" disabled={occupe} onClick={demanderConfirmation}>
                                Terminer l'audit
                            </button>
                        </>
                    }
                >
                    <div className="area-modal-corps-interne">
                        <p className="area-modal-intro">
                            Renseignez le compte rendu de votre audit{etape ? " ainsi que le traitement constaté sur le terrain" : ""}.
                            Vous pourrez enregistrer un brouillon à tout moment, puis confirmer la fin de l'audit.
                        </p>

                        <div className="aud-champ">
                            <label htmlFor="area-compte-rendu">Description du compte rendu *</label>
                            <textarea
                                id="area-compte-rendu"
                                rows={6}
                                value={form.compteRendu}
                                onChange={(e) => setForm({ ...form, compteRendu: e.target.value })}
                                placeholder="Déroulement, périmètre audité, personnes rencontrées, documents consultés..."
                                maxLength={8000}
                                disabled={occupe}
                            />
                        </div>

                        {etape && (
                            <>
                                <div className="aud-champ">
                                    <label htmlFor="area-traitement">Traitement constaté sur le terrain *</label>
                                    <textarea
                                        id="area-traitement"
                                        rows={4}
                                        value={form.traitementRealise}
                                        onChange={(e) => setForm({ ...form, traitementRealise: e.target.value })}
                                        placeholder="Ce qui a été réellement fait pour traiter cette étape, avec les preuves vues..."
                                        maxLength={8000}
                                        disabled={occupe}
                                    />
                                </div>

                                <div className="aud-champ">
                                    <fieldset disabled={occupe}>
                                        <legend>Résultat du traitement *</legend>
                                        <div className="aud-options">
                                            {Object.entries(RESULTATS_TRAITEMENT).map(([code, libelle]) => (
                                                <label key={code} className={`aud-option aud-option--${code}`}>
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
                                    <p className="area-aide">« Traitement réalisé » rend l'étape validable par le responsable qualité.</p>
                                </div>
                            </>
                        )}

                        {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
                    </div>
                </Modal>
            )}

            {/* MODALE 2 : CONFIRMATION FINALE */}
            {afficherModalConfirmation && (
                <Modal
                    titre="Confirmer la fin de l'audit"
                    onFermer={() => setAfficherModalConfirmation(false)}
                    largeur="large"
                    pied={
                        <>
                            <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={() => setAfficherModalConfirmation(false)}>
                                Annuler
                            </button>
                            <button type="button" className="nc-btn area-btn-terminer" disabled={occupe} onClick={terminer}>
                                {occupe ? "Enregistrement..." : "Confirmer la fin de l'audit"}
                            </button>
                        </>
                    }
                >
                    <div className="area-modal-corps-interne">
                        <p className="area-modal-intro">
                            Veuillez vérifier les informations ci-dessous. En confirmant, le compte rendu et les constats ({detail.constats.length}) seront transmis et l'audit ne sera plus modifiable.
                        </p>

                        <div className="area-recap-section">
                            <h4>Description du compte rendu :</h4>
                            <p className="area-recap-texte">{form.compteRendu || "Non renseigné"}</p>
                        </div>

                        {etape && (
                            <>
                                <div className="area-recap-section">
                                    <h4>Traitement constaté sur le terrain :</h4>
                                    <p className="area-recap-texte">{form.traitementRealise || "Non renseigné"}</p>
                                </div>

                                <div className="area-recap-section">
                                    <h4>Résultat du traitement :</h4>
                                    <span className={`area-badge area-badge--sub area-badge--${form.resultat} area-badge--large`}>
                                        {libelleResultat}
                                    </span>
                                </div>
                            </>
                        )}

                        <div className="area-recap-section">
                            <h4>Constats enregistrés :</h4>
                            <p><strong>Total : </strong>{detail.constats.length} constat(s) consigné(s).</p>
                        </div>

                        <div className="area-modal-avertissement">
                            ⚠️ Attention : Action irréversible après validation définitive.
                        </div>

                        {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
                    </div>
                </Modal>
            )}
        </main>
    );
}