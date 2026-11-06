"use strict";

/* =========================================
   1. CONFIGURAÇÃO DA DERIV
   ========================================= */

const DERIV_APP_ID = "34Q5j7BfYIe7fnycAjAkA";

const DERIV_REDIRECT_URI =
    "https://ngola-express.pages.dev/callback";

/* =========================================
   2. RESPOSTA HTML
   ========================================= */

function respostaHTML(mensagem, sucesso = false) {

    const cor = sucesso ? "#16803c" : "#b42318";

    return new Response(`
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width, initial-scale=1.0">
            <title>NGOLA-EXPRES | Deriv</title>
        </head>

        <body style="
            font-family: Arial, sans-serif;
            background: #f3f6fb;
            padding: 30px;
            text-align: center;
        ">

            <h2>NGOLA-EXPRES</h2>

            <p style="color: ${cor};">
                ${mensagem}
            </p>

        </body>
        </html>
    `, {
        status: sucesso ? 200 : 400,
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "no-store"
        }
    });
}

/* =========================================
   3. RECEBER O RETORNO DA DERIV
   ========================================= */

export async function onRequestGet({ request, env }) {

    try {

        if (!env.DERIV_TOKENS) {
            return respostaHTML(
                "O armazenamento seguro não está configurado."
            );
        }

        const url = new URL(request.url);

        // Verificar se a Deriv devolveu algum erro.
        const erro = url.searchParams.get("error");

        if (erro) {
            return respostaHTML(
                "A autorização não foi concluída. Tenta novamente."
            );
        }

        // Receber código e state.
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        if (!code || !state || !/^[a-f0-9]{64}$/i.test(state)) {
            return respostaHTML(
                "Retorno inválido. Inicia novamente a ligação à Deriv."
            );
        }

        /* =========================================
           4. VALIDAR O STATE E RECUPERAR O VERIFIER
           ========================================= */

        const chave = "oauth:" + state;

        const verifier = await env.DERIV_TOKENS.get(chave);

        if (!verifier) {
            return respostaHTML(
                "A sessão de autorização expirou ou é inválida."
            );
        }

        // Impedir a reutilização do mesmo pedido.
        await env.DERIV_TOKENS.delete(chave);

        /* =========================================
           5. TROCAR O CÓDIGO PELO TOKEN
           ========================================= */

        const parametros = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: DERIV_APP_ID,
            code: code,
            code_verifier: verifier,
            redirect_uri: DERIV_REDIRECT_URI
        });

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

        const dados = await resposta.json();

        if (!resposta.ok || !dados.access_token) {
            return respostaHTML(
                "A Deriv não confirmou a autorização. Verifica e tenta novamente."
            );
        }

        /* =========================================
           6. GUARDAR O TOKEN PRIVADAMENTE
           ========================================= */

        const validade = Number(dados.expires_in);

        if (!Number.isFinite(validade) || validade <= 0) {
            return respostaHTML(
                "A Deriv devolveu uma validade de token inválida."
            );
        }

        const contaPrincipal = {
            access_token: dados.access_token,
            token_type: dados.token_type || "Bearer",
            expires_at: Date.now() + validade * 1000
        };

        await env.DERIV_TOKENS.put(
            "conta_principal",
            JSON.stringify(contaPrincipal),
            {
                expirationTtl: Math.max(60, Math.floor(validade))
            }
        );

        /* =========================================
           7. CONFIRMAR A LIGAÇÃO
           ========================================= */

        return respostaHTML(
            "Autorização recebida. A ligação com a Deriv foi concluída.",
            true
        );

    } catch (erro) {

        // Não mostrar tokens, códigos ou detalhes internos.
        return respostaHTML(
            "Ocorreu um erro durante a ligação. Tenta novamente."
        );
    }
}
