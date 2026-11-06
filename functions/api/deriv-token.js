"use strict";

/* =========================================
   1. CONFIGURAÇÃO DA DERIV
   ========================================= */

const DERIV_APP_ID = "34Q5j7BfYIe7fnycAjAkA";

const DERIV_REDIRECT_URI =
    "https://ngola-express.pages.dev/callback";

/* =========================================
   2. RECEBER O CÓDIGO OAUTH
   ========================================= */

export async function onRequestPost({ request, env }) {

    try {

        // Ler os dados enviados pelo callback.
        const dados = await request.json();

        const code = dados.code;
        const codeVerifier = dados.codeVerifier;

        // Validar os dados recebidos.
        if (!code || !codeVerifier) {
            return Response.json(
                { error: "Dados de autorização incompletos." },
                { status: 400 }
            );
        }

        // Confirmar se o armazenamento está ligado.
        if (!env.DERIV_TOKENS) {
            return Response.json(
                { error: "Armazenamento não configurado." },
                { status: 500 }
            );
        }

        /* =====================================
           3. TROCAR O CÓDIGO POR TOKEN
           ===================================== */

        const parametros = new URLSearchParams();

        parametros.set("grant_type", "authorization_code");
        parametros.set("client_id", DERIV_APP_ID);
        parametros.set("code", code);
        parametros.set("code_verifier", codeVerifier);
        parametros.set("redirect_uri", DERIV_REDIRECT_URI);

        const resposta = await fetch(
            "https://auth.deriv.com/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },
                body: parametros.toString()
            }
        );

        const resultado = await resposta.json();

        if (!resposta.ok || !resultado.access_token) {
            return Response.json(
                {
                    error: "A Deriv não autorizou a troca do código."
                },
                { status: 400 }
            );
        }

        /* =====================================
           4. GUARDAR TOKEN NO KV PRIVADO
           ===================================== */

        const validade = Number(resultado.expires_in);

        if (!Number.isFinite(validade) || validade <= 0) {
            return Response.json(
                { error: "Validade do token inválida." },
                { status: 500 }
            );
        }

        await env.DERIV_TOKENS.put(
            "conta_principal",
            JSON.stringify({
                access_token: resultado.access_token,
                expires_at: Date.now() + validade * 1000
            }),
            {
                expirationTtl: validade
            }
        );

        /* =====================================
           5. CONFIRMAR SEM EXPOR O TOKEN
           ===================================== */

        return Response.json({
            success: true,
            message: "Conta Deriv autorizada."
        });

    } catch (erro) {

        console.error("Erro na autorização Deriv:", erro);

        return Response.json(
            { error: "Erro interno na autorização." },
            { status: 500 }
        );
    }
              }
