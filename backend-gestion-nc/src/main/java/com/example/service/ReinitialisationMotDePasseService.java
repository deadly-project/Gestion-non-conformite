package com.example.service;

import com.example.dto.reinitialisation.DemandeReinitialisationResponse;
import com.example.entity.DemandeReinitialisation;
import com.example.entity.enums.StatutDemande;
import com.example.entity.Users;
import com.example.event.DemandeReinitialisationRecueEvent;
import com.example.event.DemandeReinitialisationTraiteeEvent;
import com.example.repository.DemandeReinitialisationRepository;
import com.example.repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Mot de passe oublié :
 *   1. l'utilisateur demande avec son matricule (endpoint public) ;
 *   2. l'administrateur est notifié en temps réel (WebSocket) et l'utilisateur reçoit un accusé par email ;
 *   3. l'administrateur valide (mot de passe aléatoire envoyé par email) ou refuse.
 */
@Service
public class ReinitialisationMotDePasseService {

    private static final Logger log = LoggerFactory.getLogger(ReinitialisationMotDePasseService.class);

    /**
     * Alphabet du mot de passe généré, sans caractères ambigus (0/O, 1/l/I).
     * 8 caractères parmi 56 : environ 9,6 x 10^13 combinaisons, contre 10^8 pour 8 chiffres seuls.
     * Pour n'avoir QUE des chiffres, remplacer par "0123456789" (beaucoup plus faible).
     */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final int LONGUEUR_MOT_DE_PASSE = 8;

    private final SecureRandom random = new SecureRandom();

    private final UtilisateurRepository utilisateurRepository;
    private final DemandeReinitialisationRepository demandeRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationEmailService emailService;
    private final ApplicationEventPublisher eventPublisher;
    private final JournalActionsService journal;

    public ReinitialisationMotDePasseService(
            UtilisateurRepository utilisateurRepository,
            DemandeReinitialisationRepository demandeRepository,
            PasswordEncoder passwordEncoder,
            NotificationEmailService emailService,
            ApplicationEventPublisher eventPublisher,
            JournalActionsService journal) {
        this.utilisateurRepository = utilisateurRepository;
        this.demandeRepository = demandeRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.eventPublisher = eventPublisher;
        this.journal = journal;
    }

    // ------------------------------------------------------------------
    // 1. Demande (publique) : ne révèle jamais si le matricule existe
    // ------------------------------------------------------------------
    @Transactional
    public void demander(Integer matricule) {
        if (matricule == null) {
            log.warn("Demande de réinitialisation ignorée : matricule absent.");
            return;
        }

        Optional<Users> trouve = utilisateurRepository.findByMatricule(matricule)
                .filter(u -> Boolean.TRUE.equals(u.getActif()));
        if (trouve.isEmpty()) {
            log.info("Demande de réinitialisation ignorée : matricule inconnu ou compte désactivé.");
            return;
        }

        Users utilisateur = trouve.get();
        if (demandeRepository.existsByUtilisateurIdAndStatut(utilisateur.getId(), StatutDemande.EN_ATTENTE)) {
            log.info("Demande de réinitialisation ignorée : une demande est déjà en attente pour {}.", utilisateur.getMatricule());
            return;
        }

        DemandeReinitialisation demande = new DemandeReinitialisation();
        demande.setUtilisateur(utilisateur);
        demande = demandeRepository.save(demande);

        journal.enregistrer(utilisateur.getId(), "REQUEST_RESET_PASSWORD", "REINITIALISATION", demande.getId(),
                java.util.Map.of("matricule", utilisateur.getMatricule()));

        // Notification admin (WebSocket) + accusé de réception : après le commit, en asynchrone
        eventPublisher.publishEvent(new DemandeReinitialisationRecueEvent(
                DemandeReinitialisationResponse.from(demande),
                utilisateur.getEmail(), utilisateur.getPrenom(), utilisateur.getNom()));
    }

    // ------------------------------------------------------------------
    // 2. Consultation (administrateur)
    // ------------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<DemandeReinitialisationResponse> lister(StatutDemande statut) {
        return demandeRepository.findByStatutOrderByDateDemandeAsc(statut)
                .stream()
                .map(DemandeReinitialisationResponse::from)
                .toList();
    }

    // ------------------------------------------------------------------
    // 3. Validation : nouveau mot de passe aléatoire envoyé par email
    // ------------------------------------------------------------------
    @Transactional
    public DemandeReinitialisationResponse valider(Long demandeId, Authentication administrateur) {
        DemandeReinitialisation demande = chargerEnAttente(demandeId);
        Users utilisateur = demande.getUtilisateur();

        if (!Boolean.TRUE.equals(utilisateur.getActif())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le compte de cet utilisateur est désactivé");
        }

        String nouveauMotDePasse = genererMotDePasse();
        utilisateur.setMotDePasse(passwordEncoder.encode(nouveauMotDePasse));
        utilisateurRepository.save(utilisateur);

        demande.setStatut(StatutDemande.VALIDEE);
        demande.setDateTraitement(LocalDateTime.now());
        demande.setTraitePar(resoudreActeur(administrateur));
        demandeRepository.save(demande);

        // L'email part AVANT le commit : s'il échoue, tout est annulé (le mot de passe
        // n'est pas modifié) et l'administrateur est prévenu. Sinon l'utilisateur serait
        // bloqué avec un mot de passe qu'il n'a jamais reçu.
        try {
            emailService.envoyerMotDePasseReinitialise(
                    utilisateur.getEmail(), utilisateur.getPrenom(), utilisateur.getNom(),
                    utilisateur.getMatricule(), nouveauMotDePasse);
        } catch (Exception e) {
            log.error("Validation annulée pour {} : envoi de l'email impossible.", utilisateur.getMatricule(), e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Échec de l'envoi de l'email (serveur SMTP injoignable ou refus). "
                            + "Le mot de passe n'a PAS été modifié : réessayez plus tard.");
        }

        Users admin = resoudreActeur(administrateur);
        journal.enregistrer(admin == null ? null : admin.getId(), "VALIDATE_RESET_PASSWORD", "REINITIALISATION",
                demande.getId(), java.util.Map.of("matricule", utilisateur.getMatricule()));

        DemandeReinitialisationResponse reponse = DemandeReinitialisationResponse.from(demande);
        eventPublisher.publishEvent(new DemandeReinitialisationTraiteeEvent(
                reponse, utilisateur.getEmail(), utilisateur.getPrenom(), utilisateur.getNom()));
        return reponse;
    }

    // ------------------------------------------------------------------
    // 4. Refus
    // ------------------------------------------------------------------
    @Transactional
    public DemandeReinitialisationResponse refuser(Long demandeId, Authentication administrateur) {
        DemandeReinitialisation demande = chargerEnAttente(demandeId);
        Users utilisateur = demande.getUtilisateur();

        demande.setStatut(StatutDemande.REFUSEE);
        demande.setDateTraitement(LocalDateTime.now());
        demande.setTraitePar(resoudreActeur(administrateur));
        demandeRepository.save(demande);

        Users adminRefus = resoudreActeur(administrateur);
        journal.enregistrer(adminRefus == null ? null : adminRefus.getId(), "REFUSE_RESET_PASSWORD",
                "REINITIALISATION", demande.getId(), java.util.Map.of("matricule", utilisateur.getMatricule()));

        DemandeReinitialisationResponse reponse = DemandeReinitialisationResponse.from(demande);
        eventPublisher.publishEvent(new DemandeReinitialisationTraiteeEvent(
                reponse, utilisateur.getEmail(), utilisateur.getPrenom(), utilisateur.getNom()));
        return reponse;
    }

    // ------------------------------------------------------------------
    // Outils internes
    // ------------------------------------------------------------------
    private DemandeReinitialisation chargerEnAttente(Long demandeId) {
        DemandeReinitialisation demande = demandeRepository.findByIdForUpdate(demandeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Demande introuvable"));
        if (demande.getStatut() != StatutDemande.EN_ATTENTE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cette demande a déjà été traitée (" + demande.getStatut() + ")");
        }
        return demande;
    }

    private String genererMotDePasse() {
        StringBuilder sb = new StringBuilder(LONGUEUR_MOT_DE_PASSE);
        for (int i = 0; i < LONGUEUR_MOT_DE_PASSE; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    /**
     * Retrouve l'administrateur connecté à partir de authentication.getName().
     * Selon votre JwtAuthenticationFilter, ce nom est l'id (Long), le matricule ou l'email :
     * les trois cas sont gérés. Si rien ne correspond, « traite_par » reste vide.
     */
    private Users resoudreActeur(Authentication authentification) {
        if (authentification == null || authentification.getName() == null) {
            return null;
        }
        String nom = authentification.getName();
        try {
            Optional<Users> parId = utilisateurRepository.findById(Long.parseLong(nom));
            if (parId.isPresent()) {
                return parId.get();
            }
        } catch (NumberFormatException ignore) {
            // le nom n'est pas un identifiant numérique
        }
        try {
            Optional<Users> parMatricule = utilisateurRepository.findByMatricule(Integer.parseInt(nom));
            if (parMatricule.isPresent()) {
                return parMatricule.get();
            }
        } catch (NumberFormatException ignore) {
            // le nom n'est pas un matricule numérique
        }
        return utilisateurRepository.findByEmailIgnoreCase(nom)
                .orElse(null);
    }
}
