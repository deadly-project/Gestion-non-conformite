import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import {
    EXTENSIONS_DOCUMENT, STATUTS_DOCUMENT, TAILLE_MAX_DOCUMENT, TYPES_DOCUMENT, formaterTaille,

} from "../constantes"
import "../Declarant/nc.css";
import "./documents.css";

const PATRON_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/;

/** Page dédiée à l'ajout d'un document qualité (responsable qualité). */
export default function AjoutDocumentPage() {
    const navigate = useNavigate();
    const champFichier = useRef(null);

    const [processus, setProcessus] = useState([]);
    const [reference, setReference] = useState("");
    const [titre, setTitre] = useState("");
    const [typeDocument, setTypeDocument] = useState("");
    const [processusId, setProcessusId] = useState("");
    const [statut, setStatut] = useState("EN_VIGUEUR");
    const [description, setDescription] = useState("");
    const [fichier, setFichier] = useState(null);
    const [survol, setSurvol] = useState(false);
    const [erreur, setErreur] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [cree, setCree] = useState(null);

    useEffect(() => {
        apiRequest("/api/referentiels/processus").then((d) => setProcessus(d || [])).catch(() => setErreur("Impossible de charger les processus."));
    }, []);

    function choisirFichier(candidat) {
        if (!candidat) return;
        const extension = candidat.name.includes(".") ? candidat.name.split(".").pop().toLowerCase() : "";
        if (!EXTENSIONS_DOCUMENT.includes(extension)) {
            setErreur(`Format non accepté (.${extension || "?"}). Formats : PDF, Word, Excel, PowerPoint, OpenDocument, TXT, CSV, PNG, JPEG.`);
            return;
        }
        if (candidat.size > TAILLE_MAX_DOCUMENT) {
            setErreur(`Fichier trop volumineux : ${formaterTaille(TAILLE_MAX_DOCUMENT)} maximum.`);
            return;
        }
        setErreur("");
        setFichier(candidat);
    }

    function reinitialiser() {
        setReference(""); setTitre(""); setTypeDocument(""); setProcessusId(""); setStatut("EN_VIGUEUR");
        setDescription(""); setFichier(null); setErreur(""); setCree(null);
    }

    async function envoyer(event) {
        event.preventDefault();
        setErreur("");
        const referenceNette = reference.trim().toUpperCase();
        if (!PATRON_REFERENCE.test(referenceNette)) {
            return setErreur("Référence invalide : lettres, chiffres, « . », « _ » ou « - » (ex. PR-PROD-001).");
        }
        if (!titre.trim()) return setErreur("Le titre est obligatoire.");
        if (!typeDocument) return setErreur("Choisissez la catégorie du document.");
        if (!processusId) return setErreur("Choisissez le processus concerné.");
        if (!fichier) return setErreur("Joignez le fichier du document.");

        setEnvoi(true);
        try {
            const formData = new FormData();
            formData.append("donnees", new Blob([JSON.stringify({
                reference: referenceNette,
                titre: titre.trim(),
                description: description.trim(),
                typeDocument,
                processusId: Number(processusId),
                statut,
            })], { type: "application/json" }));
            formData.append("fichier", fichier);
            setCree(await apiRequest("/api/documents-qualite", { method: "POST", body: formData }));
        } catch (e) {
            setErreur(e.message || "L'ajout du document a échoué.");
        } finally {
            setEnvoi(false);
        }
    }

    if (cree) {
        return (
            <main className="nc-page">
                <h1>Document ajouté</h1>
                <p className="nc-succes" role="status">
                    Le document <strong>{cree.reference}</strong> « {cree.titre} » a été enregistré
                    ({STATUTS_DOCUMENT[cree.statut]}).
                </p>
                <div className="nc-actions">
                    <button type="button" className="nc-btn" onClick={reinitialiser}>Ajouter un autre document</button>
                    <button type="button" className="nc-btn nc-btn-secondaire"
                            onClick={() => navigate(`/responsable/documents?voir=${cree.id}`)}>Voir dans la gestion</button>
                </div>
            </main>
        );
    }

    return (
        <main className="nc-page">
            <p><Link to="/responsable/documents">← Retour à la gestion documentaire</Link></p>
            <h1>Ajouter un document qualité</h1>

            <form className="nc-form doc-formulaire" onSubmit={envoyer} noValidate>
                <div className="nc-grille">
                    <div className="nc-champ">
                        <label htmlFor="doc-reference">Référence *</label>
                        <input id="doc-reference" value={reference} maxLength={50} placeholder="PR-PROD-001"
                               onChange={(e) => setReference(e.target.value)} />
                        <span className="nc-aide">Unique, par exemple PR-PROD-001.</span>
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-titre">Titre *</label>
                        <input id="doc-titre" value={titre} maxLength={255} onChange={(e) => setTitre(e.target.value)} />
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-type">Catégorie *</label>
                        <select id="doc-type" value={typeDocument} onChange={(e) => setTypeDocument(e.target.value)}>
                            <option value="">Choisir...</option>
                            {Object.entries(TYPES_DOCUMENT).map(([code, l]) => <option key={code} value={code}>{l}</option>)}
                        </select>
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-processus">Processus *</label>
                        <select id="doc-processus" value={processusId} onChange={(e) => setProcessusId(e.target.value)}>
                            <option value="">Choisir...</option>
                            {processus.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.libelle}</option>)}
                        </select>
                    </div>
                    <div className="nc-champ">
                        <label htmlFor="doc-statut">Statut initial</label>
                        <select id="doc-statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
                            <option value="EN_VIGUEUR">{STATUTS_DOCUMENT.EN_VIGUEUR}</option>
                            <option value="EN_REVISION">{STATUTS_DOCUMENT.EN_REVISION}</option>
                        </select>
                    </div>
                </div>

                <div className="nc-champ">
                    <label htmlFor="doc-description">Description</label>
                    <textarea id="doc-description" rows={4} maxLength={4000} value={description}
                              onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div className="nc-champ">
                    <label htmlFor="doc-fichier">Fichier *</label>
                    <label htmlFor="doc-fichier" className={`doc-depot ${survol ? "doc-depot--actif" : ""}`}
                           onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
                           onDragLeave={() => setSurvol(false)}
                           onDrop={(e) => { e.preventDefault(); setSurvol(false); choisirFichier(e.dataTransfer.files?.[0]); }}>
                        <input id="doc-fichier" ref={champFichier} type="file"
                               accept={EXTENSIONS_DOCUMENT.map((x) => `.${x}`).join(",")}
                               onChange={(e) => { choisirFichier(e.target.files?.[0]); e.target.value = ""; }} />
                        <strong>Cliquez ou déposez le fichier ici</strong>
                        <div className="nc-aide">PDF, Word, Excel, PowerPoint, OpenDocument, TXT, CSV, PNG, JPEG — 20 Mo maximum</div>
                    </label>
                    {fichier && (
                        <div className="doc-fichier-choisi">
                            <span>{fichier.name} ({formaterTaille(fichier.size)})</span>
                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => setFichier(null)}>Retirer</button>
                        </div>
                    )}
                </div>

                {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

                <div className="nc-actions">
                    <button type="submit" className="nc-btn" disabled={envoi}>{envoi ? "Envoi en cours..." : "Enregistrer le document"}</button>
                    <button type="button" className="nc-btn nc-btn-secondaire" disabled={envoi}
                            onClick={() => navigate("/responsable/documents")}>Annuler</button>
                </div>
            </form>
        </main>
    );
}