import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiSearch,
  FiRefreshCw,
  FiPlus,
  FiEdit2,
  FiRotateCcw,
  FiUserCheck,
  FiUserX,
  FiX,
  FiCheck,
  FiMail,
  FiShield,
  FiHash,
  FiAlertTriangle,
  FiInfo
} from "react-icons/fi";
import { apiRequest } from "../../api/api";
import "./GestionUtilisateurs.css";

const roles = [
  { valeur: "DECLARANT", libelle: "Déclarant" },
  { valeur: "AUDITEUR", libelle: "Auditeur" },
  { valeur: "RESPONSABLE_QUALITE", libelle: "Responsable qualité" },
];
const formulaireVide = { nom: "", prenom: "", email: "", matricule: "", role: "DECLARANT" };

function libelleRole(role) {
  return roles.find((r) => r.valeur === role)?.libelle ?? role ?? "—";
}

function couleurRole(role) {
  switch (role) {
    case "RESPONSABLE_QUALITE":
      return { bg: "linear-gradient(135deg, #8b5cf6, #6d28d9)", class: "role-qualite" };
    case "AUDITEUR":
      return { bg: "linear-gradient(135deg, #f59e0b, #d97706)", class: "role-auditeur" };
    default:
      return { bg: "linear-gradient(135deg, #38bdf8, #1e6fd9)", class: "role-declarant" };
  }
}

export default function GestionUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState(null);
  const [formulaire, setFormulaire] = useState(formulaireVide);

  // Modales personnalisées (remplaçant window.confirm)
  const [modalStatut, setModalStatut] = useState(null); // Objet utilisateur ciblé pour changement de statut
  const [modalReinit, setModalReinit] = useState(null); // Objet utilisateur ciblé pour réinitialisation MDP

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const resultat = await apiRequest("/api/utilisateurs");
      setUtilisateurs(Array.isArray(resultat) ? resultat : []);
      setErreur("");
    } catch (e) {
      setErreur(e.message || "Impossible de charger les utilisateurs.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function commencerEdition(user) {
    setEdition(user);
    setFormulaire({
      nom: user.nom ?? "",
      prenom: user.prenom ?? "",
      email: user.email ?? "",
      matricule: user.matricule ?? "",
      role: user.role ?? "DECLARANT",
    });
    setErreur("");
    setMessage("");
  }

  async function enregistrerEdition(event) {
    event.preventDefault();
    if (!edition) return;
    setEnCours(edition.id);
    setErreur("");
    setMessage("");
    try {
      await apiRequest(`/api/utilisateurs/${edition.id}`, {
        method: "PUT",
        body: JSON.stringify({
          nom: formulaire.nom.trim(),
          prenom: formulaire.prenom.trim(),
          email: formulaire.email.trim(),
          matricule: formulaire.matricule,
          role: formulaire.role,
        }),
      });
      setMessage(`Les informations de ${formulaire.prenom} ${formulaire.nom} ont été mises à jour.`);
      setEdition(null);
      await charger();
    } catch (e) {
      setErreur(e.message || "La modification a échoué.");
    } finally {
      setEnCours(null);
    }
  }

  // Confirmation et exécution du changement de statut (Désactivation / Réactivation)
  async function confirmerChangementStatut() {
    if (!modalStatut) return;
    const user = modalStatut;
    const actionTexte = user.actif ? "désactiver" : "réactiver";

    setEnCours(user.id);
    setErreur("");
    setMessage("");
    setModalStatut(null);

    try {
      if (user.actif) {
        await apiRequest(`/api/utilisateurs/${user.id}/desactiver`, { method: "PATCH" });
        setMessage(`Le compte de ${user.prenom} ${user.nom} a été désactivé avec succès.`);
      } else {
        await apiRequest(`/api/utilisateurs/${user.id}/activer`, { method: "PATCH" });
        setMessage(`Le compte de ${user.prenom} ${user.nom} a été réactivé avec succès.`);
      }
      await charger();
    } catch (e) {
      setErreur(e.message || `Impossible de ${actionTexte} ce compte.`);
    } finally {
      setEnCours(null);
    }
  }

  // Confirmation et exécution de la réinitialisation MDP
  async function confirmerReinitialisation() {
    if (!modalReinit) return;
    const user = modalReinit;

    setEnCours(user.id);
    setErreur("");
    setMessage("");
    setModalReinit(null);

    try {
      const demande = await apiRequest("/api/auth/mot-de-passe-oublie", {
        method: "POST",
        body: JSON.stringify({ matricule: user.matricule }),
      });

      const demandeId = demande?.id || demande?.demande?.id;

      if (demandeId) {
        await apiRequest(`/api/admin/reinitialisations/${demandeId}/valider`, {
          method: "POST",
        });
        setMessage(`Le mot de passe de ${user.prenom} ${user.nom} a été réinitialisé et envoyé par e-mail.`);
      } else {
        const enAttente = await apiRequest("/api/admin/reinitialisations?statut=EN_ATTENTE");
        const trouveDemande = enAttente.find((d) => d.matricule === user.matricule);

        if (trouveDemande) {
          await apiRequest(`/api/admin/reinitialisations/${trouveDemande.id}/valider`, {
            method: "POST",
          });
          setMessage(`Le mot de passe de ${user.prenom} ${user.nom} a été réinitialisé et envoyé par e-mail.`);
        } else {
          throw new Error("Impossible de retrouver la demande de réinitialisation générée.");
        }
      }

      await charger();
    } catch (e) {
      setErreur(e.message || "Impossible de réinitialiser le mot de passe.");
    } finally {
      setEnCours(null);
    }
  }

  const filtre = recherche.trim().toLocaleLowerCase("fr");
  const visibles = utilisateurs.filter((u) =>
    [u.nom, u.prenom, u.email, u.matricule, u.role].some((v) =>
      String(v ?? "").toLocaleLowerCase("fr").includes(filtre)
    )
  );

  return (
    <main className="admin-users-page">
      <header className="admin-users-header">
        <div className="admin-users-header__text">
          <span className="admin-users-eyebrow">ADMINISTRATION DU SMQ</span>
          <h1>Gestion des utilisateurs</h1>
          <p>Consultez les comptes, modifiez leurs informations et gérez leur accès.</p>
        </div>
        <Link className="admin-users-primary" to="/admin/utilisateurs/nouveau">
          <FiPlus /> Créer un utilisateur
        </Link>
      </header>

      {erreur && (
        <div className="admin-users-alert admin-users-alert--error" role="alert">
          <FiX /> {erreur}
        </div>
      )}
      {message && (
        <div className="admin-users-alert admin-users-alert--success" role="status">
          <FiCheck /> {message}
        </div>
      )}

      {/* 1. MODALE D'ÉDITION DE PROFIL */}
      {edition && (
        <div className="admin-modal-overlay" onClick={() => setEdition(null)}>
          <div className="admin-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="admin-users-panel__header">
              <div>
                <h2>
                  Modifier <span className="edit-name">{edition.prenom} {edition.nom}</span>
                </h2>
                <p className="edit-subtitle">Mettez à jour les informations du collaborateur.</p>
              </div>
              <button type="button" className="admin-users-secondary btn-icon" onClick={() => setEdition(null)} title="Fermer">
                <FiX />
              </button>
            </div>
            <form className="admin-users-form" onSubmit={enregistrerEdition}>
              <label>
                Nom
                <input
                  required
                  maxLength={100}
                  value={formulaire.nom}
                  onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
                />
              </label>
              <label>
                Prénom
                <input
                  required
                  maxLength={100}
                  value={formulaire.prenom}
                  onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })}
                />
              </label>
              <label>
                E-mail
                <input
                  required
                  type="email"
                  maxLength={255}
                  value={formulaire.email}
                  onChange={(e) => setFormulaire({ ...formulaire, email: e.target.value })}
                />
              </label>
              <label>
                Matricule
                <input
                  required
                  maxLength={50}
                  value={formulaire.matricule}
                  onChange={(e) => setFormulaire({ ...formulaire, matricule: e.target.value })}
                />
              </label>
              <label className="full-width">
                Rôle
                <select
                  value={formulaire.role}
                  onChange={(e) => setFormulaire({ ...formulaire, role: e.target.value })}
                >
                  {roles.map((r) => (
                    <option key={r.valeur} value={r.valeur}>
                      {r.libelle}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-users-form__actions full-width">
                <button className="admin-users-primary" disabled={enCours === edition.id}>
                  <FiCheck /> {enCours === edition.id ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button type="button" className="admin-users-secondary" onClick={() => setEdition(null)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODALE DE CHANGEMENT DE STATUT (DÉSACTIVATION OU RÉACTIVATION) */}
      {modalStatut && (
        <div className="admin-modal-overlay" onClick={() => setModalStatut(null)}>
          <div className="admin-modal-container confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`status-modal-icon ${modalStatut.actif ? "danger" : "success"}`}>
              {modalStatut.actif ? <FiAlertTriangle /> : <FiUserCheck />}
            </div>

            <h2 className="confirmation-title">
              {modalStatut.actif ? "Désactiver le compte ?" : "Réactiver le compte ?"}
            </h2>

            <div className="confirmation-user-card">
              <strong>{modalStatut.prenom} {modalStatut.nom}</strong>
              <span>Matricule : <code>{modalStatut.matricule}</code> • {libelleRole(modalStatut.role)}</span>
            </div>

            {modalStatut.actif ? (
              <p className="confirmation-description">
                L'utilisateur sera immédiatement déconnecté de la plateforme et ses accès seront suspendus jusqu'à nouvel ordre.
              </p>
            ) : (
              <p className="confirmation-description">
                L'utilisateur pourra à nouveau se connecter à son espace collaborateur avec ses identifiants habituels.
              </p>
            )}

            <div className="confirmation-actions">
              <button type="button" className="admin-users-secondary" onClick={() => setModalStatut(null)}>
                Annuler
              </button>
              <button
                type="button"
                className={modalStatut.actif ? "admin-users-danger" : "admin-users-success-btn"}
                onClick={confirmerChangementStatut}
              >
                {modalStatut.actif ? "Oui, désactiver" : "Oui, réactiver"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODALE DE RÉINITIALISATION DE MOT DE PASSE */}
      {modalReinit && (
        <div className="admin-modal-overlay" onClick={() => setModalReinit(null)}>
          <div className="admin-modal-container confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="status-modal-icon info">
              <FiRotateCcw />
            </div>

            <h2 className="confirmation-title">Réinitialiser le mot de passe ?</h2>

            <div className="confirmation-user-card">
              <strong>{modalReinit.prenom} {modalReinit.nom}</strong>
              <span>E-mail : {modalReinit.email}</span>
            </div>

            <p className="confirmation-description">
              Un nouveau mot de passe sécurisé sera automatiquement généré par le système et transmis à l'adresse e-mail ci-dessus.
            </p>

            <div className="confirmation-actions">
              <button type="button" className="admin-users-secondary" onClick={() => setModalReinit(null)}>
                Annuler
              </button>
              <button type="button" className="admin-users-primary" onClick={confirmerReinitialisation}>
                Générer et envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION PRINCIPALE DES COMPTES */}
      <section className="admin-users-panel">
        <div className="admin-users-toolbar">
          <div>
            <h2>Comptes enregistrés</h2>
            <p>{utilisateurs.length} compte(s) au total</p>
          </div>
          <div className="admin-users-toolbar__actions">
            <div className="admin-users-search">
              <FiSearch className="search-icon" />
              <input
                aria-label="Rechercher un utilisateur"
                placeholder="Rechercher nom, matricule, rôle…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            <button type="button" className="admin-users-secondary" onClick={charger}>
              <FiRefreshCw /> <span className="btn-label">Actualiser</span>
            </button>
          </div>
        </div>

        {chargement ? (
          <div className="admin-users-state">
            <div className="loader-dot"></div>
            Chargement des utilisateurs…
          </div>
        ) : visibles.length === 0 ? (
          <div className="admin-users-state">Aucun utilisateur ne correspond à la recherche.</div>
        ) : (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Matricule</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((u) => {
                  const roleInfo = couleurRole(u.role);
                  return (
                    <tr key={u.id} className={!u.actif ? "admin-users-row--inactive" : ""}>
                      <td data-label="Utilisateur">
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar" style={{ background: roleInfo.bg }}>
                            {(u.prenom?.[0] || "")}
                            {(u.nom?.[0] || "")}
                          </div>
                          <div>
                            <strong>
                              {u.prenom} {u.nom}
                            </strong>
                            <small>
                              <FiMail /> {u.email}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Matricule">
                        <span className="admin-badge-matricule"><FiHash /> {u.matricule}</span>
                      </td>
                      <td data-label="Rôle">
                        <span className={`admin-role-badge ${roleInfo.class}`}>
                          <FiShield /> {libelleRole(u.role)}
                        </span>
                      </td>
                      <td data-label="Statut">
                        <span className={`admin-users-status ${u.actif ? "is-active" : "is-inactive"}`}>
                          <span className="admin-status-dot"></span>
                          {u.actif ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="admin-users-row-actions">
                          <button
                            type="button"
                            className="admin-users-secondary btn-icon"
                            onClick={() => commencerEdition(u)}
                            title="Modifier"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            className="admin-users-secondary btn-icon"
                            disabled={!u.actif || enCours === u.id}
                            onClick={() => setModalReinit(u)}
                            title="Réinitialiser le mot de passe"
                          >
                            <FiRotateCcw />
                          </button>
                          <button
                            type="button"
                            className={u.actif ? "admin-users-danger btn-icon" : "admin-users-secondary btn-icon"}
                            disabled={enCours === u.id}
                            onClick={() => setModalStatut(u)}
                            title={u.actif ? "Désactiver" : "Réactiver"}
                          >
                            {u.actif ? <FiUserX /> : <FiUserCheck />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="admin-users-note">
        💡 Les comptes peuvent être désactivés puis réactivés à tout moment. La réinitialisation du
        mot de passe crée et valide automatiquement la demande pour envoyer un nouveau mot de passe
        par e-mail.
      </p>
    </main>
  );
}