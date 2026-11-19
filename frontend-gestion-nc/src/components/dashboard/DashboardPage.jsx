import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import HistogrammeMensuel from "./HistogrammeMensuel";
import DashboardAdministrateur from "./DashboardAdministrateur";
import { MOIS_LONGS } from "./mois";
import {
    FiRefreshCw, FiAlertTriangle, FiUsers, FiRotateCcw, FiArrowRight,
    FiAlertCircle, FiCheckCircle, FiClock, FiActivity,
} from "react-icons/fi";

/** Mois(es) en tête d'une série, sous forme de phrase (« mars », « mars et juin »). */
function phrasePic(donnees, cle) {
    const sommet = Math.max(0, ...donnees.map((d) => d[cle]));
    if (sommet === 0) return null;
    const mois = donnees.filter((d) => d[cle] === sommet).map((d) => MOIS_LONGS[d.mois - 1]);
    return { mois: mois.join(" et "), valeur: sommet };
}

/**
 * Tableau de bord qualité, commun au responsable qualité et à l'administrateur.
 * L'administrateur voit en plus les cartes « Utilisateurs » et « Demandes de réinitialisation »,
 * qui renvoient chacune vers leur espace.
 */
export default function DashboardPage({ utilisateur }) {
    const navigate = useNavigate();
    const [annee, setAnnee] = useState(null);       // null : année courante (choisie par le serveur)
    const [donnees, setDonnees] = useState(null);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");

    const charger = useCallback(async (anneeDemandee) => {
        try {
            setChargement(true);
            const reponse = await apiRequest(
                `/api/dashboard${anneeDemandee ? `?annee=${anneeDemandee}` : ""}`
            );
            setDonnees(reponse);
            setErreur("");
        } catch (e) {
            setErreur(e.message || "Impossible de charger le tableau de bord.");
        } finally {
            setChargement(false);
        }
    }, []);

    useEffect(() => {
        charger(annee);
    }, [annee, charger]);


    return (
        <main className="dash-page">
            <DashboardAdministrateur
                admin={donnees?.admin}
                chargement={chargement}
                erreur={erreur}
                actualiser={() => charger(annee)}
            />
        </main>
    );
}