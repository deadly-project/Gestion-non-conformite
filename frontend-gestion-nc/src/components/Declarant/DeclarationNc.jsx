import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/api";
import {
    GRAVITES, MAX_IMAGES, TAILLE_MAX_IMAGE, TAILLE_MAX_PDF, TYPES_IMAGES,
    dateAujourdhui, formaterTaille,
} from "../constantes";
import "./nc.css";

// Exemples de codes de processus disponibles pour la création
const CODES_PROCESSUS_DISPONIBLES = [
    { code: "PRD", libelleType: "Production" },
    { code: "ACH", libelleType: "Achats" },
    { code: "RH", libelleType: "Ressources Humaines" },
    { code: "LOG", libelleType: "Logistique" },
    { code: "QSE", libelleType: "Qualité, Sécurité, Environnement" },
    { code: "MAI", libelleType: "Maintenance" },
];

export default function DeclarationNc({ utilisateur }) {
    const [reference, setReference] = useState("");
    const [titre, setTitre] = useState("");
    const [dateDetection, setDateDetection] = useState(dateAujourdhui());
    const [gravite, setGravite] = useState("");
    const [description, setDescription] = useState("");
    const [images, setImages] = useState([]);
    const [pdf, setPdf] = useState(null);

    // Gestion du processus (sélection existant ou création)
    const [services, setServices] = useState([]);
    const [rechercheProcessus, setRechercheProcessus] = useState("");
    const [processusSelectionne, setProcessusSelectionne] = useState(null); // { id, code, libelle, description } ou nouveau
    const [modeNouveauProcessus, setModeNouveauProcessus] = useState(false);
    
    // Champs pour nouveau processus
    const [nouveauCode, setNouveauCode] = useState("PRD");
    const [nouveauLibelle, setNouveauLibelle] = useState("");
    const [nouvelleDescription, setNouvelleDescription] = useState("");

    const [erreur, setErreur] = useState("");
    const [erreurFichiers, setErreurFichiers] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [cree, setCree] = useState(null);

    const imagesRef = useRef([]);
    useEffect(() => { imagesRef.current = images; }, [images]);
    useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

    useEffect(() => {
        let actif = true;
        apiRequest("/api/referentiels/processus")
            .then((donnees) => { if (actif) setServices(donnees); })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les services."); });
        return () => { actif = false; };
    }, []);

    const processusFiltres = services.filter(s => 
        s.libelle.toLowerCase().includes(rechercheProcessus.toLowerCase()) ||
        s.code.toLowerCase().includes(rechercheProcessus.toLowerCase())
    );

    function ajouterImages(event) {
        const fichiers = Array.from(event.target.files || []);
        event.target.value = "";

        let message = "";
        const acceptes = [];
        for (const f of fichiers) {
            if (!TYPES_IMAGES.includes(f.type)) {
                message = `« ${f.name} » : format non autorisé (JPEG, PNG ou WebP).`;
            } else if (f.size > TAILLE_MAX_IMAGE) {
                message = `« ${f.name} » : image trop volumineuse (${formaterTaille(TAILLE_MAX_IMAGE)} maximum).`;
            } else {
                acceptes.push(f);
            }
        }

        const place = Math.max(MAX_IMAGES - images.length, 0);
        if (acceptes.length > place) {
            message = `Maximum ${MAX_IMAGES} images : seules les premières ont été ajoutées.`;
        }

        const nouvelles = acceptes.slice(0, place).map((file) => ({
            cle: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
            file,
            url: URL.createObjectURL(file),
        }));

        setImages((precedentes) => [...precedentes, ...nouvelles]);
        setErreurFichiers(message);
    }

    function retirerImage(cle) {
        setImages((precedentes) => {
            const retiree = precedentes.find((i) => i.cle === cle);
            if (retiree) URL.revokeObjectURL(retiree.url);
            return precedentes.filter((i) => i.cle !== cle);
        });
        setErreurFichiers("");
    }

    function choisirPdf(event) {
        const fichier = event.target.files?.[0];
        event.target.value = "";
        if (!fichier) return;

        if (fichier.type !== "application/pdf") {
            setErreurFichiers(`« ${fichier.name} » n'est pas un PDF.`);
        } else if (fichier.size > TAILLE_MAX_PDF) {
            setErreurFichiers(`PDF trop volumineux (${formaterTaille(TAILLE_MAX_PDF)} maximum).`);
        } else {
            setPdf(fichier);
            setErreurFichiers("");
        }
    }

    function reinitialiser() {
        images.forEach((i) => URL.revokeObjectURL(i.url));
        setReference("");
        setTitre("");
        setDateDetection(dateAujourdhui());
        setProcessusSelectionne(null);
        setModeNouveauProcessus(false);
        setNouveauLibelle("");
        setNouvelleDescription("");
        setGravite("");
        setDescription("");
        setImages([]);
        setPdf(null);
        setErreur("");
        setErreurFichiers("");
        setCree(null);
    }

    async function envoyer(event) {
        event.preventDefault();
        setErreur("");
        setEnvoi(true);

        try {
            const formData = new FormData();
            
            const payload = {
                reference: reference.trim(),
                titre: titre.trim(),
                dateDetection,
                graviteDeclaree: gravite,
                descriptionDetaillee: description.trim(),
            };

            if (modeNouveauProcessus) {
                payload.nouveauProcessus = {
                    code: nouveauCode,
                    libelle: nouveauLibelle.trim(),
                    description: nouvelleDescription.trim()
                };
            } else if (processusSelectionne) {
                payload.processusId = processusSelectionne.id;
            } else {
                throw new Error("Veuillez sélectionner ou créer un processus.");
            }

            formData.append("donnees", new Blob([JSON.stringify(payload)], { type: "application/json" }));

            images.forEach((i) => formData.append("images", i.file));
            if (pdf) formData.append("pdf", pdf);

            const resultat = await apiRequest("/api/non-conformites", {
                method: "POST",
                body: formData,
            });
            setCree(resultat);
        } catch (error) {
            setErreur(error.message || "La déclaration a échoué.");
        } finally {
            setEnvoi(false);
        }
    }

    if (cree) {
        return (
            <main className="nc-page">
                <h1>Déclaration enregistrée</h1>
                <p className="nc-succes" role="status">
                    Votre non-conformité a bien été enregistrée sous la référence{" "}
                    <strong>{cree.reference}</strong>. Elle sera examinée par le responsable qualité.
                </p>
                <button type="button" className="nc-btn" onClick={reinitialiser}>
                    Déclarer une autre non-conformité
                </button>
            </main>
        );
    }

    return (
        <main className="nc-page">
            <h1>Déclarer une non-conformité</h1>

            <form className="nc-form" onSubmit={envoyer}>
                <div className="nc-grille">
                    <div className="nc-champ">
                        <label htmlFor="reference">Référence *</label>
                        <input 
                            id="reference" 
                            value={reference} 
                            onChange={(e) => setReference(e.target.value)} 
                            placeholder="Ex: NC-2026-001"
                            required 
                        />
                    </div>

                    <div className="nc-champ">
                        <label htmlFor="auteur">Auteur de la déclaration</label>
                        <input
                            id="auteur"
                            readOnly
                            value={utilisateur
                                ? `${utilisateur.prenom} ${utilisateur.nom} (matricule ${utilisateur.matricule})`
                                : ""}
                        />
                    </div>

                    <div className="nc-champ">
                        <label htmlFor="dateDetection">Date de détection *</label>
                        <input
                            id="dateDetection"
                            type="date"
                            value={dateDetection}
                            max={dateAujourdhui()}
                            onChange={(e) => setDateDetection(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="nc-champ">
                    <label htmlFor="titre">Titre *</label>
                    <input
                        id="titre"
                        value={titre}
                        maxLength={200}
                        onChange={(e) => setTitre(e.target.value)}
                        placeholder="Résumé en une phrase"
                        required
                    />
                </div>

                {/* Section Gestion du Processus */}
                <fieldset className="nc-champ" style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "5px" }}>
                    <legend>Processus / Service concerné *</legend>

                    {!modeNouveauProcessus ? (
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                                <input
                                    type="text"
                                    placeholder="Filtrer les processus existants..."
                                    value={rechercheProcessus}
                                    onChange={(e) => setRechercheProcessus(e.target.value)}
                                    style={{ width: "70%", padding: "8px" }}
                                />
                                <button 
                                    type="button" 
                                    className="nc-btn nc-btn-secondaire"
                                    onClick={() => setModeNouveauProcessus(true)}
                                >
                                    + Créer un nouveau processus
                                </button>
                            </div>

                            <div className="liste-processus" style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #eee" }}>
                                {processusFiltres.length === 0 ? (
                                    <p style={{ padding: "10px", color: "#666" }}>Aucun processus trouvé. Créez-en un nouveau.</p>
                                ) : (
                                    processusFiltres.map((s) => (
                                        <div 
                                            key={s.id} 
                                            onClick={() => setProcessusSelectionne(s)}
                                            style={{
                                                padding: "8px",
                                                cursor: "pointer",
                                                background: processusSelectionne?.id === s.id ? "#e0f2fe" : "transparent",
                                                borderBottom: "1px solid #f0f0f0"
                                            }}
                                        >
                                            <strong>{s.libelle}</strong> ({s.code})
                                            <div style={{ fontSize: "0.85em", color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {s.description || "Aucune description"}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {processusSelectionne && (
                                <p style={{ marginTop: "8px", color: "green", fontSize: "0.9em" }}>
                                    Processus sélectionné : <strong>{processusSelectionne.libelle}</strong>
                                </p>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <button 
                                type="button" 
                                className="nc-btn nc-btn-secondaire" 
                                style={{ alignSelf: "flex-start" }}
                                onClick={() => setModeNouveauProcessus(false)}
                            >
                                ← Retour aux processus existants
                            </button>

                            <div>
                                <label>Code du processus *</label>
                                <select value={nouveauCode} onChange={(e) => setNouveauCode(e.target.value)}>
                                    {CODES_PROCESSUS_DISPONIBLES.map(c => (
                                        <option key={c.code} value={c.code}>{c.code} - {c.libelleType}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label>Libellé du processus *</label>
                                <input 
                                    type="text" 
                                    value={nouveauLibelle} 
                                    onChange={(e) => setNouveauLibelle(e.target.value)} 
                                    placeholder="Ex: Ligne d'assemblage principale"
                                    required 
                                />
                            </div>

                            <div>
                                <label>Description du processus</label>
                                <textarea 
                                    value={nouvelleDescription} 
                                    onChange={(e) => setNouvelleDescription(e.target.value)} 
                                    placeholder="Détails sur ce processus..."
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}
                </fieldset>

                <div className="nc-champ">
                    <label htmlFor="gravite">Gravité *</label>
                    <select id="gravite" value={gravite}
                        onChange={(e) => setGravite(e.target.value)} required>
                        <option value="">— Choisir —</option>
                        {Object.entries(GRAVITES).map(([code, libelle]) => (
                            <option key={code} value={code}>{libelle}</option>
                        ))}
                    </select>
                    <span className="nc-aide">Votre évaluation : le responsable qualité la confirmera.</span>
                </div>

                <div className="nc-champ">
                    <label htmlFor="description">Description détaillée *</label>
                    <textarea
                        id="description"
                        rows={6}
                    
                        maxLength={5000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Que s'est-il passé ? Où, quand, comment l'avez-vous constaté ?"
                        required
                    />
                    <span className="nc-aide">{description.length} / 5000 caractères</span>
                </div>

                <fieldset className="nc-champ">
                    <legend>Pièces jointes (facultatives)</legend>

                    <label htmlFor="images">
                        Images : {images.length} / {MAX_IMAGES} (JPEG, PNG ou WebP)
                    </label>
                    <input
                        id="images"
                        type="file"
                        accept={TYPES_IMAGES.join(",")}
                        multiple
                        disabled={images.length >= MAX_IMAGES}
                        onChange={ajouterImages}
                    />

                    {images.length > 0 && (
                        <div className="nc-apercus">
                            {images.map((i) => (
                                <div className="nc-apercu" key={i.cle}>
                                    <img src={i.url} alt={i.file.name} />
                                    <button type="button" aria-label={`Retirer ${i.file.name}`}
                                        onClick={() => retirerImage(i.cle)}>×</button>
                                    <span title={i.file.name}>{i.file.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <label htmlFor="pdf">Document PDF (1 maximum)</label>
                    <input id="pdf" type="file" accept="application/pdf" onChange={choisirPdf} />
                    {pdf && (
                        <div className="nc-choisi">
                            <span>{pdf.name} ({formaterTaille(pdf.size)})</span>
                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                onClick={() => setPdf(null)}>Retirer</button>
                        </div>
                    )}

                    {erreurFichiers && <p className="nc-erreur" role="alert">{erreurFichiers}</p>}
                </fieldset>

                {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

                <div className="nc-actions">
                    <button type="submit" className="nc-btn" disabled={envoi}>
                        {envoi ? "Envoi en cours..." : "Enregistrer la déclaration"}
                    </button>
                </div>
            </form>
        </main>
    );
}