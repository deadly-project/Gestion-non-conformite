import { useState } from "react";
import { TYPES_CONSTAT, formaterDateHeure, nomPersonne } from "./libelles";
import { formaterTaille } from "../constantes";
import "./audits.css";

/**
 * Liste des constats d'un audit, partagée par l'auditeur et le responsable qualité.
 *  - onCommenter(constatId, texte)        : affiche le fil de commentaires modifiable (responsable qualité)
 *  - onModifier(constat, { type, description }) / onSupprimer(constat) : édition (auditeur)
 * Chaque gestionnaire renvoie true en cas de succès ; la page parente affiche les erreurs.
 */
export default function ConstatsAudit({ constats, onCommenter, onModifier, onSupprimer, onAjouterPieceJointe, onOuvrirPieceJointe }) {
    if (!constats || constats.length === 0) {
        return <p className="aud-vide">Aucun constat enregistré.</p>;
    }
    return (
        <ul className="aud-constats">
            {constats.map((constat) => (
                <CarteConstat
                    key={constat.id}
                    constat={constat}
                    onCommenter={onCommenter}
                    onModifier={onModifier}
                    onSupprimer={onSupprimer}
                    onAjouterPieceJointe={onAjouterPieceJointe}
                    onOuvrirPieceJointe={onOuvrirPieceJointe}
                />
            ))}
        </ul>
    );
}

function CarteConstat({ constat, onCommenter, onModifier, onSupprimer, onAjouterPieceJointe, onOuvrirPieceJointe }) {
    const [enEdition, setEnEdition] = useState(false);
    const [type, setType] = useState(constat.type);
    const [description, setDescription] = useState(constat.description);
    const [suppression, setSuppression] = useState(false);
    const [occupe, setOccupe] = useState(false);
    const [ajoutPreuve, setAjoutPreuve] = useState(false);

    async function enregistrer(event) {
        event.preventDefault();
        if (!description.trim()) return;
        setOccupe(true);
        const ok = await onModifier(constat, { type, description: description.trim() });
        setOccupe(false);
        if (ok) setEnEdition(false);
    }

    async function supprimer() {
        setOccupe(true);
        const ok = await onSupprimer(constat);
        setOccupe(false);
        if (!ok) setSuppression(false);
    }

    async function ajouterPreuves(event) {
        const fichiers = Array.from(event.target.files || []);
        event.target.value = "";
        if (fichiers.length === 0) return;
        setOccupe(true);
        const ok = await onAjouterPieceJointe(constat, fichiers);
        setOccupe(false);
        if (ok) setAjoutPreuve(false);
    }

    return (
        <li className={`aud-constat aud-constat--${constat.type}`}>
            <div className="aud-constat-entete">
                <span className="aud-constat-type">{TYPES_CONSTAT[constat.type] ?? constat.type}</span>
                <span className="aud-constat-meta">
                    {nomPersonne(constat.auteur)} · {formaterDateHeure(constat.date)}
                </span>

                {(onModifier || onSupprimer) && !enEdition && (
                    <div className="aud-constat-actions">
                        {onModifier && (
                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setEnEdition(true)}>
                                Modifier
                            </button>
                        )}
                        {onSupprimer && !suppression && (
                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setSuppression(true)}>
                                Supprimer
                            </button>
                        )}
                        {onSupprimer && suppression && (
                            <>
                                <button type="button" className="nc-btn nc-btn-petit" disabled={occupe} onClick={supprimer}>
                                    Confirmer la suppression
                                </button>
                                <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" disabled={occupe} onClick={() => setSuppression(false)}>
                                    Annuler
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {enEdition ? (
                <form onSubmit={enregistrer}>
                    <div className="aud-champ">
                        <label htmlFor={`constat-type-${constat.id}`}>Type</label>
                        <select id={`constat-type-${constat.id}`} value={type} onChange={(e) => setType(e.target.value)}>
                            {Object.entries(TYPES_CONSTAT).map(([code, libelle]) => (
                                <option key={code} value={code}>{libelle}</option>
                            ))}
                        </select>
                    </div>
                    <div className="aud-champ">
                        <label htmlFor={`constat-desc-${constat.id}`}>Description</label>
                        <textarea id={`constat-desc-${constat.id}`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
                    </div>
                    <div className="aud-options">
                        <button type="submit" className="nc-btn nc-btn-petit" disabled={occupe}>Enregistrer</button>
                        <button
                            type="button"
                            className="nc-btn nc-btn-secondaire nc-btn-petit"
                            disabled={occupe}
                            onClick={() => { setEnEdition(false); setType(constat.type); setDescription(constat.description); }}
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            ) : (
                <p className="aud-constat-texte">{constat.description}</p>
            )}

            {((constat.piecesJointes?.length ?? 0) > 0 || onAjouterPieceJointe) && (
                <div className="aud-fil" style={{ marginTop: "0.5rem" }}>
                    <strong>Preuves / pièces jointes</strong>
                    {(constat.piecesJointes?.length ?? 0) > 0 && (
                        <div className="nc-actions" style={{ marginTop: "0.35rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                            {constat.piecesJointes.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    className="nc-btn nc-btn-secondaire nc-btn-petit"
                                    disabled={!onOuvrirPieceJointe}
                                    onClick={() => onOuvrirPieceJointe?.(p)}
                                >
                                    {p.type === "PDF" ? "PDF" : "Image"} : {p.nom} ({formaterTaille(p.taille)})
                                </button>
                            ))}
                        </div>
                    )}

                    {onAjouterPieceJointe && !ajoutPreuve && (
                        <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" style={{ marginTop: "0.35rem" }} onClick={() => setAjoutPreuve(true)}>
                            + Ajouter une preuve (facultatif)
                        </button>
                    )}
                    {onAjouterPieceJointe && ajoutPreuve && (
                        <div className="aud-champ" style={{ marginTop: "0.35rem" }}>
                            <label htmlFor={`preuve-${constat.id}`}>Images (JPEG/PNG/WebP) ou PDF</label>
                            <input
                                id={`preuve-${constat.id}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                multiple
                                disabled={occupe}
                                onChange={ajouterPreuves}
                            />
                            <div className="aud-options" style={{ marginTop: "0.35rem" }}>
                                <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" disabled={occupe} onClick={() => setAjoutPreuve(false)}>
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {((constat.commentaires?.length ?? 0) > 0 || onCommenter) && (
                <FilCommentaires constat={constat} onCommenter={onCommenter} />
            )}
        </li>
    );
}

function FilCommentaires({ constat, onCommenter }) {
    const [texte, setTexte] = useState("");
    const [occupe, setOccupe] = useState(false);

    async function envoyer(event) {
        event.preventDefault();
        if (!texte.trim()) return;
        setOccupe(true);
        const ok = await onCommenter(constat.id, texte.trim());
        setOccupe(false);
        if (ok) setTexte("");
    }

    return (
        <div className="aud-fil">
            {(constat.commentaires?.length ?? 0) > 0 && (
                <ul aria-label="Commentaires du responsable qualité">
                    {constat.commentaires.map((c) => (
                        <li key={c.id} className="aud-commentaire">
                            <span className="aud-commentaire-meta">
                                {nomPersonne(c.auteur)} · {formaterDateHeure(c.date)}
                            </span>
                            <p>{c.commentaire}</p>
                        </li>
                    ))}
                </ul>
            )}

            {onCommenter && (
                <form className="aud-fil-formulaire" onSubmit={envoyer}>
                    <textarea
                        rows={2}
                        value={texte}
                        onChange={(e) => setTexte(e.target.value)}
                        placeholder="Commenter ce constat..."
                        aria-label="Commenter ce constat"
                        maxLength={2000}
                    />
                    <button type="submit" className="nc-btn nc-btn-secondaire" disabled={occupe || !texte.trim()}>
                        Commenter
                    </button>
                </form>
            )}
        </div>
    );
}