
import { useState } from "react";
import { apiRequest } from "../api/api";

const formulaireInitial = {
    nom: "",
    prenom: "",
    dateNaissance: "",
    email: "",
    matricule: "",
    motDePasse: "",
    role: "DECLARANT",
};

export default function CreationUtilisateur({ onCreated }) {
    const [formulaire, setFormulaire] = useState(formulaireInitial);
    const [erreur, setErreur] = useState("");
    const [message, setMessage] = useState("");
    const [chargement, setChargement] = useState(false);

    function modifier(champ, valeur) {
        setFormulaire((ancien) => ({
            ...ancien,
            [champ]: valeur,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setErreur("");
        setMessage("");
        setChargement(true);

        const payload = {
            ...formulaire,
            dateNaissance: formulaire.dateNaissance || null,
        };

        try {
            await apiRequest("/api/utilisateurs", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setMessage("Utilisateur créé avec succès.");
            setFormulaire(formulaireInitial);
            onCreated?.();
        } catch (error) {
            setErreur(error.message);
        } finally {
            setChargement(false);
        }
    }

    return (
        <main>
            <h1>Créer un utilisateur</h1>

            <p>
                Les comptes administrateurs ne peuvent pas être créés
                depuis ce formulaire.
            </p>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="nom">Nom</label>
                    <input
                        id="nom"
                        value={formulaire.nom}
                        onChange={(e) => modifier("nom", e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="prenom">Prénom</label>
                    <input
                        id="prenom"
                        value={formulaire.prenom}
                        onChange={(e) => modifier("prenom", e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="dateNaissance">Date de naissance</label>
                    <input
                        id="dateNaissance"
                        type="date"
                        value={formulaire.dateNaissance}
                        onChange={(e) =>
                            modifier("dateNaissance", e.target.value)
                        }
                    />
                </div>

                <div>
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={formulaire.email}
                        onChange={(e) => modifier("email", e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="matricule">Matricule</label>
                    <input
                        id="matricule"
                        value={formulaire.matricule}
                        onChange={(e) =>
                            modifier("matricule", e.target.value)
                        }
                        required
                    />
                </div>

                <div>
                    <label htmlFor="motDePasse">Mot de passe initial</label>
                    <input
                        id="motDePasse"
                        type="password"
                        minLength={12}
                        maxLength={72}
                        autoComplete="new-password"
                        value={formulaire.motDePasse}
                        onChange={(e) =>
                            modifier("motDePasse", e.target.value)
                        }
                        required
                    />
                </div>

                <div>
                    <label htmlFor="role">Rôle</label>
                    <select
                        id="role"
                        value={formulaire.role}
                        onChange={(e) => modifier("role", e.target.value)}
                    >
                        <option value="DECLARANT">Déclarant</option>
                        <option value="AUDITEUR">Auditeur</option>
                        <option value="RESPONSABLE_QUALITE">
                            Responsable qualité
                        </option>
                    </select>
                </div>

                {erreur && <p role="alert">{erreur}</p>}
                {message && <p role="status">{message}</p>}

                <button type="submit" disabled={chargement}>
                    {chargement ? "Création..." : "Créer l'utilisateur"}
                </button>
            </form>
        </main>
    );
}
