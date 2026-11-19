package com.example.domain;

/** Statuts d'une NC. L'ordre est conservé pour l'affichage ; les transitions sont pilotées par les actions métier. */
public enum StatutNc {
    EN_ATTENTE(0), OUVERT(1), EN_COURS_D_ANALYSE(2), EN_TRAITEMENT(3), CLOTUREE(4);

    private final int ordre;

    StatutNc(int ordre) {
        this.ordre = ordre;
    }

    public int getOrdre() {
        return ordre;
    }
}