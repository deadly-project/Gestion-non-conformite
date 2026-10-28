package com.example.domain;

/** Statuts d'une NC. L'ordre sert à interdire les retours en arrière lors du traitement. */
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