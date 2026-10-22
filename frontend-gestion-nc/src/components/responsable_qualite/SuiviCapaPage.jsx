import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";   // adapter le chemin si besoin
import { STATUTS_ACTION, TYPES_ACTION, formaterDate } from "../constantes";

import ConstatsAudit from "../Auditeur/ConstatsAudit";
import { RESULTATS_TRAITEMENT, STATUTS_AUDIT, TYPES_AUDIT, formaterDateHeure, nomPersonne  } from "../Auditeur/libelles";
import "../Declarant/nc.css";
import "../Auditeur/audits.css";
import "./CapaPage.css";          // badges de type d'action (capa-type)
import "./SuiviCapaPage.css";

const TOPIC_CAPA = "/topic/admin/capa";

/**
 * Suivi terrain d'une non-conformité par le responsable qualité :
 *  - le travail des auditeurs (audits, constats, traitement constaté) arrive en temps réel ;
 *  - les constats se commentent ;
 *  - chaque étape CAPA se classe une par une (validée, efficace ou non) ;
 *  - la non-conformité se clôture quand toutes les étapes sont validées.
 */
export default function SuiviCapaPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [suivi, setSuivi] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [occupe, setOccupe] = useState(false);
    const [ouvertes, setOuvertes] = useState(new Set());
    const [evenement, setEvenement] = useState(null);
    const [dialogueCloture, setDialogueCloture] = useState(false);
    const premierChargement = useRef(true);
    const minuterie = useRef(null);

    const charger = useCallback(async () => {
        try {
            const donnees = await apiRequest(`/api/capa/nc/${id}/suivi`);
            setSuivi(donnees);
            setErreur("");
            if (premierChargement.current) {   // à l'arrivée, on déplie les étapes prêtes à être validées
                premierChargement.current = false;
                setOuvertes(new Set(donnees.etapes.filter((e) => e.validable).map((e) => e.id)));
            }
        } catch (e) {
            setErreur(e.message || "Impossible de charger le suivi.");
        } finally {
            setChargement(false);
        }
    }, [id]);

    useEffect(() => {
        premierChargement.current = true;
        setChargement(true);
        charger();
    }, [charger]);

    useEffect(() => () => clearTimeout(minuterie.current), []);

    // Temps réel : chaque événement concernant cette NC déclenche un rechargement (regroupé sur 300 ms)
    const surEvenement = useCallback((message) => {
        if (String(message.ncId) !== String(id)) return;
        setEvenement(message);
        clearTimeout(minuterie.current);
        minuterie.current = setTimeout(charger, 300);
    }, [id, charger]);

    const connecte = useNotificationsAdmin({ topic: TOPIC_CAPA, onMessage: surEvenement });

    /** Action du responsable : la réponse est le suivi à jour. Renvoie true en cas de succès. */
    async function executer(chemin, options) {
        setOccupe(true);
        setErreur("");
        try {
            setSuivi(await apiRequest(chemin, options));
            return true;
        } catch (e) {
            setErreur(e.message || "L'action a échoué.");
            return false;
        } finally {
            setOccupe(false);
        }
    }

    const commenter = (constatId, commentaire) =>
        executer(`/api/capa/constats/${constatId}/commentaires`, { method: "POST", body: JSON.stringify({ commentaire }) });

    const valider = (etapeId, valeurs) =>
        executer(`/api/capa/etapes/${etapeId}/validation`, { method: "PUT", body: JSON.stringify(valeurs) });

    const annulerValidation = (etapeId) =>
        executer(`/api/capa/etapes/${etapeId}/validation`, { method: "DELETE" });

    async function cloturer(commentaire) {
        const ok = await executer(`/api/capa/nc/${id}/cloture`, { method: "POST", body: JSON.stringify({ commentaire }) });
        if (ok) setDialogueCloture(false);
    }

    function basculer(etapeId) {
        setOuvertes((actuelles) => {
            const suivantes = new Set(actuelles);
            if (suivantes.has(etapeId)) suivantes.delete(etapeId);
            else suivantes.add(etapeId);
            return suivantes;
        });
    }

    if (chargement) return <main className="nc-page"><p>Chargement...</p></main>;
    if (!suivi) return <main className="nc-page"><p className="nc-erreur" role="alert">{erreur || "Non-conformité introuvable."}</p></main>;

    const pourcentage = suivi.nbEtapes === 0 ? 0 : Math.round((100 * suivi.nbValidees) / suivi.nbEtapes);

    return (
        <main className="nc-page">
            <button type="button" className="nc-btn nc-btn-secondaire suivi-retour" onClick={() => navigate(`/responsable/nc/${id}/capa`)}>
                ← Plan d'actions (CAPA)
            </button>

            <header className="suivi-entete">
                <div>
                    <h1>Suivi terrain : {suivi.reference}</h1>
                    <p className="suivi-titre-nc">{suivi.titre}</p>
                </div>

                <div className="suivi-cloture">
                    <button
                        type="button"
                        className="nc-btn"
                        disabled={!suivi.peutCloturer || occupe}
                        onClick={() => setDialogueCloture(true)}
                        aria-describedby="suivi-motif-cloture"
                    >
                        Clôturer la non-conformité
                    </button>
                    <span id="suivi-motif-cloture" className="suivi-motif">
                        {suivi.cloturee ? "Non-conformité clôturée" : suivi.peutCloturer ? "Toutes les étapes sont validées" : suivi.motifNonCloturable}
                    </span>
                </div>
            </header>

            <div className="suivi-progression" role="group" aria-label="Progression des validations">
                <div className="suivi-barre" role="progressbar" aria-valuemin={0} aria-valuemax={suivi.nbEtapes} aria-valuenow={suivi.nbValidees}>
                    <div className="suivi-barre-remplie" style={{ width: `${pourcentage}%` }} />
                </div>
                <span>{suivi.nbValidees} / {suivi.nbEtapes} étape(s) validée(s)</span>
            </div>

            <div className="suivi-temps-reel" role="status" aria-live="polite">
                <span className={`suivi-point ${connecte ? "suivi-point--actif" : ""}`} />
                {connecte ? "Temps réel actif" : "Temps réel indisponible"}
                {!connecte && (
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={charger}>Actualiser</button>
                )}
            </div>

            {evenement && (
                <p className="aud-bandeau suivi-evenement" role="status">
                    <span>
                        <strong>{formaterDateHeure(evenement.date)}</strong> · {evenement.message}
                    </span>
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setEvenement(null)}>Masquer</button>
                </p>
            )}

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

            {suivi.etapes.length === 0 ? (
                <p className="aud-vide">Aucune étape CAPA : définissez un plan d'actions dans la page CAPA.</p>
            ) : (
                <ol className="suivi-etapes">
                    {suivi.etapes.map((etape) => (
                        <CarteEtape
                            key={etape.id}
                            etape={etape}
                            ncId={id}
                            ouverte={ouvertes.has(etape.id)}
                            onBasculer={() => basculer(etape.id)}
                            cloturee={suivi.cloturee}
                            occupe={occupe}
                            onCommenter={suivi.cloturee ? undefined : commenter}
                            onValider={valider}
                            onAnnuler={annulerValidation}
                        />
                    ))}
                </ol>
            )}

            {dialogueCloture && (
                <DialogueCloture
                    suivi={suivi}
                    occupe={occupe}
                    onConfirmer={cloturer}
                    onAnnuler={() => setDialogueCloture(false)}
                />
            )}
        </main>
    );
}

// ----------------------------------------------------------------------------------------------
function CarteEtape({ etape, ncId, ouverte, onBasculer, cloturee, occupe, onCommenter, onValider, onAnnuler }) {
    const idCorps = `suivi-etape-${etape.id}`;
    const nbConstats = etape.audits.reduce((total, a) => total + a.constats.length, 0);

    return (
        <li className={`suivi-etape${etape.statut === "VERIFIEE" ? " suivi-etape--validee" : ""}`}>
            <button type="button" className="suivi-etape-entete" aria-expanded={ouverte} aria-controls={idCorps} onClick={onBasculer}>
                <span className="suivi-etape-titre">
                    <strong>Étape {etape.numero}</strong>
                    <span className={`capa-type capa-type--${etape.type}`}>{TYPES_ACTION[etape.type] ?? etape.type}</span>
                    <span className={`aud-badge aud-badge--${etape.statut}`}>{STATUTS_ACTION[etape.statut] ?? etape.statut}</span>
                    {etape.statut === "VERIFIEE" && (
                        <span className={`aud-badge ${etape.efficace ? "aud-badge--REALISE" : "aud-badge--NON_REALISE"}`}>
                            {etape.efficace ? "Efficace" : "Non efficace"}
                        </span>
                    )}
                </span>
                <span className="suivi-etape-resume">
                    {etape.audits.length} audit(s) · {nbConstats} constat(s)
                </span>
                <span className="suivi-etape-fleche" aria-hidden="true">{ouverte ? "▲" : "▼"}</span>
            </button>

            {ouverte && (
                <div id={idCorps} className="suivi-etape-corps">
                    <p className="suivi-etape-description">{etape.description}</p>
                    <p className="suivi-etape-meta">
                        Responsable : {nomPersonne(etape.responsable)} · Échéance : {formaterDate(etape.dateEcheance)}
                    </p>

                    <h3 className="suivi-sous-titre">Audits terrain</h3>
                    {etape.audits.length === 0 ? (
                        <p className="aud-vide">
                            Aucun audit planifié pour cette étape.{" "}
                            {!cloturee && <Link to={`/responsable/nc/${ncId}/capa`}>Planifier un audit dans le calendrier</Link>}
                        </p>
                    ) : (
                        <ul className="suivi-audits">
                            {etape.audits.map((audit) => (
                                <AuditBloc key={audit.id} audit={audit} onCommenter={onCommenter} />
                            ))}
                        </ul>
                    )}

                    <Classification etape={etape} cloturee={cloturee} occupe={occupe} onValider={onValider} onAnnuler={onAnnuler} />
                </div>
            )}
        </li>
    );
}

function AuditBloc({ audit, onCommenter }) {
    return (
        <li className="suivi-audit">
            <div className="suivi-audit-entete">
                <strong>{formaterDate(audit.date)}</strong>
                <span className={`aud-badge aud-badge--${audit.statut}`}>{STATUTS_AUDIT[audit.statut] ?? audit.statut}</span>
                {audit.resultatTraitement && (
                    <span className={`aud-badge aud-badge--${audit.resultatTraitement}`}>
                        {RESULTATS_TRAITEMENT[audit.resultatTraitement]}
                    </span>
                )}
                <span className="suivi-audit-meta">
                    Audit {(TYPES_AUDIT[audit.typeAudit] ?? "").toLowerCase()} · {nomPersonne(audit.auditeur)}
                </span>
            </div>

            {audit.compteRendu && (
                <div className="suivi-texte">
                    <h4>Compte rendu de l'audit</h4>
                    <p>{audit.compteRendu}</p>
                </div>
            )}
            {audit.traitementRealise && (
                <div className="suivi-texte">
                    <h4>Traitement constaté sur le terrain</h4>
                    <p>{audit.traitementRealise}</p>
                </div>
            )}

            <h4 className="suivi-texte-titre">Constats ({audit.constats.length})</h4>
            <ConstatsAudit constats={audit.constats} onCommenter={onCommenter} />
        </li>
    );
}

// ----------------------------------------------------------------------------------------------
/** Section « Classification de l'action » : validation et qualification de l'efficacité. */
function Classification({ etape, cloturee, occupe, onValider, onAnnuler }) {
    const [statut, setStatut] = useState("A_VALIDER");
    const [efficace, setEfficace] = useState(null);
    const [commentaire, setCommentaire] = useState("");
    const idBase = `classif-${etape.id}`;

    if (etape.statut === "VERIFIEE") {
        return (
            <section className="suivi-classification suivi-classification--validee" aria-label="Classification de l'action">
                <h3 className="suivi-sous-titre">Classification de l'action</h3>
                <p>
                    <span className="aud-badge aud-badge--VERIFIEE">Validée</span>{" "}
                    <span className={`aud-badge ${etape.efficace ? "aud-badge--REALISE" : "aud-badge--NON_REALISE"}`}>
                        {etape.efficace ? "Traitement efficace" : "Traitement non efficace"}
                    </span>
                </p>
                <p className="suivi-etape-meta">
                    Par {nomPersonne(etape.verificateur)} le {formaterDateHeure(etape.dateVerification)}
                </p>
                {etape.commentaireEfficacite && <p className="suivi-texte-simple">{etape.commentaireEfficacite}</p>}
                {!cloturee && (
                    <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={() => onAnnuler(etape.id)}>
                        Annuler la validation
                    </button>
                )}
            </section>
        );
    }

    const choixInvalide = statut === "VALIDEE" && (efficace === null || (efficace === false && !commentaire.trim()));
    const verrouille = !etape.validable || occupe;

    async function enregistrer(event) {
        event.preventDefault();
        const ok = await onValider(etape.id, { efficace, commentaire: commentaire.trim() || null });
        if (ok) {
            setStatut("A_VALIDER");
            setEfficace(null);
            setCommentaire("");
        }
    }

    return (
        <form className="suivi-classification" onSubmit={enregistrer} aria-label="Classification de l'action">
            <h3 className="suivi-sous-titre">Classification de l'action</h3>

            {!etape.validable && etape.motifNonValidable && (
                <p className="aud-bandeau aud-bandeau--alerte">{etape.motifNonValidable}</p>
            )}

            <div className="aud-champ">
                <fieldset disabled={verrouille}>
                    <legend>Statut de l'étape</legend>
                    <div className="aud-options">
                        <label className="aud-option">
                            <input type="radio" name={`${idBase}-statut`} checked={statut === "A_VALIDER"} onChange={() => setStatut("A_VALIDER")} />
                            En attente de validation
                        </label>
                        <label className="aud-option">
                            <input type="radio" name={`${idBase}-statut`} checked={statut === "VALIDEE"} onChange={() => setStatut("VALIDEE")} />
                            Validée
                        </label>
                    </div>
                </fieldset>
            </div>

            {statut === "VALIDEE" && (
                <>
                    <div className="aud-champ">
                        <fieldset disabled={verrouille}>
                            <legend>Qualification du traitement *</legend>
                            <div className="aud-options">
                                <label className="aud-option">
                                    <input type="radio" name={`${idBase}-efficace`} checked={efficace === true} onChange={() => setEfficace(true)} />
                                    Efficace
                                </label>
                                <label className="aud-option">
                                    <input type="radio" name={`${idBase}-efficace`} checked={efficace === false} onChange={() => setEfficace(false)} />
                                    Non efficace
                                </label>
                            </div>
                        </fieldset>
                    </div>

                    <div className="aud-champ">
                        <label htmlFor={`${idBase}-commentaire`}>
                            Commentaire {efficace === false ? "*" : "(facultatif)"}
                        </label>
                        <textarea
                            id={`${idBase}-commentaire`}
                            rows={3}
                            value={commentaire}
                            onChange={(e) => setCommentaire(e.target.value)}
                            placeholder={efficace === false ? "Pourquoi le traitement n'est-il pas efficace ?" : "Justification de la qualification..."}
                            maxLength={2000}
                            disabled={verrouille}
                        />
                    </div>
                </>
            )}

            <button type="submit" className="nc-btn" disabled={verrouille || statut !== "VALIDEE" || choixInvalide}>
                Enregistrer la classification
            </button>
        </form>
    );
}

// ----------------------------------------------------------------------------------------------
function DialogueCloture({ suivi, occupe, onConfirmer, onAnnuler }) {
    const [commentaire, setCommentaire] = useState("");

    useEffect(() => {
        const surTouche = (e) => { if (e.key === "Escape" && !occupe) onAnnuler(); };
        window.addEventListener("keydown", surTouche);
        return () => window.removeEventListener("keydown", surTouche);
    }, [occupe, onAnnuler]);

    return (
        <>
            <div className="suivi-voile" onClick={occupe ? undefined : onAnnuler} />
            <div className="suivi-dialogue" role="dialog" aria-modal="true" aria-labelledby="suivi-dialogue-titre">
                <h2 id="suivi-dialogue-titre">Clôturer {suivi.reference} ?</h2>
                <p>
                    Les {suivi.nbEtapes} étape(s) CAPA sont validées. Après la clôture, la non-conformité
                    et son plan d'actions ne seront plus modifiables.
                </p>
                {suivi.nbNonEfficaces > 0 && (
                    <p className="aud-bandeau aud-bandeau--alerte">
                        {suivi.nbNonEfficaces} étape(s) ont été jugées non efficaces. Vérifiez que cela ne
                        justifie pas une nouvelle action avant de clôturer.
                    </p>
                )}
                <div className="aud-champ">
                    <label htmlFor="suivi-commentaire-cloture">Commentaire de clôture (facultatif)</label>
                    <textarea
                        id="suivi-commentaire-cloture"
                        rows={3}
                        value={commentaire}
                        onChange={(e) => setCommentaire(e.target.value)}
                        maxLength={2000}
                        disabled={occupe}
                    />
                </div>
                <div className="suivi-dialogue-actions">
                    <button type="button" className="nc-btn" disabled={occupe} onClick={() => onConfirmer(commentaire.trim() || null)}>
                        {occupe ? "Clôture..." : "Confirmer la clôture"}
                    </button>
                    <button type="button" className="nc-btn nc-btn-secondaire" disabled={occupe} onClick={onAnnuler}>Annuler</button>
                </div>
            </div>
        </>
    );
}