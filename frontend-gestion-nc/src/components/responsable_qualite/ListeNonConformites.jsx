import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, GRAVITES, formaterDate } from "../constantes";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";
import VisualisationNcModal from "./VisualisationNcModal";
import TraitementNcModal from "./TraitementNcModal";
import AvancementNcModal from "./AvancementNcModal";
import Modal from "../Modal";
import Avatar from "../compte/Avatar";
import {
  FaEye, FaArrowTrendUp, FaLocationDot, FaRotate, FaFilter, FaChevronDown, FaChevronUp,
} from "react-icons/fa6";
import {
  FiClock, FiAlertCircle, FiLoader, FiSearch, FiArchive, FiCalendar, FiX, FiRefreshCw,
} from "react-icons/fi";
import { GiSettingsKnobs } from "react-icons/gi";
import "./ListeNonConformites.css";

const TAILLE_PAGE = 10;
const JOURS_ECHEANCE_PROCHE = 7;

const ICONES_STATUT = {
  EN_ATTENTE: FiClock,
  OUVERT: FiAlertCircle,
  EN_COURS_D_ANALYSE: FiLoader,
  EN_TRAITEMENT: FiSearch,
  CLOTUREE: FiArchive,
};

const FILTRES_STATUT = [
  { code: "", libelle: "Tous" },
  ...Object.entries(STATUTS_NC).map(([code, libelle]) => ({ code, libelle })),
];

function dateRelative(dateStr) {
  if (!dateStr) return "—";
  const dateCible = new Date(dateStr);
  if (Number.isNaN(dateCible.getTime())) return formaterDate(dateStr);

  const diffSecondes = Math.floor((Date.now() - dateCible.getTime()) / 1000);
  if (diffSecondes < 0) {
    if (Math.abs(diffSecondes) < 60) return "à l'instant";
    return formaterDate(dateStr);
  }
  if (diffSecondes < 60) return `il y a ${diffSecondes} seconde${diffSecondes > 1 ? "s" : ""}`;
  const diffMinutes = Math.floor(diffSecondes / 60);
  if (diffMinutes < 60) return `il y a ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
  const diffHeures = Math.floor(diffMinutes / 60);
  if (diffHeures < 24) return `il y a ${diffHeures} heure${diffHeures > 1 ? "s" : ""}`;
  const diffJours = Math.floor(diffHeures / 24);
  if (diffJours <= 7) return `il y a ${diffJours} jour${diffJours > 1 ? "s" : ""}`;
  return formaterDate(dateStr);
}

function BadgeStatut({ statut }) {
  const Icone = ICONES_STATUT[statut] || FiAlertCircle;
  return (
    <span className={`nc-badge nc-badge-${statut}`}>
      {STATUTS_NC[statut] ?? statut} <Icone size={11} />
    </span>
  );
}

function etatEcheance(dateEcheance, statut) {
  if (!dateEcheance) return "nc-echeance-vide";
  const dateCible = new Date(dateEcheance);
  if (Number.isNaN(dateCible.getTime())) return "nc-echeance-vide";
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const cible = new Date(dateCible);
  cible.setHours(0, 0, 0, 0);
  const diffJours = Math.round((cible - aujourdHui) / (1000 * 60 * 60 * 24));
  if (statut === "CLOTUREE") return "nc-echeance-neutre";
  if (diffJours < 0) return "nc-echeance-rouge";
  if (diffJours <= JOURS_ECHEANCE_PROCHE) return "nc-echeance-orange";
  return "nc-echeance-verte";
}

export default function ListeNonConformites({ utilisateur }) {
  /* --- Filtres --- */
  const [statut, setStatut] = useState("");
  const [gravite, setGravite] = useState("");
  const [mesCapa, setMesCapa] = useState(false);

  // panneau avancé
  const [afficherAvance, setAfficherAvance] = useState(false);
  const [saisie, setSaisie] = useState("");               // recherche libre (titre, etc.)
  const [reference, setReference] = useState("");
  const [declarant, setDeclarant] = useState("");
  const [dateDetection, setDateDetection] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [filtresAppliques, setFiltresAppliques] = useState({
    q: "", reference: "", declarant: "", dateDetection: "", dateDebut: "", dateFin: "",
  });

  const [page, setPage] = useState(0);
  const [parametresUrl, setParametresUrl] = useSearchParams();

  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [version, setVersion] = useState(0);

  const [ncVisualisation, setNcVisualisation] = useState(null);
  const [ncTraitement, setNcTraitement] = useState(null);
  const [ncAvancement, setNcAvancement] = useState(null);
  const [ncReouverture, setNcReouverture] = useState(null);
  const [reouvertureEnCours, setReouvertureEnCours] = useState(null);

  useEffect(() => {
    const id = Number(parametresUrl.get("visualiser"));
    if (id > 0) {
      setNcVisualisation(id);
      setParametresUrl({}, { replace: true });
    }
  }, [parametresUrl, setParametresUrl]);

  useNotificationsAdmin({
    topic: "/topic/admin/nc",
    onMessage: (nouvelleNc) => {
      setInfo(`Nouvelle non-conformité déclarée : ${nouvelleNc.reference || "référence non attribuée"}`);
      setVersion((v) => v + 1);
    },
  });

  // Debounce simple pour la recherche libre
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltresAppliques((f) => ({ ...f, q: saisie.trim() }));
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [saisie]);

  // Requête backend
  useEffect(() => {
    let actif = true;
    setChargement(true);
    const p = new URLSearchParams({
      statut,
      gravite,
      mesCapa: String(mesCapa),
      q: filtresAppliques.q,
      reference: filtresAppliques.reference,
      declarant: filtresAppliques.declarant,
      dateDetection: filtresAppliques.dateDetection,
      dateDebut: filtresAppliques.dateDebut,
      dateFin: filtresAppliques.dateFin,
      page: String(page),
      taille: String(TAILLE_PAGE),
    });
    apiRequest(`/api/non-conformites?${p}`)
      .then((r) => { if (actif) { setDonnees(r); setErreur(""); } })
      .catch((e) => { if (actif) setErreur(e.message || "Impossible de charger les non-conformités."); })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [statut, gravite, mesCapa, filtresAppliques, page, version]);

  function appliquerFiltresAvances() {
    setFiltresAppliques({
      q: saisie.trim(),
      reference: reference.trim(),
      declarant: declarant.trim(),
      dateDetection,
      dateDebut,
      dateFin,
    });
    setPage(0);
  }

  function reinitialiserFiltresAvances() {
    setSaisie("");
    setReference("");
    setDeclarant("");
    setDateDetection("");
    setDateDebut("");
    setDateFin("");
    setFiltresAppliques({ q: "", reference: "", declarant: "", dateDetection: "", dateDebut: "", dateFin: "" });
    setPage(0);
  }

  function demanderReouverture(nc) {
    setNcReouverture(nc);
  }

  async function confirmerReouverture() {
    if (!ncReouverture) return;
    const nc = ncReouverture;

    setReouvertureEnCours(nc.id);
    setErreur("");
    setInfo("");
    try {
      await apiRequest(`/api/capa/nc/${nc.id}/reouverture`, { method: "POST" });
      setInfo(`La non-conformité ${nc.reference || `#${nc.id}`} a été réouverte.`);
      setNcReouverture(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e.message || "Impossible de réouvrir cette non-conformité.");
      setNcReouverture(null);
    } finally {
      setReouvertureEnCours(null);
    }
  }

  function apresTraitement(detail) {
    setNcTraitement(null);
    setInfo(`Le traitement de ${detail.reference} a été enregistré.`);
    setVersion((v) => v + 1);
  }

  const total = donnees?.total ?? donnees?.totalElements ?? 0;
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  const liste = donnees?.contenu ?? [];

  return (
    <main className="nc-page">
      <header className="nc-entete-liste">
        <div>
          <h1>Suivi des non-conformités</h1>
          <p className="nc-sous-titre">
            {total} non-conformité{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}
          </p>
        </div>
        <button type="button" className="nc-btn nc-btn-secondaire" onClick={() => setVersion((v) => v + 1)}>
          <FaRotate /> Actualiser
        </button>
      </header>

      {/* --- Filtres statut (chips) --- */}
      <div className="nc-filtres" role="group" aria-label="Filtrer par statut">
        {FILTRES_STATUT.map(({ code, libelle }) => {
          const actif = statut === code;
          return (
            <button
              key={code || "TOUS"}
              type="button"
              className={`nc-filtre${actif ? " nc-filtre--actif" : ""} nc-filtre--${code || "TOUS"}`}
              aria-pressed={actif}
              onClick={() => { setStatut(code); setPage(0); }}
            >
              <span className="nc-filtre-pastille" aria-hidden="true" />
              {libelle}
            </button>
          );
        })}
      </div>

      {/* --- Barre principale --- */}
      <div className="nc-barre">
        <button
          type="button"
          className={`nc-btn nc-btn-secondaire nc-btn-filtre${afficherAvance ? " nc-btn-filtre--actif" : ""}`}
          onClick={() => setAfficherAvance((v) => !v)}
          aria-expanded={afficherAvance}
        >
          <GiSettingsKnobs /> Filtres {afficherAvance ? <FaChevronUp /> : <FaChevronDown />}
        </button>

        <div className="nc-champ nc-champ-cal">
          <label htmlFor="filtreGravite">Gravité</label>
          <select
            id="filtreGravite"
            className="nc-select-cal"
            value={gravite}
            onChange={(e) => { setGravite(e.target.value); setPage(0); }}
          >
            <option value="">Toutes les gravités</option>
            {Object.entries(GRAVITES).map(([code, libelle]) => (
              <option key={code} value={code}>{libelle}</option>
            ))}
          </select>
        </div>

        <div className="nc-champ nc-champ-cal">
          <label htmlFor="filtreCapa">Responsabilité CAPA</label>
          <select
            id="filtreCapa"
            className="nc-select-cal"
            value={mesCapa ? "mes" : ""}
            onChange={(e) => { setMesCapa(e.target.value === "mes"); setPage(0); }}
          >
            <option value="">Toutes les non-conformités</option>
            <option value="mes">Où je suis responsable d'actions CAPA</option>
          </select>
        </div>
      </div>

      {/* --- Panneau avancé --- */}
      {afficherAvance && (
        <div className="nc-barre nc-barre-avancee">
          <div className="nc-champ nc-champ-flex">
            <label htmlFor="fRecherche">Recherche libre</label>
            <input id="fRecherche" type="search" value={saisie}
                   placeholder="Titre, processus…"
                   onChange={(e) => setSaisie(e.target.value)} />
          </div>

          <div className="nc-champ">
            <label htmlFor="fRef">Référence</label>
            <input id="fRef" type="search" value={reference}
                   placeholder="NC-…"
                   onChange={(e) => setReference(e.target.value)} />
          </div>

          <div className="nc-champ">
            <label htmlFor="fDeclarant">Déclarant (nom, prénom, matricule)</label>
            <input id="fDeclarant" type="search" value={declarant}
                   placeholder="Nom ou matricule"
                   onChange={(e) => setDeclarant(e.target.value)} />
          </div>

          <div className="nc-champ">
            <label htmlFor="fDateDet">Date de détection</label>
            <input id="fDateDet" type="date" value={dateDetection}
                   onChange={(e) => setDateDetection(e.target.value)} />
          </div>

          <div className="nc-champ">
            <label htmlFor="fDateDebut">Détectée entre le</label>
            <input id="fDateDebut" type="date" value={dateDebut}
                   onChange={(e) => setDateDebut(e.target.value)} />
          </div>

          <div className="nc-champ">
            <label htmlFor="fDateFin">… et le</label>
            <input id="fDateFin" type="date" value={dateFin}
                   onChange={(e) => setDateFin(e.target.value)} />
          </div>

          <div className="nc-barre-avancee-actions">
            <button type="button" className="nc-btn nc-btn-petit" onClick={appliquerFiltresAvances}>
              Appliquer
            </button>
            <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit" onClick={reinitialiserFiltresAvances}>
              <FiX /> Réinitialiser
            </button>
          </div>
        </div>
      )}

      {info && <p className="nc-succes">{info}</p>}
      {erreur && <p className="nc-erreur">{erreur}</p>}

      <div className="nc-cartes">
        {chargement && !donnees && <p className="nc-vide">Chargement...</p>}
        {donnees && liste.length === 0 && <p className="nc-vide">Aucune non-conformité trouvée.</p>}

        {liste.map((nc) => {
          const dateDeclaration = nc.dateCreation ?? nc.dateDetection;
          const classeEcheance = etatEcheance(nc.dateEcheance, nc.statut);

          return (
            <article key={nc.id} className="nc-carte">
              <div className="nc-carte-haut">
                <h2 className="nc-carte-titre" title={nc.titre}>{nc.titre}</h2>
                <BadgeStatut statut={nc.statut} />
              </div>

              <div className="nc-carte-ligne-meta">
                <span className="nc-carte-ref">
                  <strong>Ref NC :</strong>{" "}
                  {nc.reference ? <span className="nc-ref-valeur">{nc.reference}</span>
                                : <span className="nc-echeance-vide">-- --</span>}
                </span>
                <span className="nc-carte-date-inline"
                      title={dateDeclaration ? `Déclarée le ${formaterDate(dateDeclaration)}` : "Date inconnue"}>
                  <FiClock size={12} /> {dateRelative(dateDeclaration)}
                </span>
              </div>

              <ul className="nc-carte-infos">
                <li>
                  <Avatar
                    id={nc.matriculeAuteur}
                    nom={{ prenom: nc.auteurPrenom, nom: nc.auteurNom }}
                    role={nc.roleAuteur}
                    email={nc.emailAuteur}
                    taille="md"
                    position="top"
                  />
                </li>
                <li>
                  <FaLocationDot className="nc-icone" />
                  <span><strong>Processus :</strong> {nc.service || "—"}</span>
                </li>
                <li>
                  <FiCalendar className="nc-icone" size={14} />
                  <span>
                    <strong>Échéance :</strong>{" "}
                    {nc.dateEcheance
                      ? <span className={`nc-echeance ${classeEcheance}`}>{formaterDate(nc.dateEcheance)}</span>
                      : <span className="nc-echeance-vide">-- --</span>}
                  </span>
                </li>
              </ul>

              <div className="nc-carte-bas">
                <div className="nc-carte-actions">
                  <button type="button" className="nc-btn nc-btn-petit"
                          title="Visualiser" onClick={() => setNcVisualisation(nc.id)}>
                    <FaEye /> Visualiser
                  </button>
                  <button type="button" className="nc-btn nc-btn-petit"
                          title="Avancement" onClick={() => setNcAvancement(nc.id)}>
                    <FaArrowTrendUp /> Avancement
                  </button>
                  {nc.statut === "CLOTUREE" && (
                    <button
                      type="button"
                      className="nc-btn nc-btn-petit nc-btn-reouvrir"
                      title="Réouvrir cette non-conformité"
                      disabled={reouvertureEnCours === nc.id}
                      onClick={() => demanderReouverture(nc)}
                    >
                      <FiRefreshCw /> {reouvertureEnCours === nc.id ? "Réouverture…" : "Réouvrir"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {nbPages > 1 && (
        <nav className="nc-pagination" aria-label="Pagination">
          <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                  disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            ← Précédent
          </button>
          <span>Page {page + 1} / {nbPages}</span>
          <button type="button" className="nc-btn nc-btn-secondaire nc-btn-petit"
                  disabled={page + 1 >= nbPages} onClick={() => setPage((p) => p + 1)}>
            Suivant →
          </button>
        </nav>
      )}

      {ncReouverture && (
        <Modal
          titre="Confirmer la réouverture"
          largeur="small"
          onFermer={() => {
            if (reouvertureEnCours !== ncReouverture.id) {
              setNcReouverture(null);
            }
          }}
          pied={
            <>
              <button
                type="button"
                className="nc-btn nc-btn-secondaire nc-btn-petit"
                disabled={reouvertureEnCours === ncReouverture.id}
                onClick={() => setNcReouverture(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="nc-btn nc-btn-petit nc-btn-reouvrir"
                disabled={reouvertureEnCours === ncReouverture.id}
                onClick={confirmerReouverture}
              >
                <FiRefreshCw />{" "}
                {reouvertureEnCours === ncReouverture.id ? "Réouverture…" : "Confirmer la réouverture"}
              </button>
            </>
          }
        >
          <p className="nc-modal-confirmation-texte">
            Voulez-vous réouvrir la non-conformité{" "}
            <strong>{ncReouverture.reference || `#${ncReouverture.id}`}</strong>
            {ncReouverture.titre ? ` — ${ncReouverture.titre}` : ""} ?
          </p>
          <p className="nc-modal-confirmation-note">
            Son statut repassera à <strong>OUVERT</strong>. Les audits et actions CAPA existants seront conservés.
          </p>
        </Modal>
      )}

      {ncVisualisation && (
        <VisualisationNcModal
          ncId={ncVisualisation}
          actionsResponsable
          onFermer={() => setNcVisualisation(null)}
          onOuvrirTraitement={(id) => { setNcVisualisation(null); setNcTraitement(id); }}
        />
      )}
      {ncAvancement && (
        <AvancementNcModal ncId={ncAvancement} onFermer={() => setNcAvancement(null)} />
      )}
      {ncTraitement && (
        <TraitementNcModal
          ncId={ncTraitement}
          utilisateur={utilisateur}
          onFermer={() => setNcTraitement(null)}
          onEnregistre={apresTraitement}
        />
      )}
    </main>
  );
}