import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBlob, apiRequest } from "../../api/api";
import Modal from "../Modal";
import ConstatsAudit from "../Auditeur/ConstatsAudit";
import {
    RESULTATS_TRAITEMENT, STATUTS_AUDIT, TYPES_AUDIT, formaterDateHeure, nomPersonne,
} from "../Auditeur/libelles";
import { STATUTS_ACTION, TYPES_ACTION, formaterDate } from "../constantes";
import {
    FaChartLine, FaCircleInfo, FaTriangleExclamation, FaArrowRightLong,
    FaClipboardList, FaComments, FaFileLines, FaCalendarDays, FaUserCheck,
    FaSpinner, FaXmark, FaLocationArrow,
} from "react-icons/fa6";
import "../Auditeur/audits.css";
import "./SuiviCapaPage.css";
import "./AvancementNcModal.css";

export default function AvancementNcModal({ ncId, onFermer }) {
    const navigate = useNavigate();
    const [suivi, setSuivi] = useState(null);
    const [erreur, setErreur] = useState("");

    useEffect(() => {
        let actif = true;
        apiRequest(`/api/capa/nc/${ncId}/suivi`)
            .then((d) => { if (actif) setSuivi(d); })
            .catch((e) => { if (actif) setErreur(e.message || "Chargement impossible."); });
        return () => { actif = false; };
    }, [ncId]);

    async function ouvrirPieceJointe(piece) {
        try {
            const blob = await apiBlob(`/api/audits/pieces-jointes/${piece.id}`);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            setErreur(error.message || "Impossible d'ouvrir la pièce jointe.");
        }
    }

    function ouvrirSuivi(etapeId) {
        onFermer();
        navigate(`/responsable/nc/${ncId}/suivi${etapeId ? `?etape=${etapeId}` : ""}`);
    }

    const pied = suivi && (
        <div className="AV-pied">
            <button type="button" className="AV-btn AV-btn--primaire" onClick={() => ouvrirSuivi(null)}>
                <FaArrowRightLong /> Ouvrir le suivi terrain
            </button>
            <button type="button" className="AV-btn AV-btn--secondaire" onClick={onFermer}>
                <FaXmark /> Fermer
            </button>
        </div>
    );

    return (
        <Modal
            titre={suivi ? `Avancement : ${suivi.reference || "référence non attribuée"}` : "Avancement"}
            onFermer={onFermer}
            largeur="large"
            pied={pied}
        >
            {erreur && (
                <div className="AV-alerte AV-alerte--erreur">
                    <FaTriangleExclamation />
                    <span>{erreur}</span>
                </div>
            )}

            {!suivi && !erreur && (
                <div className="AV-chargement">
                    <FaSpinner className="AV-spin" /> Chargement...
                </div>
            )}

            {suivi && (
                <div className="AV-contenu">
                    {/* ---- Résumé ---- */}
                    <section className="AV-resume">
                        <header className="AV-resume-entete">
                            <FaChartLine className="AV-resume-icone" />
                            <h3>Résumé</h3>
                        </header>
                        <dl className="AV-resume-grille">
                            <div>
                                <dt>Titre</dt>
                                <dd>{suivi.titre}</dd>
                            </div>
                            <div>
                                <dt>Statut</dt>
                                <dd><span className={`nc-badge nc-badge-${suivi.statut}`}>{suivi.statut}</span></dd>
                            </div>
                            <div>
                                <dt>Progression</dt>
                                <dd>
                                    <div className="AV-progress">
                                        <div
                                            className="AV-progress-barre"
                                            style={{
                                                width: `${suivi.nbEtapes ? (suivi.nbValidees / suivi.nbEtapes) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                    <span className="AV-progress-texte">
                                        {suivi.nbValidees} / {suivi.nbEtapes} étape(s) validée(s)
                                    </span>
                                </dd>
                            </div>
                        </dl>
                    </section>

                    {suivi.etapes.length === 0 && (
                        <div className="AV-alerte AV-alerte--info">
                            <FaCircleInfo />
                            <span>Aucune action CAPA définie pour l'instant.</span>
                        </div>
                    )}

                    {/* ---- Étapes ---- */}
                    <div className="AV-etapes">
                        {suivi.etapes.map((etape) => {
                            const constats = etape.audits.flatMap((a) => a.constats || []);
                            return (
                                <section className="AV-etape" key={etape.id}>
                                    <header className="AV-etape-entete">
                                        <div>
                                            <span className="AV-etape-numero">Étape {etape.numero}</span>
                                            <h3>{TYPES_ACTION[etape.type] ?? etape.type}</h3>
                                        </div>
                                        <span className={`AV-badge AV-badge--${etape.statut}`}>
                                            {STATUTS_ACTION[etape.statut] ?? etape.statut}
                                        </span>
                                    </header>

                                    <p className="AV-etape-description">{etape.description}</p>

                                    <div className="AV-etape-meta">
                                        <span><FaUserCheck /> {nomPersonne(etape.responsable)}</span>
                                        <span><FaCalendarDays /> Échéance : {formaterDate(etape.dateEcheance)}</span>
                                    </div>

                                    <button
                                        type="button"
                                        className="AV-btn AV-btn--secondaire AV-btn--petit"
                                        onClick={() => ouvrirSuivi(etape.id)}
                                    >
                                        <FaLocationArrow /> Ouvrir le suivi de cette étape
                                    </button>

                                    {/* ---- Audits ---- */}
                                    {etape.audits.length === 0 ? (
                                        <p className="AV-vide">Aucun audit planifié pour cette étape.</p>
                                    ) : (
                                        <div className="AV-audits">
                                            {etape.audits.map((audit) => (
                                                <article className="AV-audit" key={audit.id}>
                                                    <header className="AV-audit-entete">
                                                        <strong>Audit du {formaterDate(audit.date)}</strong>
                                                        <span className={`aud-badge aud-badge--${audit.statut}`}>
                                                            {STATUTS_AUDIT[audit.statut] ?? audit.statut}
                                                        </span>
                                                        <span className="AV-audit-type">
                                                            {(TYPES_AUDIT[audit.typeAudit] ?? audit.typeAudit ?? "").toLowerCase()} · {nomPersonne(audit.auditeur)}
                                                        </span>
                                                        {audit.resultatTraitement && (
                                                            <span className={`aud-badge aud-badge--${audit.resultatTraitement}`}>
                                                                {RESULTATS_TRAITEMENT[audit.resultatTraitement]}
                                                            </span>
                                                        )}
                                                    </header>

                                                    {audit.compteRendu && (
                                                        <div className="AV-texte">
                                                            <h4><FaFileLines /> Compte rendu de l'audit</h4>
                                                            <p>{audit.compteRendu}</p>
                                                        </div>
                                                    )}
                                                    {audit.traitementRealise && (
                                                        <div className="AV-texte">
                                                            <h4><FaClipboardList /> Traitement constaté sur le terrain</h4>
                                                            <p>{audit.traitementRealise}</p>
                                                        </div>
                                                    )}

                                                    <h4 className="AV-constats-titre">
                                                        <FaComments /> Constats ({audit.constats.length})
                                                    </h4>
                                                    <ConstatsAudit
                                                        constats={audit.constats}
                                                        onOuvrirPieceJointe={ouvrirPieceJointe}
                                                    />
                                                </article>
                                            ))}
                                        </div>
                                    )}

                                    <footer className="AV-etape-pied">
                                        <span className="AV-aide">
                                            {constats.length} constat(s) consultable(s) en lecture seule dans le suivi terrain.
                                        </span>
                                        <span className="AV-aide">
                                            Dernière mise à jour : {formaterDateHeure(etape.dateVerification) || "—"}
                                        </span>
                                    </footer>
                                </section>
                            );
                        })}
                    </div>
                </div>
            )}
        </Modal>
    );
}