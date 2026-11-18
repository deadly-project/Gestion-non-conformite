import { useEffect, useRef, useState } from "react";
import { FiUser, FiMail, FiHash, FiShield } from "react-icons/fi";
import "./Avatar.css";

/* ---- Libellés & couleurs de rôle (alignés sur GestionUtilisateurs) ---- */
const ROLES = {
  DECLARANT: { libelle: "Déclarant", class: "role-declarant", degrade: "linear-gradient(135deg, #38bdf8, #1e6fd9)" },
  AUDITEUR: { libelle: "Auditeur", class: "role-auditeur", degrade: "linear-gradient(135deg, #f59e0b, #d97706)" },
  RESPONSABLE_QUALITE: { libelle: "Responsable qualité", class: "role-qualite", degrade: "linear-gradient(135deg, #8b5cf6, #6d28d9)" },
};

function infosRole(role) {
  return ROLES[role] || { libelle: role || "—", class: "role-declarant", degrade: "linear-gradient(135deg, #38bdf8, #1e6fd9)" };
}

/**
 * Avatar réutilisable.
 *
 * Props :
 *  - id        : identifiant (matricule, numéro, etc.)
 *  - nom       : nom complet ("Prénom Nom") ou { prenom, nom }
 *  - role      : code du rôle (DECLARANT, AUDITEUR, RESPONSABLE_QUALITE, ...)
 *  - email     : optionnel, affiché dans le détail
 *  - taille    : "sm" | "md" | "lg" (défaut "md")
 *  - position  : "top" | "bottom" (défaut "bottom") — sens d'ouverture du panneau
 *  - afficherDetails : bool — affiche la carte de détail au clic/focus
 *  - detailsOuverts  : bool — force l'ouverture du panneau de détail
 *  - onClick   : callback optionnel au clic
 */
export default function Avatar({
  id,
  nom,
  role,
  email,
  taille = "md",
  position = "bottom",
  afficherDetails = true,
  detailsOuverts = false,
  onClick,
}) {
  const [ouvert, setOuvert] = useState(detailsOuverts);
  const wrapRef = useRef(null);

  const prenom = typeof nom === "object" ? nom?.prenom ?? "" : String(nom ?? "").split(" ")[0] ?? "";
  const nomFamille = typeof nom === "object"
    ? nom?.nom ?? ""
    : String(nom ?? "").split(" ").slice(1).join(" ");
  const nomComplet = [prenom, nomFamille].filter(Boolean).join(" ") || "—";

  const initiales = `${prenom?.[0] ?? ""}${nomFamille?.[0] ?? ""}`.toUpperCase() || "?";
  const info = infosRole(role);

  // Fermer le panneau au clic extérieur + touche Échap
  useEffect(() => {
    if (!ouvert) return undefined;

    function surClicExterieur(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOuvert(false);
    }
    function surTouche(e) {
      if (e.key === "Escape") setOuvert(false);
    }

    document.addEventListener("mousedown", surClicExterieur);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClicExterieur);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  function gererClic(e) {
    if (onClick) onClick(e);
    if (afficherDetails && !detailsOuverts) {
      e.stopPropagation();
      setOuvert((v) => !v);
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`nc-avatar nc-avatar--${taille} nc-avatar--pos-${position} ${ouvert ? "is-open" : ""}`}
      onClick={gererClic}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          gererClic(e);
        }
      }}
      role={afficherDetails ? "button" : undefined}
      tabIndex={afficherDetails ? 0 : -1}
      aria-label={`Avatar de ${nomComplet}${role ? `, ${info.libelle}` : ""}`}
    >
      <div className="nc-avatar-badge" style={{ background: info.degrade }}>
        {initiales}
      </div>
      <div className="nc-avatar-identite">
        <strong>{nomComplet}</strong>
        <small>{info.libelle}</small>
      </div>

      {afficherDetails && ouvert && (
        <div
          className={`nc-avatar-detail nc-avatar-detail--${position}`}
          role="dialog"
          aria-label={`Détails de ${nomComplet}`}
        >
          <div className="nc-avatar-detail-header" style={{ background: info.degrade }}>
            <span className="nc-avatar-detail-initiales">{initiales}</span>
            <div>
              <strong>{nomComplet}</strong>
              <span className={`nc-avatar-role ${info.class}`}>
                <FiShield size={11} /> {info.libelle}
              </span>
            </div>
          </div>
          <ul className="nc-avatar-detail-infos">
            <li>
              <FiUser size={13} />
              <span><strong>Nom :</strong> {nomComplet}</span>
            </li>
            {role && (
              <li>
                <FiShield size={13} />
                <span><strong>Rôle :</strong> {info.libelle}</span>
              </li>
            )}
            {id != null && id !== "" && (
              <li>
                <FiHash size={13} />
                <span><strong>Matricule :</strong> <code>{id}</code></span>
              </li>
            )}
            {email && (
              <li>
                <FiMail size={13} />
                <span><strong>E-mail :</strong> {email}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}