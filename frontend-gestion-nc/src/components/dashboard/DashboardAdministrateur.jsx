import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    FiActivity, FiArrowRight, FiRefreshCw, FiRotateCcw, FiUsers,
    FiAlertTriangle,
} from "react-icons/fi";
import "./DashboardAdministrateur.css"

const nombre = (valeur) => Number(valeur ?? 0).toLocaleString("fr-FR");

export default function DashboardAdministrateur({ admin, chargement, erreur, actualiser }) {
    const navigate = useNavigate();
    const [periode, setPeriode] = useState("mois");

    const series = periode === "jour" ? (admin?.activiteParJour ?? []) : (admin?.activiteParMois ?? []);
    const totalActivites = useMemo(
        () => series.reduce((somme, item) => somme + Number(item.total ?? 0), 0),
        [series]
    );
    const maximum = Math.max(1, ...series.map((item) => Number(item.total ?? 0)));
    const pic = useMemo(() => {
        if (!series.length || maximum === 0 || totalActivites === 0) return null;
        return series.reduce((meilleur, item) =>
            Number(item.total) > Number(meilleur.total) ? item : meilleur, series[0]);
    }, [series, maximum, totalActivites]);

    const totalDemandes = Number(admin?.nbDemandesReinitialisation ?? 0);
    const statuts = [
        { label: "En attente", valeur: admin?.nbDemandesEnAttente, classe: "attente" },
        { label: "Validées", valeur: admin?.nbDemandesValidees, classe: "validee" },
        { label: "Rejetées", valeur: admin?.nbDemandesRejetees, classe: "rejetee" },
    ];

    return (
        <main className="dash-page dash-admin-page">
            <header className="dash-header">
                <div>
                    <span className="dash-eyebrow">ADMINISTRATION DU SMQ</span>
                    <h1>Tableau de bord administrateur</h1>
                    <p>Vue générale des utilisateurs, de l'activité et des demandes de réinitialisation.</p>
                </div>
                <button type="button" className="dash-btn" onClick={actualiser} disabled={chargement}>
                    <FiRefreshCw className={chargement ? "dash-spin" : ""} />
                    <span>Actualiser</span>
                </button>
            </header>

            {erreur && <div className="dash-alerte" role="alert"><FiAlertTriangle /> {erreur}</div>}
            {chargement && !admin && <p className="dash-etat">Chargement des indicateurs...</p>}

            {admin && (
                <>
                    <section className="dash-admin" aria-label="Indicateurs administrateur">
                        <button type="button" className="dash-carte-lien utilisateurs"
                            onClick={() => navigate("/admin/utilisateurs")}>
                            <span className="dash-carte-icone"><FiUsers /></span>
                            <span className="dash-carte-texte">
                                <span className="dash-carte-libelle">Nombre total d'utilisateurs</span>
                                <strong className="dash-carte-valeur">{nombre(admin.nbUtilisateurs)}</strong>
                                <span className="dash-carte-detail">Comptes enregistrés dans l'application</span>
                            </span>
                            <span className="dash-carte-aller">Gérer les utilisateurs <FiArrowRight /></span>
                        </button>

                        <button type="button" className="dash-carte-lien reinit"
                            onClick={() => navigate("/admin/reinitialisations?filtre=TOUTES")}>
                            <span className="dash-carte-icone"><FiRotateCcw /></span>
                            <span className="dash-carte-texte">
                                <span className="dash-carte-libelle">Demandes de réinitialisation</span>
                                <strong className="dash-carte-valeur">{nombre(totalDemandes)}</strong>
                                <span className="dash-carte-detail">Toutes les demandes enregistrées</span>
                            </span>
                            <span className="dash-carte-aller">Consulter les demandes <FiArrowRight /></span>
                        </button>
                    </section>
                    
                    <section className="dash-carte admin-reinitialisations">
                        <header className="dash-carte-entete">
                            <div>
                                <h2>État des demandes de réinitialisation</h2>
                                <p>Répartition selon le statut de traitement.</p>
                            </div>
                            <strong className="admin-total-demandes">{nombre(totalDemandes)} au total</strong>
                        </header>
                        <div className="admin-statuts-demandes">
                            {statuts.map((statut) => (
                                <div className={`admin-statut-demande ${statut.classe}`} key={statut.label}>
                                    <span>{statut.label}</span>
                                    <strong>{nombre(statut.valeur)}</strong>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="dash-carte admin-activite">
                        <header className="dash-carte-entete">
                            <div>
                                <h2><FiActivity /> Activité des utilisateurs</h2>
                                <p>Répartition des actions enregistrées dans l'historique.</p>
                            </div>
                            <div className="admin-periode" role="group" aria-label="Période du graphique">
                                <button type="button" className={periode === "jour" ? "active" : ""}
                                    onClick={() => setPeriode("jour")}>Par jour</button>
                                <button type="button" className={periode === "mois" ? "active" : ""}
                                    onClick={() => setPeriode("mois")}>Par mois</button>
                            </div>
                        </header>

                        <div className="admin-activite-resume">
                            <div><span>Total sur la période affichée</span><strong>{nombre(totalActivites)}</strong></div>
                            <div><span>Période la plus active</span><strong>{pic ? pic.periode : "Aucune activité"}</strong></div>
                            <div><span>Part du pic</span><strong>{pic && totalActivites ? `${(pic.total * 100 / totalActivites).toFixed(1).replace(".", ",")} %` : "0 %"}</strong></div>
                        </div>

                        {totalActivites === 0 ? (
                            <p className="dash-vide">Aucune activité enregistrée pour cette période.</p>
                        ) : (
                            <div className={`admin-activite-liste ${periode === "jour" ? "quotidien" : "mensuel"}`}>
                                {series.map((item) => {
                                    const part = totalActivites ? Number(item.total) * 100 / totalActivites : 0;
                                    return (
                                        <div className="admin-activite-ligne" key={item.periode}>
                                            <span className="admin-activite-label">{item.periode}</span>
                                            <div className="admin-activite-piste" title={`${nombre(item.total)} action(s), ${part.toFixed(1)} %`}>
                                                <div className="admin-activite-remplie" style={{ width: `${part}%` }} />
                                            </div>
                                            <strong>{part.toFixed(1).replace(".", ",")} %</strong>
                                            <small>{nombre(item.total)}</small>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p className="admin-activite-note">Le pourcentage représente la part des actions de chaque période dans le total affiché.</p>
                    </section>

                    
                </>
            )}
        </main>
    );
}