package com.example.domain;

/**
 * Types de notification (colonne notifications.type, texte libre limité à 40 caractères).
 * Le front (NotificationBell / lienNotification) s'en sert pour choisir l'icône et la page cible.
 */
public final class TypeNotification {

    private TypeNotification() {}

    // ----- Administrateur -----
    public static final String UTILISATEUR_CREE = "UTILISATEUR_CREE";
    public static final String UTILISATEUR_MODIFIE = "UTILISATEUR_MODIFIE";
    public static final String UTILISATEUR_DESACTIVE = "UTILISATEUR_DESACTIVE";
    public static final String UTILISATEUR_ACTIVE = "UTILISATEUR_ACTIVE";
    public static final String DEMANDE_REINIT_RECUE = "DEMANDE_REINIT_RECUE";

    // ----- Tous les rôles : leurs propres demandes et leurs propres informations -----
    public static final String DEMANDE_REINIT_VALIDEE = "DEMANDE_REINIT_VALIDEE";
    public static final String DEMANDE_REINIT_REFUSEE = "DEMANDE_REINIT_REFUSEE";
    public static final String PROFIL_MODIFIE = "PROFIL_MODIFIE";
    public static final String MOT_DE_PASSE_MODIFIE = "MOT_DE_PASSE_MODIFIE";

    // ----- Responsable qualité -----
    public static final String NC_DECLAREE = "NC_DECLAREE";
    public static final String NC_MODIFIEE = "NC_MODIFIEE";
    public static final String AUDIT_DEMARRE = "AUDIT_DEMARRE";
    public static final String COMPTE_RENDU_ENREGISTRE = "COMPTE_RENDU_ENREGISTRE";
    public static final String CONSTAT_AJOUTE = "CONSTAT_AJOUTE";
    public static final String CONSTAT_MODIFIE = "CONSTAT_MODIFIE";
    public static final String CONSTAT_SUPPRIME = "CONSTAT_SUPPRIME";
    public static final String AUDIT_TERMINE = "AUDIT_TERMINE";
    public static final String AUDIT_REOUVERT = "AUDIT_REOUVERT";
    public static final String NC_ECHEANCE_DEPASSEE = "NC_ECHEANCE_DEPASSEE";
    public static final String NC_SANS_TRAITEMENT = "NC_SANS_TRAITEMENT";

    // ----- Responsable qualité et auditeur -----
    public static final String NC_CLOTUREE = "NC_CLOTUREE";

    // ----- Auditeur -----
    public static final String AUDIT_ATTRIBUE = "AUDIT_ATTRIBUE";
    public static final String AUDIT_RETIRE = "AUDIT_RETIRE";
    public static final String NC_AUDITEUR_ASSIGNE = "NC_AUDITEUR_ASSIGNE";
    public static final String COMMENTAIRE_CONSTAT = "COMMENTAIRE_CONSTAT";

    // ----- Déclarant -----
    public static final String NC_STATUT_CHANGE = "NC_STATUT_CHANGE";
}
