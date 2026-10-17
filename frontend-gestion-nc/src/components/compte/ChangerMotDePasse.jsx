import { useState } from "react";
import { apiRequest } from "../../api/api";

const vide = { ancienMotDePasse: "", nouveauMotDePasse: "", confirmationMotDePasse: "" };

export default function ChangerMotDePasse() {
  const [formulaire, setFormulaire] = useState(vide);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  function modifier(champ, valeur) {
    setFormulaire((ancien) => ({ ...ancien, [champ]: valeur }));
    setErreur("");
    setSucces("");
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
        <div><span className="param-eyebrow">SÉCURITÉ</span><h2>Changer le mot de passe</h2></div>
        <span className="param-icon" aria-hidden="true">⌑</span>
      </div>
      <p className="param-muted">Saisissez votre mot de passe actuel, puis choisissez-en un nouveau. Un e-mail de notification sera envoyé après le changement.</p>
      <form onSubmit={soumettre} className="param-form">
        <label>Ancien mot de passe<input type="password" value={formulaire.ancienMotDePasse} onChange={(e) => modifier("ancienMotDePasse", e.target.value)} autoComplete="current-password" required /></label>
        <div className="param-fields">
          <label>Nouveau mot de passe<input type="password" value={formulaire.nouveauMotDePasse} onChange={(e) => modifier("nouveauMotDePasse", e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required /><small>8 caractères minimum.</small></label>
          <label>Confirmer le nouveau mot de passe<input type="password" value={formulaire.confirmationMotDePasse} onChange={(e) => modifier("confirmationMotDePasse", e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required /></label>
        </div>
        {erreur && <p className="param-alert param-alert--error" role="alert">{erreur}</p>}
        {succes && <p className="param-alert param-alert--success" role="status">{succes}</p>}
        <div className="param-actions"><button className="param-button param-button--primary" disabled={chargement}>{chargement ? "Modification…" : "Modifier le mot de passe"}</button></div>
      </form>
    </section>
  );
}