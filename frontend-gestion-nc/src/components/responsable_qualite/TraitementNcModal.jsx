import { useEffect, useState } from "react";
import { apiRequest } from "../../api/api";
import Modal from "../Modal";
import RechercheUtilisateur from "./RechercheUtilisateur";
import {
    GRAVITES, ORDRE_STATUT, STATUTS_NC, STATUTS_TRAITEMENT,
    TYPES_ACTION, dateAujourdhui,
} from "../constantes";
import {
    FaFingerprint, FaWandMagicSparkles, FaUserShield, FaLayerGroup,
    FaTriangleExclamation, FaCircleInfo, FaListCheck, FaPlus,
    FaTrashCan, FaFloppyDisk, FaXmark, FaCalendarDays, FaSpinner,
} from "react-icons/fa6";
import "./TraitementNcModal.css";

export default function TraitementNcModal({ ncId, utilisateur, onFermer, onEnregistre }) {
    const [detail, setDetail] = useState(null);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(null);

    const [erreurs, setErreurs] = useState([]);
    const [erreurServeur, setErreurServeur] = useState("");
    const [chargement, setChargement] = useState(true);
    const [enregistrement, setEnregistrement] = useState(false);

    useEffect(() => {
        Promise.all([
            apiRequest(`/api/non-conformites/${ncId}`),
            apiRequest("/api/referentiels/categories"),
        ])
            .then(([d, c]) => {
                setDetail(d);
                setCategories(c);
                setForm({
                    reference: d.reference || "",
                    genererReference: false,
                    gravite: d.gravite || d.graviteDeclaree || "",
                    categorieId: d.categorieId ? String(d.categorieId) : "",
                    statut: ORDRE_STATUT[d.statut] >= 1 ? d.statut : "OUVERT",
                    delaisJours: d.delaisJours ? String(d.delaisJours) : "",
                    auditeur: d.auditeur || null,
                    etapesCapa: (d.etapesCapa || []).map((e) => ({
                        cle: `existante-${e.id}`, id: e.id, type: e.type, description: e.description,
                        dateEcheance: e.dateEcheance, responsable: e.responsable, statut: e.statut,
                    })),
                });
            })
            .catch((e) => setErreurServeur(e.message || "Chargement impossible."))
            .finally(() => setChargement(false));
    }, [ncId]);

    function maj(patch) {
        setForm((f) => ({ ...f, ...patch }));
    }

    function ajouterEtape() {
        maj({
            etapesCapa: [...form.etapesCapa, {
                cle: `nouvelle-${Date.now()}-${Math.random()}`, id: null, type: "CORRECTIVE",
                description: "", dateEcheance: "",
                responsable: { id: utilisateur.id, nom: utilisateur.nom, prenom: utilisateur.prenom, matricule: utilisateur.matricule },
                statut: "A_FAIRE",
            }],
        });
    }

    function majEtape(cle, patch) {
        maj({ etapesCapa: form.etapesCapa.map((e) => (e.cle === cle ? { ...e, ...patch } : e)) });
    }

    function retirerEtape(cle) {
        maj({ etapesCapa: form.etapesCapa.filter((e) => e.cle !== cle) });
    }

    function valider() {
        const problemes = [];
        if (!detail?.reference && !form.genererReference && !form.reference.trim()) {
            problemes.push("Attribuez une référence ou cochez la génération automatique.");
        }
        if (!form.gravite) problemes.push("Choisissez la gravité.");
        if (!form.categorieId) problemes.push("Choisissez la nature.");
        if (!form.statut) problemes.push("Choisissez le statut.");
        const delai = Number(form.delaisJours);
        if (!Number.isInteger(delai) || delai < 1 || delai > 365) {
            problemes.push("Le délai doit être compris entre 1 et 365 jours.");
        }
        return problemes;
    }

    async function terminer() {
        const problemes = valider();
        if (problemes.length > 0) {
            setErreurs(problemes);
            return;
        }
        setEnregistrement(true);
        setErreurServeur("");
        try {
            const corps = {
                reference: form.reference.trim() || null,
                genererReference: form.genererReference,
                gravite: form.gravite,
                categorieId: Number(form.categorieId),
                statut: form.statut,
                auditeurId: form.auditeur ? form.auditeur.id : null,
                delaisJours: Number(form.delaisJours),
                analyses: [],
                etapesCapa: form.etapesCapa.map((e) => ({
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
        } finally {
            setEnregistrement(false);
        }
    }

    const statutsProposes = detail
        ? STATUTS_TRAITEMENT.filter((s) => ORDRE_STATUT[s] >= ORDRE_STATUT[detail.statut])
        : [];

    const pied = form && (
        <div className="TRT-pied">
            {erreurs.length > 0 && (
                <div className="TRT-alerte TRT-alerte--erreur">
                    <FaCircleInfo />
                    <ul className="TRT-erreurs">
                        {erreurs.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                </div>
            )}
            {erreurServeur && (
                <div className="TRT-alerte TRT-alerte--erreur">
                    <FaTriangleExclamation />
                    <span>{erreurServeur}</span>
                </div>
            )}
            <div className="TRT-pied-actions">
                <button
                    type="button"
                    className="TRT-btn TRT-btn--primaire"
                    disabled={enregistrement}
                    onClick={terminer}
                >
                    {enregistrement ? <><FaSpinner className="TRT-spin" /> Enregistrement...</> : <><FaFloppyDisk /> Enregistrer le traitement</>}
                </button>
                <button type="button" className="TRT-btn TRT-btn--secondaire" onClick={onFermer}>
                    <FaXmark /> Annuler
                </button>
            </div>
        </div>
    );

    return (
        <Modal
            titre={detail ? `Traitement / Qualification : ${detail.reference}` : "Traitement"}
            onFermer={onFermer}
            pied={pied}
        >
            {chargement && (
                <div className="TRT-chargement">
                    <FaSpinner className="TRT-spin" /> Chargement...
                </div>
            )}

            {form && detail && (
                <div className="TRT-contenu">
                    {/* --- Section Référence --- */}
                    <section className="TRT-section">
                        <header className="TRT-section-entete">
                            <FaFingerprint className="TRT-section-icone" />
                            <h3>Référence de la non-conformité</h3>
                        </header>

                        {detail.reference ? (
                            <div className="TRT-champ">
                                <label>Référence attribuée</label>
                                <input value={detail.reference} readOnly className="TRT-input TRT-input--readonly" />
                                <span className="TRT-aide">La référence est déjà attribuée et ne peut plus être modifiée.</span>
                            </div>
                        ) : (
                            <>
                                <div className="TRT-champ">
                                    <label htmlFor="referenceNc">Référence à attribuer</label>
                                    <input
                                        id="referenceNc"
                                        className="TRT-input"
                                        value={form.reference}
                                        maxLength={20}
                                        disabled={form.genererReference}
                                        placeholder="Ex : NC-2026-0001"
                                        onChange={(e) => maj({ reference: e.target.value })}
                                    />
                                </div>
                                <label className="TRT-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={form.genererReference}
                                        onChange={(e) => maj({
                                            genererReference: e.target.checked,
                                            reference: e.target.checked ? "" : form.reference,
                                        })}
                                    />
                                    <FaWandMagicSparkles className="TRT-icone-inline" />
                                    Générer automatiquement la référence (format NC-ANNÉE-NNNN)
                                </label>
                                <span className="TRT-aide">La référence sera attribuée à l'enregistrement du traitement.</span>
                            </>
                        )}
                    </section>

                    {/* --- Section Qualification --- */}
                    <section className="TRT-section">
                        <header className="TRT-section-entete">
                            <FaUserShield className="TRT-section-icone" />
                            <h3>Qualification</h3>
                        </header>

                        <RechercheUtilisateur
                            id="auditeur"
                            label="Auditeur à attribuer"
                            role="AUDITEUR"
                            valeur={form.auditeur}
                            onChange={(u) => maj({ auditeur: u })}
                        />

                        <div className="TRT-grille">
                            <div className="TRT-champ">
                                <label htmlFor="nature"><FaLayerGroup /> Nature *</label>
                                <select
                                    id="nature"
                                    className="TRT-input"
                                    value={form.categorieId}
                                    onChange={(e) => maj({ categorieId: e.target.value })}
                                >
                                    <option value="">— Choisir —</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.libelle}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="TRT-champ">
                                <label htmlFor="graviteRetenue"><FaTriangleExclamation /> Gravité retenue *</label>
                                <select
                                    id="graviteRetenue"
                                    className="TRT-input"
                                    value={form.gravite}
                                    onChange={(e) => maj({ gravite: e.target.value })}
                                >
                                    <option value="">— Choisir —</option>
                                    {Object.entries(GRAVITES).map(([code, libelle]) => (
                                        <option key={code} value={code}>{libelle}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="TRT-champ">
                                <label htmlFor="statut"><FaListCheck /> Statut d'ouverture *</label>
                                <select
                                    id="statut"
                                    className="TRT-input"
                                    value={form.statut}
                                    onChange={(e) => maj({ statut: e.target.value })}
                                >
                                    {statutsProposes.map((s) => (
                                        <option key={s} value={s}>{STATUTS_NC[s]}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="TRT-champ">
                                <label htmlFor="delai"><FaCalendarDays /> Délai de traitement (jours) *</label>
                                <input
                                    id="delai"
                                    type="number"
                                    min={1}
                                    max={365}
                                    className="TRT-input"
                                    value={form.delaisJours}
                                    onChange={(e) => maj({ delaisJours: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* --- Section CAPA --- */}
                    <section className="TRT-section">
                        <header className="TRT-section-entete">
                            <FaListCheck className="TRT-section-icone" />
                            <h3>Plan d'actions (CAPA)</h3>
                            <span className="TRT-compteur">{form.etapesCapa.length}</span>
                        </header>

                        {form.etapesCapa.length === 0 && (
                            <p className="TRT-vide">Aucune étape CAPA définie pour l'instant.</p>
                        )}

                        <div className="TRT-capa-liste">
                            {form.etapesCapa.map((e, index) => (
                                <article className="TRT-capa" key={e.cle}>
                                    <header className="TRT-capa-entete">
                                        <span className="TRT-capa-numero">Étape {index + 1}</span>
                                        <button
                                            type="button"
                                            className="TRT-btn TRT-btn--danger TRT-btn--petit"
                                            onClick={() => retirerEtape(e.cle)}
                                            title="Retirer cette étape"
                                        >
                                            <FaTrashCan /> Retirer
                                        </button>
                                    </header>

                                    <div className="TRT-grille">
                                        <div className="TRT-champ">
                                            <label>Type</label>
                                            <select
                                                className="TRT-input"
                                                value={e.type}
                                                onChange={(ev) => majEtape(e.cle, { type: ev.target.value })}
                                            >
                                                {Object.entries(TYPES_ACTION).map(([code, libelle]) => (
                                                    <option key={code} value={code}>{libelle}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="TRT-champ">
                                            <label><FaCalendarDays /> Échéance</label>
                                            <input
                                                type="date"
                                                className="TRT-input"
                                                value={e.dateEcheance}
                                                min={dateAujourdhui()}
                                                onChange={(ev) => majEtape(e.cle, { dateEcheance: ev.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="TRT-champ">
                                        <label>Action à mener</label>
                                        <textarea
                                            rows={3}
                                            className="TRT-input"
                                            value={e.description}
                                            onChange={(ev) => majEtape(e.cle, { description: ev.target.value })}
                                            placeholder="Décrivez l'action corrective/préventive..."
                                        />
                                    </div>

                                    <p className="TRT-aide">
                                        Responsable : <strong>{e.responsable?.prenom} {e.responsable?.nom}</strong> (figé)
                                    </p>
                                </article>
                            ))}
                        </div>

                        <button type="button" className="TRT-btn TRT-btn--secondaire" onClick={ajouterEtape}>
                            <FaPlus /> Ajouter une étape CAPA
                        </button>
                    </section>
                </div>
            )}
        </Modal>
    );
}