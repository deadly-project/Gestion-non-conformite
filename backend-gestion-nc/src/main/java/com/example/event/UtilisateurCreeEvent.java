package com.example.event;

/**
 * Publié après la création d'un compte. Traité APRÈS le commit de la transaction,
 * pour ne jamais envoyer d'email concernant un compte finalement annulé.
 */
public record UtilisateurCreeEvent(
        Long id,
        String prenom,
        String nom,
        String email,
        Integer matricule,
        String role,
        String motDePasseTemporaire
) {
    /** Le mot de passe ne doit jamais apparaître dans un log. */
    @Override
    public String toString() {
        return "UtilisateurCreeEvent[id=" + id + ", email=" + email + ", role=" + role + "]";
    }
}
