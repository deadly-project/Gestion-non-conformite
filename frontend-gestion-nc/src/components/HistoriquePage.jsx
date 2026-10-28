import { useEffect, useState, useMemo } from "react";
import {
    // UI
    FiClock, FiRefreshCw, FiFilter, FiX, FiChevronLeft, FiChevronRight,
    FiCalendar, FiUser, FiLayers, FiInbox, FiSliders, FiChevronDown,
    FiChevronUp, FiAlertCircle, FiActivity, FiArrowUpRight,
    // Catégories d'action
    FiPlusCircle, FiEdit2, FiTrash2, FiPlay, FiLock, FiUnlock,
    FiLogIn, FiSend, FiFileText, FiMessageSquare, FiPaperclip,
    FiKey, FiUserPlus, FiUserX, FiRotateCcw, FiXCircle, FiCheckCircle,
    FiArrowRight,
} from "react-icons/fi";
import { apiRequest } from "../api/api";
import { formaterDate } from "./constantes";
import { formaterDateHeure } from "./Auditeur/libelles";
import HistoriqueDetails from "./HistoriqueDetails";
import "./HistoriquePage.css";

const TAILLE_PAGE = 20;

/* ==========================================================================
   Config actions : libellé + ton (couleur) + icône
   ========================================================================== */
const ACTIONS_CONFIG = {
    ADD_NC:                   { libelle: "Ajout d'une non-conformité",        ton: "create",   icone: FiPlusCircle },
    CREATE_NC:                { libelle: "Création d'une non-conformité",     ton: "create",   icone: FiPlusCircle },
    UPDATE_NC:                { libelle: "Modification d'une non-conformité", ton: "update",   icone: FiEdit2 },
    TRAITEMENT_NC:            { libelle: "Traitement d'une non-conformité",   ton: "update",   icone: FiActivity },
    CLOSE_NC:                 { libelle: "Clôture d'une non-conformité",      ton: "close",    icone: FiLock },
    CLOTURER_NC:              { libelle: "Clôture d'une non-conformité",      ton: "close",    icone: FiLock },

    ADD_CAPA:                 { libelle: "Ajout d'une action CAPA",           ton: "create",   icone: FiPlusCircle },
    UPDATE_CAPA:              { libelle: "Modification d'une action CAPA",    ton: "update",   icone: FiEdit2 },
    VALIDATE_CAPA:            { libelle: "Validation d'une action CAPA",      ton: "validate", icone: FiCheckCircle },
    VALIDER_CAPA:             { libelle: "Validation d'une action CAPA",      ton: "validate", icone: FiCheckCircle },
    CANCEL_CAPA_VALIDATION:   { libelle: "Annulation de validation CAPA",     ton: "reject",   icone: FiXCircle },
    ANNULER_VALIDATION_CAPA:  { libelle: "Annulation de validation CAPA",     ton: "reject",   icone: FiXCircle },

    ADD_AUDIT:                { libelle: "Ajout d'un audit",                  ton: "create",   icone: FiPlusCircle },
    ADD_AUDIT_PLANNING:       { libelle: "Planification d'un audit",          ton: "create",   icone: FiCalendar },
    DELETE_AUDIT_PLANNING:    { libelle: "Retrait d'un audit du planning",    ton: "delete",   icone: FiTrash2 },
    START_AUDIT:              { libelle: "Démarrage d'un audit",              ton: "start",    icone: FiPlay },
    DEMARRER_AUDIT:           { libelle: "Démarrage d'un audit",              ton: "start",    icone: FiPlay },
    UPDATE_AUDIT:             { libelle: "Mise à jour d'un audit",            ton: "update",   icone: FiEdit2 },
    ENREGISTRER_COMPTE_RENDU: { libelle: "Mise à jour d'un compte rendu",     ton: "update",   icone: FiFileText },
    CLOSE_AUDIT:              { libelle: "Clôture d'un audit",                ton: "close",    icone: FiLock },
    TERMINER_AUDIT:           { libelle: "Clôture d'un audit",                ton: "close",    icone: FiLock },
    REOPEN_AUDIT:             { libelle: "Réouverture d'un audit",            ton: "reopen",   icone: FiRotateCcw },
    REOUVRIR_AUDIT:           { libelle: "Réouverture d'un audit",            ton: "reopen",   icone: FiRotateCcw },

    ADD_CONSTAT:              { libelle: "Ajout d'un constat",                ton: "create",   icone: FiPlusCircle },
    AJOUTER_CONSTAT:          { libelle: "Ajout d'un constat",                ton: "create",   icone: FiPlusCircle },
    UPDATE_CONSTAT:           { libelle: "Modification d'un constat",         ton: "update",   icone: FiEdit2 },
    MODIFIER_CONSTAT:         { libelle: "Modification d'un constat",         ton: "update",   icone: FiEdit2 },
    DELETE_CONSTAT:           { libelle: "Suppression d'un constat",          ton: "delete",   icone: FiTrash2 },
    SUPPRIMER_CONSTAT:        { libelle: "Suppression d'un constat",          ton: "delete",   icone: FiTrash2 },
    ADD_CONSTAT_ATTACHMENT:   { libelle: "Ajout d'une preuve de constat",     ton: "create",   icone: FiPaperclip },
    ADD_COMMENT:              { libelle: "Ajout d'un commentaire",            ton: "create",   icone: FiMessageSquare },
    COMMENTER_CONSTAT:        { libelle: "Ajout d'un commentaire",            ton: "create",   icone: FiMessageSquare },

    ADD_USER:                 { libelle: "Création d'un utilisateur",         ton: "create",   icone: FiUserPlus },
    UPDATE_USER:              { libelle: "Modification d'un utilisateur",     ton: "update",   icone: FiEdit2 },
    DISABLE_USER:             { libelle: "Désactivation d'un utilisateur",    ton: "delete",   icone: FiUserX },
    ENABLE_USER:              { libelle: "Réactivation d'un utilisateur",     ton: "validate", icone: FiUser },
    UPDATE_PROFILE:           { libelle: "Modification du profil",            ton: "update",   icone: FiEdit2 },

    UPDATE_PASSWORD:          { libelle: "Changement de mot de passe",        ton: "update",   icone: FiKey },
    REQUEST_RESET_PASSWORD:   { libelle: "Demande de réinitialisation",       ton: "update",   icone: FiSend },
    VALIDATE_RESET_PASSWORD:  { libelle: "Validation de réinitialisation",    ton: "validate", icone: FiCheckCircle },
    REFUSE_RESET_PASSWORD:    { libelle: "Refus de réinitialisation",         ton: "reject",   icone: FiXCircle },
    LOGIN:                    { libelle: "Connexion",                         ton: "start",    icone: FiLogIn },
};

const CONFIG_DEFAUT = { libelle: null, ton: "neutral", icone: FiActivity };

function getConfigAction(code) {
    if (!code) return CONFIG_DEFAUT;
    if (ACTIONS_CONFIG[code]) return ACTIONS_CONFIG[code];
    if (code.includes("DELETE") || code.includes("SUPPRIMER")) return { libelle: null, ton: "delete", icone: FiTrash2 };
    if (code.includes("ADD") || code.includes("AJOUT") || code.includes("CREATE")) return { libelle: null, ton: "create", icone: FiPlusCircle };
    if (code.includes("UPDATE") || code.includes("MODIF")) return { libelle: null, ton: "update", icone: FiEdit2 };
    return CONFIG_DEFAUT;
}

const libelleAction = (code) => getConfigAction(code).libelle || code;

/* ==========================================================================
   Helpers
   ========================================================================== */
function formatRelatif(dateStr) {
    if (!dateStr) return "";
    const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diffSec < 60) return "à l'instant";
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
    if (diffSec < 172800) return "hier";
    if (diffSec < 604800) return `il y a ${Math.floor(diffSec / 86400)} j`;
    return "";
}

/** Extrait "HH:MM" d'une date ISO */
function heureSeule(dateStr) {
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "—";
    }
}

/** Extrait "DD MMM" d'une date ISO */
function jourCourt(dateStr) {
    if (!dateStr) return "—";
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    } catch {
        return "—";
    }
}

const initiales = (prenom, nom) =>
    ((prenom?.[0] || "?") + (nom?.[0] || "")).toUpperCase();

/* ==========================================================================
   Composants utilitaires
   ========================================================================== */
function SkeletonTimeline() {
    return (
        <div className="histo-timeline">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="histo-tl-item histo-tl-item--skeleton">
                    <div className="histo-tl-rail">
                        <span className="histo-skeleton-dot" />
                    </div>
                    <div className="histo-tl-card">
                        <div className="histo-skeleton-line" style={{ width: "30%" }} />
                        <div className="histo-skeleton-line" style={{ width: "70%" }} />
                        <div className="histo-skeleton-line" style={{ width: "50%" }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function SelectModerne({ id, label, icone: Icone, value, onChange, options, placeholder }) {
    return (
        <div className="histo-filtre-champ">
            <label htmlFor={id}>{label}</label>
            <div className="histo-filtre-input-wrap">
                <Icone className="histo-filtre-icone" aria-hidden="true" />
                <select id={id} value={value} onChange={onChange} className="histo-filtre-select">
                    <option value="">{placeholder}</option>
                    {options}
                </select>
                <FiChevronDown className="histo-filtre-chevron" aria-hidden="true" />
            </div>
        </div>
    );
}

function InputDate({ id, label, value, onChange }) {
    return (
        <div className="histo-filtre-champ">
            <label htmlFor={id}>{label}</label>
            <div className="histo-filtre-input-wrap">
                <FiCalendar className="histo-filtre-icone" aria-hidden="true" />
                <input id={id} type="date" value={value} onChange={onChange} className="histo-filtre-input" />
            </div>
        </div>
    );
}

/* ==========================================================================
   Page principale
   ========================================================================== */
export default function HistoriquePage({ utilisateur }) {
    const estAdmin = utilisateur?.role === "ADMINISTRATEUR";
    const [donnees, setDonnees] = useState(null);
    const [options, setOptions] = useState({ typesAction: [], entites: [] });
    const [utilisateurs, setUtilisateurs] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState("");
    const [page, setPage] = useState(0);
    const [rafraichir, setRafraichir] = useState(0);
    const [filtresOuverts, setFiltresOuverts] = useState(false);

    const [filtres, setFiltres] = useState({
        utilisateurId: "", actionType: "", entite: "", debut: "", fin: "",
    });

    useEffect(() => {
        let actif = true;
        const parametres = new URLSearchParams({ page: String(page), taille: String(TAILLE_PAGE) });
        if (estAdmin && filtres.utilisateurId) parametres.set("utilisateurId", filtres.utilisateurId);
        if (filtres.actionType) parametres.set("actionType", filtres.actionType);
        if (filtres.entite) parametres.set("entite", filtres.entite);
        if (filtres.debut) parametres.set("debut", filtres.debut);
        if (filtres.fin) parametres.set("fin", filtres.fin);

        apiRequest(`/api/historique?${parametres}`)
            .then((r) => { if (actif) { setDonnees(r); setErreur(""); } })
            .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger l'historique."); })
            .finally(() => { if (actif) setChargement(false); });

        return () => { actif = false; };
    }, [page, filtres, estAdmin, rafraichir]);

    function actualiser() { setChargement(true); setRafraichir((v) => v + 1); }

    useEffect(() => {
        apiRequest("/api/historique/options")
            .then((d) => setOptions(d || { typesAction: [], entites: [] }))
            .catch(() => {});
        if (estAdmin) {
            apiRequest("/api/utilisateurs")
                .then((d) => setUtilisateurs(Array.isArray(d) ? d : []))
                .catch(() => {});
        }
    }, [estAdmin]);

    function majFiltre(nom, valeur) {
        setChargement(true);
        setPage(0);
        setFiltres((f) => ({ ...f, [nom]: valeur }));
    }

    function reinitialiser() {
        setChargement(true);
        setPage(0);
        setFiltres({ utilisateurId: "", actionType: "", entite: "", debut: "", fin: "" });
    }

    const filtresActifs = useMemo(() => {
        const arr = [];
        if (estAdmin && filtres.utilisateurId) {
            const u = utilisateurs.find((x) => String(x.id) === String(filtres.utilisateurId));
            if (u) arr.push({ cle: "utilisateurId", label: `${u.prenom} ${u.nom}` });
        }
        if (filtres.actionType) arr.push({ cle: "actionType", label: libelleAction(filtres.actionType) });
        if (filtres.entite) arr.push({ cle: "entite", label: filtres.entite });
        if (filtres.debut) arr.push({ cle: "debut", label: `Du ${formaterDate(filtres.debut)}` });
        if (filtres.fin) arr.push({ cle: "fin", label: `Au ${formaterDate(filtres.fin)}` });
        return arr;
    }, [filtres, estAdmin, utilisateurs]);

    const nbFiltresActifs = filtresActifs.length;

    return (
        <main className="nc-page histo-page">
            {/* ===== En-tête ===== */}
            <header className="histo-entete">
                <div>
                    <h1>
                        <span className="histo-entete-icone" aria-hidden="true"><FiClock /></span>
                        {estAdmin ? "Historique global" : "Mon historique"}
                    </h1>
                    <p className="nc-aide histo-sous-titre">
                        {estAdmin
                            ? "Journal complet des actions effectuées dans l'application."
                            : "Retrouvez ici toutes les actions que vous avez effectuées."}
                    </p>
                </div>
                <div className="histo-entete-boutons">
                    <button
                        type="button"
                        className={`nc-btn nc-btn-secondaire histo-btn-filtres ${filtresOuverts ? "is-actif" : ""}`}
                        onClick={() => setFiltresOuverts((v) => !v)}
                        aria-expanded={filtresOuverts}
                        aria-controls="histo-panneau-filtres"
                    >
                        <FiSliders aria-hidden="true" />
                        Filtres
                        {nbFiltresActifs > 0 && (
                            <span className="histo-filtres-compteur">{nbFiltresActifs}</span>
                        )}
                        {filtresOuverts ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                    <button
                        type="button"
                        className="nc-btn nc-btn-secondaire histo-btn-actualiser"
                        onClick={actualiser}
                        title="Rafraîchir"
                    >
                        <FiRefreshCw aria-hidden="true" /> Actualiser
                    </button>
                </div>
            </header>

            {/* ===== Filtres repliables ===== */}
            <div id="histo-panneau-filtres" className={`histo-filtres-panneau ${filtresOuverts ? "is-ouvert" : ""}`}>
                <div className="histo-filtres-inner">
                    <div className="histo-filtres-entete">
                        <h2><FiFilter aria-hidden="true" /> Filtres de recherche</h2>
                        {nbFiltresActifs > 0 && (
                            <button type="button" className="histo-btn-lien" onClick={reinitialiser}>
                                <FiX aria-hidden="true" /> Tout effacer
                            </button>
                        )}
                    </div>

                    <div className="histo-filtres-grille">
                        {estAdmin && (
                            <SelectModerne
                                id="histo-utilisateur" label="Utilisateur" icone={FiUser}
                                value={filtres.utilisateurId}
                                onChange={(e) => majFiltre("utilisateurId", e.target.value)}
                                placeholder="Tous les utilisateurs"
                                options={utilisateurs.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.prenom} {u.nom} — M° {u.matricule} ({u.role})
                                    </option>
                                ))}
                            />
                        )}
                        <SelectModerne
                            id="histo-type" label="Type d'action" icone={FiLayers}
                            value={filtres.actionType}
                            onChange={(e) => majFiltre("actionType", e.target.value)}
                            placeholder="Tous les types"
                            options={options.typesAction.map((t) => (
                                <option key={t} value={t}>{libelleAction(t)} ({t})</option>
                            ))}
                        />
                        <SelectModerne
                            id="histo-entite" label="Entité" icone={FiInbox}
                            value={filtres.entite}
                            onChange={(e) => majFiltre("entite", e.target.value)}
                            placeholder="Toutes les entités"
                            options={options.entites.map((e) => (
                                <option key={e} value={e}>{e}</option>
                            ))}
                        />
                        <InputDate id="histo-debut" label="Du" value={filtres.debut}
                            onChange={(e) => majFiltre("debut", e.target.value)} />
                        <InputDate id="histo-fin" label="Au" value={filtres.fin}
                            onChange={(e) => majFiltre("fin", e.target.value)} />
                    </div>

                    {nbFiltresActifs > 0 && (
                        <div className="histo-filtres-tags">
                            {filtresActifs.map((f) => (
                                <button key={f.cle} type="button" className="histo-filtre-tag"
                                    onClick={() => majFiltre(f.cle, "")}>
                                    {f.label}<FiX aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {erreur && (
                <p className="nc-erreur" role="alert">
                    <FiAlertCircle /> {erreur}
                </p>
            )}

            {/* ===== Barre de résultats ===== */}
            <div className="histo-resultats-barre">
                <div className="histo-resultats-titre">
                    <FiActivity aria-hidden="true" />
                    <span>{donnees?.total ?? 0} action{(donnees?.total ?? 0) > 1 ? "s" : ""}</span>
                </div>
                {chargement && donnees && (
                    <span className="histo-chargement-inline">
                        <span className="histo-spinner" /> Mise à jour…
                    </span>
                )}
            </div>

            {/* ===== Timeline ===== */}
            {chargement && !donnees ? (
                <SkeletonTimeline />
            ) : (!donnees || donnees.contenu.length === 0) ? (
                <div className="histo-vide">
                    <FiInbox className="histo-vide-icone" aria-hidden="true" />
                    <p>Aucune action enregistrée pour ces filtres.</p>
                    {nbFiltresActifs > 0 && (
                        <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={reinitialiser}>
                            Réinitialiser les filtres
                        </button>
                    )}
                </div>
            ) : (
                <div className="histo-timeline">
                    {donnees.contenu.map((h, idx) => {
                        const cfg = getConfigAction(h.actionType);
                        const Icone = cfg.icone;
                        const relatif = formatRelatif(h.date);
                        const actionLibelle = cfg.libelle || h.actionType;

                        return (
                            <article key={h.id} className={`histo-tl-item histo-tl-item--${cfg.ton}`}>
                                {/* Rail vertical + pastille */}
                                <div className="histo-tl-rail" aria-hidden="true">
                                    <span className={`histo-tl-dot histo-tl-dot--${cfg.ton}`}>
                                        <Icone />
                                    </span>
                                </div>

                                {/* Carte */}
                                <div className="histo-tl-card">
                                    {/* Ligne 1 : heure + badges */}
                                    <div className="histo-tl-top">
                                        <div className="histo-tl-heure-wrap">
                                            <span className="histo-tl-heure">{heureSeule(h.date)}</span>
                                            <span className="histo-tl-jour">{jourCourt(h.date)}</span>
                                        </div>

                                        <div className="histo-tl-badges">
                                            <span className={`histo-badge histo-badge--${cfg.ton}`}>
                                                <Icone className="histo-badge-icone" aria-hidden="true" />
                                                {h.actionType}
                                            </span>

                                            <span className="histo-entite-pill">
                                                {h.entite}
                                                {h.entiteId && <span className="histo-entite-id">#{h.entiteId}</span>}
                                            </span>

                                            {relatif && (
                                                <span className="histo-relatif">{relatif}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ligne 2 : libellé + utilisateur */}
                                    <div className="histo-tl-main">
                                        <div className="histo-tl-libelle">
                                            <FiArrowRight className="histo-tl-fleche" aria-hidden="true" />
                                            <span>{actionLibelle}</span>
                                        </div>

                                        {estAdmin && (
                                            <div className="histo-tl-user">
                                                <span className="histo-avatar histo-avatar--sm" aria-hidden="true">
                                                    {initiales(h.utilisateurPrenom, h.utilisateurNom)}
                                                </span>
                                                <div className="histo-tl-user-txt">
                                                    <strong>{h.utilisateurPrenom} {h.utilisateurNom}</strong>
                                                    <span className="histo-tl-user-meta">
                                                        {h.utilisateurMatricule && <>M° {h.utilisateurMatricule}</>}
                                                        {h.utilisateurRole && (
                                                            <span className="histo-role-pill">{h.utilisateurRole}</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ligne 3 : détails */}
                                    <HistoriqueDetails details={h.details} />
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* ===== Pagination ===== */}
            {donnees && donnees.total > 0 && (
                <div className="histo-pagination">
                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                        disabled={page <= 0 || chargement}
                        onClick={() => { setChargement(true); setPage((p) => Math.max(0, p - 1)); }}>
                        <FiChevronLeft /> Précédent
                    </button>

                    <div className="histo-pagination-info">
                        {donnees.totalPages > 1 ? (
                            <>
                                <strong>Page {donnees.page + 1}</strong>
                                <span>/ {donnees.totalPages}</span>
                                <span className="histo-pagination-sep">·</span>
                                <span>{donnees.total} action{donnees.total > 1 ? "s" : ""}</span>
                            </>
                        ) : (
                            <span>{donnees.total} action{donnees.total > 1 ? "s" : ""}</span>
                        )}
                    </div>

                    <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                        disabled={donnees.totalPages <= 1 || page + 1 >= donnees.totalPages || chargement}
                        onClick={() => { setChargement(true); setPage((p) => p + 1); }}>
                        Suivant <FiChevronRight />
                    </button>
                </div>
            )}
        </main>
    );
}