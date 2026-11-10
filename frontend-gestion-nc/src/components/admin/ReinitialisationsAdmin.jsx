import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";
import { 
    FiRefreshCw, 
    FiCheckCircle, 
    FiAlertTriangle, 
    FiClock, 
    FiShield, 
    FiHash, 
    FiCheck, 
    FiX 
} from "react-icons/fi";
import "./ReinitialisationsAdmin.css";

const TOPIC = "/topic/admin/reinitialisations";

const FILTRES = [
    { code: "TOUTES", libelle: "Toutes" },
    { code: "EN_ATTENTE", libelle: "En attente" },
    { code: "VALIDEE", libelle: "Validées" },
    { code: "REFUSEE", libelle: "Refusées" },
];

const LIBELLES_STATUT = {
    EN_ATTENTE: "En attente",
    VALIDEE: "Validée",
    REFUSEE: "Refusée",
};

const MESSAGES_VIDES = {
    TOUTES: "Aucune demande de réinitialisation pour le moment.",
    EN_ATTENTE: "Aucune demande de réinitialisation en attente.",
    VALIDEE: "Aucune demande validée.",
    REFUSEE: "Aucune demande refusée.",
};

function formaterDate(valeur) {
    return valeur ? new Date(valeur).toLocaleString("fr-FR") : "";
}

export default function ReinitialisationsAdmin() {
    const [parametresUrl] = useSearchParams();
    const [demandes, setDemandes] = useState([]);
    // ?filtre=TOUTES (tableau de bord) ; sans paramètre : les demandes à traiter (en attente)
    const [filtre, setFiltre] = useState(() => {
        const demande = parametresUrl.get("filtre");
        return FILTRES.some((f) => f.code === demande) ? demande : "EN_ATTENTE";
    });
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [info, setInfo] = useState("");
    const [enCours, setEnCours] = useState(null);
    const [modalAction, setModalAction] = useState(null); // { demande, action: 'valider' | 'refuser' }

    const charger = useCallback(async () => {
        try {
            // Toutes les demandes : le filtre et les compteurs sont calculés ici
            const donnees = await apiRequest("/api/admin/reinitialisations");
            setDemandes(donnees);
            setErreur("");
        } catch (error) {
            setErreur(error.message || "Impossible de charger les demandes.");
        } finally {
            setChargement(false);
        }
    }, []);

    useEffect(() => {
        charger();
    }, [charger]);

    const surNotification = useCallback(
        (notification) => {
            setInfo(notification.message);
            charger();
        },
        [charger]
    );

    const tempsReelActif = useNotificationsAdmin({
        topic: TOPIC,
        onMessage: surNotification,
    });

    const compteurs = useMemo(() => ({
        TOUTES: demandes.length,
        EN_ATTENTE: demandes.filter((d) => d.statut === "EN_ATTENTE").length,
        VALIDEE: demandes.filter((d) => d.statut === "VALIDEE").length,
        REFUSEE: demandes.filter((d) => d.statut === "REFUSEE").length,
    }), [demandes]);

    const demandesAffichees = useMemo(
        () => (filtre === "TOUTES" ? demandes : demandes.filter((d) => d.statut === filtre)),
        [demandes, filtre]
    );

    async function confirmerTraitement() {
        if (!modalAction) return;
        const { demande, action } = modalAction;
        setModalAction(null);
        setEnCours(demande.id);
        setErreur("");
        setInfo("");

        try {
            await apiRequest(
                `/api/admin/reinitialisations/${demande.id}/${action}`,
                { method: "POST" }
            );
            setInfo(
                action === "valider"
                    ? "Demande validée : le nouveau mot de passe a été envoyé par email."
                    : "Demande refusée : l'utilisateur a été prévenu par email."
            );
            await charger();
        } catch (error) {
            setErreur(error.message || "Opération impossible.");
        } finally {
            setEnCours(null);
        }
    }

    return (
        <main className="admin-reinit-page">
            <header className="admin-reinit-header">
                <div>
                    <span className="admin-reinit-eyebrow">ADMINISTRATION DU SMQ</span>
                    <h1>Demandes de réinitialisation</h1>
                    <p>Gérez les demandes de réinitialisation de mot de passe des collaborateurs.</p>
                </div>
                <div className="admin-reinit-actions-top">
                    <div className="realtime-status-pill">
                        <span className={`status-dot ${tempsReelActif ? "active" : "inactive"}`}></span>
                        <span>Temps réel : {tempsReelActif ? "Actif" : "Indisponible"}</span>
                    </div>
                    <button type="button" className="admin-btn-secondary" onClick={charger}>
                        <FiRefreshCw /> <span>Actualiser</span>
                    </button>
                </div>
            </header>

            {info && (
                <div className="admin-alert success" role="status">
                    <FiCheckCircle /> <span>{info}</span>
                </div>
            )}
            {erreur && (
                <div className="admin-alert error" role="alert">
                    <FiAlertTriangle /> <span>{erreur}</span>
                </div>
            )}

            {/* MODALE DE CONFIRMATION PERSONNALISÉE (VALIDATION / REFUS) */}
            {modalAction && (
                <div className="admin-modal-overlay" onClick={() => setModalAction(null)}>
                    <div className="admin-modal-container confirmation-modal" onClick={(e) => e.stopPropagation()}>
                        <div className={`status-modal-icon ${modalAction.action === 'valider' ? 'success' : 'danger'}`}>
                            {modalAction.action === 'valider' ? <FiCheckCircle /> : <FiAlertTriangle />}
                        </div>

                        <h2 className="confirmation-title">
                            {modalAction.action === 'valider' ? "Valider la demande ?" : "Refuser la demande ?"}
                        </h2>

                        <div className="confirmation-user-card">
                            <strong>{modalAction.demande.prenom} {modalAction.demande.nom}</strong>
                            <span>Matricule : <code>{modalAction.demande.matricule}</code> • Rôle : {modalAction.demande.role}</span>
                        </div>

                        <p className="confirmation-description">
                            {modalAction.action === 'valider'
                                ? "Un nouveau mot de passe sécurisé sera généré et envoyé automatiquement par e-mail au collaborateur."
                                : "La demande sera refusée et une notification de refus sera transmise par e-mail."}
                        </p>

                        <div className="confirmation-actions">
                            <button type="button" className="admin-users-secondary" onClick={() => setModalAction(null)}>
                                Annuler
                            </button>
                            <button
                                type="button"
                                className={modalAction.action === 'valider' ? 'admin-users-success-btn' : 'admin-users-danger'}
                                onClick={confirmerTraitement}
                            >
                                {modalAction.action === 'valider' ? "Oui, valider" : "Oui, refuser"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-reinit-filtres" role="group" aria-label="Filtrer les demandes par statut">
                {FILTRES.map(({ code, libelle }) => (
                    <button
                        key={code}
                        type="button"
                        className={`admin-reinit-filtre ${filtre === code ? "actif" : ""}`}
                        aria-pressed={filtre === code}
                        onClick={() => setFiltre(code)}
                    >
                        {libelle}
                        <span className="admin-reinit-filtre-nb">{compteurs[code]}</span>
                    </button>
                ))}
            </div>

            <section className="admin-reinit-panel">
                {chargement ? (
                    <div className="admin-reinit-state">
                        <div className="loader-dot"></div>
                        Chargement des demandes...
                    </div>
                ) : demandesAffichees.length === 0 ? (
                    <div className="admin-reinit-state">
                        <FiClock className="empty-icon" />
                        <p>{MESSAGES_VIDES[filtre]}</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-reinit-table">
                            <thead>
                                <tr>
                                    <th>Matricule</th>
                                    <th>Collaborateur</th>
                                    <th>Rôle</th>
                                    <th>Demandée le</th>
                                    <th>Statut</th>
                                    <th className="th-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {demandesAffichees.map((demande) => (
                                    <tr key={demande.id}>
                                        <td data-label="Matricule">
                                            <span className="admin-badge-matricule">
                                                <FiHash /> {demande.matricule}
                                            </span>
                                        </td>
                                        <td data-label="Collaborateur">
                                            <div className="admin-user-cell">
                                                <div className="admin-user-avatar">
                                                    {(demande.prenom?.[0] || "")}{(demande.nom?.[0] || "")}
                                                </div>
                                                <div>
                                                    <strong>{demande.prenom} {demande.nom}</strong>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Rôle">
                                            <span className="admin-role-badge">
                                                <FiShield /> {demande.role}
                                            </span>
                                        </td>
                                        <td data-label="Demandée le">
                                            <span className="date-text">
                                                <FiClock /> {formaterDate(demande.dateDemande)}
                                            </span>
                                        </td>
                                        <td data-label="Statut">
                                            <span className={`admin-statut-badge admin-statut-${demande.statut}`}>
                                                {LIBELLES_STATUT[demande.statut] ?? demande.statut}
                                            </span>
                                            {demande.dateTraitement && (
                                                <span className="admin-statut-date">
                                                    le {formaterDate(demande.dateTraitement)}
                                                </span>
                                            )}
                                        </td>
                                        <td data-label="Actions">
                                            {demande.statut !== "EN_ATTENTE" ? (
                                                <span className="admin-statut-date">Traitée</span>
                                            ) : (
                                            <div className="action-buttons">
                                                <button
                                                    type="button"
                                                    className="admin-users-success-btn btn-action-item"
                                                    disabled={enCours === demande.id}
                                                    onClick={() => setModalAction({ demande, action: 'valider' })}
                                                    title="Valider"
                                                >
                                                    <FiCheck /> <span>Valider</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-users-danger btn-action-item"
                                                    disabled={enCours === demande.id}
                                                    onClick={() => setModalAction({ demande, action: 'refuser' })}
                                                    title="Refuser"
                                                >
                                                    <FiX /> <span>Refuser</span>
                                                </button>
                                            </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <p className="admin-reinit-note">
                💡 La validation génère automatiquement un mot de passe sécurisé et l'envoie par e-mail, tandis que le refus notifie l'utilisateur du rejet de sa demande.
            </p>
        </main>
    );
}