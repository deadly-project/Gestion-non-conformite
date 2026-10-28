package com.example.service;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Transient;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.time.temporal.TemporalAccessor;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Photographie de TOUS les champs persistés d'une entité (id, nom, prénom, statut, dates...),
 * pour le journal des actions : on en prend une avant la modification et une après, et la page
 * d'historique compare les deux champ par champ.
 *
 * Les champs sont lus par réflexion sur les annotations JPA : un champ ajouté plus tard à une
 * entité apparaît automatiquement dans l'historique, sans toucher aux services.
 * Les données sensibles ne sont JAMAIS copiées (voir MASQUES).
 */
public final class Instantane {

    /** Champs exclus de l'historique, quelle que soit l'entité. */
    private static final Set<String> MASQUES = Set.of("motDePasse");

    private Instantane() {}

    /** À appeler AVANT de modifier l'entité (les entités JPA sont modifiées sur place). */
    public static Map<String, Object> de(Object entite) {
        if (entite == null) return null;

        Map<String, Object> champs = new LinkedHashMap<>();
        for (Field champ : entite.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(champ.getModifiers()) || champ.isAnnotationPresent(Transient.class)) continue;
            if (MASQUES.contains(champ.getName())) continue;

            boolean persiste = champ.isAnnotationPresent(Id.class)
                    || champ.isAnnotationPresent(Column.class)
                    || champ.isAnnotationPresent(JoinColumn.class);
            if (!persiste) continue;

            try {
                champ.setAccessible(true);
                Object valeur = champ.get(entite);
                if (champ.isAnnotationPresent(JoinColumn.class)) {
                    // Relation : on ne garde que l'identifiant de l'objet lié
                    champs.put(champ.getName() + "Id", identifiant(valeur));
                } else {
                    champs.put(champ.getName(), simplifier(valeur));
                }
            } catch (IllegalAccessException | RuntimeException e) {
                champs.put(champ.getName(), null);
            }
        }
        return champs;
    }

    private static Object simplifier(Object valeur) {
        if (valeur == null) return null;
        if (valeur instanceof Number || valeur instanceof Boolean || valeur instanceof String) return valeur;
        if (valeur instanceof Enum<?> e) return e.name();
        if (valeur instanceof TemporalAccessor) return valeur.toString();   // dates en texte ISO
        return valeur.toString();
    }

    private static Object identifiant(Object lie) {
        if (lie == null) return null;
        try {
            Method lecture = lie.getClass().getMethod("getId");
            return lecture.invoke(lie);
        } catch (ReflectiveOperationException | RuntimeException e) {
            return null;
        }
    }
}
