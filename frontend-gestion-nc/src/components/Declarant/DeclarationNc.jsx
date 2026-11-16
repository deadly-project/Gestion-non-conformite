import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import {
    GRAVITES, MAX_IMAGES, TAILLE_MAX_IMAGE, TAILLE_MAX_PDF, TYPES_IMAGES,
    dateAujourdhui, formaterTaille,
} from "../constantes";
import {
    FiPlus,
    FiCamera,
    FiX,
    FiTrash2,
    FiFileText,
    FiAlertTriangle,
    FiCalendar,
    FiUser,
    FiUpload,
    FiArrowLeft,
    FiCheckCircle,
    FiCameraOff,
    FiSearch,
} from "react-icons/fi";
import "./DeclarationNc.css";

const CODES_PROCESSUS_DISPONIBLES = [
    { code: "PRD", libelleType: "Production" },
    { code: "ACH", libelleType: "Achats" },
    { code: "RH", libelleType: "Ressources Humaines" },
    { code: "LOG", libelleType: "Logistique" },
    { code: "QSE", libelleType: "Qualité, Sécurité, Environnement" },
    { code: "MAI", libelleType: "Maintenance" },
];

function normaliser(texte) {
    return (texte ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function libelleOption(s) {
    const resume = s.description
        ? ` — ${s.description.replace(/\s+/g, " ").slice(0, 40)}${s.description.length > 40 ? "…" : ""}`
        : "";
    return `${s.libelle} (${s.code})${resume}`;
}

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
    const navigate = useNavigate();
    const [titre, setTitre] = useState("");
    const [dateDetection, setDateDetection] = useState(dateAujourdhui());
    const [gravite, setGravite] = useState("");
    const [description, setDescription] = useState("");
    const [images, setImages] = useState([]);
    const [pdf, setPdf] = useState(null);

    const [services, setServices] = useState([]);
    const [processusSelectionneId, setProcessusSelectionneId] = useState("");
    const [modeNouveauProcessus, setModeNouveauProcessus] = useState(false);
    const [rechercheProcessus, setRechercheProcessus] = useState("");

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

    const processusActifSelectionne = services.find((s) => s.id.toString() === processusSelectionneId);

    const termes = normaliser(rechercheProcessus).split(/\s+/).filter(Boolean);
    const servicesFiltres = services.filter((s) => {
        if (s.id.toString() === processusSelectionneId) return true;
        const texte = normaliser(`${s.code} ${s.libelle} ${s.description ?? ""}`);
        return termes.every((t) => texte.includes(t));
    });

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
                audio: false,
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
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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
        setTitre("");
        setDateDetection(dateAujourdhui());
        setProcessusSelectionneId("");
        setModeNouveauProcessus(false);
        setRechercheProcessus("");
        apiRequest("/api/referentiels/processus").then(setServices).catch(() => {});
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
                titre: titre.trim(),
                dateDetection,
                graviteDeclaree: gravite,
                descriptionDetaillee: description.trim(),
            };

            if (modeNouveauProcessus) {
                payload.nouveauProcessus = {
                    code: nouveauCode,
                    libelle: nouveauLibelle.trim(),
                    description: nouvelleDescription.trim(),
                };
            } else if (processusSelectionneId) {
                payload.processusId = Number(processusSelectionneId);
            } else {
                throw new Error("Veuillez sélectionner un processus existant ou en créer un nouveau.");
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
            <main className="dec-page">
                <div className="dec-succes-carte">
                    <div className="dec-succes-icone">
                        <FiCheckCircle />
                    </div>
                    <h1>Déclaration enregistrée</h1>
                    <p className="dec-succes-texte" role="status">
                        Votre non-conformité a bien été enregistrée
                        {cree.reference ? (
                            <> sous la référence <strong>{cree.reference}</strong></>
                        ) : (
                            <> sans référence</>
                        )}
                        . Le responsable qualité lui attribuera une référence lors de son traitement.
                    </p>
                    <button type="button" className="dec-btn" onClick={reinitialiser}>
                        <FiPlus /> Déclarer une autre non-conformité
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="dec-page">
            <div className="dec-header-titre">
                <h1>Déclarer une non-conformité</h1>
                <p className="dec-soustitre">
                    Remplissez les informations ci-dessous pour signaler un dysfonctionnement.
                </p>
            </div>

            <form className="dec-form" onSubmit={envoyer} noValidate>
                <div className="dec-grille">
                    <div className="dec-champ dec-champ-auteur">
                        <label htmlFor="auteur"><FiUser /> Auteur de la déclaration</label>
                        <div className="dec-input-auteur-wrap">
                            <span className="dec-input-auteur-icon" aria-hidden="true">
                                {utilisateur
                                    ? `${utilisateur.prenom?.[0] ?? ""}${utilisateur.nom?.[0] ?? ""}`.toUpperCase()
                                    : "?"}
                            </span>
                            <input
                                id="auteur"
                                className="dec-input-auteur"
                                readOnly
                                value={
                                    utilisateur
                                        ? `${utilisateur.prenom} ${utilisateur.nom} (matricule ${utilisateur.matricule})`
                                        : ""
                                }
                            />
                        </div>
                    </div>

                    <div className="dec-champ">
                        <label htmlFor="dateDetection"><FiCalendar /> Date de détection *</label>
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

                <div className="dec-champ dec-champ-titre">
                    <label htmlFor="titre"><FiFileText /> Titre de la non-conformité *</label>
                    <input
                        id="titre"
                        type="text"
                        value={titre}
                        maxLength={200}
                        onChange={(e) => setTitre(e.target.value)}
                        placeholder="Résumé clair en une phrase"
                        required
                    />
                </div>

                <fieldset className="dec-fieldset">
                    <legend>Processus / Service concerné *</legend>

                    {!modeNouveauProcessus ? (
                        <div className="dec-processus-conteneur">
                            <div className="dec-recherche-wrapper">
                                <FiSearch className="dec-search-icon" aria-hidden="true" />
                                <input
                                    type="search"
                                    className="dec-input-recherche"
                                    value={rechercheProcessus}
                                    onChange={(e) => setRechercheProcessus(e.target.value)}
                                    placeholder="Rechercher un processus (code, libellé, description)…"
                                    aria-label="Rechercher un processus existant"
                                />
                            </div>

                            <div className="dec-select-action-ligne">
                                <select
                                    value={processusSelectionneId}
                                    onChange={(e) => setProcessusSelectionneId(e.target.value)}
                                    className="dec-select"
                                    aria-label="Sélectionner un processus existant"
                                >
                                    <option value="">
                                        {termes.length > 0
                                            ? `${servicesFiltres.length} résultat${servicesFiltres.length > 1 ? "s" : ""}`
                                            : "Sélectionner un processus…"}
                                    </option>
                                    {servicesFiltres.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {libelleOption(s)}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="dec-btn dec-btn-secondaire"
                                    onClick={() => setModeNouveauProcessus(true)}
                                >
                                    <FiPlus /> Nouveau processus
                                </button>
                            </div>

                            {processusActifSelectionne && (
                                <div className="dec-processus-selectionne-info">
                                    <div>
                                        <strong>{processusActifSelectionne.libelle}</strong>{" "}
                                        ({processusActifSelectionne.code})
                                        <div className="dec-processus-desc">
                                            {formaterDescriptionProcessus(processusActifSelectionne.description)}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="dec-btn dec-btn-secondaire dec-btn-petit"
                                        onClick={() => setProcessusSelectionneId("")}
                                        aria-label="Désélectionner le processus"
                                    >
                                        Désélectionner
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="dec-nouveau-processus-bloc">
                            <button
                                type="button"
                                className="dec-btn dec-btn-secondaire dec-btn-retour"
                                onClick={() => setModeNouveauProcessus(false)}
                            >
                                <FiArrowLeft /> Retour à la liste existante
                            </button>

                            <div className="dec-champ">
                                <label htmlFor="codeProcessus">Code du processus *</label>
                                <select
                                    id="codeProcessus"
                                    value={nouveauCode}
                                    onChange={(e) => setNouveauCode(e.target.value)}
                                    className="dec-select"
                                >
                                    {CODES_PROCESSUS_DISPONIBLES.map((c) => (
                                        <option key={c.code} value={c.code}>
                                            {c.code} — {c.libelleType}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <span className="dec-aide" id="aide-code-processus">
                                Un même code peut être utilisé pour plusieurs processus, à condition que la
                                description (ou le libellé) soit différente. Vérifiez d'abord, avec la recherche,
                                que le processus n'existe pas déjà.
                            </span>

                            <div className="dec-champ">
                                <label htmlFor="libelleProcessus">Libellé du processus *</label>
                                <input
                                    id="libelleProcessus"
                                    type="text"
                                    value={nouveauLibelle}
                                    onChange={(e) => setNouveauLibelle(e.target.value)}
                                    placeholder="Ex : Ligne d'assemblage principale"
                                    required
                                />
                            </div>

                            <div className="dec-champ">
                                <label htmlFor="descProcessus">Description du processus</label>
                                <textarea
                                    id="descProcessus"
                                    value={nouvelleDescription}
                                    onChange={(e) => setNouvelleDescription(e.target.value)}
                                    placeholder="Détails sur ce processus…"
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}
                </fieldset>

                <div className="dec-champ">
                    <label htmlFor="gravite"><FiAlertTriangle /> Gravité *</label>
                    <select
                        id="gravite"
                        value={gravite}
                        onChange={(e) => setGravite(e.target.value)}
                        required
                        className="dec-select"
                        aria-describedby="aide-gravite"
                    >
                        <option value="">Sélectionner une gravité…</option>
                        {Object.entries(GRAVITES).map(([code, libelle]) => (
                            <option key={code} value={code}>{libelle}</option>
                        ))}
                    </select>
                    <span className="dec-aide" id="aide-gravite">
                        Votre évaluation indicative : le responsable qualité la confirmera.
                    </span>
                </div>

                <div className="dec-champ">
                    <label htmlFor="description"><FiFileText /> Description détaillée *</label>
                    <textarea
                        id="description"
                        rows={6}
                        maxLength={5000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Que s'est-il passé ? Où, quand, comment l'avez-vous constaté ?"
                        required
                        aria-describedby="compteur-description"
                    />
                    <div className="dec-compteur-caracteres" id="compteur-description">
                        {description.length} / 5000 caractères
                    </div>
                </div>

                <fieldset className="dec-fieldset">
                    <legend><FiUpload /> Pièces jointes (facultatives)</legend>

                    <div className="dec-fichiers-grid">
                        <div className="dec-champ-upload">
                            <label htmlFor="upload-images">Importer des images (max {MAX_IMAGES})</label>
                            <input
                                id="upload-images"
                                type="file"
                                accept={TYPES_IMAGES.join(",")}
                                multiple
                                disabled={images.length >= MAX_IMAGES || cameraActive}
                                onChange={ajouterImages}
                                className="dec-file-input"
                            />
                        </div>
                        <div className="dec-champ-upload">
                            <label>Caméra en direct</label>
                            {!cameraActive ? (
                                <button
                                    type="button"
                                    className="dec-btn dec-btn-secondaire dec-btn-plein"
                                    disabled={images.length >= MAX_IMAGES}
                                    onClick={demarrerCamera}
                                >
                                    <FiCamera /> Ouvrir la caméra
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="dec-btn dec-btn-danger-clair dec-btn-plein"
                                    onClick={arreterCamera}
                                >
                                    <FiCameraOff /> Fermer la caméra
                                </button>
                            )}
                        </div>
                    </div>

                    {cameraActive && (
                        <div className="dec-camera-box">
                            <video ref={videoRef} autoPlay playsInline />
                            <div className="dec-camera-actions">
                                <button type="button" className="dec-btn" onClick={capturerPhoto}>
                                    <FiCamera /> Capturer la photo
                                </button>
                            </div>
                        </div>
                    )}

                    <div
                        className="dec-info-compteur"
                        role="status"
                        aria-live="polite"
                    >
                        <FiUpload aria-hidden="true" />
                        Total actuel : {images.length} / {MAX_IMAGES} images
                    </div>

                    {images.length > 0 && (
                        <div className="dec-apercus">
                            {images.map((i) => (
                                <div className="dec-apercu-item" key={i.cle}>
                                    <img src={i.url} alt={i.file.name} />
                                    <button
                                        type="button"
                                        aria-label={`Retirer ${i.file.name}`}
                                        onClick={() => retirerImage(i.cle)}
                                    >
                                        <FiX />
                                    </button>
                                    <span title={i.file.name}>{i.file.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="dec-champ" style={{ marginTop: "1.25rem" }}>
                        <label htmlFor="pdf"><FiFileText /> Document PDF (1 maximum)</label>
                        <input
                            id="pdf"
                            type="file"
                            accept="application/pdf"
                            onChange={choisirPdf}
                            className="dec-file-input"
                        />
                        {pdf && (
                            <div className="dec-pdf-choisi">
                                <span><FiFileText /> {pdf.name} ({formaterTaille(pdf.size)})</span>
                                <button
                                    type="button"
                                    className="dec-btn dec-btn-secondaire dec-btn-petit"
                                    onClick={() => setPdf(null)}
                                >
                                    <FiTrash2 /> Retirer
                                </button>
                            </div>
                        )}
                    </div>

                    {erreurFichiers && (
                        <p className="dec-alerte-erreur" role="alert">{erreurFichiers}</p>
                    )}
                </fieldset>

                {erreur && <p className="dec-alerte-erreur" role="alert">{erreur}</p>}

                <div className="dec-actions-submit">
                    <button type="submit" className="dec-btn dec-btn-principal" disabled={envoi}>
                        {envoi ? "Envoi en cours…" : "Enregistrer la déclaration"}
                    </button>
                </div>
            </form>
        </main>
    );
}