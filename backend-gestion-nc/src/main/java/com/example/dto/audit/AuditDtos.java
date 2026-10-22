package com.example.dto.audit;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Tous les objets échangés par l'espace auditeur et le suivi des CAPA (responsable qualité). */
public final class AuditDtos {

    private AuditDtos() {}

    // ------------------------------------------------------------------ réponses communes
    public record PersonneResume(Long id, String nom, String prenom, Integer matricule) {}

    public record NcResume(Long id, String reference, String titre, String statut) {}

    public record EtapeResume(Long id, int numero, String type, String description,
                              LocalDate dateEcheance, String statut) {}

    /** Ligne du calendrier d'un auditeur. nc et etape sont null pour un audit sans étape CAPA. */
    public record AuditItem(Long id, String titre, LocalDate date, LocalDate dateRealisation,
                            String typeAudit, String statut, String resultatTraitement,
                            String processus, NcResume nc, EtapeResume etape,
                            long nbConstats, boolean enRetard) {}

    public record CommentaireDto(Long id, PersonneResume auteur, String commentaire, LocalDateTime date) {}

    public record ConstatDto(Long id, String type, String description, PersonneResume auteur,
                             LocalDateTime date, List<CommentaireDto> commentaires) {}

    /** Page de réalisation d'un audit. modifiable = false : motifBlocage explique pourquoi. */
    public record AuditDetail(AuditItem audit, String compteRendu, String traitementRealise,
                              boolean modifiable, String motifBlocage, List<ConstatDto> constats) {}

    // ------------------------------------------------------------------ suivi responsable qualité
    public record AuditSuivi(Long id, LocalDate date, LocalDate dateRealisation, String typeAudit,
                             String statut, PersonneResume auditeur, String resultatTraitement,
                             String compteRendu, String traitementRealise, List<ConstatDto> constats) {}

    public record EtapeSuivi(Long id, int numero, String type, String description,
                             PersonneResume responsable, LocalDate dateEcheance, String statut,
                             Boolean efficace, String commentaireEfficacite,
                             LocalDateTime dateVerification, PersonneResume verificateur,
                             boolean validable, String motifNonValidable, List<AuditSuivi> audits) {}

    public record SuiviNc(Long id, String reference, String titre, String statut, boolean cloturee,
                          int nbEtapes, int nbValidees, int nbNonEfficaces,
                          boolean peutCloturer, String motifNonCloturable, List<EtapeSuivi> etapes) {}

    // ------------------------------------------------------------------ requêtes
    public record ConstatRequest(
            @NotNull @Pattern(regexp = "ECART|POINT_FORT|REMARQUE") String type,
            @NotBlank @Size(max = 4000) String description) {}

    /** Les trois champs sont facultatifs à l'enregistrement ; terminer() contrôle leur présence. */
    public record CompteRenduRequest(
            @Size(max = 8000) String compteRendu,
            @Size(max = 8000) String traitementRealise,
            @Pattern(regexp = "REALISE|PARTIEL|NON_REALISE") String resultatTraitement) {}

    public record CommentaireRequest(@NotBlank @Size(max = 2000) String commentaire) {}

    public record ValidationRequest(@NotNull Boolean efficace, @Size(max = 2000) String commentaire) {}

    public record ClotureRequest(@Size(max = 2000) String commentaire) {}
}