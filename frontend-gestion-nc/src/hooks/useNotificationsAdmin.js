import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { lireToken } from "../api/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/**
 * Abonnement temps réel (STOMP sur SockJS) à un canal /topic/admin/...
 * L'identité est celle de l'ONGLET : le jeton est lu dans le sessionStorage et envoyé
 * dans l'en-tête Authorization de la trame CONNECT.
 *
 * @returns true si la connexion temps réel est active
 */
export function useNotificationsAdmin({ topic, onMessage }) {
    const [connecte, setConnecte] = useState(false);
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        const client = new Client({
            webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
            reconnectDelay: 5000,
            // Exécuté avant CHAQUE connexion et reconnexion : le jeton est toujours à jour
            beforeConnect: () => {
                client.connectHeaders = {
                    Authorization: `Bearer ${lireToken() ?? ""}`,
                };
            },
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
            // Erreur renvoyée par le serveur (jeton refusé, accès interdit...) :
            // on arrête, sinon la reconnexion automatique referait la même erreur toutes les 5 s
            onStompError: (frame) => {
                console.error("Erreur STOMP :", frame.headers?.message);
                setConnecte(false);
                client.deactivate();
            },
        });

        client.activate();
        return () => {
            client.deactivate();
        };
    }, [topic]);

    return connecte;
}