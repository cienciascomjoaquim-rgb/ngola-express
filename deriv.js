"use strict";

/* =========================================
   1. ENDEREÇO DO SERVIDOR NGOLA-EXPRES
   ========================================= */

const DERIV_AUTH_URL =
    "https://ngola-express.pages.dev/api/deriv-auth-start";

/* =========================================
   2. INICIAR LIGAÇÃO À CONTA DERIV
   ========================================= */

export function conectarDeriv() {

    try {

        // O servidor gera e valida o PKCE e o state.
        // O navegador não recebe nem guarda o token.

        window.location.href = DERIV_AUTH_URL;

    } catch (erro) {

        console.error(
            "Erro ao iniciar ligação Deriv:",
            erro
        );

        alert(
            "Não foi possível iniciar a ligação à Deriv."
        );
    }
}
