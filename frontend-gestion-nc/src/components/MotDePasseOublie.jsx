import { useState } from "react";
import { Link } from "react-router-dom";
import { FiKey, FiUser, FiArrowLeft, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { apiRequest } from "../api/api";
import "./MotDePasseOublie.css";

export default function MotDePasseOublie() {
    const [matricule, setMatricule] = useState("");
    const [message, setMessage] = useState("");
    const [erreur, setErreur] = useState("");
    const [chargement, setChargement] = useState(false);
    const [envoye, setEnvoye] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setErreur("");
        setChargement(true);

        try {
            const resultat = await apiRequest("/api/auth/mot-de-passe-oublie", {
                method: "POST",
                body: JSON.stringify({ matricule: matricule.trim() }),
            });

            setMessage(
                resultat?.message ||
                "Votre demande a été transmise à l'administrateur."
            );
            setEnvoye(true);
        } catch (error) {
            // error.message contiendra le message du backend ("Votre demande n'a pas pu être prise en compte car...")
            setErreur(error.message || "Impossible d'envoyer la demande.");
        } finally {
            setChargement(false);
        }
    }

    return (
        <div className="pwd-page">
            <div className="pwd-card">
                <div className="pwd-header">
                    <div className="pwd-icon-wrapper">
                        <FiKey className="pwd-main-icon" />
                    </div>
                    <h1>Mot de passe oublié</h1>
                    <p>
                        {envoye
                            ? "Demande prise en compte"
                            : "Saisissez votre matricule pour réinitialiser votre accès."}
                    </p>
                </div>

                {envoye ? (
                    <div className="pwd-success-container">
                        <div className="pwd-success-alert">
                            <FiCheckCircle className="pwd-success-icon" />
                            <p role="status">{message}</p>
                        </div>
                        <p className="pwd-success-info">
                            Un administrateur va examiner votre demande. Vous recevrez
                            une notification avec la décision.
                        </p>
                        <Link to="/login" className="pwd-back-link">
                            <FiArrowLeft /> Retour à la connexion
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="pwd-form">
                        <div className="input-group">
                            <label htmlFor="matricule">Matricule</label>
                            <div className="input-wrapper">
                                <FiUser className="input-icon" />
                                <input
                                    id="matricule"
                                    type="text"
                                    className="form-input has-icon"
                                    placeholder="Ex : M12345"
                                    value={matricule}
                                    onChange={(e) => setMatricule(e.target.value)}
                                    autoComplete="username"
                                    maxLength={50}
                                    required
                                />
                            </div>
                        </div>

                        {/* Affichage de l'erreur (ex: demande déjà en attente) */}
                        {erreur && (
                            <div className="error-message" role="alert">
                                <FiAlertCircle />
                                <span>{erreur}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            className="submit-button"
                            disabled={chargement || !matricule.trim()}
                        >
                            {chargement ? "Envoi en cours..." : "Envoyer la demande"}
                        </button>

                        <div className="pwd-footer-link">
                            <Link to="/login" className="pwd-back-link">
                                <FiArrowLeft /> Retour à la connexion
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}