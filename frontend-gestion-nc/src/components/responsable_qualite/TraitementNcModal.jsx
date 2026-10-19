import { useEffect, useState } from "react";
import { apiBlob, apiRequest } from "../../api/api";
import Modal from "../Modal";
import RechercheUtilisateur from "./RechercheUtilisateur";
import {
    BRANCHES, GRAVITES, ORDRE_STATUT, STATUTS_ACTION, STATUTS_NC, STATUTS_TRAITEMENT,
    TYPES_ACTION, dateAujourdhui, formaterDate, formaterTaille, nomComplet,
} from "../constantes";

const POURQUOI = [1, 2, 3, 4, 5];

function analyseVide() {
    return { pourquoi1: "", pourquoi2: "", pourquoi3: "", pourquoi4: "", pourquoi5: "", causeRacineValidee: "" };
}

function etatInitial(detail) {
    const analyses = {};
    BRANCHES.forEach((b) => { analyses[b.code] = analyseVide(); });
    (detail.analyses || []).forEach((a) => {
        analyses[a.branche] = {
            pourquoi1: a.pourquoi1 ?? "", pourquoi2: a.pourquoi2 ?? "", pourquoi3: a.pourquoi3 ?? "",
            pourquoi4: a.pourquoi4 ?? "", pourquoi5: a.pourquoi5 ?? "",
            causeRacineValidee: a.causeRacineValidee ?? "",
        };
    });

    return {
        gravite: detail.gravite || detail.graviteDeclaree || "",
        categorieId: detail.categorieId ? String(detail.categorieId) : "",
        statut: ORDRE_STATUT[detail.statut] >= 1 ? detail.statut : "OUVERT",
        delaisJours: detail.delaisJours ? String(detail.delaisJours) : "",
        auditeur: detail.auditeur || null,
        analyses,
        etapes: (detail.etapesCapa || []).map((e) => ({
            cle: `existante-${e.id}`, id: e.id, type: e.type, description: e.description,
            dateEcheance: e.dateEcheance, responsable: e.responsable, statut: e.statut,
        })),
    };
}

/**
 * Formulaire « Actions » du responsable qualité :
 * analyse des causes (Ishikawa + 5 Pourquoi), auditeur, nature, gravité, statut,
 * plan d'actions (CAPA) étape par étape, délai. Boutons Terminer / Annuler avec confirmation.
 */
export default function TraitementNcModal({ ncId, utilisateur, onFermer, onEnregistre }) {
    const [detail, setDetail] = useState(null);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(null);
    const [brancheActive, setBrancheActive] = useState(BRANCHES[0].code);

    const [modifie, setModifie] = useState(false);
    const [confirmation, setConfirmation] = useState(null);   // null | "terminer" | "annuler"
    const [erreurs, setErreurs] = useState([]);
    const [erreurServeur, setErreurServeur] = useState("");
    const [chargement, setChargement] = useState(true);
    const [enregistrement, setEnregistrement] = useState(false);

    useEffect(() => {
        let actif = true;
        Promise.all([
            apiRequest(`/api/non-conformites/${ncId}`),
            apiRequest("/api/referentiels/categories"),
        ])
            .then(([d, c]) => {
                if (!actif) return;
                setDetail(d);
                setCategories(c);
                setForm(etatInitial(d));
            })
            .catch((e) => { if (actif) setErreurServeur(e.message || "Chargement impossible."); })
            .finally(() => { if (actif) setChargement(false); });
        return () => { actif = false; };
    }, [ncId]);

    // ---------------- mise à jour du formulaire ----------------
    function maj(patch) {
        setForm((f) => ({ ...f, ...patch }));
        setModifie(true);
        setConfirmation(null);
    }

    function majAnalyse(branche, champ, valeur) {
        setForm((f) => ({
            ...f,
            analyses: { ...f.analyses, [branche]: { ...f.analyses[branche], [champ]: valeur } },
        }));
        setModifie(true);
    }

    function ajouterEtape() {
        maj({
            etapes: [...form.etapes, {
                cle: `nouvelle-${Date.now()}-${Math.random()}`, id: null, type: "CORRECTIVE",
                description: "", dateEcheance: "",
                responsable: { id: utilisateur.id, nom: utilisateur.nom, prenom: utilisateur.prenom, matricule: utilisateur.matricule },
                statut: "A_FAIRE",
            }],
        });
    }

    function majEtape(cle, patch) {
        maj({ etapes: form.etapes.map((e) => (e.cle === cle ? { ...e, ...patch } : e)) });
    }

    function retirerEtape(cle) {
        maj({ etapes: form.etapes.filter((e) => e.cle !== cle) });
    }

    // ---------------- validation ----------------
    function valider() {
        const problemes = [];
        if (!form.gravite) problemes.push("Choisissez la gravité.");
        if (!form.categorieId) problemes.push("Choisissez la nature (produit, processus, système...).");
        if (!form.statut) problemes.push("Choisissez le statut.");

        const delai = Number(form.delaisJours);
        if (!Number.isInteger(delai) || delai < 1 || delai > 365) {
            problemes.push("Le délai de traitement doit être un nombre de jours entre 1 et 365.");
        }

        form.etapes.forEach((e, i) => {
            const modifiable = e.statut === "A_FAIRE";
            if (!modifiable) return;
            if (!e.description.trim()) problemes.push(`Étape ${i + 1} : décrivez l'action.`);
            if (!e.dateEcheance) problemes.push(`Étape ${i + 1} : indiquez l'échéance.`);
            else if (e.id === null && e.dateEcheance < dateAujourdhui()) {
                problemes.push(`Étape ${i + 1} : l'échéance ne peut pas être passée.`);
            }
            if (!e.responsable) problemes.push(`Étape ${i + 1} : choisissez un responsable.`);
        });

        if (form.statut === "EN_TRAITEMENT" && form.etapes.length === 0) {
            problemes.push("Ajoutez au moins une étape au plan d'actions pour passer en traitement.");
        }
        return problemes;
    }

    function demanderTerminer() {
        const problemes = valider();
        setErreurs(problemes);
        setErreurServeur("");
        if (problemes.length === 0) setConfirmation("terminer");
    }

    function demanderAnnuler() {
        if (!modifie) {
            onFermer();
        } else {
            setConfirmation("annuler");
        }
    }

    async function terminer() {
        setEnregistrement(true);
        setErreurServeur("");
        try {
            const corps = {
                gravite: form.gravite,
                categorieId: Number(form.categorieId),
                statut: form.statut,
                auditeurId: form.auditeur ? form.auditeur.id : null,
                delaisJours: Number(form.delaisJours),
                analyses: BRANCHES.map((b) => ({ branche: b.code, ...form.analyses[b.code] })),
                etapesCapa: form.etapes.map((e) => ({
                    id: e.id ?? null,
                    type: e.type,
                    description: e.description.trim(),
                    responsableId: e.responsable.id,
                    dateEcheance: e.dateEcheance,
                })),
            };
            const resultat = await apiRequest(`/api/non-conformites/${ncId}/traitement`, {
                method: "PUT",
                body: JSON.stringify(corps),
            });
            onEnregistre(resultat);
        } catch (error) {
            setErreurServeur(error.message || "L'enregistrement a échoué.");
            setConfirmation(null);
        } finally {
            setEnregistrement(false);
        }
    }

    async function ouvrirPieceJointe(piece) {
        try {
            const blob = await apiBlob(`/api/non-conformites/pieces-jointes/${piece.id}`);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            setErreurServeur(error.message);
        }
    }

    // ---------------- rendu ----------------
    const statutsProposes = detail
        ? STATUTS_TRAITEMENT.filter((s) => ORDRE_STATUT[s] >= ORDRE_STATUT[detail.statut])
        : [];

    const pied = form && (
        <>
            {erreurs.length > 0 && (
                <div className="nc-erreur" role="alert">
                    <ul className="nc-erreurs">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
                </div>
            )}
            {erreurServeur && <p className="nc-erreur" role="alert">{erreurServeur}</p>}

            {confirmation === "terminer" && (
                <div className="nc-confirmation" role="alertdialog" aria-label="Confirmer l'enregistrement">
                    <strong>Confirmer le traitement de {detail.reference} ?</strong>
                    <span>Statut : {STATUTS_NC[form.statut]} · {form.etapes.length} étape(s) · délai {form.delaisJours} jour(s).</span>
                    <div className="nc-actions">
                        <button type="button" className="nc-btn" disabled={enregistrement} onClick={terminer}>
                            {enregistrement ? "Enregistrement..." : "Oui, terminer"}
                        </button>
                        <button type="button" className="nc-btn nc-btn-secondaire" disabled={enregistrement}
                            onClick={() => setConfirmation(null)}>
                            Non, revenir au formulaire
                        </button>
                    </div>
                </div>
            )}

            {confirmation === "annuler" && (
                <div className="nc-confirmation" role="alertdialog" aria-label="Confirmer l'annulation">
                    <strong>Abandonner les modifications ?</strong>
                    <span>Tout ce que vous avez saisi sera perdu.</span>
                    <div className="nc-actions">
                        <button type="button" className="nc-btn nc-btn-danger" onClick={onFermer}>
                            Oui, annuler
                        </button>
                        <button type="button" className="nc-btn nc-btn-secondaire"
                            onClick={() => setConfirmation(null)}>
                            Non, continuer la saisie
                        </button>
                    </div>
                </div>
            )}

            {!confirmation && (
                <div className="nc-actions">
                    <button type="button" className="nc-btn" onClick={demanderTerminer}>Terminer</button>
                    <button type="button" className="nc-btn nc-btn-secondaire" onClick={demanderAnnuler}>Annuler</button>
                </div>
            )}
        </>
    );

    return (
        <Modal
            titre={detail ? `Traitement : ${detail.reference} — ${detail.titre}` : "Traitement de la non-conformité"}
            onFermer={demanderAnnuler}
            pied={pied}
        >
            {chargement && <p>Chargement...</p>}
            {!chargement && !form && <p className="nc-erreur" role="alert">{erreurServeur}</p>}

            {form && detail && (
                <>
                    {/* ---------- Résumé de la déclaration ---------- */}
                    <section className="nc-section" aria-labelledby="t-resume">
                        <h3 id="t-resume">Déclaration</h3>
                        <dl className="nc-resume">
                            <div><dt>Auteur</dt><dd>{nomComplet(detail.declarant)} (matricule {detail.declarant?.matricule})</dd></div>
                            <div><dt>Date de détection</dt><dd>{formaterDate(detail.dateDetection)}</dd></div>
                            <div><dt>Service concerné</dt><dd>{detail.service?.libelle}</dd></div>
                            <div><dt>Gravité déclarée</dt><dd>{GRAVITES[detail.graviteDeclaree] ?? detail.graviteDeclaree}</dd></div>
                            <div><dt>Statut actuel</dt><dd>{STATUTS_NC[detail.statut]}</dd></div>
                        </dl>
                        <div>
                            <strong>Description</strong>
                            <p style={{ whiteSpace: "pre-wrap", margin: ".25rem 0 0" }}>{detail.descriptionDetaillee}</p>
                        </div>
                        {detail.piecesJointes.length > 0 && (
                            <div>
                                <strong>Pièces jointes</strong>
                                <div className="nc-actions" style={{ marginTop: ".4rem" }}>
                                    {detail.piecesJointes.map((p) => (
                                        <button key={p.id} type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                            onClick={() => ouvrirPieceJointe(p)}>
                                            {p.type === "PDF" ? "PDF" : "Image"} : {p.nomOriginal} ({formaterTaille(p.taille)})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ---------- Analyse des causes ---------- */}
                    <section className="nc-section" aria-labelledby="t-ishikawa">
                        <h3 id="t-ishikawa">Analyse des causes : Ishikawa et 5 Pourquoi</h3>
                        <div className="nc-onglets" role="tablist" aria-label="Branches d'Ishikawa">
                            {BRANCHES.map((b) => {
                                const remplie = Object.values(form.analyses[b.code]).some((v) => v.trim() !== "");
                                return (
                                    <button key={b.code} type="button" role="tab" className="nc-onglet"
                                        aria-selected={brancheActive === b.code}
                                        onClick={() => setBrancheActive(b.code)}>
                                        {b.libelle}{remplie ? " ✓" : ""}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="nc-pourquoi" role="tabpanel">
                            {POURQUOI.map((n) => (
                                <div className="nc-champ" key={n}>
                                    <label htmlFor={`pourquoi-${brancheActive}-${n}`}>Pourquoi {n}</label>
                                    <textarea
                                        id={`pourquoi-${brancheActive}-${n}`}
                                        rows={2}
                                        maxLength={2000}
                                        value={form.analyses[brancheActive][`pourquoi${n}`]}
                                        onChange={(e) => majAnalyse(brancheActive, `pourquoi${n}`, e.target.value)}
                                    />
                                </div>
                            ))}
                            <div className="nc-champ">
                                <label htmlFor={`cause-${brancheActive}`}>Cause racine retenue pour cette branche</label>
                                <textarea
                                    id={`cause-${brancheActive}`}
                                    rows={2}
                                    maxLength={2000}
                                    value={form.analyses[brancheActive].causeRacineValidee}
                                    onChange={(e) => majAnalyse(brancheActive, "causeRacineValidee", e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ---------- Qualification ---------- */}
                    <section className="nc-section" aria-labelledby="t-qualif">
                        <h3 id="t-qualif">Qualification</h3>

                        <RechercheUtilisateur
                            id="auditeur"
                            label="Auditeur à attribuer"
                            role="AUDITEUR"
                            valeur={form.auditeur}
                            onChange={(u) => maj({ auditeur: u })}
                            aide="Tapez un nom, un prénom ou un matricule, puis choisissez dans la liste (facultatif)."
                        />

                        <div className="nc-grille">
                            <div className="nc-champ">
                                <label htmlFor="nature">Nature *</label>
                                <select id="nature" value={form.categorieId}
                                    onChange={(e) => maj({ categorieId: e.target.value })}>
                                    <option value="">— Choisir —</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.libelle}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="nc-champ">
                                <label htmlFor="graviteRetenue">Gravité retenue *</label>
                                <select id="graviteRetenue" value={form.gravite}
                                    onChange={(e) => maj({ gravite: e.target.value })}>
                                    <option value="">— Choisir —</option>
                                    {Object.entries(GRAVITES).map(([code, libelle]) => (
                                        <option key={code} value={code}>{libelle}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="nc-champ">
                                <label htmlFor="statut">Statut d'ouverture *</label>
                                <select id="statut" value={form.statut}
                                    onChange={(e) => maj({ statut: e.target.value })}>
                                    {statutsProposes.map((s) => (
                                        <option key={s} value={s}>{STATUTS_NC[s]}</option>
                                    ))}
                                </select>
                                <span className="nc-aide">On ne peut pas revenir à un statut précédent.</span>
                            </div>

                            <div className="nc-champ">
                                <label htmlFor="delai">Délai de traitement (jours) *</label>
                                <input id="delai" type="number" min={1} max={365} value={form.delaisJours}
                                    onChange={(e) => maj({ delaisJours: e.target.value })} />
                            </div>
                        </div>
                    </section>

                    {/* ---------- Plan d'actions CAPA ---------- */}
                    <section className="nc-section" aria-labelledby="t-capa">
                        <h3 id="t-capa">Plan d'actions (CAPA), étape par étape</h3>

                        {form.etapes.length === 0 && (
                            <p className="nc-aide">Aucune étape pour l'instant. Ajoutez la première action à mener.</p>
                        )}

                        {form.etapes.map((e, index) => {
                            const modifiable = e.statut === "A_FAIRE";
                            return (
                                <div className="nc-etape" key={e.cle}>
                                    <div className="nc-etape-entete">
                                        <strong>Étape {index + 1}</strong>
                                        {modifiable ? (
                                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                                onClick={() => retirerEtape(e.cle)}>
                                                Retirer
                                            </button>
                                        ) : (
                                            <span className="nc-badge">{STATUTS_ACTION[e.statut] ?? e.statut} : non modifiable</span>
                                        )}
                                    </div>

                                    <div className="nc-grille">
                                        <div className="nc-champ">
                                            <label htmlFor={`type-${e.cle}`}>Type</label>
                                            <select id={`type-${e.cle}`} value={e.type} disabled={!modifiable}
                                                onChange={(ev) => majEtape(e.cle, { type: ev.target.value })}>
                                                {Object.entries(TYPES_ACTION).map(([code, libelle]) => (
                                                    <option key={code} value={code}>{libelle}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="nc-champ">
                                            <label htmlFor={`echeance-${e.cle}`}>Échéance</label>
                                            <input id={`echeance-${e.cle}`} type="date" value={e.dateEcheance}
                                                min={e.id === null ? dateAujourdhui() : undefined}
                                                disabled={!modifiable}
                                                onChange={(ev) => majEtape(e.cle, { dateEcheance: ev.target.value })} />
                                        </div>
                                    </div>

                                    <div className="nc-champ">
                                        <label htmlFor={`desc-${e.cle}`}>Action à mener</label>
                                        <textarea id={`desc-${e.cle}`} rows={2} maxLength={2000} value={e.description}
                                            disabled={!modifiable}
                                            onChange={(ev) => majEtape(e.cle, { description: ev.target.value })} />
                                    </div>

                                    {modifiable ? (
                                        <RechercheUtilisateur
                                            id={`resp-${e.cle}`}
                                            label="Responsable de l'action"
                                            valeur={e.responsable}
                                            onChange={(u) => majEtape(e.cle, { responsable: u })}
                                        />
                                    ) : (
                                        <p className="nc-aide">Responsable : {nomComplet(e.responsable)}</p>
                                    )}
                                </div>
                            );
                        })}

                        <div>
                            <button type="button" className="nc-btn nc-btn-secondaire" onClick={ajouterEtape}>
                                + Ajouter une étape
                            </button>
                        </div>
                    </section>
                </>
            )}
        </Modal>
    );
}