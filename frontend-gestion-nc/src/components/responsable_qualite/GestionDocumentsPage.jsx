import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/api";
import Modal from "../Modal";
import DocumentsExplorateur from "../documents/DocumentsExplorateur";
import { STATUTS_DOCUMENT } from "../constantes";
import "../Declarant/nc.css";
import "../documents/documents.css";

const DROITS = [
    ["consulter", "Consulter"],
    ["ajouter", "Ajouter"],
    ["modifier", "Modifier"],
    ["changerStatut", "Changer le statut"],
    ["consulterArchives", "Voir les archives"],
];

function ModalModification({ document: doc, processus, onFermer, onEnregistre }) {
    const [titre, setTitre] = useState(doc.titre);
    const [description, setDescription] = useState(doc.description || "");
    const [processusId, setProcessusId] = useState(String(doc.processus?.id ?? ""));
    const [erreur, setErreur] = useState("");
    const [envoi, setEnvoi] = useState(false);

    async function enregistrer() {
        if (!titre.trim()) return setErreur("Le titre est obligatoire.");
        setEnvoi(true);
        try {
            await apiRequest(`/api/documents-qualite/${doc.id}`, {
                method: "PUT",
                body: JSON.stringify({ titre: titre.trim(), description: description.trim(), processusId: Number(processusId) }),
            });
            onEnregistre();
        } catch (e) {
            setErreur(e.message);
            setEnvoi(false);
        }
    }

    return (
        <Modal titre={`Modifier ${doc.reference}`} onFermer={onFermer} largeur="moyen"
               pied={(
                   <div className="nc-actions">
                       <button type="button" className="nc-btn" disabled={envoi} onClick={enregistrer}>Enregistrer</button>
                       <button type="button" className="nc-btn nc-btn-secondaire" onClick={onFermer}>Annuler</button>
                   </div>
               )}>
            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            <div className="nc-champ">
                <label htmlFor="mod-titre">Titre</label>
                <input id="mod-titre" value={titre} maxLength={255} onChange={(e) => setTitre(e.target.value)} />
            </div>
            <div className="nc-champ">
                <label htmlFor="mod-processus">Processus</label>
                <select id="mod-processus" value={processusId} onChange={(e) => setProcessusId(e.target.value)}>
                    {processus.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.libelle}</option>)}
                    {doc.processus && !processus.some((p) => p.id === doc.processus.id) && (
                        <option value={doc.processus.id}>{doc.processus.code} — {doc.processus.libelle}</option>
                    )}
                </select>
            </div>
            <div className="nc-champ">
                <label htmlFor="mod-description">Description</label>
                <textarea id="mod-description" rows={5} maxLength={4000} value={description}
                          onChange={(e) => setDescription(e.target.value)} />
            </div>
            <p className="nc-aide">La référence, la catégorie et le fichier ne sont pas modifiables : ajoutez un nouveau document si besoin.</p>
        </Modal>
    );
}

function ModalStatut({ document: doc, statutInitial, onFermer, onEnregistre }) {
    const possibles = doc.statut === "OBSOLETE"
        ? ["EN_REVISION"]
        : Object.keys(STATUTS_DOCUMENT).filter((s) => s !== doc.statut);
    const [statut, setStatut] = useState(possibles.includes(statutInitial) ? statutInitial : possibles[0]);
    const [commentaire, setCommentaire] = useState("");
    const [erreur, setErreur] = useState("");
    const [envoi, setEnvoi] = useState(false);

    async function enregistrer() {
        setEnvoi(true);
        try {
            await apiRequest(`/api/documents-qualite/${doc.id}/statut`, {
                method: "PUT",
                body: JSON.stringify({ statut, commentaire: commentaire.trim() }),
            });
            onEnregistre();
        } catch (e) {
            setErreur(e.message);
            setEnvoi(false);
        }
    }

    return (
        <Modal titre={`Statut de ${doc.reference}`} onFermer={onFermer} largeur="moyen"
               pied={(
                   <div className="nc-actions">
                       <button type="button" className={statut === "OBSOLETE" ? "nc-btn nc-btn-danger" : "nc-btn"}
                               disabled={envoi} onClick={enregistrer}>
                           {statut === "OBSOLETE" ? "Archiver le document" : "Changer le statut"}
                       </button>
                       <button type="button" className="nc-btn nc-btn-secondaire" onClick={onFermer}>Annuler</button>
                   </div>
               )}>
            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            <p>
                « {doc.titre} » est actuellement <strong>{STATUTS_DOCUMENT[doc.statut]}</strong>.
            </p>
            <div className="nc-champ">
                <label htmlFor="stat-nouveau">Nouveau statut</label>
                <select id="stat-nouveau" value={statut} onChange={(e) => setStatut(e.target.value)}>
                    {possibles.map((s) => <option key={s} value={s}>{STATUTS_DOCUMENT[s]}</option>)}
                </select>
            </div>
            {statut === "OBSOLETE" && (
                <p className="nc-info">
                    Le document sera archivé : il reste conservé pour consultation historique mais n'est plus applicable ni modifiable.
                </p>
            )}
            {doc.statut === "OBSOLETE" && (
                <p className="nc-info">Un document archivé revient d'abord en révision avant de pouvoir être remis en vigueur.</p>
            )}
            <div className="nc-champ">
                <label htmlFor="stat-commentaire">Commentaire (facultatif)</label>
                <textarea id="stat-commentaire" rows={3} maxLength={1000} value={commentaire}
                          onChange={(e) => setCommentaire(e.target.value)} />
            </div>
        </Modal>
    );
}

/** Espace des responsables qualité : ajout, modification, changement de statut, archivage et droits d'accès. */
export default function GestionDocumentsPage() {
    const [mesDroits, setMesDroits] = useState(null);
    const [processus, setProcessus] = useState([]);
    const [cle, setCle] = useState(0);
    const [edition, setEdition] = useState(null);
    const [statutModal, setStatutModal] = useState(null);   // { doc, statutInitial }

    useEffect(() => {
        apiRequest("/api/documents-qualite/droits").then(setMesDroits).catch(() => setMesDroits(null));
        apiRequest("/api/referentiels/processus").then((d) => setProcessus(d || [])).catch(() => {});
    }, []);

    const apres = () => { setEdition(null); setStatutModal(null); setCle((c) => c + 1); };

    const actionsLigne = (d) => (
        <div className="doc-actions">
            {d.statut !== "OBSOLETE" && mesDroits?.moi.modifier && (
                <button type="button" className="nc-btn nc-btn-petit nc-btn-secondaire" onClick={() => setEdition(d)}>Modifier</button>
            )}
            {mesDroits?.moi.changerStatut && (
                d.statut === "OBSOLETE" ? (
                    <button type="button" className="nc-btn nc-btn-petit nc-btn-secondaire"
                            onClick={() => setStatutModal({ doc: d, statutInitial: "EN_REVISION" })}>Remettre en révision</button>
                ) : (
                    <>
                        <button type="button" className="nc-btn nc-btn-petit nc-btn-secondaire"
                                onClick={() => setStatutModal({ doc: d })}>Statut</button>
                        <button type="button" className="nc-btn nc-btn-petit nc-btn-danger"
                                onClick={() => setStatutModal({ doc: d, statutInitial: "OBSOLETE" })}>Archiver</button>
                    </>
                )
            )}
        </div>
    );

    return (
        <main className="nc-page">
            <div className="doc-entete">
                <div>
                    <h1>Gestion documentaire</h1>
                    <p className="nc-aide">
                        Espace du responsable qualité : ajoutez, modifiez, changez le statut et archivez les documents.
                        La bibliothèque commune est réservée aux administrateurs, déclarants et auditeurs.
                    </p>
                </div>
                <Link to="/responsable/documents/nouveau" className="nc-btn" style={{ textDecoration: "none" }}>
                    + Ajouter un document
                </Link>
            </div>

            {mesDroits && (
                <DocumentsExplorateur mode="gestion" droits={mesDroits.moi} cleRechargement={cle} actionsLigne={actionsLigne} />
            )}


            {edition && <ModalModification document={edition} processus={processus} onFermer={() => setEdition(null)} onEnregistre={apres} />}
            {statutModal && (
                <ModalStatut document={statutModal.doc} statutInitial={statutModal.statutInitial}
                             onFermer={() => setStatutModal(null)} onEnregistre={apres} />
            )}
        </main>
    );
}