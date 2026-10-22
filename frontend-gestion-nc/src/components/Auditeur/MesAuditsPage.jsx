import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { dateAujourdhui, formaterDate } from "../constantes";
import { STATUTS_AUDIT, TYPES_AUDIT } from "./libelles";
import "../Declarant/nc.css";
import "../responsable_qualite/CalendrierAudits.css";   // grille du calendrier (classes cal-*)
import "./audits.css";
import "./MesAuditsPage.css";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const PUCES_VISIBLES = 3;
const RAFRAICHISSEMENT_MS = 60000;

const deuxChiffres = (n) => String(n).padStart(2, "0");
const versIso = (annee, mois, jour) => `${annee}-${deuxChiffres(mois + 1)}-${deuxChiffres(jour)}`;

/** Cellules du mois, semaine commençant le lundi ; null = case vide. */
function construireGrille(annee, mois) {
    const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7;
    const nbJours = new Date(annee, mois + 1, 0).getDate();
    const cellules = Array(decalage).fill(null);
    for (let jour = 1; jour <= nbJours; jour++) cellules.push({ jour, iso: versIso(annee, mois, jour) });
    while (cellules.length % 7 !== 0) cellules.push(null);
    return cellules;
}

/** Couleur d'un audit : en retard (planifié et date passée) ou son statut. */
const etatDe = (audit) => (audit.enRetard ? "RETARD" : audit.statut);
const libelleEtat = (audit) => (audit.enRetard ? "En retard" : STATUTS_AUDIT[audit.statut] ?? audit.statut);

function libelleCourt(audit) {
    if (!audit.nc) return audit.titre;
    return audit.etape ? `${audit.nc.reference} · Étape ${audit.etape.numero}` : audit.nc.reference;
}

export default function MesAuditsPage() {
    const navigate = useNavigate();
    const aujourdhui = dateAujourdhui();

    const [annee, setAnnee] = useState(Number(aujourdhui.slice(0, 4)));
    const [mois, setMois] = useState(Number(aujourdhui.slice(5, 7)) - 1);
    const [audits, setAudits] = useState([]);
    const [aTraiter, setATraiter] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");

    const du = versIso(annee, mois, 1);
    const au = versIso(annee, mois, new Date(annee, mois + 1, 0).getDate());

    const charger = useCallback(async () => {
        try {
            const [duMois, urgents] = await Promise.all([
                apiRequest(`/api/audits/mes-audits?du=${du}&au=${au}`),
                apiRequest("/api/audits/mes-audits/a-traiter"),
            ]);
            setAudits(duMois || []);
            setATraiter(urgents || []);
            setErreur("");
        } catch (e) {
            setErreur(e.message || "Impossible de charger vos audits.");
        } finally {
            setChargement(false);
        }
    }, [du, au]);

    // Chargement, puis rafraîchissement au retour sur l'onglet et toutes les minutes
    useEffect(() => {
        charger();
        const minuterie = setInterval(charger, RAFRAICHISSEMENT_MS);
        window.addEventListener("focus", charger);
        return () => {
            clearInterval(minuterie);
            window.removeEventListener("focus", charger);
        };
    }, [charger]);

    const grille = useMemo(() => construireGrille(annee, mois), [annee, mois]);
    const parJour = useMemo(() => {
        const resultat = new Map();
        audits.forEach((a) => {
            const jour = String(a.date).slice(0, 10);
            if (!resultat.has(jour)) resultat.set(jour, []);
            resultat.get(jour).push(a);
        });
        return resultat;
    }, [audits]);

    const nbRetards = aTraiter.filter((a) => a.enRetard).length;

    function changerMois(delta) {
        const d = new Date(annee, mois + delta, 1);
        setAnnee(d.getFullYear());
        setMois(d.getMonth());
    }

    function revenirAujourdhui() {
        setAnnee(Number(aujourdhui.slice(0, 4)));
        setMois(Number(aujourdhui.slice(5, 7)) - 1);
    }

    const ouvrir = (audit) => navigate(`/auditeur/audits/${audit.id}`);

    return (
        <main className="nc-page">
            <h1>Mes audits</h1>
            <p className="maud-intro">
                Cliquez sur un audit pour le démarrer, consigner vos constats, décrire l'audit réalisé
                et enregistrer le traitement constaté sur le terrain.
            </p>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

            <div className="maud-espace">
                <section className="maud-calendrier" aria-labelledby="maud-titre-calendrier">
                    <h2 id="maud-titre-calendrier" className="maud-titre">Calendrier</h2>

                    <div className="cal-navigation">
                        <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => changerMois(-1)} aria-label="Mois précédent">‹</button>
                        <strong className="cal-mois">{MOIS[mois]} {annee}</strong>
                        <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => changerMois(1)} aria-label="Mois suivant">›</button>
                        <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit cal-aujourdhui" onClick={revenirAujourdhui}>Aujourd'hui</button>
                    </div>

                    <div className="cal-grille" role="grid" aria-label={`${MOIS[mois]} ${annee}`}>
                        {JOURS.map((j) => <div key={j} className="cal-entete" role="columnheader">{j}</div>)}

                        {grille.map((cellule, index) => {
                            if (!cellule) return <div key={`vide-${index}`} className="cal-jour cal-jour--vide" aria-hidden="true" />;

                            const { iso, jour } = cellule;
                            const duJour = parJour.get(iso) || [];
                            const classes = ["cal-jour", "maud-jour"];
                            if (iso === aujourdhui) classes.push("cal-jour--aujourdhui");

                            return (
                                <div key={iso} className={classes.join(" ")} role="gridcell">
                                    <span className="cal-jour-numero">{jour}</span>
                                    {duJour.length > 0 && (
                                        <ul className="cal-puces">
                                            {duJour.slice(0, PUCES_VISIBLES).map((audit) => (
                                                <li key={audit.id}>
                                                    <button
                                                        type="button"
                                                        className={`maud-puce maud-puce--${etatDe(audit)}`}
                                                        title={`${audit.titre} (${libelleEtat(audit)})`}
                                                        onClick={() => ouvrir(audit)}
                                                    >
                                                        {libelleCourt(audit)}
                                                    </button>
                                                </li>
                                            ))}
                                            {duJour.length > PUCES_VISIBLES && (
                                                <li className="cal-puce-plus">+{duJour.length - PUCES_VISIBLES} autres</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <ul className="maud-legende" aria-label="Légende">
                        {["PLANIFIE", "EN_COURS", "TERMINE", "RETARD"].map((etat) => (
                            <li key={etat}>
                                <span className={`maud-point maud-puce--${etat}`} />
                                {etat === "RETARD" ? "En retard" : STATUTS_AUDIT[etat]}
                            </li>
                        ))}
                    </ul>
                </section>

                <aside className="maud-liste nc-section" aria-labelledby="maud-titre-liste">
                    <h2 id="maud-titre-liste" className="maud-titre">À traiter</h2>
                    <p className="maud-aide">
                        Audits en cours, en retard ou prévus dans les 14 prochains jours.
                        {nbRetards > 0 && <strong className="maud-retards"> {nbRetards} en retard.</strong>}
                    </p>

                    {chargement ? (
                        <p className="aud-vide">Chargement...</p>
                    ) : aTraiter.length === 0 ? (
                        <p className="aud-vide">Aucun audit à traiter pour le moment.</p>
                    ) : (
                        <ul className="maud-cartes">
                            {aTraiter.map((audit) => (
                                <li key={audit.id}>
                                    <button type="button" className="maud-carte" onClick={() => ouvrir(audit)}>
                                        <span className="maud-carte-entete">
                                            <strong>{formaterDate(audit.date)}</strong>
                                            <span className={`aud-badge aud-badge--${etatDe(audit)}`}>{libelleEtat(audit)}</span>
                                        </span>
                                        <span className="maud-carte-titre">{audit.titre}</span>
                                        {audit.etape && (
                                            <span className="maud-carte-detail">{audit.etape.description}</span>
                                        )}
                                        <span className="maud-carte-detail">
                                            Audit {(TYPES_AUDIT[audit.typeAudit] ?? "").toLowerCase()}
                                            {audit.processus ? ` · ${audit.processus}` : ""}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>
        </main>
    );
}