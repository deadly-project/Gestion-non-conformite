import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBlob, apiRequest } from "../../api/api";
import Modal from "../Modal";
import { GRAVITES, STATUTS_NC, formaterDate, formaterTaille, nomComplet } from "../constantes";
import {
    FaHashtag, FaUser, FaCalendarDays, FaBuilding, FaTriangleExclamation,
    FaCircleInfo, FaPaperclip, FaFilePdf, FaImage, FaMagnifyingGlassPlus,
    FaXmark, FaListCheck, FaShieldHalved, FaArrowsRotate, FaSpinner,
} from "react-icons/fa6";
import "./VisualisationNcModal.css";

export default function VisualisationNcModal({
    ncId, onFermer, onOuvrirTraitement, actionsResponsable = true,
}) {
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");

    // Lightbox pour les images
    const [lightbox, setLightbox] = useState(null); // { url, nom }
    const [zoome, setZoome] = useState(false);

    // URL des miniatures images (blob chargé à la demande)
    const [miniatures, setMiniatures] = useState({}); // { [pieceId]: urlBlob }

    useEffect(() => {
        apiRequest(`/api/non-conformites/${ncId}`)
            .then((d) => setDetail(d))
            .catch((e) => setErreur(e.message || "Impossible de charger le contexte."))
            .finally(() => setChargement(false));
    }, [ncId]);

    // Charge les miniatures des images dès qu'on a le détail
    useEffect(() => {
        if (!detail?.piecesJointes) return;
        const images = detail.piecesJointes.filter((p) => p.type !== "PDF");
        let annule = false;
        const urlsCrees = [];

        Promise.all(
            images.map(async (p) => {
                try {
                    const blob = await apiBlob(`/api/non-conformites/pieces-jointes/${p.id}`);
                    const url = URL.createObjectURL(blob);
                    urlsCrees.push(url);
                    return [p.id, url];
                } catch {
                    return [p.id, null];
                }
            })
        ).then((resultats) => {
            if (annule) return;
            const obj = {};
            resultats.forEach(([id, url]) => {
                if (url) obj[id] = url;
            });
            setMiniatures(obj);
        });

        return () => {
            annule = true;
            urlsCrees.forEach((u) => URL.revokeObjectURL(u));
        };
    }, [detail]);

    function ouvrirPdf(piece) {
        // PDF : ouverture dans un nouvel onglet (comportement classique)
        apiBlob(`/api/non-conformites/pieces-jointes/${piece.id}`)
            .then((blob) => {
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank", "noopener");
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            })
            .catch((e) => setErreur(e.message));
    }

    function ouvrirLightbox(piece) {
        const url = miniatures[piece.id];
        if (!url) return;
        setZoome(false);
        setLightbox({ url, nom: piece.nomOriginal });
    }

    const piedModal = (
        <div className="VM-pied">
            {detail && actionsResponsable && (
                <>
                    <button
                        type="button"
                        className="VM-btn VM-btn--primaire"
                        disabled={detail.statut === "CLOTUREE"}
                        onClick={() => onOuvrirTraitement && onOuvrirTraitement(ncId)}
                    >
                        <FaListCheck /> Traitement
                    </button>
                    <button
                        type="button"
                        className="VM-btn VM-btn--secondaire"
                        onClick={() => { onFermer(); navigate(`/responsable/nc/${ncId}/capa`); }}
                    >
                        <FaShieldHalved /> CAPA
                    </button>
                    <button
                        type="button"
                        className="VM-btn VM-btn--secondaire"
                        onClick={() => { onFermer(); navigate(`/responsable/nc/${ncId}/analyse`); }}
                    >
                        <FaArrowsRotate /> Analyse
                    </button>
                </>
            )}
            <button type="button" className="VM-btn VM-btn--secondaire" onClick={onFermer}>
                <FaXmark /> Fermer
            </button>
        </div>
    );

    return (
        <>
            <Modal
                titre={
                    detail
                        ? `Contexte : ${detail.reference || "référence non attribuée"} — ${detail.titre}`
                        : "Visualisation de la non-conformité"
                }
                onFermer={onFermer}
                pied={piedModal}
            >
                {chargement && (
                    <div className="VM-chargement">
                        <FaSpinner className="VM-spin" /> Chargement...
                    </div>
                )}

                {erreur && (
                    <div className="VM-alerte VM-alerte--erreur">
                        <FaTriangleExclamation /> <span>{erreur}</span>
                    </div>
                )}

                {detail && (
                    <div className="VM-contenu">
                        {/* ---- En-tête avec statut en badge ---- */}
                        <header className="VM-entete">
                            <div className="VM-entete-titre">
                                <h2>{detail.titre}</h2>
                                <p className="VM-entete-ref">
                                    <FaHashtag /> {detail.reference || <em>En attente d'attribution</em>}
                                </p>
                            </div>
                            <span className={`VM-badge VM-badge--${detail.statut}`}>
                                {STATUTS_NC[detail.statut] ?? detail.statut}
                            </span>
                        </header>

                        {/* ---- Grille d'informations ---- */}
                        <section className="VM-info">
                            <div className="VM-info-item">
                                <FaUser className="VM-icone" />
                                <div>
                                    <dt>Auteur</dt>
                                    <dd>
                                        {detail.declarant
                                            ? `M° ${detail.declarant.matricule} — ${nomComplet(detail.declarant)}`
                                            : "—"}
                                    </dd>
                                </div>
                            </div>

                            <div className="VM-info-item">
                                <FaCalendarDays className="VM-icone" />
                                <div>
                                    <dt>Date de détection</dt>
                                    <dd>{formaterDate(detail.dateDetection)}</dd>
                                </div>
                            </div>

                            <div className="VM-info-item">
                                <FaBuilding className="VM-icone" />
                                <div>
                                    <dt>Service concerné</dt>
                                    <dd>{detail.service?.libelle || "—"}</dd>
                                </div>
                            </div>

                            <div className="VM-info-item">
                                <FaTriangleExclamation className="VM-icone VM-icone--gravite" />
                                <div>
                                    <dt>Gravité déclarée</dt>
                                    <dd>
                                        <span className={`VM-badge VM-badge--gravite-${detail.graviteDeclaree}`}>
                                            {GRAVITES[detail.graviteDeclaree] ?? detail.graviteDeclaree ?? "—"}
                                        </span>
                                    </dd>
                                </div>
                            </div>
                        </section>

                        {/* ---- Description ---- */}
                        <section className="VM-section">
                            <header className="VM-section-entete">
                                <FaCircleInfo className="VM-icone" />
                                <h3>Description</h3>
                            </header>
                            <p className="VM-description">{detail.descriptionDetaillee || "—"}</p>
                        </section>

                        {/* ---- Pièces jointes ---- */}
                        {detail.piecesJointes.length > 0 && (
                            <section className="VM-section">
                                <header className="VM-section-entete">
                                    <FaPaperclip className="VM-icone" />
                                    <h3>Pièces jointes ({detail.piecesJointes.length})</h3>
                                </header>

                                <div className="VM-pj-grille">
                                    {detail.piecesJointes.map((p) => {
                                        const estImage = p.type !== "PDF";
                                        const url = miniatures[p.id];

                                        return estImage ? (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className="VM-pj VM-pj--image"
                                                onClick={() => ouvrirLightbox(p)}
                                                title={`Agrandir ${p.nomOriginal}`}
                                            >
                                                <div className="VM-pj-apercu">
                                                    {url ? (
                                                        <img src={url} alt={p.nomOriginal} loading="lazy" />
                                                    ) : (
                                                        <div className="VM-pj-apercu-vide">
                                                            <FaSpinner className="VM-spin" />
                                                        </div>
                                                    )}
                                                    <span className="VM-pj-zoom">
                                                        <FaMagnifyingGlassPlus />
                                                    </span>
                                                </div>
                                                <div className="VM-pj-meta">
                                                    <FaImage className="VM-pj-icone" />
                                                    <span className="VM-pj-nom">{p.nomOriginal}</span>
                                                    <span className="VM-pj-taille">{formaterTaille(p.taille)}</span>
                                                </div>
                                            </button>
                                        ) : (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className="VM-pj VM-pj--pdf"
                                                onClick={() => ouvrirPdf(p)}
                                                title={`Ouvrir ${p.nomOriginal}`}
                                            >
                                                <div className="VM-pj-apercu VM-pj-apercu--pdf">
                                                    <FaFilePdf className="VM-pj-pdf-icone" />
                                                </div>
                                                <div className="VM-pj-meta">
                                                    <FaFilePdf className="VM-pj-icone VM-pj-icone--pdf" />
                                                    <span className="VM-pj-nom">{p.nomOriginal}</span>
                                                    <span className="VM-pj-taille">{formaterTaille(p.taille)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </Modal>

            {/* ---- Lightbox (dans la même fenêtre) ---- */}
            {lightbox && (
                <div
                    className="VM-lightbox"
                    onClick={() => setLightbox(null)}
                    role="dialog"
                    aria-modal="true"
                >
                    <button
                        type="button"
                        className="VM-lightbox-fermer"
                        onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
                        aria-label="Fermer"
                    >
                        <FaXmark />
                    </button>
                    <img
                        src={lightbox.url}
                        alt={lightbox.nom}
                        className={zoome ? "VM-lightbox-img VM-lightbox-img--zoome" : "VM-lightbox-img"}
                        onClick={(e) => { e.stopPropagation(); setZoome((z) => !z); }}
                    />
                </div>
            )}
        </>
    );
}