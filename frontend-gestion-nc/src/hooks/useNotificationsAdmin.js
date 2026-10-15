import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Adaptez si votre api.js utilise une autre variable pour l'URL du backend
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/**
 * Abonnement temps réel (STOMP sur SockJS) à un canal /topic/admin/...
 *
 * @param topic          canal à écouter
 * @param onMessage      appelé à chaque message (objet JSON déjà décodé)
 * @param connectHeaders en-têtes envoyés au CONNECT STOMP. Si votre
 *                       JwtStompChannelInterceptor lit le jeton dans l'en-tête
 *                       « Authorization », passez-le ici.
 * @returns true si la connexion temps réel est active
 */
export function useNotificationsAdmin({ topic, onMessage, connectHeaders = {} }) {
    const [connecte, setConnecte] = useState(false);
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        const client = new Client({
            webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
            connectHeaders: {},
            reconnectDelay: 5000,
            onConnect: () => {
                setConnecte(true);
                client.subscribe(topic, (frame) => {
                    try {
                        onMessageRef.current(JSON.parse(frame.body));
                    } catch (erreur) {
                        console.error("Message temps réel illisible :", erreur);
                    }
                });
            },
            onWebSocketClose: () => setConnecte(false),
            onStompError: (frame) => {
                console.error("Erreur STOMP :", frame.headers?.message);
                setConnecte(false);
            },
        });

        client.activate();
        return () => {
            client.deactivate();
        };
        // connectHeaders volontairement exclu : la connexion ne doit pas être recréée à chaque rendu
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topic]);

    return connecte;
}