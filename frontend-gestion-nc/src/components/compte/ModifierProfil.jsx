import { useEffect, useState } from "react";
import { apiRequest } from "../../api/api";

const champsVides = { nom: "", prenom: "", email: "", matricule: "" };

export default function ModifierProfil({ utilisateur, onProfilModifie }) {
  const [formulaire, setFormulaire] = useState(champsVides);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  useEffect(() => {
    setFormulaire({
      nom: utilisateur?.nom ?? "",
      prenom: utilisateur?.prenom ?? "",
      email: utilisateur?.email ?? "",
      matricule: utilisateur?.matricule ?? "",
    });
  }, [utilisateur]);

  function modifier(champ, valeur) {
    setFormulaire((ancien) => ({ ...ancien, [champ]: valeur }));
    setErreur("");
    setSucces("");
  }

  async function soumettre(event) {
    event.preventDefault();
    setChargement(true);
    setErreur("");
    setSucces("");
    try {
      const resultat = await apiRequest("/api/compte/profil", {
        method: "PUT",
        body: JSON.stringify({
          nom: formulaire.nom.trim(),
          prenom: formulaire.prenom.trim(),
          email: formulaire.email.trim(),
          matricule: formulaire.matricule.trim(),
        }),
      });
      onProfilModifie?.(resultat);
      setSucces("Vos informations ont été mises à jour.");
    } catch (e) {
      setErreur(e.message || "Impossible de modifier vos informations.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <section className="param-card">
      <div className="param-card__heading">
        <div><span className="param-eyebrow">MON COMPTE</span><h2>Informations personnelles</h2></div>
        <span className="param-icon" aria-hidden="true">♙</span>
      </div>
      <p className="param-muted">Modifiez vos coordonnées. Votre rôle et votre mot de passe ne peuvent pas être changés ici.</p>
      <form onSubmit={soumettre} className="param-form">
        <div className="param-fields">
          <label>Nom<input value={formulaire.nom} maxLength={100} required onChange={(e) => modifier("nom", e.target.value)} autoComplete="family-name" /></label>
          <label>Prénom<input value={formulaire.prenom} maxLength={100} required onChange={(e) => modifier("prenom", e.target.value)} autoComplete="given-name" /></label>
          <label>Adresse e-mail<input type="email" value={formulaire.email} maxLength={255} required onChange={(e) => modifier("email", e.target.value)} autoComplete="email" /></label>
          <label>Matricule<input value={formulaire.matricule} maxLength={50} required onChange={(e) => modifier("matricule", e.target.value)} /></label>
        </div>
        {erreur && <p className="param-alert param-alert--error" role="alert">{erreur}</p>}
        {succes && <p className="param-alert param-alert--success" role="status">{succes}</p>}
        <div className="param-actions"><button className="param-button param-button--primary" disabled={chargement}>{chargement ? "Enregistrement…" : "Enregistrer les modifications"}</button></div>
      </form>
    </section>
  );
}