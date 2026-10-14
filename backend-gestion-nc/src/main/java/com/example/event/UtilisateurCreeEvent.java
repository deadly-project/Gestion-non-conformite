package com.example.event;

import java.util.UUID;

/**
 * Publié après la création d'un compte. Traité APRÈS le commit de la transaction,
 * pour ne jamais envoyer d'email concernant un compte finalement annulé.
 */
public record UtilisateurCreeEvent(
        UUID id,
        String prenom,
        String nom,
        String email,
        String matricule,
        String role,
        String motDePasseTemporaire
) {
    /** Le mot de passe ne doit jamais apparaître dans un log. */
    @Override
    public String toString() {
        return "UtilisateurCreeEvent[id=" + id + ", email=" + email + ", role=" + role + "]";
    }
}