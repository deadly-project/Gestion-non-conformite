import { apiRequest } from "./api";

/** Page de notifications de l'utilisateur connecté (les plus récentes d'abord). */
export function listerNotifications(page = 0, taille = 20) {
    return apiRequest(`/api/notifications?page=${page}&taille=${taille}`);
}

export async function compterNotificationsNonLues() {
    const reponse = await apiRequest("/api/notifications/non-lues/nombre");
    return reponse?.nombre ?? 0;
}

export function marquerNotificationLue(id) {
    return apiRequest(`/api/notifications/${id}/lue`, { method: "PATCH" });
}

export function marquerToutesNotificationsLues() {
    return apiRequest("/api/notifications/lues", { method: "PATCH" });
}
