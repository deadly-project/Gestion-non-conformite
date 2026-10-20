import { useEffect, useState } from "react";
import { apiRequest } from "../../api/api";
import Modal from "../Modal";
import RechercheUtilisateur from "./RechercheUtilisateur";
import {
    GRAVITES, ORDRE_STATUT, STATUTS_NC, STATUTS_TRAITEMENT,
    TYPES_ACTION, dateAujourdhui,
} from "../constantes";

export default function TraitementNcModal({ ncId, utilisateur, onFermer, onEnregistre }) {
    const [detail, setDetail] = useState(null);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(null);

    const [confirmation, setConfirmation] = useState(null);
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
        setConfirmation(null);
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
        try {
            const corps = {
                gravite: form.gravite,
                categorieId: Number(form.categorieId),
                statut: form.statut,
                auditeurId: form.auditeur ? form.auditeur.id : null,
                delaisJours: Number(form.delaisJours),
                analyses: [], // Les analyses se font désormais dans leur propre page indépendante si besoin, ou on transmet les existantes
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
            setConfirmation(null);
        }
    }

    const statutsProposes = detail ? STATUTS_TRAITEMENT.filter((s) => ORDRE_STATUT[s] >= ORDRE_STATUT[detail.statut]) : [];

    const pied = form && (
        <>
            {erreurs.length > 0 && (
                <div className="nc-erreur"><ul className="nc-erreurs">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul></div>
            )}
            {erreurServeur && <p className="nc-erreur">{erreurServeur}</p>}
            <div className="nc-actions">
                <button type="button" className="nc-btn" disabled={enregistrement} onClick={terminer}>
                    {enregistrement ? "Enregistrement..." : "Enregistrer le traitement"}
                </button>
                <button type="button" className="nc-btn nc-btn-secondaire" onClick={onFermer}>Annuler</button>
            </div>
        </>
    );

    return (
        <Modal titre={detail ? `Traitement / Qualification : ${detail.reference}` : "Traitement"} onFermer={onFermer} pied={pied}>
            {chargement && <p>Chargement...</p>}
            {form && detail && (
                <>
                    <section className="nc-section">
                        <h3>Qualification</h3>
                        <RechercheUtilisateur
                            id="auditeur"
                            label="Auditeur à attribuer"
                            role="AUDITEUR"
                            valeur={form.auditeur}
                            onChange={(u) => maj({ auditeur: u })}
                        />
                        <div className="nc-grille">
                            <div className="nc-champ">
                                <label htmlFor="nature">Nature *</label>
                                <select id="nature" value={form.categorieId} onChange={(e) => maj({ categorieId: e.target.value })}>
                                    <option value="">— Choisir —</option>
                                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.libelle}</option>))}
                                </select>
                            </div>
                            <div className="nc-champ">
                                <label htmlFor="graviteRetenue">Gravité retenue *</label>
                                <select id="graviteRetenue" value={form.gravite} onChange={(e) => maj({ gravite: e.target.value })}>
                                    <option value="">— Choisir —</option>
                                    {Object.entries(GRAVITES).map(([code, libelle]) => (<option key={code} value={code}>{libelle}</option>))}
                                </select>
                            </div>
                            <div className="nc-champ">
                                <label htmlFor="statut">Statut d'ouverture *</label>
                                <select id="statut" value={form.statut} onChange={(e) => maj({ statut: e.target.value })}>
                                    {statutsProposes.map((s) => (<option key={s} value={s}>{STATUTS_NC[s]}</option>))}
                                </select>
                            </div>
                            <div className="nc-champ">
                                <label htmlFor="delai">Délai de traitement (jours) *</label>
                                <input id="delai" type="number" min={1} max={365} value={form.delaisJours} onChange={(e) => maj({ delaisJours: e.target.value })} />
                            </div>
                        </div>
                    </section>

                    <section className="nc-section">
                        <h3>Plan d'actions (CAPA)</h3>
                        {form.etapesCapa.map((e, index) => (
                            <div className="nc-etape" key={e.cle} style={{ marginBottom: "1rem", padding: "10px", border: "1px solid #ddd" }}>
                                <strong>Étape {index + 1}</strong>
                                <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => retirerEtape(e.cle)} style={{ float: "right" }}>Retirer</button>
                                <div className="nc-champ" style={{ marginTop: "10px" }}>
                                    <label>Type</label>
                                    <select value={e.type} onChange={(ev) => majEtape(e.cle, { type: ev.target.value })}>
                                        {Object.entries(TYPES_ACTION).map(([code, libelle]) => (<option key={code} value={code}>{libelle}</option>))}
                                    </select>
                                </div>
                                <div className="nc-champ">
                                    <label>Action à mener</label>
                                    <textarea rows={2} value={e.description} onChange={(ev) => majEtape(e.cle, { description: ev.target.value })} />
                                </div>
                                <div className="nc-champ">
                                    <label>Échéance</label>
                                    <input type="date" value={e.dateEcheance} min={dateAujourdhui()} onChange={(ev) => majEtape(e.cle, { dateEcheance: ev.target.value })} />
                                </div>
                                <p className="nc-aide">Responsable : {e.responsable?.prenom} {e.responsable?.nom} (Figé)</p>
                            </div>
                        ))}
                        <button type="button" className="nc-btn nc-btn-secondaire" onClick={ajouterEtape}>+ Ajouter une étape CAPA</button>
                    </section>
                </>
            )}
        </Modal>
    );
}