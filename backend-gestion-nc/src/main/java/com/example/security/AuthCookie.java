
package com.example.security;

import org.springframework.http.ResponseCookie;

public final class AuthCookie {

    public static final String TOKEN_COOKIE = "SMQ_TOKEN";

    private AuthCookie() {}

    public static ResponseCookie creer(String token, long expirationMs) {
        return ResponseCookie.from(TOKEN_COOKIE, token)
                .httpOnly(true)
                .secure(false) // Développement local HTTP uniquement.
                .sameSite("Lax")
                .path("/")
                .maxAge(expirationMs / 1000)
                .build();
    }

    public static ResponseCookie supprimer() {
        return ResponseCookie.from(TOKEN_COOKIE, "")
                .httpOnly(true)
                .secure(false) // Passer à true en HTTPS.
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
    }
}
