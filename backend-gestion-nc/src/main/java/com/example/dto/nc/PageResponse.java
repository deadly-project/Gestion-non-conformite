package com.example.dto.nc;

import java.util.List;

public record PageResponse<T>(List<T> contenu, int page, int taille, long total, int totalPages) {}
