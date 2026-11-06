"use strict";

/* =========================================
   1. CONFIGURAÇÃO DA DERIV
   ========================================= */

const DERIV_APP_ID = "34Q5j7BfYIe7fnycAjAkA";

const DERIV_REDIRECT_URI =
    "https://ngola-express.pages.dev/callback";

/* =========================================
   2. GERAR VALORES ALEATÓRIOS
   ========================================= */

function gerarAleatorio(tamanho) {

    const bytes = crypto.getRandomValues(
        new Uint8Array(tamanho)
    );

    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

/* =========================================
   3. CRIAR O DESAFIO PKCE
   ========================================= */

async function gerarPKCE() {

    const alfabeto =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    const bytes = crypto.getRandomValues(
        new Uint8Array(64)
    );

    const verifier = Array.from(bytes)
        .map(byte => alfabeto[byte % alfabeto.length])
        .join("");

    const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
    );

    const challenge = btoa(
        String.fromCharCode(...new Uint8Array(hash))
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    return { verifier, challenge };
}

/* =========================================
   4. INICIAR AUTORIZAÇÃO
   ========================================= */

export async function onRequestGet({ env }) {

    if (!env.DERIV_TOKENS) {
        return new Response(
            "Armazenamento Deriv não configurado.",
            { status: 500 }
        );
    }

    const state = gerarAleatorio(32);

    const { verifier, challenge } =
        await gerarPKCE();

    // Guardar os valores privados durante 10 minutos.
    await env.DERIV_TOKENS.put(
        "oauth:" + state,
        verifier,
        { expirationTtl: 600 }
    );

    // Preparar os parâmetros OAuth.
    const parametros = new URLSearchParams({
        response_type: "code",
        client_id: DERIV_APP_ID,
        redirect_uri: DERIV_REDIRECT_URI,
        scope: "payment",
        state: state,
        code_challenge: challenge,
        code_challenge_method: "S256"
    });

    // Redirecionar para a autorização oficial.
    return Response.redirect(
        "https://auth.deriv.com/oauth2/auth?" +
        parametros.toString(),
        302
    );
}
