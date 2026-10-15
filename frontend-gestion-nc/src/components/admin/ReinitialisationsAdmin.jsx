import { useCallback, useEffect, useState } from "react";
import {apiRequest} from "../../api/api";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";


const TOPIC = "/topic/admin/reinitialisations";

function formaterDate(valeur) {
    return valeur ? new Date(valeur).toLocaleString("fr-FR") : "";
}

export default function ReinitialisationsAdmin() {
    const [demandes, setDemandes] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [info, setInfo] = useState("");
    const [enCours, setEnCours] = useState(null);

    const charger = useCallback(async () => {
        try {
            const donnees = await apiRequest(
                "/api/admin/reinitialisations?statut=EN_ATTENTE"
            );
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

    // Le message WebSocket n'est qu'un signal : la liste est rechargée depuis l'API
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

    async function traiter(demande, action) {
        const verbe = action === "valider" ? "valider" : "refuser";
        const confirme = window.confirm(
            `Voulez-vous ${verbe} la demande de ${demande.prenom} ${demande.nom} ` +
            `(matricule ${demande.matricule}) ?`
        );
        if (!confirme) {
            return;
        }

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
        <main>
            <h1>Demandes de réinitialisation de mot de passe</h1>

            <p>
                Temps réel :{" "}
                <strong>{tempsReelActif ? "actif" : "indisponible"}</strong>{" "}
                <button type="button" onClick={charger}>Actualiser</button>
            </p>

            {info && <p role="status">{info}</p>}
            {erreur && <p role="alert">{erreur}</p>}

            {chargement ? (
                <p>Chargement...</p>
            ) : demandes.length === 0 ? (
                <p>Aucune demande en attente.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Matricule</th>
                            <th>Nom</th>
                            <th>Rôle</th>
                            <th>Demandée le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {demandes.map((demande) => (
                            <tr key={demande.id}>
                                <td>{demande.matricule}</td>
                                <td>{demande.prenom} {demande.nom}</td>
                                <td>{demande.role}</td>
                                <td>{formaterDate(demande.dateDemande)}</td>
                                <td>
                                    <button
                                        type="button"
                                        disabled={enCours === demande.id}
                                        onClick={() => traiter(demande, "valider")}
                                    >
                                        Valider
                                    </button>{" "}
                                    <button
                                        type="button"
                                        disabled={enCours === demande.id}
                                        onClick={() => traiter(demande, "refuser")}
                                    >
                                        Refuser
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </main>
    );
}