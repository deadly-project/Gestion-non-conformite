import { useEffect } from "react";
import { HiBellAlert } from "react-icons/hi2";

/** Bandeau éphémère affiché à la réception d'une notification en temps réel. */
export default function NotificationToast({ notification, onOuvrir, onFermer }) {
    useEffect(() => {
        if (!notification) return undefined;
        const minuteur = setTimeout(onFermer, 6000);
        return () => clearTimeout(minuteur);
    }, [notification, onFermer]);

    if (!notification) return null;

    return (
        <div className="notif-toast" role="status" aria-live="polite">
            <button type="button" className="notif-toast-corps" onClick={() => onOuvrir(notification)}>
                <HiBellAlert className="notif-toast-icone" />
                <span>{notification.message}</span>
            </button>
            <button type="button" className="notif-toast-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        </div>
    );
}
