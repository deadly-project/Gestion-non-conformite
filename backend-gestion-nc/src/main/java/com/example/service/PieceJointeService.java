package com.example.service;

import com.example.domain.TypeFichier;
import com.example.entity.NcAttachment;
import com.example.repository.NcAttachmentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Pièces jointes d'une NC : 6 images maximum + 1 PDF facultatif.
 *
 * Les fichiers sont stockés sur disque (smq.storage.root), jamais en base ; la base ne garde
 * que le chemin relatif. Le nom choisi par l'utilisateur n'est jamais utilisé comme chemin.
 */
@Service
public class PieceJointeService {

    public static final int MAX_IMAGES = 6;
    public static final long TAILLE_MAX_IMAGE = 8L * 1024 * 1024;   // 8 Mo
    public static final long TAILLE_MAX_PDF = 10L * 1024 * 1024;    // 10 Mo

    private static final Set<String> MIME_IMAGES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final String MIME_PDF = "application/pdf";

    /** Fichier déjà contrôlé, prêt à être enregistré. */
    public record FichierValide(MultipartFile fichier, TypeFichier type, String mime, String extension) {}

    private final NcAttachmentRepository attachmentRepository;
    private final Path racine;

    public PieceJointeService(NcAttachmentRepository attachmentRepository,
                              @Value("${smq.storage.root:uploads}") String racine) {
        this.attachmentRepository = attachmentRepository;
        this.racine = Paths.get(racine).toAbsolutePath().normalize();
    }

    // ------------------------------------------------------------------
    // 1. Contrôle de TOUS les fichiers avant d'enregistrer quoi que ce soit
    // ------------------------------------------------------------------
    public List<FichierValide> valider(List<MultipartFile> images, MultipartFile pdf) {
        List<FichierValide> resultat = new ArrayList<>();

        List<MultipartFile> imagesRecues = images == null ? List.of()
                : images.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (imagesRecues.size() > MAX_IMAGES) {
            throw refus("Maximum " + MAX_IMAGES + " images par non-conformité.");
        }

        for (MultipartFile image : imagesRecues) {
            String mime = image.getContentType();
            if (mime == null || !MIME_IMAGES.contains(mime)) {
                throw refus("Format d'image non autorisé (« " + nomAffichable(image)
                        + " ») : JPEG, PNG ou WebP uniquement.");
            }
            if (image.getSize() > TAILLE_MAX_IMAGE) {
                throw refus("Image trop volumineuse (« " + nomAffichable(image) + " ») : "
                        + (TAILLE_MAX_IMAGE / (1024 * 1024)) + " Mo maximum.");
            }
            if (!signatureCorrespond(mime, lireDebut(image))) {
                throw refus("Le contenu de « " + nomAffichable(image) + " » ne correspond pas à une image valide.");
            }
            resultat.add(new FichierValide(image, TypeFichier.PHOTO, mime, extension(mime)));
        }

        if (pdf != null && !pdf.isEmpty()) {
            if (!MIME_PDF.equals(pdf.getContentType())) {
                throw refus("La pièce jointe documentaire doit être un PDF.");
            }
            if (pdf.getSize() > TAILLE_MAX_PDF) {
                throw refus("PDF trop volumineux : " + (TAILLE_MAX_PDF / (1024 * 1024)) + " Mo maximum.");
            }
            if (!signatureCorrespond(MIME_PDF, lireDebut(pdf))) {
                throw refus("Le contenu du fichier ne correspond pas à un PDF valide.");
            }
            resultat.add(new FichierValide(pdf, TypeFichier.PDF, MIME_PDF, "pdf"));
        }
        return resultat;
    }

    // ------------------------------------------------------------------
    // 2. Enregistrement (dans la transaction de création de la NC)
    // ------------------------------------------------------------------
    public void enregistrer(Long ncId, List<FichierValide> fichiers, Long uploadedBy, LocalDateTime maintenant) {
        for (FichierValide f : fichiers) {
            String cle = "nc/" + ncId + "/" + UUID.randomUUID() + "." + f.extension();
            Path cible = resoudre(cle);
            ecrire(f.fichier(), cible);
            supprimerSiRollback(cible);   // aucun fichier orphelin si la transaction échoue

            NcAttachment pj = new NcAttachment();
            pj.setNcId(ncId);
            pj.setFileUrl(cle);
            pj.setNomOriginal(nomSur(f.fichier().getOriginalFilename()));
            pj.setFileType(f.type().name());
            pj.setMimeType(f.mime());
            pj.setTailleOctets(f.fichier().getSize());
            pj.setUploadedBy(uploadedBy);
            pj.setDateCreation(maintenant);
            attachmentRepository.save(pj);
        }
    }

    /**
     * Enregistre un fichier déjà validé dans un dossier donné et renvoie sa clé relative.
     * Utilisé par les pièces jointes des constats d'audit.
     */
    public String stocker(String dossier, FichierValide f) {
        String cle = dossier + "/" + UUID.randomUUID() + "." + f.extension();
        Path cible = resoudre(cle);
        ecrire(f.fichier(), cible);
        supprimerSiRollback(cible);
        return cle;
    }

    // ------------------------------------------------------------------
    // 3. Lecture
    // ------------------------------------------------------------------
    public Resource lire(NcAttachment pj) {
        return lireParCle(pj.getFileUrl());
    }

    public Resource lireParCle(String cle) {
        Path chemin = resoudre(cle);
        if (!Files.isReadable(chemin)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable sur le stockage");
        }
        return new FileSystemResource(chemin);
    }

    // ------------------------------------------------------------------
    // Outils internes
    // ------------------------------------------------------------------
    private ResponseStatusException refus(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private String extension(String mime) {
        return switch (mime) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "pdf";
        };
    }

    /** Le Content-Type envoyé par le navigateur n'est pas fiable : on vérifie les premiers octets. */
    private boolean signatureCorrespond(String mime, byte[] b) {
        return switch (mime) {
            case "image/jpeg" -> b.length >= 3
                    && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case "image/png" -> b.length >= 4
                    && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
            case "image/webp" -> b.length >= 12
                    && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                    && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
            case "application/pdf" -> b.length >= 4
                    && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F';
            default -> false;
        };
    }

    private byte[] lireDebut(MultipartFile fichier) {
        try (InputStream in = fichier.getInputStream()) {
            return in.readNBytes(12);
        } catch (IOException e) {
            throw new IllegalStateException("Lecture du fichier impossible", e);
        }
    }

    private Path resoudre(String cle) {
        Path chemin = racine.resolve(cle).normalize();
        if (!chemin.startsWith(racine)) {
            throw refus("Chemin de fichier invalide");
        }
        return chemin;
    }

    private void ecrire(MultipartFile fichier, Path cible) {
        try {
            Files.createDirectories(cible.getParent());
            try (InputStream in = fichier.getInputStream()) {
                Files.copy(in, cible);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Échec de l'enregistrement du fichier", e);
        }
    }

    private String nomAffichable(MultipartFile f) {
        return nomSur(f.getOriginalFilename());
    }

    /** Nom d'origine conservé uniquement pour l'affichage (jamais comme chemin). */
    private String nomSur(String nom) {
        if (nom == null || nom.isBlank()) {
            return "fichier";
        }
        String simple;
        try {
            simple = Paths.get(nom).getFileName().toString();
        } catch (RuntimeException e) {
            simple = "fichier";
        }
        return simple.length() > 255 ? simple.substring(0, 255) : simple;
    }

    private void supprimerSiRollback(Path fichier) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    try {
                        Files.deleteIfExists(fichier);
                    } catch (IOException ignored) {
                        // fichier orphelin : à nettoyer par une tâche de maintenance
                    }
                }
            }
        });
    }
}