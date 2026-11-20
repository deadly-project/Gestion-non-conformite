import { useState } from "react";
import ModifierProfil from "./ModifierProfil";
import ChangerMotDePasse from "./ChangerMotDePasse";
import Modal from "../Modal"; // Adaptez le chemin selon votre arborescence
import "./Parametres.css";

export default function Parametres({ utilisateur, onUtilisateurModifie }) {
  const [modaleMotDePasseOuverte, setModaleMotDePasseOuverte] = useState(false);

  function profilModifie(profil) {
    onUtilisateurModifie?.(profil);
  }

  return (
    <main className="param-page">
      <header className="param-page__header">
        <span className="param-eyebrow">ESPACE PERSONNEL</span>
        <h1>Paramètres du compte</h1>
        <p>Gérez vos informations personnelles et la sécurité de votre compte SMQ.</p>
      </header>

      <div className="param-layout">
        <div className="param-actions param-actions--start">
          <button
            type="button"
            className="param-button param-button--secondary"
            onClick={() => setModaleMotDePasseOuverte(true)}
          >
            Changer le mot de passe
          </button>
        </div>
        <ModifierProfil utilisateur={utilisateur} onProfilModifie={profilModifie} />        
      </div>

      {modaleMotDePasseOuverte && (
        <Modal
          titre="Changer le mot de passe"
          // largeur="medium"
          onFermer={() => setModaleMotDePasseOuverte(false)}
        >
          <ChangerMotDePasse />
        </Modal>
      )}
    </main>
  );
}