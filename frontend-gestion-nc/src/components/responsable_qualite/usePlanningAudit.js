import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../api/api";

/**
 * Audits planifiés sur les étapes CAPA d'une non-conformité (table audits).
 * Une entrée = { id, etapeId, date, typeAudit, statut } : une étape peut avoir plusieurs
 * entrées (plusieurs jours) et un jour peut en contenir plusieurs (plusieurs étapes).
 *
 * `planifier` et `retirer` laissent remonter les erreurs : c'est le composant
 * appelant qui décide comment les afficher.
 */
export default function usePlanningAudit(ncId) {
    const [planning, setPlanning] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");

    useEffect(() => {
        let actif = true;
        setChargement(true);
        apiRequest(`/api/audits/planning?ncId=${ncId}`)
            .then((entrees) => {
                if (!actif) return;
                setPlanning(entrees || []);
                setErreur("");
            })
            .catch((e) => {
                if (actif) setErreur(e.message || "Impossible de charger le planning d'audit.");
            })
            .finally(() => {
                if (actif) setChargement(false);
            });
        return () => { actif = false; };
    }, [ncId]);

    /** Planifie une ou plusieurs étapes sur un même jour (date AAAA-MM-JJ, typeAudit INTERNE ou EXTERNE). */
    const planifier = useCallback(async (date, etapeIds, typeAudit = "INTERNE") => {
        const crees = await apiRequest("/api/audits/planning", {
            method: "POST",
            body: JSON.stringify({ date, etapeIds, typeAudit }),
        });
        setPlanning((precedent) => {
            const connus = new Set(precedent.map((p) => p.id));
            return [...precedent, ...(crees || []).filter((c) => !connus.has(c.id))];
        });
    }, []);

    const retirer = useCallback(async (idEntree) => {
        await apiRequest(`/api/audits/planning/${idEntree}`, { method: "DELETE" });
        setPlanning((precedent) => precedent.filter((p) => p.id !== idEntree));
    }, []);

    return { planning, chargement, erreur, planifier, retirer };
}