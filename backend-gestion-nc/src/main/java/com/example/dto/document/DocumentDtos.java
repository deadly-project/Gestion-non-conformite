package com.example.dto.document;

import com.example.dto.audit.AuditDtos.PersonneResume;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Objets échangés par l'API de la gestion documentaire qualité (/api/documents-qualite). */
public final class DocumentDtos {

    private DocumentDtos() {}

    public record ProcessusResume(Long id, String code, String libelle) {}

    /** cheminFichier n'est volontairement pas exposé : le fichier se télécharge via /{id}/fichier. */
    public record DocumentItem(Long id, String reference, String titre, String description,
                               String typeDocument, String statut, String version,
                               String nomFichier, String mimeType, Long tailleOctets,
                               ProcessusResume processus, PersonneResume createur,
                               LocalDate dateApplication, LocalDateTime dateCreation,
                               LocalDateTime dateModification) {}

    public record Statistiques(long total, long enVigueur, long enRevision, long obsolete) {}

    public record Droits(boolean consulter, boolean ajouter, boolean modifier,
                         boolean changerStatut, boolean consulterArchives) {}

    public record DroitsRole(String role, String libelle, Droits droits) {}

    public record MesDroits(Droits moi, List<DroitsRole> matrice) {}

    /** Partie JSON (« donnees ») de la requête multipart d'ajout. */
    public record CreationRequest(String reference, String titre, String description,
                                  String typeDocument, Long processusId, String statut) {}

    public record ModificationRequest(String titre, String description, Long processusId) {}

    public record StatutRequest(String statut, String commentaire) {}
}