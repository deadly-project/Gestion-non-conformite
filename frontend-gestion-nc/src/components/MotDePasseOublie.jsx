import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/api";

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
            setErreur(error.message || "Impossible d'envoyer la demande.");
        } finally {
            setChargement(false);
        }
    }

    return (
        <main>
            <h1>Mot de passe oublié</h1>

            {envoye ? (
                <>
                    <p role="status">{message}</p>
                    <p>
                        Un administrateur va examiner votre demande. Vous recevrez
                        un email avec la décision.
                    </p>
                    <Link to="/login">Retour à la connexion</Link>
                </>
            ) : (
                <form onSubmit={handleSubmit}>
                    <p>
                        Saisissez votre matricule. Votre demande sera transmise à
                        l'administrateur.
                    </p>

                    <div>
                        <label htmlFor="matricule">Matricule</label>
                        <input
                            id="matricule"
                            type="text"
                            value={matricule}
                            onChange={(e) => setMatricule(e.target.value)}
                            autoComplete="username"
                            maxLength={50}
                            required
                        />
                    </div>

                    {erreur && <p role="alert">{erreur}</p>}

                    <button type="submit" disabled={chargement || !matricule.trim()}>
                        {chargement ? "Envoi..." : "Demander"}
                    </button>
                    <Link to="/login">Retour à la connexion</Link>
                </form>
            )}
        </main>
    );
}