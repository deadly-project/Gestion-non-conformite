import { useEffect, useState } from "react";
import { apiRequest } from "../../api/api";
import Modal from "../Modal";
import {
    STATUTS_NC, STATUTS_ACTION, TYPES_ACTION, formaterDate, nomComplet,
} from "../constantes";

/**
 * Fenêtre « Avancement » : pour l'instant, présente la structure à venir.
 * Pour chaque action du plan, les constats et commentaires seront affichés (fonctionnalité à développer).
 */
export default function AvancementNcModal({ ncId, onFermer }) {
    const [detail, setDetail] = useState(null);
    const [erreur, setErreur] = useState("");

    useEffect(() => {
        let actif = true;
        apiRequest(`/api/non-conformites/${ncId}`)
            .then((d) => { if (actif) setDetail(d); })
            .catch((e) => { if (actif) setErreur(e.message || "Chargement impossible."); });
        return () => { actif = false; };
    }, [ncId]);

    return (
        <Modal
            titre={detail ? `Avancement : ${detail.reference}` : "Avancement"}
            onFermer={onFermer}
            largeur="moyen"
            pied={<div className="nc-actions">
                <button type="button" className="nc-btn" onClick={onFermer}>Fermer</button>
            </div>}
        >
            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}
            {!detail && !erreur && <p>Chargement...</p>}

            {detail && (
                <>
                    <p className="nc-info">
                        Cette partie est en cours de développement. Elle affichera, pour chaque action
                        du plan, les <strong>constats</strong> d'audit et les <strong>commentaires</strong>
                        {" "}des responsables.
                    </p>

                    <dl className="nc-resume">
                        <div><dt>Titre</dt><dd>{detail.titre}</dd></div>
                        <div><dt>Statut</dt><dd>{STATUTS_NC[detail.statut] ?? detail.statut}</dd></div>
                        <div><dt>Échéance</dt><dd>{formaterDate(detail.dateEcheance) || "Non définie"}</dd></div>
                    </dl>

                    <h3>Actions du plan de traitement</h3>
                    {detail.etapesCapa.length === 0 && (
                        <p className="nc-aide">Aucune action définie pour l'instant.</p>
                    )}

                    {detail.etapesCapa.map((etape, index) => (
                        <section className="nc-section" key={etape.id}>
                            <h3>
                                Étape {index + 1} : {TYPES_ACTION[etape.type] ?? etape.type}
                                {" "}({STATUTS_ACTION[etape.statut] ?? etape.statut})
                            </h3>
                            <p>{etape.description}</p>
                            <p className="nc-aide">
                                Responsable : {nomComplet(etape.responsable)} — échéance {formaterDate(etape.dateEcheance)}
                            </p>
                            <div className="nc-bientot">Constats : à venir</div>
                            <div className="nc-bientot">Commentaires : à venir</div>
                        </section>
                    ))}
                </>
            )}
        </Modal>
    );
}