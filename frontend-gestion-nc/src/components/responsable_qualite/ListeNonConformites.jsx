import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, formaterDate } from "../constantes";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";
import VisualisationNcModal from "./VisualisationNcModal";
import TraitementNcModal from "./TraitementNcModal";
import AvancementNcModal from "./AvancementNcModal";
import Avatar from "../compte/Avatar";
import {
  FaEye,
  FaArrowTrendUp,
  FaLocationDot,
  FaRotate,
} from "react-icons/fa6";
import {
  FiClock,
  FiAlertCircle,
  FiLoader,
  FiSearch,
  FiArchive,
  FiCalendar,
} from "react-icons/fi";
import "./ListeNonConformites.css";

const TAILLE_PAGE = 10;
const JOURS_ECHEANCE_PROCHE = 7;

/* ---- Icônes par statut ---- */
const ICONES_STATUT = {
  EN_ATTENTE: FiClock,
  OUVERT: FiAlertCircle,
  EN_COURS_D_ANALYSE: FiLoader,
  EN_TRAITEMENT: FiSearch,
  CLOTUREE: FiArchive,
};

/* ---- Barre de filtres statut ---- */
const FILTRES_STATUT = [
  { code: "", libelle: "Tous" },
  ...Object.entries(STATUTS_NC).map(([code, libelle]) => ({ code, libelle })),
];

/* ---- Utilitaire : date relative (robuste) ---- */
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

/* ---- Rendu d'un badge de statut avec icône ---- */
function BadgeStatut({ statut }) {
  const Icone = ICONES_STATUT[statut] || FiAlertCircle;
  return (
    <span className={`nc-badge nc-badge-${statut}`}>
      {STATUTS_NC[statut] ?? statut}{" "}
      <Icone size={11} />
    </span>
  );
}

/* ---- État d'échéance : retourne une classe CSS ---- */
function etatEcheance(dateEcheance, statut) {
  if (!dateEcheance) return "nc-echeance-vide";
  const dateCible = new Date(dateEcheance);
  if (Number.isNaN(dateCible.getTime())) return "nc-echeance-vide";

  // On compare à minuit pour éviter les effets d'heure
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const cible = new Date(dateCible);
  cible.setHours(0, 0, 0, 0);

  const diffJours = Math.round((cible - aujourdHui) / (1000 * 60 * 60 * 24));

  // Clôturée : échéance neutralisée (peu importe le dépassement)
  if (statut === "CLOTUREE") return "nc-echeance-neutre";

  if (diffJours < 0) return "nc-echeance-rouge";       // dépassée
  if (diffJours <= JOURS_ECHEANCE_PROCHE) return "nc-echeance-orange"; // proche
  return "nc-echeance-verte";                          // lointaine
}

export default function ListeNonConformites({ utilisateur }) {
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const [mesCapa, setMesCapa] = useState(false);
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

  useEffect(() => {
    const minuteur = setTimeout(() => {
      setRecherche(saisie.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(minuteur);
  }, [saisie]);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    const parametres = new URLSearchParams({
      statut,
      q: recherche,
      mesCapa: String(mesCapa),
      page: String(page),
      taille: String(TAILLE_PAGE),
    });
    apiRequest(`/api/non-conformites?${parametres}`)
      .then((resultat) => {
        if (actif) {
          setDonnees(resultat);
          setErreur("");
        }
      })
      .catch((e) => {
        if (actif) setErreur(e.message || "Impossible de charger les non-conformités.");
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, [statut, mesCapa, recherche, page, version]);

  function apresTraitement(detail) {
    setNcTraitement(null);
    setInfo(`Le traitement de ${detail.reference} a été enregistré.`);
    setVersion((v) => v + 1);
  }

  const total = donnees?.total ?? donnees?.totalElements ?? 0;
  const nbPages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  return (
    <main className="nc-page">
      <header className="nc-entete-liste">
        <div>
          <h1>Suivi des non-conformités</h1>
          <p className="nc-sous-titre">
            {total} non-conformité{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          className="nc-btn nc-btn-secondaire"
          onClick={() => setVersion((v) => v + 1)}
        >
          <FaRotate /> Actualiser
        </button>
      </header>

      {/* --- Barre de filtres statut --- */}
      <div className="nc-filtres" role="group" aria-label="Filtrer les non-conformités par statut">
        {FILTRES_STATUT.map(({ code, libelle }) => {
          const actif = statut === code;
          return (
            <button
              key={code || "TOUS"}
              type="button"
              className={`nc-filtre${actif ? " nc-filtre--actif" : ""} nc-filtre--${code || "TOUS"}`}
              aria-pressed={actif}
              onClick={() => {
                setStatut(code);
                setPage(0);
              }}
            >
              <span className="nc-filtre-pastille" aria-hidden="true" />
              {libelle}
            </button>
          );
        })}
      </div>

      {/* --- Barre de filtres --- */}
      <div className="nc-barre">
        <div className="nc-champ nc-champ-flex">
          <label htmlFor="recherche">Rechercher</label>
          <input
            id="recherche"
            type="search"
            value={saisie}
            placeholder="Titre, référence..."
            onChange={(e) => setSaisie(e.target.value)}
          />
        </div>

        <div className="nc-champ nc-champ-cal">
          <label htmlFor="filtreCapa">Responsabilité CAPA</label>
          <select
            id="filtreCapa"
            className="nc-select-cal"
            value={mesCapa ? "mes" : ""}
            onChange={(e) => {
              setMesCapa(e.target.value === "mes");
              setPage(0);
            }}
          >
            <option value="">Toutes les non-conformités</option>
            <option value="mes">Où je suis responsable d'actions CAPA</option>
          </select>
        </div>
      </div>

      {info && <p className="nc-succes">{info}</p>}
      {erreur && <p className="nc-erreur">{erreur}</p>}

      <div className="nc-cartes">
        {chargement && !donnees && <p className="nc-vide">Chargement...</p>}
        {donnees && donnees.contenu.length === 0 && (
          <p className="nc-vide">Aucune non-conformité trouvée.</p>
        )}

        {donnees?.contenu.map((nc) => {
          // Date de déclaration = date de création serveur (fallback : détection)
          const dateDeclaration = nc.dateCreation ?? nc.dateDetection;
          const classeEcheance = etatEcheance(nc.dateEcheance, nc.statut);

          return (
            <article key={nc.id} className="nc-carte">
              <div className="nc-carte-haut">
                <h2 className="nc-carte-titre" title={nc.titre}>
                  {nc.titre}
                </h2>
                <BadgeStatut statut={nc.statut} />
              </div>

              {/* --- Ligne Ref NC + date de déclaration --- */}
              <div className="nc-carte-ligne-meta">
                <span className="nc-carte-ref">
                  <strong>Ref NC :</strong>{" "}
                  {nc.reference ? (
                    <span className="nc-ref-valeur">{nc.reference}</span>
                  ) : (
                    <span className="nc-echeance-vide">-- --</span>
                  )}
                </span>
                <span
                  className="nc-carte-date-inline"
                  title={
                    dateDeclaration
                      ? `Déclarée le ${formaterDate(dateDeclaration)}`
                      : "Date inconnue"
                  }
                >
                  <FiClock size={12} />
                  {dateRelative(dateDeclaration)}
                </span>
              </div>

              {/* --- Auteur + processus + échéance --- */}
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
                  <span>
                    <strong>Processus :</strong> {nc.service || "—"}
                  </span>
                </li>
                <li>
                  <FiCalendar className="nc-icone" size={14} />
                  <span>
                    <strong>Échéance :</strong>{" "}
                    {nc.dateEcheance ? (
                      <span className={`nc-echeance ${classeEcheance}`}>
                        {formaterDate(nc.dateEcheance)}
                      </span>
                    ) : (
                      <span className="nc-echeance-vide">-- --</span>
                    )}
                  </span>
                </li>
              </ul>

              <div className="nc-carte-bas">
                <div className="nc-carte-actions">
                  <button
                    type="button"
                    className="nc-btn nc-btn-petit"
                    title="Visualiser"
                    onClick={() => setNcVisualisation(nc.id)}
                  >
                    <FaEye /> Visualiser
                  </button>
                  <button
                    type="button"
                    className="nc-btn nc-btn-petit"
                    title="Avancement"
                    onClick={() => setNcAvancement(nc.id)}
                  >
                    <FaArrowTrendUp /> Avancement
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {nbPages > 1 && (
        <nav className="nc-pagination" aria-label="Pagination">
          <button
            type="button"
            className="nc-btn nc-btn-secondaire nc-btn-petit"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Précédent
          </button>
          <span>
            Page {page + 1} / {nbPages}
          </span>
          <button
            type="button"
            className="nc-btn nc-btn-secondaire nc-btn-petit"
            disabled={page + 1 >= nbPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant →
          </button>
        </nav>
      )}

      {ncVisualisation && (
        <VisualisationNcModal
          ncId={ncVisualisation}
          actionsResponsable
          onFermer={() => setNcVisualisation(null)}
          onOuvrirTraitement={(id) => {
            setNcVisualisation(null);
            setNcTraitement(id);
          }}
        />
      )}

      {ncAvancement && (
        <AvancementNcModal
          ncId={ncAvancement}
          onFermer={() => setNcAvancement(null)}
        />
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