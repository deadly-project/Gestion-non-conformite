import { lireToken, effacerToken, SESSION_EXPIREE } from "./auth";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8080";

function surNonAutorise(response, token, path) {
    // Jeton refusé : on efface la session de l'onglet et on prévient l'application
    if (response.status === 401 && token && path !== "/api/auth/login") {
        effacerToken();
        window.dispatchEvent(new Event(SESSION_EXPIREE));
    }
}

export async function apiRequest(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const token = lireToken();
    const estFormData = options.body instanceof FormData;

    const headers = {
        // Pour un FormData, c'est le navigateur qui fixe Content-Type (avec la frontière multipart)
        ...(options.body && !estFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        method,
        headers,
    });

    surNonAutorise(response, token, path);

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

/** Télécharge un fichier protégé (image, PDF) : l'en-tête Authorization ne peut pas passer par <img src>. */
export async function apiBlob(path) {
    const token = lireToken();
    const response = await fetch(`${API_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    surNonAutorise(response, token, path);

    if (!response.ok) {
        throw new Error("Impossible de charger le fichier.");
    }
    return response.blob();
}