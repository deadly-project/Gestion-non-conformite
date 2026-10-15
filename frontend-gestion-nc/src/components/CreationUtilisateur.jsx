import { useState } from "react";
import { apiRequest } from "../api/api";

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
    const [erreur, setErreur] = useState("");
    const [messageSucces, setMessageSucces] = useState("");
    const [statutEmail, setStatutEmail] = useState("");
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
        setMessageSucces("");
        setStatutEmail("");
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

            // resultat contient { utilisateur, messageSucces, statutEmail }
            setMessageSucces(resultat.messageSucces || "Utilisateur créé avec succès.");
            setStatutEmail(resultat.statutEmail || "");
            setFormulaire(formulaireInitial);
            onCreated?.();
        } catch (error) {
            setErreur(error.message || "Erreur lors de la création de l'utilisateur.");
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
                        minLength={8}
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

                {erreur && (
                    <p role="alert" style={{ color: "red", fontWeight: "bold" }}>
                        ❌ {erreur}
                    </p>
                )}

                {messageSucces && (
                    <p role="status" style={{ color: "green", fontWeight: "bold" }}>
                        ✅ {messageSucces}
                    </p>
                )}

                {statutEmail && (
                    <p role="status" style={{ color: statutEmail.includes("succès") ? "green" : "orange" }}>
                        📧 {statutEmail}
                    </p>
                )}

                <button type="submit" disabled={chargement}>
                    {chargement ? "Création..." : "Créer l'utilisateur"}
                </button>
            </form>
        </main>
    );
}