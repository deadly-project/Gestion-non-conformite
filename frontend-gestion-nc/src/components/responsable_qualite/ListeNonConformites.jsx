import { useEffect, useState } from "react";
import { apiRequest } from "../../api/api";
import { STATUTS_NC, GRAVITES, formaterDate } from "../constantes";
import { useNotificationsAdmin } from "../../hooks/useNotificationsAdmin";
import VisualisationNcModal from "./VisualisationNcModal";
import TraitementNcModal from "./TraitementNcModal";
import AvancementNcModal from "./AvancementNcModal";
import { FaEye, FaArrowTrendUp, FaLocationDot, FaUser, FaRotate } from "react-icons/fa6";
import "./ListeNonConformites.css";

const TAILLE_PAGE = 10;

/* ---- Utilitaire : date relative ---- */
function dateRelative(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return formaterDate(dateStr);

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffJ = Math.floor(diffH / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} minute${diffMin > 1 ? "s" : ""}`;
  if (diffH < 24) return `il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffJ < 7) return `il y a ${diffJ} jour${diffJ > 1 ? "s" : ""}`;
  return formaterDate(dateStr);
}

export default function ListeNonConformites({ utilisateur }) {
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const [page, setPage] = useState(0);

  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [version, setVersion] = useState(0);

  const [ncVisualisation, setNcVisualisation] = useState(null);
  const [ncTraitement, setNcTraitement] = useState(null);
  const [ncAvancement, setNcAvancement] = useState(null);

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
  }, [statut, recherche, page, version]);

  function apresTraitement(detail) {
    setNcTraitement(null);
    setInfo(`Le traitement de ${detail.reference} a été enregistré.`);
    setVersion((v) => v + 1);
  }

  const total = donnees?.totalElements ?? 0;
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
        <div className="nc-champ">
          <label htmlFor="filtreStatut">Statut</label>
          <select
            id="filtreStatut"
            value={statut}
            onChange={(e) => {
              setStatut(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tous</option>
            {Object.entries(STATUTS_NC).map(([code, libelle]) => (
              <option key={code} value={code}>
                {libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {info && <p className="nc-succes">{info}</p>}
      {erreur && <p className="nc-erreur">{erreur}</p>}

      {/* ---- Liste de cartes ---- */}
      <div className="nc-cartes">
        {chargement && !donnees && <p className="nc-vide">Chargement...</p>}
        {donnees && donnees.contenu.length === 0 && (
          <p className="nc-vide">Aucune non-conformité trouvée.</p>
        )}

        {donnees?.contenu.map((nc) => {
          const gravite = nc.gravite || nc.graviteDeclaree;
          return (
            <article key={nc.id} className="nc-carte">
              <div className="nc-carte-haut">
                <h2 className="nc-carte-titre" title={nc.titre}>
                  {nc.titre}
                </h2>
                <span className={`nc-badge nc-badge-${nc.statut}`}>
                  {STATUTS_NC[nc.statut] ?? nc.statut}
                </span>
              </div>

              <p className="nc-carte-date">
                <FaClockCote /> {dateRelative(nc.dateDetection)}
              </p>

              <div className="nc-carte-meta">
                <span className="nc-carte-ref">
                  <strong>Ref NC :</strong>{" "}
                  {nc.reference || (
                    <em style={{ color: "#b45309" }}>Non attribuée</em>
                  )}
                </span>
              </div>

              <ul className="nc-carte-infos">
                <li>
                  <FaUser className="nc-icone" />
                  <span>
                    <strong>Auteur :</strong> {nc.auteurPrenom} {nc.auteurNom}
                    {nc.matriculeAuteur && ` — N° ${nc.matriculeAuteur}`}
                  </span>
                </li>
                <li>
                  <FaLocationDot className="nc-icone" />
                  <span>
                    <strong>Processus :</strong> {nc.service || "—"}
                  </span>
                </li>
              </ul>

              <div className="nc-carte-bas">
                <span className={`nc-badge nc-badge-${gravite}`}>
                  {GRAVITES[gravite] ?? gravite ?? "Gravité ?"}
                </span>

                <div className="nc-carte-actions">
                  <button
                    type="button"
                    className="nc-btn nc-btn-secondaire nc-btn-petit"
                    title="Visualiser"
                    onClick={() => setNcVisualisation(nc.id)}
                  >
                    <FaEye /> Visualiser
                  </button>
                  <button
                    type="button"
                    className="nc-btn nc-btn-secondaire nc-btn-petit"
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

      {/* ---- Pagination ---- */}
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

      {/* ---- Modales ---- */}
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

/* Petit composant inline pour l'icône horloge */
function FaClockCote() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: "-2px" }}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}