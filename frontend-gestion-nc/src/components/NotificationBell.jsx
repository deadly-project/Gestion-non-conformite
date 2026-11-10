import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiBellAlert } from "react-icons/hi2";
import { categorieNotification, lienNotification, tempsRelatif } from "./notificationsConfig";
import VisualisationNcModal from "./responsable_qualite/VisualisationNcModal";
import AvancementNcModal from "./responsable_qualite/AvancementNcModal";
import "./NotificationBell.css";

export default function NotificationBell({ role, etat, variante }) {
    const { notifications, nonLues, connecte, chargement, aPlus, chargerPlus, marquerLue, toutMarquerLu } = etat;
    const [ouvert, setOuvert] = useState(false);
    
    // États pour contrôler l'affichage direct des modales pour l'auditeur
    const [ncIdVisualiser, setNcIdVisualiser] = useState(null);
    const [ncIdAvancement, setNcIdAvancement] = useState(null);

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
        setOuvert(false); // Ferme le menu déroulant de la cloche

        // Cas particulier pour l'auditeur : ouverture directe en modale sans navigation de page
        if (role === "AUDITEUR") {
            if (notification.type === "NC_AUDITEUR_ASSIGNE" && notification.entiteId) {
                setNcIdVisualiser(notification.entiteId);
                return;
            }
            if (notification.type === "NC_CLOTUREE" && notification.entiteId) {
                setNcIdAvancement(notification.entiteId);
                return;
            }
        }

        // Comportement standard pour les autres types ou rôles
        const lien = lienNotification(notification, role);
        if (lien) {
            navigate(lien);
        }
    };

    return (
        <>
            <div className={`notif-bell notif-bell-${variante}`} ref={conteneurRef}>
                <button
                    type="button"
                    className={`notif-bell-btn ${nonLues > 0 ? "a-des-non-lues" : ""}`}
                    onClick={() => setOuvert((v) => !v)}
                    aria-label={nonLues > 0 ? `Notifications : ${nonLues} non lue(s)` : "Notifications"}
                    aria-expanded={ouvert}
                    title={connecte ? "Notifications en temps réel" : "Notifications (hors ligne...)"}
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

            {/* Rendu des modales déclenchées directement depuis la cloche */}
            {ncIdVisualiser && (
                <VisualisationNcModal
                    ncId={ncIdVisualiser}
                    onFermer={() => setNcIdVisualiser(null)}
                    actionsResponsable={false}
                />
            )}

            {ncIdAvancement && (
                <AvancementNcModal
                    ncId={ncIdAvancement}
                    onFermer={() => setNcIdAvancement(null)}
                    lectureSeule={true}
                />
            )}
        </>
    );
}