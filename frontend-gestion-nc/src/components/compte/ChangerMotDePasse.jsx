import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { apiRequest } from "../../api/api";

const vide = { ancienMotDePasse: "", nouveauMotDePasse: "", confirmationMotDePasse: "" };

const visibiliteInitiale = {
  ancienMotDePasse: false,
  nouveauMotDePasse: false,
  confirmationMotDePasse: false,
};

export default function ChangerMotDePasse() {
  const [formulaire, setFormulaire] = useState(vide);
  const [visibles, setVisibles] = useState(visibiliteInitiale);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  function modifier(champ, valeur) {
    setFormulaire((ancien) => ({ ...ancien, [champ]: valeur }));
    setErreur("");
    setSucces("");
  }

  function basculerVisibilite(champ) {
    setVisibles((ancien) => ({ ...ancien, [champ]: !ancien[champ] }));
  }

  async function soumettre(event) {
    event.preventDefault();
    setErreur("");
    setSucces("");
    if (formulaire.nouveauMotDePasse !== formulaire.confirmationMotDePasse) {
      setErreur("Le nouveau mot de passe et sa confirmation ne correspondent pas.");
      return;
    }
    if (formulaire.nouveauMotDePasse === formulaire.ancienMotDePasse) {
      setErreur("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }
    setChargement(true);
    try {
      const resultat = await apiRequest("/api/compte/mot-de-passe", {
        method: "PUT",
        body: JSON.stringify(formulaire),
      });
      setFormulaire(vide);
      setVisibles(visibiliteInitiale);
      setSucces(resultat?.message || "Mot de passe modifié. Une notification par e-mail a été demandée.");
    } catch (e) {
      setErreur(e.message || "Impossible de changer le mot de passe.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <section className="param-card">
      <div className="param-card__heading">
        <div>
          <span className="param-eyebrow">SÉCURITÉ</span>
          <h2>Changer le mot de passe</h2>
        </div>
        <span className="param-icon" aria-hidden="true">⌑</span>
      </div>

      <p className="param-muted">
        Saisissez votre mot de passe actuel, puis choisissez-en un nouveau. Un e-mail de notification sera envoyé après le changement.
      </p>

      <form onSubmit={soumettre} className="param-form">
        <label>
          Ancien mot de passe
          <div className="param-password-wrap">
            <input
              type={visibles.ancienMotDePasse ? "text" : "password"}
              value={formulaire.ancienMotDePasse}
              onChange={(e) => modifier("ancienMotDePasse", e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="param-password-toggle"
              onClick={() => basculerVisibilite("ancienMotDePasse")}
              aria-label={visibles.ancienMotDePasse ? "Masquer l'ancien mot de passe" : "Afficher l'ancien mot de passe"}
              aria-pressed={visibles.ancienMotDePasse}
            >
              {visibles.ancienMotDePasse ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
            </button>
          </div>
        </label>

        <div className="param-fields">
          <label>
            Nouveau mot de passe
            <div className="param-password-wrap">
              <input
                type={visibles.nouveauMotDePasse ? "text" : "password"}
                value={formulaire.nouveauMotDePasse}
                onChange={(e) => modifier("nouveauMotDePasse", e.target.value)}
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="param-password-toggle"
                onClick={() => basculerVisibilite("nouveauMotDePasse")}
                aria-label={visibles.nouveauMotDePasse ? "Masquer le nouveau mot de passe" : "Afficher le nouveau mot de passe"}
                aria-pressed={visibles.nouveauMotDePasse}
              >
                {visibles.nouveauMotDePasse ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
            <small>8 caractères minimum.</small>
          </label>

          <label>
            Confirmer le nouveau mot de passe
            <div className="param-password-wrap">
              <input
                type={visibles.confirmationMotDePasse ? "text" : "password"}
                value={formulaire.confirmationMotDePasse}
                onChange={(e) => modifier("confirmationMotDePasse", e.target.value)}
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="param-password-toggle"
                onClick={() => basculerVisibilite("confirmationMotDePasse")}
                aria-label={visibles.confirmationMotDePasse ? "Masquer la confirmation du mot de passe" : "Afficher la confirmation du mot de passe"}
                aria-pressed={visibles.confirmationMotDePasse}
              >
                {visibles.confirmationMotDePasse ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
              </button>
            </div>
          </label>
        </div>

        {erreur && <p className="param-alert param-alert--error" role="alert">{erreur}</p>}
        {succes && <p className="param-alert param-alert--success" role="status">{succes}</p>}

        <div className="param-actions">
          <button className="param-button param-button--primary" disabled={chargement}>
            {chargement ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </div>
      </form>
    </section>
  );
}