import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../api/api";

const roles = [
  { valeur: "DECLARANT", libelle: "Déclarant" },
  { valeur: "AUDITEUR", libelle: "Auditeur" },
  { valeur: "RESPONSABLE_QUALITE", libelle: "Responsable qualité" },
];
const formulaireVide = { nom: "", prenom: "", email: "", matricule: "", role: "DECLARANT" };

function libelleRole(role) {
  return roles.find((r) => r.valeur === role)?.libelle ?? role ?? "—";
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

  useEffect(() => { charger(); }, [charger]);

  function commencerEdition(user) {
    setEdition(user);
    setFormulaire({ nom: user.nom ?? "", prenom: user.prenom ?? "", email: user.email ?? "", matricule: user.matricule ?? "", role: user.role ?? "DECLARANT" });
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

  // Basculer l'état Actif / Désactivé du compte
  async function basculerStatut(user) {
    const actionTexte = user.actif ? "désactiver" : "réactiver";
    const confirmationMessage = user.actif
      ? `Désactiver le compte de ${user.prenom} ${user.nom} (${user.matricule}) ? Cette action empêchera sa prochaine connexion.`
      : `Voulez-vous réactiver le compte de ${user.prenom} ${user.nom} (${user.matricule}) ?`;

    if (!window.confirm(confirmationMessage)) return;

    setEnCours(user.id);
    setErreur("");
    setMessage("");
    try {
      if (user.actif) {
        await apiRequest(`/api/utilisateurs/${user.id}/desactiver`, { method: "PATCH" });
        setMessage(`Le compte de ${user.prenom} ${user.nom} a été désactivé.`);
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

  // Réinitialisation directe du mot de passe sans redirection
  async function reinitialiser(user) {
    if (!user.actif) {
      setErreur("Impossible de réinitialiser le mot de passe d'un compte désactivé.");
      return;
    }
    const confirme = window.confirm(
      `Voulez-vous réinitialiser le mot de passe de ${user.prenom} ${user.nom} (${user.matricule}) ?\n\n` +
      "Un nouveau mot de passe aléatoire sera généré et envoyé directement par e-mail à l'utilisateur."
    );
    if (!confirme) return;

    setEnCours(user.id);
    setErreur("");
    setMessage("");
    try {
      // Étape 1 : Créer la demande
      const demande = await apiRequest("/api/auth/mot-de-passe-oublie", {
        method: "POST",
        body: JSON.stringify({ matricule: user.matricule }),
      });

      // Récupération de l'ID de la demande créée (gérant les différentes structures de réponse possibles)
      const demandeId = demande?.id || demande?.demande?.id;

      if (demandeId) {
        // Étape 2 : Valider immédiatement la demande pour déclencher l'envoi du mail et la mise à jour du mot de passe
        await apiRequest(`/api/admin/reinitialisations/${demandeId}/valider`, {
          method: "POST",
        });
        setMessage(`Le mot de passe de ${user.prenom} ${user.nom} a été réinitialisé et envoyé par e-mail.`);
      } else {
        // Fallback si l'API de création ne renvoie pas l'objet complet : récupération des demandes en attente
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
  const visibles = utilisateurs.filter((u) => [u.nom, u.prenom, u.email, u.matricule, u.role].some((v) => String(v ?? "").toLocaleLowerCase("fr").includes(filtre)));

  return (
    <main className="admin-users-page">
      <header className="admin-users-header">
        <div><span className="admin-users-eyebrow">ADMINISTRATION DU SMQ</span><h1>Gestion des utilisateurs</h1><p>Consultez les comptes, modifiez leurs informations et gérez leur accès.</p></div>
        <Link className="admin-users-primary" to="/admin/utilisateurs/nouveau">+ Créer un utilisateur</Link>
      </header>
      {erreur && <p className="admin-users-alert admin-users-alert--error" role="alert">{erreur}</p>}
      {message && <p className="admin-users-alert admin-users-alert--success" role="status">{message}</p>}

      {edition && <section className="admin-users-panel">
        <div className="admin-users-panel__header"><h2>Modifier {edition.prenom} {edition.nom}</h2><button type="button" className="admin-users-secondary" onClick={() => setEdition(null)}>Annuler</button></div>
        <form className="admin-users-form" onSubmit={enregistrerEdition}>
          <label>Nom<input required maxLength={100} value={formulaire.nom} onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })} /></label>
          <label>Prénom<input required maxLength={100} value={formulaire.prenom} onChange={(e) => setFormulaire({ ...formulaire, prenom: e.target.value })} /></label>
          <label>E-mail<input required type="email" maxLength={255} value={formulaire.email} onChange={(e) => setFormulaire({ ...formulaire, email: e.target.value })} /></label>
          <label>Matricule<input required maxLength={50} value={formulaire.matricule} onChange={(e) => setFormulaire({ ...formulaire, matricule: e.target.value })} /></label>
          <label>Rôle<select value={formulaire.role} onChange={(e) => setFormulaire({ ...formulaire, role: e.target.value })}>{roles.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}</select></label>
          <div className="admin-users-form__actions"><button className="admin-users-primary" disabled={enCours === edition.id}>{enCours === edition.id ? "Enregistrement…" : "Enregistrer"}</button><button type="button" className="admin-users-secondary" onClick={() => setEdition(null)}>Annuler</button></div>
        </form>
      </section>}

      <section className="admin-users-panel">
        <div className="admin-users-toolbar"><div><h2>Comptes enregistrés</h2><p>{utilisateurs.length} compte(s) au total</p></div><div className="admin-users-toolbar__actions"><input aria-label="Rechercher un utilisateur" placeholder="Rechercher nom, matricule, rôle…" value={recherche} onChange={(e) => setRecherche(e.target.value)} /><button type="button" className="admin-users-secondary" onClick={charger}>Actualiser</button></div></div>
        {chargement ? <p>Chargement des utilisateurs…</p> : visibles.length === 0 ? <p>Aucun utilisateur ne correspond à la recherche.</p> : <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th>Utilisateur</th><th>Matricule</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{visibles.map((u) => <tr key={u.id}>
          <td><strong>{u.prenom} {u.nom}</strong><small>{u.email}</small></td><td>{u.matricule}</td><td>{libelleRole(u.role)}</td><td><span className={`admin-users-status ${u.actif ? "is-active" : "is-inactive"}`}>{u.actif ? "Actif" : "Désactivé"}</span></td>
          <td>
            <div className="admin-users-row-actions">
              <button type="button" className="admin-users-secondary" onClick={() => commencerEdition(u)}>Modifier</button>
              <button type="button" className="admin-users-secondary" disabled={!u.actif || enCours === u.id} onClick={() => reinitialiser(u)}>{enCours === u.id ? "Traitement…" : "Réinitialiser MDP"}</button>
              <button 
                type="button" 
                className={u.actif ? "admin-users-danger" : "admin-users-secondary"} 
                disabled={enCours === u.id} 
                onClick={() => basculerStatut(u)}
              >
                {enCours === u.id ? "Traitement…" : (u.actif ? "Désactiver" : "Activer")}
              </button>
            </div>
          </td>
        </tr>)}</tbody></table></div>}
      </section>
      <p className="admin-users-note">Les comptes peuvent être désactivés puis réactivés à tout moment. La réinitialisation du mot de passe crée et valide automatiquement la demande pour envoyer un nouveau mot de passe par e-mail.</p>
      <style>{`
        .admin-users-page{max-width:1250px;margin:30px auto;padding:0 22px 48px;color:var(--text-color,#172033)}.admin-users-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}.admin-users-header h1{margin:5px 0 8px;font-size:clamp(1.7rem,3vw,2.2rem)}.admin-users-header p,.admin-users-toolbar p,.admin-users-note{color:var(--muted-color,#687386);line-height:1.55}.admin-users-eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.12em;color:#315fce}.admin-users-panel{background:var(--card-background,#fff);border:1px solid var(--border-color,#e2e7ef);border-radius:15px;padding:22px;margin:18px 0;box-shadow:0 7px 24px rgba(20,35,65,.04)}.admin-users-panel h2{font-size:1.15rem;margin:0 0 5px}.admin-users-toolbar,.admin-users-panel__header{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:18px}.admin-users-toolbar p{margin:0;font-size:.9rem}.admin-users-toolbar__actions{display:flex;gap:8px;align-items:center}.admin-users-toolbar input,.admin-users-form input,.admin-users-form select{box-sizing:border-box;max-width:100%;border:1px solid var(--border-color,#cfd7e4);border-radius:8px;padding:10px 11px;background:var(--input-background,#fff);color:inherit;font:inherit}.admin-users-toolbar input{width:min(330px,50vw)}.admin-users-primary,.admin-users-secondary,.admin-users-danger{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:9px 12px;border:1px solid transparent;font:inherit;font-size:.86rem;font-weight:700;text-decoration:none;cursor:pointer;white-space:nowrap}.admin-users-primary{background:#315fce;color:#fff}.admin-users-secondary{background:transparent;border-color:var(--border-color,#cfd7e4);color:inherit}.admin-users-danger{background:#fff0f0;color:#a52020;border-color:#ffd0d0}.admin-users-primary:disabled,.admin-users-secondary:disabled,.admin-users-danger:disabled{opacity:.55;cursor:not-allowed}.admin-users-table-wrap{overflow-x:auto}.admin-users-table{width:100%;border-collapse:collapse;font-size:.9rem}.admin-users-table th,.admin-users-table td{text-align:left;padding:13px 11px;border-bottom:1px solid var(--border-color,#e7ebf1);vertical-align:middle}.admin-users-table th{font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-color,#687386);background:var(--subtle-background,#f8faff)}.admin-users-table td small{display:block;margin-top:4px;color:var(--muted-color,#687386);overflow-wrap:anywhere}.admin-users-status{display:inline-flex;border-radius:30px;padding:5px 9px;font-size:.78rem;font-weight:750}.admin-users-status.is-active{background:#e9f9ef;color:#17663c}.admin-users-status.is-inactive{background:#f1f2f5;color:#646b78}.admin-users-row-actions{display:flex;gap:6px;flex-wrap:wrap}.admin-users-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.admin-users-form label{display:grid;gap:6px;font-size:.9rem;font-weight:650}.admin-users-form__actions{display:flex;gap:8px;align-items:center;align-self:end}.admin-users-alert{padding:11px 14px;border-radius:9px}.admin-users-alert--error{background:#fff0f0;color:#9d2020}.admin-users-alert--success{background:#edfff4;color:#17663c}.admin-users-note{font-size:.86rem}.admin-users-panel__header{margin-bottom:20px}@media(max-width:850px){.admin-users-header,.admin-users-toolbar{align-items:flex-start;flex-direction:column}.admin-users-toolbar__actions{width:100%;flex-wrap:wrap}.admin-users-toolbar input{width:100%;flex:1}.admin-users-form{grid-template-columns:1fr}}@media(max-width:600px){.admin-users-page{padding:0 12px 30px}.admin-users-panel{padding:14px}.admin-users-header{flex-direction:column}.admin-users-table{min-width:820px}}
      `}</style>
    </main>
  );
}