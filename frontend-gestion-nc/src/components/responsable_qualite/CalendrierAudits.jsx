import { useEffect, useMemo, useRef, useState } from "react";
import { TYPES_ACTION, dateAujourdhui, formaterDate } from "../constantes";
import "./CalendrierAudits.css";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const PUCES_VISIBLES = 3;
const TYPES_AUDIT = { INTERNE: "Interne", EXTERNE: "Externe" };

const deuxChiffres = (n) => String(n).padStart(2, "0");
const versIso = (annee, mois, jour) => `${annee}-${deuxChiffres(mois + 1)}-${deuxChiffres(jour)}`;

/** Ramène une date renvoyée par l'API au format AAAA-MM-JJ (comparable comme texte). */
export const jourIso = (date) => (date ? String(date).slice(0, 10) : "");

/** Cellules du mois, semaine commençant le lundi ; null = case vide. */
function construireGrille(annee, mois) {
    const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7;
    const nbJours = new Date(annee, mois + 1, 0).getDate();
    const cellules = Array(decalage).fill(null);
    for (let jour = 1; jour <= nbJours; jour++) {
        cellules.push({ jour, iso: versIso(annee, mois, jour) });
    }
    while (cellules.length % 7 !== 0) cellules.push(null);
    return cellules;
}

/**
 * Règle de planification : le jour ne doit pas être avant aujourd'hui
 * ni après l'échéance de l'étape. Renvoie le motif du refus, ou "" si autorisé.
 */
export function motifRefus(etape, jour, aujourdhui) {
    if (jour < aujourdhui) return "Ce jour est déjà passé.";
    const echeance = jourIso(etape.dateEcheance);
    if (echeance && jour > echeance) {
        return `Après l'échéance de l'étape (${formaterDate(echeance)}).`;
    }
    return "";
}

export default function CalendrierAudits({ etapes, planning, etapeGlissee, avertissement, onPlanifier, onRetirer }) {
    const aujourdhui = dateAujourdhui();

    const [annee, setAnnee] = useState(Number(aujourdhui.slice(0, 4)));
    const [mois, setMois] = useState(Number(aujourdhui.slice(5, 7)) - 1);
    const [jourOuvert, setJourOuvert] = useState(null);
    const [selection, setSelection] = useState([]);
    const [typeAudit, setTypeAudit] = useState("INTERNE");
    const tiroirRef = useRef(null);
    const [jourSurvole, setJourSurvole] = useState(null);
    const [enCours, setEnCours] = useState(false);
    const [erreur, setErreur] = useState("");
    const [info, setInfo] = useState("");

    const etapesParId = useMemo(() => new Map(etapes.map((e) => [e.id, e])), [etapes]);
    const numeros = useMemo(() => new Map(etapes.map((e, i) => [e.id, i + 1])), [etapes]);
    const grille = useMemo(() => construireGrille(annee, mois), [annee, mois]);

    // jour (AAAA-MM-JJ) -> entrées de planning, triées par numéro d'étape
    const parJour = useMemo(() => {
        const resultat = new Map();
        planning.forEach((p) => {
            const jour = jourIso(p.date);
            if (!resultat.has(jour)) resultat.set(jour, []);
            resultat.get(jour).push(p);
        });
        resultat.forEach((liste) =>
            liste.sort((a, b) => (numeros.get(a.etapeId) || 0) - (numeros.get(b.etapeId) || 0)));
        return resultat;
    }, [planning, numeros]);

    // Tiroir : Échap le ferme, et le focus y entre à l'ouverture
    useEffect(() => {
        if (!jourOuvert) return undefined;
        const surTouche = (e) => { if (e.key === "Escape") setJourOuvert(null); };
        window.addEventListener("keydown", surTouche);
        tiroirRef.current?.focus();
        return () => window.removeEventListener("keydown", surTouche);
    }, [jourOuvert]);

    function changerMois(delta) {
        const d = new Date(annee, mois + delta, 1);
        setAnnee(d.getFullYear());
        setMois(d.getMonth());
    }

    function revenirAujourdhui() {
        setAnnee(Number(aujourdhui.slice(0, 4)));
        setMois(Number(aujourdhui.slice(5, 7)) - 1);
    }

    function ouvrirJour(jour) {
        setInfo("");
        setSelection([]);
        if (jour < aujourdhui) {
            setJourOuvert(null);
            setErreur("Impossible de planifier un audit avant aujourd'hui.");
            return;
        }
        setErreur("");
        setJourOuvert(jour);
    }

    function basculerSelection(idEtape) {
        setSelection((actuelle) =>
            actuelle.includes(idEtape) ? actuelle.filter((id) => id !== idEtape) : [...actuelle, idEtape]);
    }

    /** Point d'entrée commun au glisser-déposer et au formulaire. */
    async function planifier(jour, idsEtapes, type = "INTERNE") {
        setErreur("");
        setInfo("");

        for (const id of idsEtapes) {
            const etape = etapesParId.get(id);
            const motif = etape ? motifRefus(etape, jour, aujourdhui) : "Étape introuvable.";
            if (motif) {
                setErreur(`Étape ${numeros.get(id) ?? "?"} : ${motif}`);
                return false;
            }
        }

        const dejaPlanifiees = new Set((parJour.get(jour) || []).map((p) => p.etapeId));
        const aAjouter = idsEtapes.filter((id) => !dejaPlanifiees.has(id));
        if (aAjouter.length === 0) {
            setInfo(`Déjà planifié le ${formaterDate(jour)}.`);
            return false;
        }

        setEnCours(true);
        try {
            await onPlanifier(jour, aAjouter, type);
            setInfo(`${aAjouter.length} étape(s) planifiée(s) le ${formaterDate(jour)}.`);
            return true;
        } catch (e) {
            setErreur(e.message || "La planification a échoué.");
            return false;
        } finally {
            setEnCours(false);
        }
    }

    async function retirer(entree) {
        setErreur("");
        setInfo("");
        try {
            await onRetirer(entree.id);
        } catch (e) {
            setErreur(e.message || "Impossible de retirer cette planification.");
        }
    }

    function deposer(event, jour) {
        event.preventDefault();
        setJourSurvole(null);
        const id = Number(event.dataTransfer.getData("text/plain")) || etapeGlissee?.id;
        if (id) planifier(jour, [id]);
    }

    async function validerFormulaire(event) {
        event.preventDefault();
        if (selection.length === 0) {
            setErreur("Sélectionnez au moins une étape.");
            return;
        }
        if (await planifier(jourOuvert, selection, typeAudit)) {
            setSelection([]);
            setJourOuvert(null);
        }
    }

    const entreesDuJourOuvert = jourOuvert ? parJour.get(jourOuvert) || [] : [];

    return (
        <section className="cal" aria-labelledby="cal-titre">
            <h2 id="cal-titre">Calendrier d'audits</h2>
            <p className="cal-aide">
                Glissez une étape CAPA sur un jour, ou cliquez sur un jour pour choisir les étapes à auditer.
                Une étape peut être planifiée sur plusieurs jours, et un jour peut recevoir plusieurs étapes.
            </p>
            {avertissement && <p className="cal-avertissement" role="note">{avertissement}</p>}

            {erreur && !jourOuvert && <p className="nc-erreur" role="alert">{erreur}</p>}
            {info && <p className="nc-succes" role="status">{info}</p>}

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
                    const entrees = parJour.get(iso) || [];
                    const classes = ["cal-jour"];
                    if (iso < aujourdhui) classes.push("cal-jour--passe");
                    if (iso === aujourdhui) classes.push("cal-jour--aujourdhui");
                    if (iso === jourOuvert) classes.push("cal-jour--ouvert");
                    if (iso === jourSurvole) classes.push("cal-jour--survole");
                    if (etapeGlissee) {
                        classes.push(motifRefus(etapeGlissee, iso, aujourdhui) ? "cal-jour--refuse" : "cal-jour--accepte");
                    }

                    return (
                        <div
                            key={iso}
                            className={classes.join(" ")}
                            role="gridcell"
                            onClick={() => ouvrirJour(iso)}
                            onDragOver={(e) => { e.preventDefault(); setJourSurvole(iso); }}
                            onDragLeave={() => setJourSurvole((j) => (j === iso ? null : j))}
                            onDrop={(e) => deposer(e, iso)}
                        >
                            <button
                                type="button"
                                className="cal-jour-numero"
                                aria-label={`Planifier le ${formaterDate(iso)}`}
                                onClick={(e) => { e.stopPropagation(); ouvrirJour(iso); }}
                            >
                                {jour}
                            </button>

                            {entrees.length > 0 && (
                                <ul className="cal-puces">
                                    {entrees.slice(0, PUCES_VISIBLES).map((p) => {
                                        const etape = etapesParId.get(p.etapeId);
                                        const numero = numeros.get(p.etapeId) ?? "?";
                                        return (
                                            <li
                                                key={p.id}
                                                className={`cal-puce cal-puce--${etape?.type}`}
                                                title={`${etape?.description ?? ""} (audit ${(TYPES_AUDIT[p.typeAudit] ?? "").toLowerCase()})`.trim()}
                                            >
                                                <span>Étape {numero}</span>
                                                {(!p.statut || p.statut === "PLANIFIE") && (
                                                    <button
                                                        type="button"
                                                        className="cal-puce-retirer"
                                                        aria-label={`Retirer l'étape ${numero} du ${formaterDate(iso)}`}
                                                        onClick={(e) => { e.stopPropagation(); retirer(p); }}
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                    {entrees.length > PUCES_VISIBLES && (
                                        <li className="cal-puce-plus">+{entrees.length - PUCES_VISIBLES} autres</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            {jourOuvert && (
                <>
                    <div className="cal-voile" onClick={() => setJourOuvert(null)} />
                    <aside
                        ref={tiroirRef}
                        className="cal-tiroir"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cal-tiroir-titre"
                        tabIndex={-1}
                    >
                        <header className="cal-tiroir-entete">
                            <h3 id="cal-tiroir-titre">Planifier le {formaterDate(jourOuvert)}</h3>
                            <button type="button" className="cal-tiroir-fermer" aria-label="Fermer" onClick={() => setJourOuvert(null)}>×</button>
                        </header>

                        <form className="cal-tiroir-formulaire" onSubmit={validerFormulaire}>
                            <div className="cal-tiroir-corps">
                                {erreur && <p className="nc-erreur" role="alert">{erreur}</p>}

                                {entreesDuJourOuvert.length > 0 && (
                                    <section className="cal-deja">
                                        <h4>Déjà planifié ce jour</h4>
                                        <ul>
                                            {entreesDuJourOuvert.map((p) => {
                                                const etape = etapesParId.get(p.etapeId);
                                                return (
                                                    <li key={p.id}>
                                                        <span>
                                                            <strong>Étape {numeros.get(p.etapeId) ?? "?"}</strong>{" "}
                                                            <span className="cal-deja-type">audit {(TYPES_AUDIT[p.typeAudit] ?? "").toLowerCase()}</span>
                                                            <span className="cal-description">{etape?.description}</span>
                                                        </span>
                                                        {(!p.statut || p.statut === "PLANIFIE") && (
                                                            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={() => retirer(p)}>Retirer</button>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                )}

                                <div className="nc-champ cal-champ">
                                    <label htmlFor="cal-type-audit">Type d'audit</label>
                                    <select id="cal-type-audit" value={typeAudit} onChange={(e) => setTypeAudit(e.target.value)} disabled={enCours}>
                                        {Object.entries(TYPES_AUDIT).map(([code, libelle]) => (
                                            <option key={code} value={code}>{libelle}</option>
                                        ))}
                                    </select>
                                </div>

                                <fieldset className="cal-groupe">
                                    <legend>Étapes à auditer ce jour-là</legend>
                                    {etapes.length === 0 ? (
                                        <p className="cal-aide">Ajoutez d'abord une étape CAPA pour pouvoir la planifier.</p>
                                    ) : (
                                        <ul className="cal-choix">
                                            {etapes.map((etape, index) => {
                                                const motif = motifRefus(etape, jourOuvert, aujourdhui);
                                                const deja = entreesDuJourOuvert.some((p) => p.etapeId === etape.id);
                                                const desactive = Boolean(motif) || deja;
                                                const idChamp = `cal-choix-${etape.id}`;
                                                return (
                                                    <li key={etape.id} className={desactive ? "cal-choix--desactive" : ""}>
                                                        <input
                                                            id={idChamp}
                                                            type="checkbox"
                                                            checked={selection.includes(etape.id)}
                                                            disabled={desactive || enCours}
                                                            onChange={() => basculerSelection(etape.id)}
                                                        />
                                                        <label htmlFor={idChamp}>
                                                            <strong>Étape {index + 1}</strong>{" "}
                                                            <span className={`capa-type capa-type--${etape.type}`}>{TYPES_ACTION[etape.type] ?? etape.type}</span>
                                                            <span className="cal-description">{etape.description}</span>
                                                            {(deja || motif) && (
                                                                <em className="cal-motif">{deja ? "Déjà planifiée ce jour." : motif}</em>
                                                            )}
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </fieldset>
                            </div>

                            <footer className="cal-actions">
                                <button type="submit" className="nc-btn" disabled={enCours || selection.length === 0}>
                                    {enCours ? "Enregistrement..." : `Planifier${selection.length > 0 ? ` (${selection.length})` : ""}`}
                                </button>
                                <button type="button" className="nc-btn nc-btn-secondaire" disabled={enCours} onClick={() => setJourOuvert(null)}>
                                    Fermer
                                </button>
                            </footer>
                        </form>
                    </aside>
                </>
            )}
        </section>
    );
}