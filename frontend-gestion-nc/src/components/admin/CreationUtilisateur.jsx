import { useState, useEffect } from "react";
import { 
    FiUserPlus, 
    FiUser, 
    FiMail, 
    FiHash, 
    FiLock, 
    FiShield, 
    FiCheckCircle, 
    FiAlertCircle, 
    FiInfo,
    FiX
} from "react-icons/fi";
import { apiRequest } from "../../api/api";
import "./CreationUtilisateur.css";

const formulaireInitial = {
    nom: "",
    prenom: "",
    email: "",
    matricule: "",
    motDePasse: "",
    role: "DECLARANT",
};

export default function CreationUtilisateur({ onCreated }) {
    const [formulaire, setFormulaire] = useState(formulaireInitial);
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }
    const [chargement, setChargement] = useState(false);

    // Effet pour faire disparaître automatiquement la notification après 5 secondes
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    function modifier(champ, valeur) {
        setFormulaire((ancien) => ({
            ...ancien,
            [champ]: valeur,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setNotification(null);
        setChargement(true);

        const payload = {
            ...formulaire,
            dateNaissance: formulaire.dateNaissance || null,
        };

        try {
            const resultat = await apiRequest("/api/utilisateurs", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            const msgSucces = resultat.messageSucces || "Utilisateur créé avec succès.";
            const msgEmail = resultat.statutEmail ? ` (${resultat.statutEmail})` : "";

            setNotification({
                type: "success",
                message: msgSucces + msgEmail
            });

            setFormulaire(formulaireInitial);
            onCreated?.();
        } catch (error) {
            setNotification({
                type: "error",
                message: error.message || "Erreur lors de la création de l'utilisateur."
            });
        } finally {
            setChargement(false);
        }
    }

    return (
        <main className="user-create-page">
            {/* Notification Toast Flottante (Temporaire) */}
            {notification && (
                <div className={`toast-notification ${notification.type}`} role="status">
                    {notification.type === "success" && <FiCheckCircle className="toast-icon" />}
                    {notification.type === "error" && <FiAlertCircle className="toast-icon" />}
                    {notification.type === "info" && <FiInfo className="toast-icon" />}
                    
                    <span className="toast-text">{notification.message}</span>
                    
                    <button 
                        type="button" 
                        className="toast-close" 
                        onClick={() => setNotification(null)}
                        aria-label="Fermer"
                    >
                        <FiX />
                    </button>
                </div>
            )}

            <div className="user-create-header-section">
                <h1>Créer un utilisateur</h1>
                <p className="user-create-subtitle">
                    Ajoutez un nouveau collaborateur et attribuez-lui son rôle dans le système.
                </p>
            </div>

            <div className="user-create-card">
                <form onSubmit={handleSubmit} className="user-create-form">
                    <div className="form-grid">
                        {/* Nom */}
                        <div className="input-group">
                            <label htmlFor="nom">Nom</label>
                            <div className="input-wrapper">
                                <FiUser className="input-icon" />
                                <input
                                    id="nom"
                                    className="form-input has-icon"
                                    placeholder="Ex : Dupont"
                                    value={formulaire.nom}
                                    onChange={(e) => modifier("nom", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Prénom */}
                        <div className="input-group">
                            <label htmlFor="prenom">Prénom</label>
                            <div className="input-wrapper">
                                <FiUser className="input-icon" />
                                <input
                                    id="prenom"
                                    className="form-input has-icon"
                                    placeholder="Ex : Jean"
                                    value={formulaire.prenom}
                                    onChange={(e) => modifier("prenom", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="input-group">
                            <label htmlFor="email">Email</label>
                            <div className="input-wrapper">
                                <FiMail className="input-icon" />
                                <input
                                    id="email"
                                    type="email"
                                    className="form-input has-icon"
                                    placeholder="jean.dupont@entreprise.com"
                                    value={formulaire.email}
                                    onChange={(e) => modifier("email", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Matricule */}
                        <div className="input-group">
                            <label htmlFor="matricule">Matricule</label>
                            <div className="input-wrapper">
                                <FiHash className="input-icon" />
                                <input
                                    id="matricule"
                                    type="number"
                                    className="form-input has-icon"
                                    placeholder="Ex : 12345"
                                    value={formulaire.matricule}
                                    onChange={(e) => modifier("matricule", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Mot de passe */}
                        <div className="input-group">
                            <label htmlFor="motDePasse">Mot de passe initial</label>
                            <div className="input-wrapper">
                                <FiLock className="input-icon" />
                                <input
                                    id="motDePasse"
                                    type="password"
                                    className="form-input has-icon"
                                    minLength={8}
                                    maxLength={72}
                                    autoComplete="new-password"
                                    placeholder="Min. 8 caractères"
                                    value={formulaire.motDePasse}
                                    onChange={(e) => modifier("motDePasse", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* Rôle */}
                        <div className="input-group">
                            <label htmlFor="role">Rôle</label>
                            <div className="input-wrapper">
                                <FiShield className="input-icon" />
                                <select
                                    id="role"
                                    className="form-input has-icon form-select"
                                    value={formulaire.role}
                                    onChange={(e) => modifier("role", e.target.value)}
                                >
                                    <option value="DECLARANT">Déclarant</option>
                                    <option value="AUDITEUR">Auditeur</option>
                                    <option value="RESPONSABLE_QUALITE">Responsable qualité</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="submit-button" disabled={chargement}>
                            <FiUserPlus />
                            <span>{chargement ? "Création en cours..." : "Créer l'utilisateur"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}