import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { TYPES_ACTION, dateAujourdhui, formaterDate } from "../constantes";
import { STATUTS_AUDIT, TYPES_AUDIT } from "./libelles";
import { FiCalendar, FiMapPin, FiArrowRight, FiX } from "react-icons/fi";
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

const FILTRES = [
    { code: "TOUS", libelle: "Tous" },
    { code: "PLANIFIE", libelle: "Planifié" },
    { code: "EN_COURS", libelle: "En cours" },
    { code: "TERMINE", libelle: "Terminé" },
    { code: "RETARD", libelle: "En retard" },
];

const deuxChiffres = (n) => String(n).padStart(2, "0");
const versIso = (annee, mois, jour) => `${annee}-${deuxChiffres(mois + 1)}-${deuxChiffres(jour)}`;

function construireGrille(annee, mois) {
    const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7;
    const nbJours = new Date(annee, mois + 1, 0).getDate();
    const cellules = Array(decalage).fill(null);
    for (let jour = 1; jour <= nbJours; jour++) cellules.push({ jour, iso: versIso(annee, mois, jour) });
    while (cellules.length % 7 !== 0) cellules.push(null);
    return cellules;
}

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

    const [jourSelectionne, setJourSelectionne] = useState(null);
    const [filtreStatut, setFiltreStatut] = useState("TOUS");

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

    useEffect(() => {
        charger();
        const minuterie = setInterval(charger, RAFRAICHISSEMENT_MS);
        window.addEventListener("focus", charger);
        return () => {
            clearInterval(minuterie);
            window.removeEventListener("focus", charger);
        };
    }, [charger]);

    useEffect(() => {
        function surTouche(event) {
            if (event.key === "Escape") {
                setJourSelectionne(null);
            }
        }
        if (jourSelectionne) {
            document.addEventListener("keydown", surTouche);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", surTouche);
            document.body.style.overflow = "";
        };
    }, [jourSelectionne]);

    // Prédicat de filtrage partagé par le calendrier et la sidebar
    const correspondAuFiltre = useCallback(
        (audit) => filtreStatut === "TOUS" || etatDe(audit) === filtreStatut,
        [filtreStatut]
    );

    const grille = useMemo(() => construireGrille(annee, mois), [annee, mois]);

    // Audits filtrés pour le calendrier
    const auditsFiltres = useMemo(
        () => audits.filter(correspondAuFiltre),
        [audits, correspondAuFiltre]
    );

    const parJour = useMemo(() => {
        const resultat = new Map();
        auditsFiltres.forEach((a) => {
            const jour = String(a.date).slice(0, 10);
            if (!resultat.has(jour)) resultat.set(jour, []);
            resultat.get(jour).push(a);
        });
        return resultat;
    }, [auditsFiltres]);

    // Audits filtrés pour la sidebar « À traiter »
    const aTraiterFiltres = useMemo(
        () => aTraiter.filter(correspondAuFiltre),
        [aTraiter, correspondAuFiltre]
    );

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
    const ouvrirJournee = (iso) => setJourSelectionne(iso);
    const auditsJourSelectionne = jourSelectionne ? parJour.get(jourSelectionne) || [] : [];

    return (
        <main className="nc-page">
            <h1>Mes audits</h1>
            <p className="maud-intro">
                Cliquez sur un audit ou une journée pour afficher les constats, décrire l'audit réalisé
                et enregistrer le traitement constaté sur le terrain.
            </p>

            {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

            {/* BARRE DE FILTRES PAR STATUT */}
            <div className="maud-filtres" role="group" aria-label="Filtrer les audits par statut">
                {FILTRES.map(({ code, libelle }) => {
                    const actif = filtreStatut === code;
                    return (
                        <button
                            key={code}
                            type="button"
                            className={`maud-filtre${actif ? " maud-filtre--actif" : ""} maud-filtre--${code}`}
                            aria-pressed={actif}
                            onClick={() => setFiltreStatut(code)}
                        >
                            <span className="maud-filtre-pastille" aria-hidden="true" />
                            {libelle}
                        </button>
                    );
                })}
            </div>

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
                            if (iso === jourSelectionne) classes.push("maud-jour--selectionne");

                            return (
                                <div 
                                    key={iso} 
                                    className={classes.join(" ")} 
                                    role="gridcell"
                                    onClick={() => ouvrirJournee(iso)}
                                >
                                    <span className="cal-jour-numero">{jour}</span>
                                    {duJour.length > 0 && (
                                        <ul className="cal-puces">
                                            {duJour.slice(0, PUCES_VISIBLES).map((audit) => (
                                                <li key={audit.id}>
                                                    <button
                                                        type="button"
                                                        className={`maud-puce maud-puce--${etatDe(audit)}`}
                                                        title={`${audit.titre} (${libelleEtat(audit)})`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            ouvrir(audit);
                                                        }}
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

                {/* LISTE À TRAITER */}
                <aside className="maud-liste nc-section" aria-labelledby="maud-titre-liste">
                    <h2 id="maud-titre-liste" className="maud-titre">À traiter</h2>
                    <p className="maud-aide">
                        Audits en cours, en retard ou prévus dans les 14 prochains jours.
                        {nbRetards > 0 && <strong className="maud-retards"> {nbRetards} en retard.</strong>}
                    </p>

                    {chargement ? (
                        <p className="aud-vide">Chargement...</p>
                    ) : aTraiterFiltres.length === 0 ? (
                        <p className="aud-vide">
                            {aTraiter.length === 0
                                ? "Aucun audit à traiter pour le moment."
                                : "Aucun audit ne correspond au filtre sélectionné."}
                        </p>
                    ) : (
                        <ul className="maud-cartes">
                            {aTraiterFiltres.map((audit) => (
                                <li key={audit.id}>
                                    <button type="button" className="maud-carte" onClick={() => ouvrir(audit)}>
                                        <div className="maud-carte-ligne-titre">
                                            <span className="maud-carte-titre">Titre : {audit.titre}</span>
                                            <span className={`aud-badge aud-badge--${etatDe(audit)}`}>
                                                {libelleEtat(audit)}
                                            </span>
                                        </div>

                                        <div className="maud-carte-badges">
                                            <span className="maud-badge-type-audit">
                                                {(TYPES_AUDIT[audit.typeAudit] ?? audit.typeAudit).toLowerCase()}
                                            </span>
                                            {audit.etape && (
                                                <span className="maud-badge-action">
                                                    {TYPES_ACTION[audit.etape.type] ?? audit.etape.type}
                                                </span>
                                            )}
                                        </div>

                                        {audit.etape?.description && (
                                            <p className="maud-carte-description">
                                                <strong>Description : </strong>{audit.etape.description}
                                            </p>
                                        )}

                                        <div className="maud-carte-pied">
                                            <span className="maud-carte-processus">
                                                <FiMapPin className="maud-icon-pin" /> Processus : {audit.processus || "N/A"}
                                            </span>
                                            <span className="maud-carte-date">
                                                Prévu le : <strong>{formaterDate(audit.date)}</strong>
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>

            {/* TIROIR LATÉRAL (PROGRAMME DU JOUR) */}
            {jourSelectionne && (
                <div className="maud-drawer-overlay" onClick={() => setJourSelectionne(null)}>
                    <div 
                        className="maud-drawer" 
                        onClick={(e) => e.stopPropagation()} 
                        role="dialog" 
                        aria-modal="true" 
                        aria-labelledby="maud-drawer-titre"
                    >
                        <header className="maud-drawer-header">
                            <div>
                                <span className="maud-drawer-sous-titre">Programme du jour</span>
                                <h3 id="maud-drawer-titre">
                                    <FiCalendar className="maud-icon-titre" /> Date : {formaterDate(jourSelectionne)}
                                </h3>
                            </div>
                            <button 
                                type="button" 
                                className="maud-drawer-fermer" 
                                onClick={() => setJourSelectionne(null)}
                                aria-label="Fermer le panneau"
                            >
                                <FiX />
                            </button>
                        </header>

                        <div className="maud-drawer-corps">
                            {auditsJourSelectionne.length === 0 ? (
                                <p className="aud-vide">
                                    {filtreStatut === "TOUS"
                                        ? "Aucun audit programmé pour cette journée."
                                        : "Aucun audit ne correspond au filtre sélectionné pour cette journée."}
                                </p>
                            ) : (
                                <ul className="maud-drawer-liste">
                                    {auditsJourSelectionne.map((audit) => (
                                        <li key={audit.id}>
                                            <button 
                                                type="button" 
                                                className="maud-drawer-item" 
                                                onClick={() => ouvrir(audit)}
                                            >
                                                <div className="maud-carte-ligne-titre">
                                                    <h4 className="maud-drawer-item-titre">Titre : {audit.titre}</h4>
                                                    <span className={`aud-badge aud-badge--${etatDe(audit)}`}>
                                                        {libelleEtat(audit)}
                                                    </span>
                                                </div>

                                                <div className="maud-carte-badges">
                                                    <span className="maud-badge-type-audit">
                                                        {(TYPES_AUDIT[audit.typeAudit] ?? audit.typeAudit).toLowerCase()}
                                                    </span>
                                                    {audit.etape && (
                                                        <span className="maud-badge-action">
                                                            {TYPES_ACTION[audit.etape.type] ?? audit.etape.type}
                                                        </span>
                                                    )}
                                                </div>

                                                {audit.nc && (
                                                    <p className="maud-drawer-item-ref">
                                                        Ref NC : <strong>{audit.nc.reference}</strong>
                                                    </p>
                                                )}

                                                {audit.etape?.description && (
                                                    <p className="maud-drawer-item-capa-desc">
                                                        <strong>Description : </strong>{audit.etape.description}
                                                    </p>
                                                )}

                                                <div className="maud-carte-pied">
                                                    <span className="maud-carte-processus">
                                                        <FiMapPin className="maud-icon-pin" /> Processus : {audit.processus || "N/A"}
                                                    </span>
                                                </div>

                                                <span className="maud-drawer-item-action">
                                                    Ouvrir l'audit <FiArrowRight className="maud-icon-arrow" />
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}