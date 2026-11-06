"use strict";

/* =========================================
   1. ROTA DE RETORNO DA DERIV
   ========================================= */

export async function onRequestGet() {

    // Página provisória de receção do OAuth.
    const html = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1.0">
        <title>NGOLA-EXPRES | Deriv</title>
    </head>

    <body>
        <h2>NGOLA-EXPRES</h2>
        <p>Endereço de retorno da Deriv preparado.</p>
        <p>Aguarde a configuração de segurança.</p>
    </body>
    </html>
    `;

    return new Response(html, {
        headers: {
            "Content-Type": "text/html; charset=UTF-8"
        }
    });
}
