import ModifierProfil from "./ModifierProfil";
import ChangerMotDePasse from "./ChangerMotDePasse";


export default function Parametres({ utilisateur, onUtilisateurModifie }) {
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
        <ModifierProfil utilisateur={utilisateur} onProfilModifie={profilModifie} />
        <ChangerMotDePasse />
      </div>
    </main>
  );
}