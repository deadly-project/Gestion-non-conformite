import { useCallback, useEffect, useRef, useState } from "react";
import { useNotificationsAdmin } from "./useNotificationsAdmin";
import {
    compterNotificationsNonLues,
    listerNotifications,
    marquerNotificationLue,
    marquerToutesNotificationsLues,
} from "../api/notifications";

const TAILLE_PAGE = 20;

/**
 * Notifications personnelles de l'utilisateur connecté (tous rôles) :
 *  - historique et compteur lus en REST ;
 *  - nouvelles notifications reçues en temps réel sur /user/queue/notifications
 *    (file privée : le serveur ne l'envoie qu'à son destinataire).
 *
 * @param actif  false tant que personne n'est connecté
 * @param surNouvelle  appelée pour chaque notification reçue en temps réel (toast...)
 */
export function useNotifications({ actif, surNouvelle }) {
    const [notifications, setNotifications] = useState([]);
    const [nonLues, setNonLues] = useState(0);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [chargement, setChargement] = useState(false);
    const surNouvelleRef = useRef(surNouvelle);

    useEffect(() => {
        surNouvelleRef.current = surNouvelle;
    }, [surNouvelle]);

    const recharger = useCallback(async () => {
        try {
            setChargement(true);
            const [resultat, total] = await Promise.all([
                listerNotifications(0, TAILLE_PAGE),
                compterNotificationsNonLues(),
            ]);
            setNotifications(resultat.contenu ?? []);
            setPage(0);
            setTotalPages(resultat.totalPages ?? 0);
            setNonLues(total);
        } catch (erreur) {
            console.error("Notifications illisibles :", erreur);
        } finally {
            setChargement(false);
        }
    }, []);

    const chargerPlus = useCallback(async () => {
        try {
            setChargement(true);
            const suivante = page + 1;
            const resultat = await listerNotifications(suivante, TAILLE_PAGE);
            setNotifications((anciennes) => {
                const connus = new Set(anciennes.map((n) => n.id));
                return [...anciennes, ...(resultat.contenu ?? []).filter((n) => !connus.has(n.id))];
            });
            setPage(suivante);
            setTotalPages(resultat.totalPages ?? 0);
        } catch (erreur) {
            console.error("Notifications illisibles :", erreur);
        } finally {
            setChargement(false);
        }
    }, [page]);

    const recue = useCallback((notification) => {
        setNotifications((anciennes) =>
            anciennes.some((n) => n.id === notification.id) ? anciennes : [notification, ...anciennes]
        );
        setNonLues((n) => n + 1);
        surNouvelleRef.current?.(notification);
    }, []);

    // Abonnement temps réel (aucun abonnement tant que l'utilisateur n'est pas connecté)
    const connecte = useNotificationsAdmin({
        topic: actif ? "/user/queue/notifications" : null,
        onMessage: recue,
    });

    // Au chargement, et à chaque (re)connexion : rattrape ce qui a pu arriver pendant une coupure
    useEffect(() => {
        if (actif) recharger();
    }, [actif, connecte, recharger]);

    const marquerLue = useCallback(async (notification) => {
        if (notification.lue) return;
        setNotifications((liste) => liste.map((n) => (n.id === notification.id ? { ...n, lue: true } : n)));
        setNonLues((n) => Math.max(0, n - 1));
        try {
            await marquerNotificationLue(notification.id);
        } catch (erreur) {
            console.error(erreur);
            recharger();
        }
    }, [recharger]);

    const toutMarquerLu = useCallback(async () => {
        setNotifications((liste) => liste.map((n) => ({ ...n, lue: true })));
        setNonLues(0);
        try {
            await marquerToutesNotificationsLues();
        } catch (erreur) {
            console.error(erreur);
            recharger();
        }
    }, [recharger]);

    return {
        notifications,
        nonLues,
        connecte,
        chargement,
        aPlus: page + 1 < totalPages,
        chargerPlus,
        marquerLue,
        toutMarquerLu,
    };
}
