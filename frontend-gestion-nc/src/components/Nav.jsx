
import { NavLink } from "react-router-dom";

const liensParRole = {
    ADMINISTRATEUR: [
        { to: "/admin/utilisateurs", label: "Utilisateurs" },
        { to: "/admin/dashboard", label: "Administration" },
        { to: "/admin/reinitialisations", label: "Demande de reinitialisation" },
    ],

    DECLARANT: [
        { to: "/declarant/non-conformites", label: "Mes déclarations" },
        { to: "/declarant/non-conformites/nouvelle", label: "Déclarer une non-conformité" },
    ],

    AUDITEUR: [
        { to: "/auditeur/audits", label: "Mes audits" },
        { to: "/auditeur/constats", label: "Constats d'audit" },
    ],

    RESPONSABLE_QUALITE: [
        { to: "/responsable/non-conformites", label: "Non-conformités" },
        { to: "/responsable/capa", label: "Actions correctives (CAPA)" },
        { to: "/responsable/audits", label: "Planification des audits" },
    ],
};

export default function Nav({ utilisateur, onLogout }) {
    const liens = liensParRole[utilisateur?.role] || [];

    return (
        <nav>
            <p>
                Connecté : {utilisateur?.prenom} {utilisateur?.nom}
            </p>
            <p>Rôle : {utilisateur?.role}</p>

            <ul>
                {liens.map((lien) => (
                    <li key={lien.to}>
                        <NavLink to={lien.to}>
                            {lien.label}
                        </NavLink>
                    </li>
                ))}
            </ul>

            <button type="button" onClick={onLogout}>
                Se déconnecter
            </button>
        </nav>
    );
}
