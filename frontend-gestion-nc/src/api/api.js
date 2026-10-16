import { lireToken, effacerToken, SESSION_EXPIREE } from "./auth";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function apiRequest(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const token = lireToken();

    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        // Le jeton de CET onglet : c'est lui qui détermine l'utilisateur connecté
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    // Pas de cookies : l'identité ne passe que par l'en-tête Authorization
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        method,
        headers,
    });

    // Jeton refusé : on efface la session de l'onglet et on prévient l'application
    if (response.status === 401 && token && path !== "/api/auth/login") {
        effacerToken();
        window.dispatchEvent(new Event(SESSION_EXPIREE));
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message = typeof data === "string"
            ? data
            : data.message || data.detail || data.error
                || "Une erreur est survenue.";

        throw new Error(message);
    }

    return data;
}