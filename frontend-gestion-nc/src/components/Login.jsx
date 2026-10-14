
import { useState } from "react";
import { apiRequest } from "../api/api";

export default function Login({ onLogin }) {
    const [email, setEmail] = useState("");
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
                    email: email.trim(),
                    motDePasse,
                }),
            });

            // Le JWT reste dans le cookie HttpOnly.
            // Le frontend ne reçoit que le profil utilisateur.
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
                    <label htmlFor="email">Adresse email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                <a href="">Mot de passe oublié</a>
            </form>
        </main>
    );
}
