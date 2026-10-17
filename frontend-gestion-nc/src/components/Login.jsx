import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/api";
import { enregistrerToken } from "../api/auth";
import "./Login.css";

export default function Login({ onLogin }) {
    const [matricule, setMatricule] = useState("");
    const [motDePasse, setMotDePasse] = useState("");
    const [erreur, setErreur] = useState("");
    const [chargement, setChargement] = useState(false);

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

            // Le jeton reste dans CET onglet (sessionStorage)
            enregistrerToken(resultat.accessToken);
            onLogin(resultat.utilisateur);
        } catch (error) {
            setErreur(error.message || "Connexion impossible.");
        } finally {
            setChargement(false);
        }
    }

    return (
        <main>
            <h1>Connexion au SMQ</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="matricule">Matricule</label>
                    <input
                        id="matricule"
                        type="number"
                        value={matricule}
                        onChange={(e) => setMatricule(e.target.value)}
                        autoComplete="username"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="motDePasse">Mot de passe</label>
                    <input
                        id="motDePasse"
                        type="password"
                        value={motDePasse}
                        onChange={(e) => setMotDePasse(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                </div>

                {erreur && <p role="alert">{erreur}</p>}

                <button type="submit" disabled={chargement}>
                    {chargement ? "Connexion..." : "Se connecter"}
                </button>
                <Link to="/mot-de-passe-oublie">Mot de passe oublié</Link>
            </form>
        </main>
    );
}