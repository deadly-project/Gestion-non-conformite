package com.example.controller;

import com.example.dto.nc.PageResponse;
import com.example.dto.notification.NotificationDto;
import com.example.entity.Users;
import com.example.repository.UtilisateurRepository;
import com.example.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** Notifications de l'utilisateur connecté (tous rôles). Chacun ne voit et ne modifie que les siennes. */
@RestController
@RequestMapping("/api/notifications")
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService service;
    private final UtilisateurRepository utilisateurRepository;

    public NotificationController(NotificationService service, UtilisateurRepository utilisateurRepository) {
        this.service = service;
        this.utilisateurRepository = utilisateurRepository;
    }

    @GetMapping
    public PageResponse<NotificationDto> lister(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "20") int taille,
                                                Authentication authentication) {
        return service.lister(utilisateurCourant(authentication).getId(), page, taille);
    }

    @GetMapping("/non-lues/nombre")
    public Map<String, Long> nombreNonLues(Authentication authentication) {
        return Map.of("nombre", service.nombreNonLues(utilisateurCourant(authentication).getId()));
    }

    @PatchMapping("/{id}/lue")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marquerLue(@PathVariable Long id, Authentication authentication) {
        service.marquerLue(id, utilisateurCourant(authentication).getId());
    }

    @PatchMapping("/lues")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void marquerToutesLues(Authentication authentication) {
        service.marquerToutesLues(utilisateurCourant(authentication).getId());
    }

    private Users utilisateurCourant(Authentication authentication) {
        return utilisateurRepository.findByEmailIgnoreCase(authentication.getName())
                .filter(u -> Boolean.TRUE.equals(u.getActif()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Session invalide"));
    }
}