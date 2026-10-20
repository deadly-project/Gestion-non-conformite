import { useEffect, useState } from "react";
import { apiBlob, apiRequest } from "../../api/api";
import Modal from "../Modal";
import { GRAVITES, STATUTS_NC, formaterDate, formaterTaille, nomComplet } from "../constantes";

export default function VisualisationNcModal({ ncId, onFermer }) {
    const [detail, setDetail] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");

    useEffect(() => {
        apiRequest(`/api/non-conformites/${ncId}`)
            .then((d) => setDetail(d))
            .catch((e) => setErreur(e.message || "Impossible de charger le contexte."))
            .finally(() => setChargement(false));
    }, [ncId]);

    async function ouvrirPieceJointe(piece) {
        try {
            const blob = await apiBlob(`/api/non-conformites/pieces-jointes/${piece.id}`);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            setErreur(error.message);
        }
    }

    return (
        <Modal titre={detail ? `Contexte : ${detail.reference} — ${detail.titre}` : "Visualisation de la non-conformité"} onFermer={onFermer}>
            {chargement && <p>Chargement...</p>}
            {erreur && <p className="nc-erreur">{erreur}</p>}
            {detail && (
                <section className="nc-section" aria-labelledby="t-resume">
                    <dl className="nc-resume">
                        <div><dt>Auteur</dt><dd>M°: {detail.declarant?.matricule}: {nomComplet(detail.declarant)}</dd></div>
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
                        <div style={{ marginTop: "1rem" }}>
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
            )}
        </Modal>
    );
}