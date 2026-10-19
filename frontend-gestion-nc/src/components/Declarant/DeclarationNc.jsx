import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/api";
import {
    GRAVITES, MAX_IMAGES, TAILLE_MAX_IMAGE, TAILLE_MAX_PDF, TYPES_IMAGES,
    dateAujourdhui, formaterTaille,
} from "../constantes";
import "./nc.css";

const CODES_PROCESSUS_DISPONIBLES = [
    { code: "PRD", libelleType: "Production" },
    { code: "ACH", libelleType: "Achats" },
    { code: "RH", libelleType: "Ressources Humaines" },
    { code: "LOG", libelleType: "Logistique" },
    { code: "QSE", libelleType: "Qualité, Sécurité, Environnement" },
    { code: "MAI", libelleType: "Maintenance" },
];

function formaterDescriptionProcessus(description) {
    if (!description) return "Aucune description";
    const matchPoint = description.match(/^.*?\./);
    if (matchPoint && matchPoint[0].split(/\s+/).length <= 30) {
        return matchPoint[0];
    }
    const mots = description.split(/\s+/);
    if (mots.length > 30) {
        return mots.slice(0, 30).join(" ") + "...";
    }
    return description;
}

export default function DeclarationNc({ utilisateur }) {
    const [reference, setReference] = useState("");
    const [titre, setTitre] = useState("");
    const [dateDetection, setDateDetection] = useState(dateAujourdhui());
    const [gravite, setGravite] = useState("");
    const [description, setDescription] = useState("");
    const [images, setImages] = useState([]);
    const [pdf, setPdf] = useState(null);

    const [services, setServices] = useState([]);
    const [processusSelectionneId, setProcessusSelectionneId] = useState("");
    const [modeNouveauProcessus, setModeNouveauProcessus] = useState(false);
    
    const [nouveauCode, setNouveauCode] = useState("PRD");
    const [nouveauLibelle, setNouveauLibelle] = useState("");
    const [nouvelleDescription, setNouvelleDescription] = useState("");

    const [erreur, setErreur] = useState("");
    const [erreurFichiers, setErreurFichiers] = useState("");
    const [envoi, setEnvoi] = useState(false);
    const [cree, setCree] = useState(null);

    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef(null);
    const mediaStreamRef = useRef(null);

    const imagesRef = useRef([]);
    useEffect(() => { imagesRef.current = images; }, [images]);
    
    useEffect(() => {
        return () => {
            imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url));
            arreterCamera();
        };
    }, []);

    useEffect(() => {
        let actif = true;
        apiRequest("/api/referentiels/processus")
            .then((donnees) => { if (actif) setServices(donnees); })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les services."); });
        return () => { actif = false; };
    }, []);

    const processusActifSelectionne = services.find(s => s.id.toString() === processusSelectionneId);

    function gererFichiersImages(fichiersBruts) {
        const fichiers = Array.from(fichiersBruts || []);
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

        const placeRestante = Math.max(MAX_IMAGES - images.length, 0);
        if (acceptes.length > placeRestante) {
            message = `Maximum ${MAX_IMAGES} images au total : seules les premières ont été ajoutées.`;
        }

        const nouvelles = acceptes.slice(0, placeRestante).map((file) => ({
            cle: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
            file,
            url: URL.createObjectURL(file),
        }));

        setImages((precedentes) => [...precedentes, ...nouvelles]);
        setErreurFichiers(message);
    }

    function ajouterImages(event) {
        gererFichiersImages(event.target.files);
        event.target.value = "";
    }

    async function demarrerCamera() {
        if (images.length >= MAX_IMAGES) {
            setErreurFichiers(`Maximum ${MAX_IMAGES} images atteint.`);
            return;
        }
        setErreurFichiers("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" }, 
                audio: false 
            });
            mediaStreamRef.current = stream;
            setCameraActive(true);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            setErreurFichiers("Impossible d'accéder à la caméra (permission refusée ou non disponible).");
        }
    }

    function arreterCamera() {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setCameraActive(false);
    }

    function capturerPhoto() {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) {
                setErreurFichiers("Erreur lors de la capture de la photo.");
                return;
            }
            const fichier = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
            gererFichiersImages([fichier]);
            arreterCamera();
        }, "image/jpeg", 0.90);
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
        arreterCamera();
        setReference("");
        setTitre("");
        setDateDetection(dateAujourdhui());
        setProcessusSelectionneId("");
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
        arreterCamera();
        setErreur("");
        setEnvoi(true);

        try {
            const formData = new FormData();
            
            const payload = {
                reference: reference.trim() !== "" ? reference.trim() : null,
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
            } else if (processusSelectionneId) {
                payload.processusId = Number(processusSelectionneId);
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
                        <label htmlFor="reference">Référence (Facultative)</label>
                        <input 
                            id="reference" 
                            value={reference} 
                            onChange={(e) => setReference(e.target.value)} 
                            placeholder="Laisser vide pour génération automatique"
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

                <fieldset className="nc-champ" style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "5px" }}>
                    <legend>Processus / Service concerné *</legend>

                    {!modeNouveauProcessus ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                <select 
                                    value={processusSelectionneId} 
                                    onChange={(e) => setProcessusSelectionneId(e.target.value)}
                                    style={{ flex: 1, padding: "8px" }}
                                >
                                    <option value="">— Sélectionnez un processus existant —</option>
                                    {services.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.libelle} ({s.code})
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    type="button" 
                                    className="nc-btn nc-btn-secondaire"
                                    onClick={() => setModeNouveauProcessus(true)}
                                >
                                    + Nouveau processus
                                </button>
                            </div>

                            {processusActifSelectionne && (
                                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <strong>{processusActifSelectionne.libelle}</strong> ({processusActifSelectionne.code})
                                        <div style={{ fontSize: "0.85em", color: "#555", marginTop: "4px" }}>
                                            {formaterDescriptionProcessus(processusActifSelectionne.description)}
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="nc-btn nc-btn-secondaire nc-btn-petit"
                                        onClick={() => setProcessusSelectionneId("")}
                                    >
                                        Désélectionner
                                    </button>
                                </div>
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
                                ← Retour à la liste existante
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

                    <div style={{ display: "flex", gap: "15px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label htmlFor="upload-images">Importer des images (Max {MAX_IMAGES})</label>
                            <input
                                id="upload-images"
                                type="file"
                                accept={TYPES_IMAGES.join(",")}
                                multiple
                                disabled={images.length >= MAX_IMAGES || cameraActive}
                                onChange={ajouterImages}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label>Caméra en direct</label>
                            {!cameraActive ? (
                                <button 
                                    type="button" 
                                    className="nc-btn nc-btn-secondaire" 
                                    style={{ width: "100%", marginTop: "4px" }}
                                    disabled={images.length >= MAX_IMAGES}
                                    onClick={demarrerCamera}
                                >
                                    📷 Ouvrir la caméra
                                </button>
                            ) : (
                                <button 
                                    type="button" 
                                    className="nc-btn nc-btn-secondaire" 
                                    style={{ width: "100%", marginTop: "4px", background: "#fee2e2", color: "#991b1b" }}
                                    onClick={arreterCamera}
                                >
                                    Fermer la caméra
                                </button>
                            )}
                        </div>
                    </div>

                    {cameraActive && (
                        <div style={{ margin: "15px 0", textAlign: "center", background: "#000", padding: "10px", borderRadius: "6px" }}>
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                style={{ width: "100%", maxHeight: "300px", objectFit: "contain" }} 
                            />
                            <div style={{ marginTop: "10px" }}>
                                <button 
                                    type="button" 
                                    className="nc-btn" 
                                    onClick={capturerPhoto}
                                >
                                    📸 Capturer la photo
                                </button>
                            </div>
                        </div>
                    )}

                    <small style={{ color: "#666" }}>Total actuel : {images.length} / {MAX_IMAGES} images</small>

                    {images.length > 0 && (
                        <div className="nc-apercus" style={{ marginTop: "10px" }}>
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

                    <div style={{ marginTop: "15px" }}>
                        <label htmlFor="pdf">Document PDF (1 maximum)</label>
                        <input id="pdf" type="file" accept="application/pdf" onChange={choisirPdf} />
                        {pdf && (
                            <div className="nc-choisi">
                                <span>{pdf.name} ({formaterTaille(pdf.size)})</span>
                                <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                                    onClick={() => setPdf(null)}>Retirer</button>
                            </div>
                        )}
                    </div>

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