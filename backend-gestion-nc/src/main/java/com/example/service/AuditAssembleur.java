package com.example.service;

import com.example.dto.audit.AuditDtos.*;
import com.example.entity.*;
import com.example.repository.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Construit les objets de réponse à partir des entités (lecture seule, partagé par les deux services). */
@Component
public class AuditAssembleur {

    private final ConstatAuditRepository constatRepository;
    private final CommentaireConstatRepository commentaireRepository;
    private final ConstatPieceJointeRepository pieceJointeRepository;
    private final ActionCapaRepository capaRepository;
    private final NonConformiteRepository ncRepository;
    private final ProcessusRepository processusRepository;
    private final UtilisateurRepository utilisateurRepository;

    public AuditAssembleur(ConstatAuditRepository constatRepository,
                           CommentaireConstatRepository commentaireRepository,
                           ConstatPieceJointeRepository pieceJointeRepository,
                           ActionCapaRepository capaRepository,
                           NonConformiteRepository ncRepository,
                           ProcessusRepository processusRepository,
                           UtilisateurRepository utilisateurRepository) {
        this.constatRepository = constatRepository;
        this.commentaireRepository = commentaireRepository;
        this.pieceJointeRepository = pieceJointeRepository;
        this.capaRepository = capaRepository;
        this.ncRepository = ncRepository;
        this.processusRepository = processusRepository;
        this.utilisateurRepository = utilisateurRepository;
    }

    public PersonneResume personne(Long id) {
        if (id == null) return null;
        return utilisateurRepository.findById(id)
                .map(u -> new PersonneResume(u.getId(), u.getNom(), u.getPrenom(), u.getMatricule()))
                .orElse(null);
    }

    /** Constats (avec leurs commentaires) regroupés par audit. Un audit sans constat est absent de la map. */
    @Transactional(readOnly = true)
    public Map<Long, List<ConstatDto>> constatsParAudit(Collection<Long> auditIds) {
        if (auditIds.isEmpty()) return Map.of();

        List<ConstatAudit> constats = constatRepository.findByAuditIdInOrderByDateConstatAscIdAsc(auditIds);
        List<Long> constatIds = constats.stream().map(ConstatAudit::getId).toList();
        Map<Long, List<CommentaireConstat>> commentaires = constats.isEmpty() ? Map.of()
                : commentaireRepository.findByConstatIdInOrderByDateCommentaireAscIdAsc(constatIds)
                .stream().collect(Collectors.groupingBy(CommentaireConstat::getConstatId));
        Map<Long, List<ConstatPieceJointe>> pieces = constats.isEmpty() ? Map.of()
                : pieceJointeRepository.findByConstatIdInOrderByIdAsc(constatIds)
                .stream().collect(Collectors.groupingBy(ConstatPieceJointe::getConstatId));

        Map<Long, List<ConstatDto>> resultat = new HashMap<>();
        for (ConstatAudit c : constats) {
            List<CommentaireDto> fil = commentaires.getOrDefault(c.getId(), List.of()).stream()
                    .map(k -> new CommentaireDto(k.getId(), personne(k.getAuteurId()), k.getCommentaire(), k.getDateCommentaire()))
                    .toList();
            List<PieceJointeConstatDto> preuves = pieces.getOrDefault(c.getId(), List.of()).stream()
                    .map(p -> new PieceJointeConstatDto(p.getId(), p.getNomOriginal(), p.getFileType(),
                            p.getMimeType(), p.getTailleOctets()))
                    .toList();
            resultat.computeIfAbsent(c.getAuditId(), k -> new ArrayList<>())
                    .add(new ConstatDto(c.getId(), c.getTypeConstat(), c.getDescriptionConstat(),
                            personne(c.getAuteurId()), c.getDateConstat(), fil, preuves));
        }
        return resultat;
    }

    /** Lignes de calendrier : NC, étape (avec son numéro dans le plan) et processus en lots. */
    @Transactional(readOnly = true)
    public List<AuditItem> items(List<Audit> audits) {
        if (audits.isEmpty()) return List.of();

        Set<Long> etapeIds = audits.stream().map(Audit::getActionCapaId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, ActionCapa> etapes = capaRepository.findAllById(etapeIds).stream()
                .collect(Collectors.toMap(ActionCapa::getId, Function.identity()));

        Set<Long> ncIds = etapes.values().stream().map(ActionCapa::getNcId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, NonConformite> ncs = ncRepository.findAllById(ncIds).stream()
                .collect(Collectors.toMap(NonConformite::getId, Function.identity()));

        // numéro d'une étape = sa position dans le plan d'actions de sa NC (ordre de création)
        Map<Long, Integer> numeros = new HashMap<>();
        for (Long ncId : ncIds) {
            List<ActionCapa> plan = capaRepository.findByNcIdOrderByIdAsc(ncId);
            for (int i = 0; i < plan.size(); i++) numeros.put(plan.get(i).getId(), i + 1);
        }

        Map<Long, String> processus = processusRepository
                .findAllById(audits.stream().map(Audit::getProcessusId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Processus::getId, Processus::getLibelle));

        Map<Long, Long> nbConstats = new HashMap<>();
        for (Object[] ligne : constatRepository.compterParAudit(audits.stream().map(Audit::getId).toList())) {
            nbConstats.put((Long) ligne[0], (Long) ligne[1]);
        }

        LocalDate aujourdhui = LocalDate.now();
        List<AuditItem> items = new ArrayList<>();
        for (Audit a : audits) {
            ActionCapa etape = a.getActionCapaId() == null ? null : etapes.get(a.getActionCapaId());
            NonConformite nc = etape == null || etape.getNcId() == null ? null : ncs.get(etape.getNcId());

            items.add(new AuditItem(
                    a.getId(), a.getTitre(), a.getDatePlanifiee(), a.getDateRealisation(),
                    a.getTypeAudit(), a.getStatut(), a.getResultatTraitement(),
                    processus.get(a.getProcessusId()),
                    nc == null ? null : new NcResume(nc.getId(), nc.getReference(), nc.getTitre(), nc.getStatut()),
                    etape == null ? null : new EtapeResume(etape.getId(), numeros.getOrDefault(etape.getId(), 0),
                            etape.getTypeAction(), etape.getDescription(), etape.getDateEcheance(), etape.getStatutAction()),
                    nbConstats.getOrDefault(a.getId(), 0L),
                    "PLANIFIE".equals(a.getStatut()) && a.getDatePlanifiee().isBefore(aujourdhui)));
        }
        return items;
    }
}