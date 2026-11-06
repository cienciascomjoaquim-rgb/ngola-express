"use strict";

/* =========================================
   1. CONFIGURAÇÃO OAUTH DA DERIV
   ========================================= */

const DERIV_APP_ID = "34Q5j7BfYIe7fnycAjAkA";

const DERIV_REDIRECT_URI =
    "https://ngolaexpress.com/callback";

/* =========================================
   2. GERAR VALORES PKCE E STATE
   ========================================= */

async function gerarPKCE() {

    // Gerar código secreto aleatório.
    const bytes = crypto.getRandomValues(
        new Uint8Array(32)
    );

    const codeVerifier = btoa(
        String.fromCharCode(...bytes)
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

    // Criar desafio SHA-256.
    const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(codeVerifier)
    );

    const codeChallenge = btoa(
        String.fromCharCode(
            ...new Uint8Array(hash)
        )
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

    // Gerar proteção contra falsificação.
    const stateBytes = crypto.getRandomValues(
        new Uint8Array(16)
    );

    const state = Array.from(stateBytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");

    return {
        codeVerifier,
        codeChallenge,
        state
    };
}

/* =========================================
   3. LIGAR À DERIV
   ========================================= */

export async function conectarDeriv() {

    try {

        const {
            codeVerifier,
            codeChallenge,
            state
        } = await gerarPKCE();

        // Guardar os valores antes do redirecionamento.
        sessionStorage.setItem(
            "pkce_code_verifier",
            codeVerifier
        );

        sessionStorage.setItem(
            "oauth_state",
            state
        );

        // Criar endereço de autorização.
        const parametros = new URLSearchParams({
            response_type: "code",
            client_id: DERIV_APP_ID,
            redirect_uri: DERIV_REDIRECT_URI,
            scope: "payment",
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256"
        });

        // Enviar o utilizador para a Deriv.
        window.location.href =
            "https://auth.deriv.com/oauth2/auth?" +
            parametros.toString();

    } catch (erro) {

        console.error(
            "Erro ao ligar à Deriv:",
            erro
        );

        alert(
            "Não foi possível iniciar a ligação à Deriv."
        );
    }
}