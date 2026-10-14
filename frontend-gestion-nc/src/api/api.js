
const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8080";

let csrfToken = null;

async function obtenirCsrfToken(forcer = false) {
  if (csrfToken && !forcer) return csrfToken;

  const response = await fetch(`${API_URL}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Impossible d'obtenir le jeton CSRF.");

  csrfToken = (await response.json()).token;
  return csrfToken;
}

export async function apiRequest(path, options = {}, dejaRetente = false) {
    const method = (options.method || "GET").toUpperCase();
    const methodProtege = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };
  
    if (methodProtege) {
      headers["X-CSRF-TOKEN"] = await obtenirCsrfToken();
    }
  
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    });
  
    // Token expiré ou invalide : on le renouvelle et on réessaie une fois
    if (response.status === 403 && methodProtege && !dejaRetente) {
      csrfToken = null;
      return apiRequest(path, options, true);
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

    if (path === "/api/auth/logout") {
        csrfToken = null;
    }

    return data;
}
