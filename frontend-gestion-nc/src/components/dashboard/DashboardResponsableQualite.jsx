import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api/api";
import HistogrammeMensuel from "./HistogrammeMensuel";
import { MOIS_LONGS } from "./mois";
import {
    FiRefreshCw, FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiClock,
} from "react-icons/fi";
import "./DashbboardResponsablequalite.css";

const nombre = (valeur) => Number(valeur ?? 0).toLocaleString("fr-FR");
const pourcentage = (valeur) => (valeur == null ? "—" : `${String(valeur).replace(".", ",")} %`);

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
export default function Dashbboard_Responsable_qualite() {
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

    const picDeclarees = useMemo(() => (donnees ? phrasePic(donnees.parMois, "declarees") : null), [donnees]);
    const picPrises = useMemo(() => (donnees ? phrasePic(donnees.parMois, "prisesEnCharge") : null), [donnees]);

    const ind = donnees?.indicateurs;
    const audits = donnees?.audits;
    const maxProcessus = Math.max(1, ...(donnees?.recurrenceParProcessus ?? []).map((p) => p.nbNc));

    return (
        <main className="dash-page">
            <header className="dash-header">
                <div>
                    <span className="dash-eyebrow">
                        PILOTAGE QUALITÉ
                    </span>
                    <h1>Tableau de bord</h1>
                    <p>Suivi des non-conformités, des délais de traitement et de l’avancement des audits.</p>
                </div>
                <button type="button" className="dash-btn" onClick={() => charger(annee)} disabled={chargement}>
                    <FiRefreshCw className={chargement ? "dash-spin" : ""} /> <span>Actualiser</span>
                </button>
            </header>

            {erreur && (
                <div className="dash-alerte" role="alert">
                    <FiAlertTriangle /> <span>{erreur}</span>
                </div>
            )}

            {!donnees && chargement && <p className="dash-etat">Chargement des indicateurs...</p>}

            {donnees && (
                <>
                    {/* ---- KPI de traitement dans les délais ---- */}
                    <section className="dash-kpis dash-kpis-delais" aria-label="Indicateurs de traitement dans les délais">
                        <article className="dash-kpi dash-kpi--principal">
                            <span className="dash-kpi-libelle">
                                <FiCheckCircle /> Taux de clôture dans les délais
                            </span>
                            <strong className="dash-kpi-valeur">{pourcentage(ind.tauxDansLesDelais)}</strong>
                            <div className="dash-jauge" aria-hidden="true">
                                <div
                                    className="dash-jauge-remplie"
                                    style={{ width: `${Math.min(100, Math.max(0, ind.tauxDansLesDelais ?? 0))}%` }}
                                />
                            </div>
                            <span className="dash-kpi-detail">
                                Calculé sur les NC clôturées à temps et les NC hors délai
                                (clôturées en retard ou encore ouvertes après échéance).
                            </span>
                        </article>

                        <article className="dash-kpi dash-kpi--delais-ok">
                            <span className="dash-kpi-libelle"><FiCheckCircle /> Dans les délais</span>
                            <strong className="dash-kpi-valeur">{nombre(ind.dansLesDelais)}</strong>
                            <span className="dash-kpi-detail">
                                {nombre(ind.repartitionDelais?.dansLesDelaisCloturees ?? ind.dansLesDelais)}
                                {' '}NC clôturée(s) au plus tard à la date d'échéance.
                            </span>
                        </article>

                        <article className="dash-kpi dash-kpi--delais-retard">
                            <span className="dash-kpi-libelle"><FiAlertCircle /> Hors délais</span>
                            <strong className="dash-kpi-valeur">{nombre(ind.horsDelais)}</strong>
                            <div className="dash-retard-detail">
                                <span>En attente <strong>{nombre(ind.repartitionDelais?.horsDelaisEnAttente)}</strong></span>
                                <span>Ouvertes <strong>{nombre(ind.repartitionDelais?.horsDelaisOuvertes)}</strong></span>
                                <span>En analyse <strong>{nombre(ind.repartitionDelais?.horsDelaisEnCoursAnalyse)}</strong></span>
                                <span>En traitement <strong>{nombre(ind.repartitionDelais?.horsDelaisEnTraitement)}</strong></span>
                                <span>Clôturées <strong>{nombre(ind.repartitionDelais?.horsDelaisCloturees)}</strong></span>
                            </div>
                        </article>

                        <article className="dash-kpi">
                            <span className="dash-kpi-libelle"><FiClock /> Délai moyen de traitement</span>
                            <strong className="dash-kpi-valeur">
                                {ind.delaiMoyenJours == null ? "—" : `${String(ind.delaiMoyenJours).replace(".", ",")} j`}
                            </strong>
                            <span className="dash-kpi-detail">De la déclaration à la clôture · {nombre(ind.reouvertures)} réouverture(s)</span>
                        </article>
                    </section>

                    {/* ---- Répartition exacte des cinq statuts ---- */}
                    <section className="dash-statuts" aria-label="Résumé des non-conformités par statut">
                        <header className="dash-statuts-entete">
                            <div>
                                <h2>Résumé des non-conformités</h2>
                                <p>{nombre(ind.total)} non-conformité(s) au total, réparties selon leur statut actuel.</p>
                            </div>
                        </header>
                        <div className="dash-statuts-grille">
                            <article className="dash-statut-card statut-attente">
                                <span>En attente</span>
                                <strong>{nombre(ind.enAttente)}</strong>
                            </article>
                            <article className="dash-statut-card statut-ouvert">
                                <span>En cours / ouvertes</span>
                                <strong>{nombre(ind.ouvert ?? Math.max(0, ind.enCours - (ind.enCoursAnalyse ?? 0) - (ind.enTraitement ?? 0)))}</strong>
                            </article>
                            <article className="dash-statut-card statut-analyse">
                                <span>En cours d'analyse</span>
                                <strong>{nombre(ind.enCoursAnalyse)}</strong>
                            </article>
                            <article className="dash-statut-card statut-traitement">
                                <span>En traitement</span>
                                <strong>{nombre(ind.enTraitement)}</strong>
                            </article>
                            <article className="dash-statut-card statut-cloture">
                                <span>Clôturées</span>
                                <strong>{nombre(ind.cloturees)}</strong>
                            </article>
                        </div>
                    </section>

                    {/* ---- Histogramme mensuel ---- */}
                    <section className="dash-carte">
                        <header className="dash-carte-entete">
                            <div>
                                <h2>Non-conformités par mois</h2>
                                <p>Déclarées et prises en charge (ouvertes) en {donnees.annee}.</p>
                            </div>
                            <label className="dash-annee">
                                <span>Année</span>
                                <select
                                    value={donnees.annee}
                                    onChange={(e) => setAnnee(Number(e.target.value))}
                                >
                                    {donnees.anneesDisponibles.map((a) => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </label>
                        </header>

                        <div className="dash-legende">
                            <span><i className="dash-puce declarees" /> Déclarées</span>
                            <span><i className="dash-puce prises" /> Prises en charge (ouvertes)</span>
                        </div>

                        <HistogrammeMensuel donnees={donnees.parMois} />

                        <ul className="dash-faits">
                            <li>
                                {picDeclarees
                                    ? <>Mois avec le plus de NC <strong>déclarées</strong> : <strong>{picDeclarees.mois}</strong> ({picDeclarees.valeur})</>
                                    : <>Aucune NC déclarée en {donnees.annee}.</>}
                            </li>
                            <li>
                                {picPrises
                                    ? <>Mois avec le plus de NC <strong>prises en charge</strong> : <strong>{picPrises.mois}</strong> ({picPrises.valeur})</>
                                    : <>Aucune NC prise en charge en {donnees.annee}.</>}
                            </li>
                        </ul>
                    </section>

                    <div className="dash-deux-colonnes">
                        {/* ---- Récurrence par processus ---- */}
                        <section className="dash-carte">
                            <header className="dash-carte-entete">
                                <div>
                                    <h2>Récurrence par processus</h2>
                                    <p>Nombre de non-conformités par processus (toutes années).</p>
                                </div>
                            </header>
                            {donnees.recurrenceParProcessus.length === 0 ? (
                                <p className="dash-vide">Aucune non-conformité enregistrée.</p>
                            ) : (
                                <ul className="dash-barres">
                                    {donnees.recurrenceParProcessus.map((p) => (
                                        <li key={p.processus}>
                                            <div className="dash-barres-ligne">
                                                <span className="dash-barres-nom" title={p.processus}>{p.processus}</span>
                                                <span className="dash-barres-nb">
                                                    {nombre(p.nbNc)}
                                                    {p.nbReouvertures > 0 && (
                                                        <small> · {nombre(p.nbReouvertures)} réouv.</small>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="dash-barres-piste">
                                                <div
                                                    className="dash-barres-remplie"
                                                    style={{ width: `${(p.nbNc / maxProcessus) * 100}%` }}
                                                />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {/* ---- Avancement des audits ---- */}
                        <section className="dash-carte">
                            <header className="dash-carte-entete">
                                <div>
                                    <h2>Avancement des audits</h2>
                                    <p>{nombre(audits.total)} audit(s) au planning.</p>
                                </div>
                            </header>
                            {audits.total === 0 ? (
                                <p className="dash-vide">Aucun audit planifié.</p>
                            ) : (
                                <>
                                    <div className="dash-empile" role="img" aria-label="Répartition des audits par statut">
                                        <div className="dash-empile-part planifie" style={{ flexGrow: audits.planifies }} />
                                        <div className="dash-empile-part encours" style={{ flexGrow: audits.enCours }} />
                                        <div className="dash-empile-part termine" style={{ flexGrow: audits.termines }} />
                                    </div>
                                    <ul className="dash-audits-liste">
                                        <li><i className="dash-puce planifie" /> Planifiés <strong>{nombre(audits.planifies)}</strong></li>
                                        <li><i className="dash-puce encours" /> En cours <strong>{nombre(audits.enCours)}</strong></li>
                                        <li><i className="dash-puce termine" /> Terminés <strong>{nombre(audits.termines)}</strong></li>
                                    </ul>
                                    {audits.enRetard > 0 && (
                                        <p className="dash-retard">
                                            <FiAlertCircle /> {nombre(audits.enRetard)} audit(s) planifié(s) en retard
                                        </p>
                                    )}
                                    <p className="dash-kpi-detail">
                                        Taux de réalisation : {pourcentage(Math.round((audits.termines / audits.total) * 1000) / 10)}
                                    </p>
                                </>
                            )}
                        </section>
                    </div>
                </>
            )}
        </main>
    );
}