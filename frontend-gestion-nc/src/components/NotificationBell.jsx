import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiBellAlert } from "react-icons/hi2";
import { categorieNotification, lienNotification, tempsRelatif } from "./notificationsConfig";
import "./NotificationBell.css";

/**
 * Cloche des notifications (navigation). L'état vient du hook useNotifications, créé UNE seule fois
 * dans Nav : la cloche de la barre mobile et celle du menu latéral partagent la même connexion.
 */
export default function NotificationBell({ role, etat, variante }) {
    const { notifications, nonLues, connecte, chargement, aPlus, chargerPlus, marquerLue, toutMarquerLu } = etat;
    const [ouvert, setOuvert] = useState(false);
    const conteneurRef = useRef(null);
    const navigate = useNavigate();

    // Fermeture au clic extérieur et sur Échap
    useEffect(() => {
        if (!ouvert) return undefined;
        const clic = (e) => {
            if (conteneurRef.current && !conteneurRef.current.contains(e.target)) setOuvert(false);
        };
        const touche = (e) => e.key === "Escape" && setOuvert(false);
        document.addEventListener("mousedown", clic);
        document.addEventListener("keydown", touche);
        return () => {
            document.removeEventListener("mousedown", clic);
            document.removeEventListener("keydown", touche);
        };
    }, [ouvert]);

    const ouvrir = (notification) => {
        marquerLue(notification);
        const lien = lienNotification(notification, role);
        if (lien) {
            setOuvert(false);
            navigate(lien);
        }
    };

    return (
        <div className={`notif-bell notif-bell-${variante}`} ref={conteneurRef}>
            <button
                type="button"
                className={`notif-bell-btn ${nonLues > 0 ? "a-des-non-lues" : ""}`}
                onClick={() => setOuvert((v) => !v)}
                aria-label={nonLues > 0 ? `Notifications : ${nonLues} non lue(s)` : "Notifications"}
                aria-expanded={ouvert}
                title={connecte ? "Notifications en temps réel" : "Notifications (hors ligne, reconnexion...)"}
            >
                <HiBellAlert />
                {nonLues > 0 && <span className="notif-badge">{nonLues > 99 ? "99+" : nonLues}</span>}
                <span className={`notif-statut ${connecte ? "en-ligne" : "hors-ligne"}`} />
            </button>

            {ouvert && (
                <div className="notif-panneau" role="dialog" aria-label="Notifications">
                    <div className="notif-entete">
                        <strong>Notifications</strong>
                        <button type="button" className="notif-lien-action" onClick={toutMarquerLu} disabled={nonLues === 0}>
                            Tout marquer comme lu
                        </button>
                    </div>

                    <ul className="notif-liste">
                        {notifications.length === 0 && !chargement && (
                            <li className="notif-vide">Aucune notification pour le moment.</li>
                        )}
                        {notifications.map((n) => (
                            <li key={n.id}>
                                <button
                                    type="button"
                                    className={`notif-item ${n.lue ? "" : "non-lue"}`}
                                    onClick={() => ouvrir(n)}
                                >
                                    <span className={`notif-pastille ${categorieNotification(n.type)}`} />
                                    <span className="notif-contenu">
                                        <span className="notif-message">{n.message}</span>
                                        <span className="notif-date">{tempsRelatif(n.dateCreation)}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    {aPlus && (
                        <button type="button" className="notif-plus" onClick={chargerPlus} disabled={chargement}>
                            {chargement ? "Chargement..." : "Voir plus anciennes"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
