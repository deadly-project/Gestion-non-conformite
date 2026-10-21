import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/api";
import { enregistrerToken } from "../api/auth";
import { FiEye, FiEyeOff, FiLock, FiUser, FiArrowRight } from "react-icons/fi";
import "./Login.css";

import logoSpat from "/images.jpg";

export default function Login({ onLogin }) {
    const [matricule, setMatricule] = useState("");
    const [motDePasse, setMotDePasse] = useState("");
    const [erreur, setErreur] = useState("");
    const [chargement, setChargement] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setErreur("");
        setChargement(true);

        try {
            const resultat = await apiRequest("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    matricule: matricule.trim(),
                    motDePasse,
                }),
            });

            enregistrerToken(resultat.accessToken);
            onLogin(resultat.utilisateur);
        } catch (error) {
            setErreur(error.message || "Connexion impossible.");
        } finally {
            setChargement(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-wrapper">
                {/* Panneau gauche : branding */}
                <aside className="login-brand">
                    <div className="brand-top">
                        <img src={logoSpat} alt="Logo SPAT" className="brand-logo" />
                        <span className="brand-tag">SMQ</span>
                    </div>

                    <div className="brand-content">
                        <h2>
                            Bienvenue sur votre <span>espace qualité</span>
                        </h2>
                        <p>
                            Plateforme de gestion du Système de Management de la Qualité
                            de la Société du Port à gestion Autonome de Toamasina.
                        </p>

                        <ul className="brand-features">
                            <li>
                                <span className="dot"></span>
                                Suivi des processus et indicateurs
                            </li>
                            <li>
                                <span className="dot"></span>
                                Gestion documentaire centralisée
                            </li>
                            <li>
                                <span className="dot"></span>
                                Accès sécurisé et traçabilité
                            </li>
                        </ul>
                    </div>

                    <div className="brand-footer">
                        <span>© {new Date().getFullYear()} SPAT — Tous droits réservés</span>
                    </div>
                </aside>

                {/* Panneau droit : formulaire avec blobs derrière */}
                <main className="login-panel">
                    <div className="panel-decor">
                        <span className="decor-blob decor-blob-1"></span>
                        <span className="decor-blob decor-blob-2"></span>
                    </div>

                    <div className="login-card">
                        <div className="card-header">
                            <h1>Connexion</h1>
                            <p>Entrez vos identifiants pour continuer</p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="input-group">
                                <label htmlFor="matricule">Matricule</label>
                                <div className="input-wrapper">
                                    <FiUser className="input-icon" size={18} />
                                    <input
                                        id="matricule"
                                        type="number"
                                        value={matricule}
                                        onChange={(e) => setMatricule(e.target.value)}
                                        autoComplete="username"
                                        required
                                        className="form-input"
                                        placeholder="Ex : 12345"
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label htmlFor="motDePasse">Mot de passe</label>
                                <div className="input-wrapper">
                                    <FiLock className="input-icon" size={18} />
                                    <input
                                        id="motDePasse"
                                        type={showPassword ? "text" : "password"}
                                        value={motDePasse}
                                        onChange={(e) => setMotDePasse(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                        className="form-input has-suffix"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Masquer" : "Afficher"}
                                    >
                                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="checkbox">
                                    <input type="checkbox" />
                                    <span>Se souvenir de moi</span>
                                </label>
                                <Link to="/mot-de-passe-oublie" className="forgot-link">
                                    Mot de passe oublié ?
                                </Link>
                            </div>

                            {erreur && (
                                <div className="error-message" role="alert">
                                    {erreur}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={chargement}
                                className="submit-button"
                            >
                                <span>{chargement ? "Connexion en cours..." : "Se connecter"}</span>
                                {!chargement && <FiArrowRight size={18} />}
                            </button>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}