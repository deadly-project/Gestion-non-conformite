import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
    FiUsers, 
    FiUserPlus, 
    FiGrid, 
    FiRotateCcw, 
    FiFileText, 
    FiPlusCircle, 
    FiSettings, 
    FiClipboard, 
    FiCheckSquare, 
    FiAlertTriangle, 
    FiCalendar,
    FiClock,
    FiLogOut 
} from "react-icons/fi";
import "./Nav.css";

const liensParRole = {
    ADMINISTRATEUR: [
        { to: "/admin/dashboard", label: "Administration", icon: <FiGrid /> },
        { to: "/admin/utilisateurs/nouveau", label: "Créer un Utilisateur", icon: <FiUserPlus /> },
        { to: "/admin/utilisateurs", label: "Liste des Utilisateurs", icon: <FiUsers />, end: true },
        { to: "/admin/reinitialisations", label: "Demande de réinitialisation", icon: <FiRotateCcw /> },
        { to: "/historique", label: "Historique", icon: <FiClock /> },
    ],

    DECLARANT: [
        { to: "/declarant/non-conformites", label: "Mes déclarations", icon: <FiFileText /> },
        { to: "/declarant/non-conformites/nouvelle", label: "Déclarer une non-conformité", icon: <FiPlusCircle /> },
        { to: "/historique", label: "Mon historique", icon: <FiClock /> },
        { to: "/parametres", label: "Paramètres", icon: <FiSettings /> },
    ],

    AUDITEUR: [
        { to: "/auditeur/audits", label: "Mes audits", icon: <FiClipboard /> },
        { to: "/auditeur/constats", label: "Constats d'audit", icon: <FiCheckSquare /> },
        { to: "/historique", label: "Mon historique", icon: <FiClock /> },
        { to: "/parametres", label: "Paramètres", icon: <FiSettings /> },
    ],

    RESPONSABLE_QUALITE: [
        { to: "/responsable/non-conformites", label: "Non-conformités", icon: <FiAlertTriangle /> },
        { to: "/responsable/capa", label: "Actions correctives (CAPA)", icon: <FiCheckSquare /> },
        { to: "/historique", label: "Mon historique", icon: <FiClock /> },
        { to: "/parametres", label: "Paramètres", icon: <FiSettings /> },
    ],
};

const rolesConfig = {
    ADMINISTRATEUR: {
        themeClass: "role-admin",
        label: "Administrateur",
    },
    DECLARANT: {
        themeClass: "role-declarant",
        label: "Déclarant",
    },
    AUDITEUR: {
        themeClass: "role-auditeur",
        label: "Auditeur",
    },
    RESPONSABLE_QUALITE: {
        themeClass: "role-responsable",
        label: "Resp. Qualité",
    },
};

function getInitiales(prenom, nom) {
    const p = prenom ? prenom.charAt(0) : "";
    const n = nom ? nom.charAt(0) : "";
    return (p + n).toUpperCase() || "U";
}

export default function Nav({ utilisateur, onLogout }) {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    const liens = liensParRole[utilisateur?.role] || [];
    const initiales = getInitiales(utilisateur?.prenom, utilisateur?.nom);
    const currentRoleConfig = rolesConfig[utilisateur?.role] || {
        themeClass: "role-default",
        label: utilisateur?.role || "Utilisateur",
    };

    return (
        <>
            <header className="nav-mobile-bar">
                <span className="nav-mobile-title">SMQ Qualité</span>
                <button
                    type="button"
                    className="nav-hamburger"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Ouvrir le menu"
                >
                    <span className={`hamburger-line ${isOpen ? "open" : ""}`}></span>
                    <span className={`hamburger-line ${isOpen ? "open" : ""}`}></span>
                    <span className={`hamburger-line ${isOpen ? "open" : ""}`}></span>
                </button>
            </header>

            {isOpen && <div className="nav-overlay" onClick={() => setIsOpen(false)} />}

            <nav className={`nav-container ${isOpen ? "is-open" : ""}`}>
                <div className={`nav-user-info ${currentRoleConfig.themeClass}`}>
                    <div className="nav-user-avatar">
                        {initiales}
                    </div>
                    <div className="nav-user-details">
                        <p className="nav-user-name">
                            {utilisateur?.prenom} {utilisateur?.nom}
                        </p>
                        <span className="nav-user-role-badge">
                            {currentRoleConfig.label}
                        </span>
                    </div>
                </div>

                <ul className="nav-links-list">
                    {liens.map((lien) => (
                        <li key={lien.to} className="nav-link-item">
                            <NavLink
                                to={lien.to}
                                end={lien.end}
                                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                            >
                                <span className="nav-link-icon">{lien.icon}</span>
                                <span className="nav-link-text">{lien.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>

                <button type="button" className="nav-logout-btn" onClick={onLogout}>
                    <FiLogOut className="nav-logout-icon" />
                    <span>Se déconnecter</span>
                </button>
            </nav>
        </>
    );
}