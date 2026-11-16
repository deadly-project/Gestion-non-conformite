package com.example.service;

import com.example.domain.TypeFichier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;

/**
 * Contrôle des fichiers de la gestion documentaire : PDF et formats bureautiques courants.
 * Le type MIME envoyé par le navigateur n'est jamais cru : il est déduit de l'extension, et
 * les premiers octets du fichier doivent correspondre à ce format.
 */
@Component
public class DocumentFichierValidateur {

    public static final long TAILLE_MAX = 20L * 1024 * 1024;   // 20 Mo

    private record Format(String mime, String signature) {}

    private static final String ZIP = "ZIP", OLE = "OLE", PDF = "PDF", PNG = "PNG", JPG = "JPG", TEXTE = "TEXTE";

    private static final Map<String, Format> FORMATS = Map.ofEntries(
            Map.entry("doc", new Format("application/msword", OLE)),
            Map.entry("docx", new Format("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ZIP)),
            Map.entry("pdf", new Format("application/pdf", PDF)),
            Map.entry("xls", new Format("application/vnd.ms-excel", OLE)),
            Map.entry("xlsx", new Format("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ZIP)),
            Map.entry("ppt", new Format("application/vnd.ms-powerpoint", OLE)),
            Map.entry("pptx", new Format("application/vnd.openxmlformats-officedocument.presentationml.presentation", ZIP)),
            Map.entry("odt", new Format("application/vnd.oasis.opendocument.text", ZIP)),
            Map.entry("ods", new Format("application/vnd.oasis.opendocument.spreadsheet", ZIP)),
            Map.entry("txt", new Format("text/plain", TEXTE)),
            Map.entry("csv", new Format("text/csv", TEXTE)),
            Map.entry("png", new Format("image/png", PNG)),
            Map.entry("jpg", new Format("image/jpeg", JPG)),
            Map.entry("jpeg", new Format("image/jpeg", JPG)));

    public static final String FORMATS_ACCEPTES = "PDF, Word, Excel, PowerPoint, OpenDocument, TXT, CSV, PNG, JPEG";

    public PieceJointeService.FichierValide valider(MultipartFile fichier) {
        if (fichier == null || fichier.isEmpty()) {
            throw refus("Le fichier du document est obligatoire.");
        }
        if (fichier.getSize() > TAILLE_MAX) {
            throw refus("Fichier trop volumineux : " + (TAILLE_MAX / (1024 * 1024)) + " Mo maximum.");
        }
        String extension = extension(fichier.getOriginalFilename());
        Format format = FORMATS.get(extension);
        if (format == null) {
            throw refus("Format non accepté. Formats autorisés : " + FORMATS_ACCEPTES + ".");
        }
        if (!signatureCorrespond(format.signature(), debut(fichier))) {
            throw refus("Le contenu du fichier ne correspond pas au format « ." + extension + " ».");
        }
        return new PieceJointeService.FichierValide(fichier, TypeFichier.DOCUMENT, format.mime(),
                "jpeg".equals(extension) ? "jpg" : extension);
    }

    /** Nom d'origine conservé uniquement pour l'affichage (jamais comme chemin). */
    public String nomAffichable(String nom) {
        if (nom == null || nom.isBlank()) return "document";
        String simple;
        try {
            simple = Paths.get(nom).getFileName().toString();
        } catch (RuntimeException e) {
            simple = "document";
        }
        return simple.length() > 255 ? simple.substring(0, 255) : simple;
    }

    private String extension(String nom) {
        if (nom == null) return "";
        int point = nom.lastIndexOf('.');
        return point < 0 ? "" : nom.substring(point + 1).toLowerCase(Locale.ROOT).trim();
    }

    private boolean signatureCorrespond(String signature, byte[] b) {
        return switch (signature) {
            case PDF -> b.length >= 4 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F';
            case ZIP -> b.length >= 4 && b[0] == 'P' && b[1] == 'K' && b[2] == 3 && b[3] == 4;
            case OLE -> b.length >= 8 && (b[0] & 0xFF) == 0xD0 && (b[1] & 0xFF) == 0xCF
                    && (b[2] & 0xFF) == 0x11 && (b[3] & 0xFF) == 0xE0;
            case PNG -> b.length >= 4 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
            case JPG -> b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case TEXTE -> {
                for (byte octet : b) if (octet == 0) yield false;   // un fichier texte ne contient pas d'octet nul
                yield true;
            }
            default -> false;
        };
    }

    private byte[] debut(MultipartFile fichier) {
        try (InputStream in = fichier.getInputStream()) {
            return in.readNBytes(1024);
        } catch (IOException e) {
            throw new IllegalStateException("Lecture du fichier impossible", e);
        }
    }

    private ResponseStatusException refus(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}