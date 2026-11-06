"use strict";

/* ========================================= 
   1. IMPORTAR O FIREBASE 
   ========================================= */ 
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  signOut, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  collection, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  runTransaction, 
  addDoc, 
  query, 
  orderBy, 
  limit 
} from "./firebase.js";

/* =========================================
   2. ELEMENTOS DO FORMULÁRIO
   ========================================= */

const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminKeyword = document.getElementById("adminKeyword");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminLoginMessage = document.getElementById("adminLoginMessage");

/* =========================================
   3. MOSTRAR MENSAGENS
   ========================================= */

function mostrarMensagem(texto, tipo = "erro") {
    adminLoginMessage.textContent = texto;
    adminLoginMessage.className = tipo;
}

/* =========================================
   4. IMPEDIR O ENVIO DUPLICADO
   ========================================= */

function bloquearFormulario(bloquear) {
    adminLoginButton.disabled = bloquear;

    adminLoginButton.textContent = bloquear
        ? "A VERIFICAR..."
        : "ENTRAR NO PAINEL";
}

/* =========================================
   5. LOGIN DO ADMINISTRADOR
   ========================================= */

adminLoginForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const email = adminEmail.value.trim().toLowerCase();
    const password = adminPassword.value;
    const keyword = adminKeyword.value.trim();

    if (!email || !password || !keyword) {
        mostrarMensagem("Preenche todos os campos.");
        return;
    }

    if (keyword !== "Antónia") {
        mostrarMensagem("Palavra-chave incorreta.");
        return;
    }

    bloquearFormulario(true);
    mostrarMensagem("A verificar os dados...", "info");

    try {
        /* Autenticar a conta no Firebase */
        const credenciais = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const utilizador = credenciais.user;

        /*
         * IMPORTANTE:
         * O perfil tem de estar autorizado como administrador
         * através de uma configuração segura no Firebase.
         *
         * Não atribuímos privilégios automaticamente.
         */

        const referenciaPerfil = doc(db, "users", utilizador.uid);
        const documentoPerfil = await getDoc(referenciaPerfil);

        if (!documentoPerfil.exists()) {
            await signOut(auth);

            mostrarMensagem(
                "A conta não tem um perfil administrativo autorizado."
            );
            return;
        }

        const perfil = documentoPerfil.data();

        /*
         * Só permitir entrada se o perfil tiver role = "admin".
         * Este campo deve ser atribuído pelo proprietário através
         * de uma configuração administrativa segura.
         */

        if (perfil.role !== "admin") {
            await signOut(auth);

            mostrarMensagem(
                "Acesso recusado. Esta conta não está autorizada como administrador."
            );
            return;
        }

        mostrarMensagem("Acesso confirmado. A abrir o painel...", "sucesso");

// Esconder o formulário de login.
document.getElementById("adminLoginView").hidden = true;

// Mostrar o dashboard.
document.getElementById("adminDashboard").hidden = false;

carregarSaldoAdmin();
carregarListaAgentes();
inicializarSaldosAgentes();
iniciarObservacaoPedidosAgentesUSD();
        /*
         * O painel administrativo será ligado na próxima etapa.
         * Ainda não executar operações financeiras aqui.
         */

    } catch (erro) {
        console.error("Erro de autenticação:", erro.code);

        if (
            erro.code === "auth/invalid-credential" ||
            erro.code === "auth/wrong-password" ||
            erro.code === "auth/user-not-found"
        ) {
            mostrarMensagem("E-mail ou palavra-passe incorretos.");
        } else if (erro.code === "auth/too-many-requests") {
            mostrarMensagem(
                "Demasiadas tentativas. Aguarda um pouco e tenta novamente."
            );
        } else {
            mostrarMensagem(
                "Não foi possível validar o acesso. Verifica a ligação e tenta novamente."
            );
        }
    } finally {
        bloquearFormulario(false);
    }
});

/* =========================================
   6. LIGAR O SALDO DO GERENTE AO FIREBASE
   ========================================= */

// Elementos do saldo
const adminBalanceDisplay = document.getElementById("adminBalanceDisplay");
const adminBalanceInput = document.getElementById("adminBalanceInput");
const saveAdminBalanceButton = document.getElementById("saveAdminBalanceButton");
const balanceMessage = document.getElementById("balanceMessage");

// Documento onde ficará guardado o saldo
const referenciaSaldo = doc(db, "settings", "adminBalance");

// Formatar o saldo em USD
function formatarSaldo(valor) {
    return Number(valor).toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + " USD";
}

// Mostrar mensagens do saldo
function mostrarMensagemSaldo(texto, tipo = "info") {
    balanceMessage.textContent = texto;
    balanceMessage.className = tipo;
}

// Carregar o saldo guardado no Firebase
async function carregarSaldoAdmin() {
    try {
        const documentoSaldo = await getDoc(referenciaSaldo);

        if (documentoSaldo.exists()) {
            const dados = documentoSaldo.data();
            const saldo = Number(dados.saldo);

            if (Number.isFinite(saldo) && saldo >= 0) {
                adminBalanceDisplay.textContent = formatarSaldo(saldo);
                adminBalanceInput.value = saldo.toFixed(2);
                mostrarMensagemSaldo("Saldo carregado pelo sistema.", "sucesso");
            } else {
                mostrarMensagemSaldo("O saldo guardado não é válido.", "erro");
            }
        } else {
            adminBalanceDisplay.textContent = formatarSaldo(0);
            adminBalanceInput.value = "0.00";
            mostrarMensagemSaldo(
                "Ainda não existe saldo guardado. Introduz um valor e selecciona Actualizar.",
                "info"
            );
        }
    } catch (erro) {
        console.error("Erro ao carregar saldo:", erro);
        mostrarMensagemSaldo(
            "Não foi possível carregar o saldo. Verifica as regras do Firestore.",
            "erro"
        );
    }
}

// Guardar o novo saldo no Firebase
saveAdminBalanceButton.addEventListener("click", async () => {
    const valor = Number(adminBalanceInput.value);

    if (
        adminBalanceInput.value.trim() === "" ||
        !Number.isFinite(valor) ||
        valor < 0
    ) {
        mostrarMensagemSaldo("Introduz um saldo válido, igual ou superior a zero.", "erro");
        return;
    }

    saveAdminBalanceButton.disabled = true;
    mostrarMensagemSaldo("A guardar o saldo...", "info");

    try {
        await setDoc(referenciaSaldo, {
            saldo: Number(valor.toFixed(2)),
            moeda: "USD",
            atualizadoEm: serverTimestamp()
        });

        adminBalanceDisplay.textContent = formatarSaldo(valor);
        adminBalanceInput.value = valor.toFixed(2);

        mostrarMensagemSaldo("Saldo actualizado e guardado no sistema.", "sucesso");
    } catch (erro) {
    console.error("Erro ao guardar saldo:", erro);

    mostrarMensagemSaldo(
        "Erro: " + (erro.code || "desconhecido") +
        " — " + (erro.message || "Sem detalhes."),
        "erro"
    );
}finally {
        saveAdminBalanceButton.disabled = false;
    }
});


/* =========================================
   GESTÃO DE AGENTES — NGOLA-EXPRES
   Consulta, pesquisa e estado das contas
   ========================================= */

const agentsList = document.getElementById("agentsList");
const agentSearch = document.getElementById("agentSearch");

let listaAgentes = [];

/* Evita inserir HTML recebido do Firestore diretamente */
function escaparTextoAgente(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caracter]);
}

/* Apresentar agentes e respetivos botões */
function mostrarListaAgentes(filtro = "") {
    if (!agentsList) return;

    const pesquisa = filtro.trim().toLowerCase();

    const resultados = listaAgentes.filter(agente => {
        const texto = [
            agente.fullName,
            agente.email,
            agente.phone,
            agente.status
        ].join(" ").toLowerCase();

        return texto.includes(pesquisa);
    });

    if (resultados.length === 0) {
        agentsList.innerHTML = "<p>Nenhum agente encontrado.</p>";
        return;
    }

    agentsList.innerHTML = resultados.map(agente => {
        const estado = String(agente.status || "inactive").toLowerCase();

        return `
    <!-- CARTÃO AZUL-ESCURO DO AGENTE -->
    <article class="agent-item">

        <h3>${escaparTextoAgente(agente.fullName || "Sem nome")}</h3>

        <p>
            <strong>E-mail:</strong>
            ${escaparTextoAgente(agente.email || "Não indicado")}
        </p>

        <p>
            <strong>Telefone:</strong>
            ${escaparTextoAgente(agente.phone || "Não indicado")}
        </p>

        <p>
            <strong>Estado:</strong>
            ${escaparTextoAgente(estado)}
        </p>

        <div class="agent-balance">
            <span>Saldo atual</span>
            <strong>
                ${Number(agente.saldoUSD || 0).toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })} USD
            </strong>
        </div>

        <!-- BOTÕES DE GESTÃO -->
        <div class="agent-actions">

            <button type="button"
                class="agent-btn-activate"
                data-agent-action="active"
                data-agent-uid="${escaparTextoAgente(agente.uid)}">
                Ativar
            </button>

            <button type="button"
                class="agent-btn-deactivate"
                data-agent-action="inactive"
                data-agent-uid="${escaparTextoAgente(agente.uid)}">
                Desativar
            </button>

            <button type="button"
                class="agent-btn-block"
                data-agent-action="blocked"
                data-agent-uid="${escaparTextoAgente(agente.uid)}">
                Bloquear
            </button>

        </div>
    </article>
`;
    }).join("");
}

/* =========================================
   CARREGAR AGENTES EM TEMPO REAL
   NGOLA-EXPRES — GERENTE ADM
   ========================================= */

let cancelarObservacaoAgentes = null;

function carregarListaAgentes() {
    if (!agentsList) return;

    agentsList.innerHTML = "<p>A carregar agentes...</p>";

    // Evita criar observações duplicadas
    if (cancelarObservacaoAgentes) {
        cancelarObservacaoAgentes();
        cancelarObservacaoAgentes = null;
    }

    try {
        const referencia = collection(db, "users");

        // Escuta alterações no Firestore em tempo real
        cancelarObservacaoAgentes = onSnapshot(
            referencia,
            (resultado) => {
                listaAgentes = resultado.docs
                    .map(documento => ({
                        uid: documento.id,
                        ...documento.data()
                    }))
                    .filter(utilizador => utilizador.role === "agente");

                mostrarListaAgentes(agentSearch?.value || "");
            },
            (erro) => {
                console.error("Erro ao observar agentes:", erro);

                agentsList.innerHTML =
                    "<p>Não foi possível atualizar os agentes. Verifica as regras do Firestore.</p>";
            }
        );

    } catch (erro) {
        console.error("Erro ao carregar agentes:", erro);

        agentsList.innerHTML =
            "<p>Não foi possível carregar os agentes.</p>";
    }
}

/* Pesquisar agentes */
if (agentSearch) {
    agentSearch.addEventListener("input", () => {
        mostrarListaAgentes(agentSearch.value);
    });
}

/*
 ATENÇÃO:
 Os botões são apresentados, mas ainda não alteram o estado.
 A alteração real será ligada ao Firebase no próximo passo,
 com validação das permissões do administrador.
 */
 
 /* =========================================
   INICIALIZAR SALDO DOS AGENTES
   ========================================= */

async function inicializarSaldosAgentes() {
    try {
        const referencia = collection(db, "users");
        const resultado = await getDocs(referencia);

        for (const documento of resultado.docs) {
            const agente = documento.data();

            if (
                agente.role === "agente" &&
                typeof agente.saldoUSD !== "number"
            ) {
                await updateDoc(doc(db, "users", documento.id), {
                    saldoUSD: 0
                });
            }
        }

        console.log("Verificação dos saldos dos agentes concluída.");

    } catch (erro) {
        console.error("Erro ao inicializar saldos:", erro);
    }
}

/* =========================================
   ATIVAR, DESATIVAR E BLOQUEAR AGENTES
   NGOLA-EXPRES — GERENTE ADM
   ========================================= */

if (agentsList) {
    agentsList.addEventListener("click", async (evento) => {
        const botao = evento.target.closest("[data-agent-action]");

        if (!botao) return;

        const acao = botao.dataset.agentAction;
        const uidAgente = botao.dataset.agentUid;

        if (!uidAgente || !["active", "inactive", "blocked"].includes(acao)) {
            return;
        }

        const nomesAcoes = {
            active: "ativar",
            inactive: "desativar",
            blocked: "bloquear"
        };

        if (!confirm(`Tens a certeza de que pretendes ${nomesAcoes[acao]} esta conta?`)) {
            return;
        }

        botao.disabled = true;

        try {
            await updateDoc(doc(db, "users", uidAgente), {
                status: acao,
                atualizadoEm: serverTimestamp()
            });

            console.log(`Estado do agente atualizado: ${acao}`);

            // A lista será atualizada automaticamente pelo onSnapshot.
            alert(`Conta do agente atualizada: ${nomesAcoes[acao]}.`);

        } catch (erro) {
            console.error("Erro ao atualizar conta do agente:", erro);

            alert(
                "Não foi possível atualizar a conta. Verifica as regras do Firestore."
            );

        } finally {
            botao.disabled = false;
        }
    });
}

/* ===================================================== 
   7. CHAT AGENTES USD — PEDIDOS EM TEMPO REAL 
   NGOLA-EXPRES | GERENTE ADM 
===================================================== */ 

const pedidosChatAgentesUSD = document.getElementById("selectedRoom"); 
const listaPedidosCarregamento = document.getElementById("topupsList"); 

let salaChatAtual = ""; 
let cancelarPedidosCarregamento = null; 
let pedidosCarregamentoAtuais = []; 

/* Escapar texto antes de o inserir no HTML */ 
function escaparTextoPedido(valor) { 
  return String(valor ?? "").replace(/[&<>"']/g, caracter => ({ 
    "&": "&amp;", 
    "<": "&lt;", 
    ">": "&gt;", 
    '"': "&quot;", 
    "'": "&#39;" 
  })[caracter]); 
} 

/* Formatar valores monetários */ 
function formatarValorPedido(valor, moeda) { 
  const numero = Number(valor); 
  return `${(Number.isFinite(numero) && numero >= 0 ? numero : 0) .toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moeda}`; 
} 

/* =====================================================
   APRESENTAR PEDIDOS DE CARREGAMENTO
   Cartões compactos com botões de decisão
   ===================================================== */

function apresentarPedidosAgentesUSD(destino) {
    if (!destino) return;

    if (pedidosCarregamentoAtuais.length === 0) {
        destino.innerHTML = `
            <p class="topup-empty">
                Ainda não existem pedidos de carregamento.
            </p>
        `;
        return;
    }

    destino.innerHTML = pedidosCarregamentoAtuais.map(pedido => {
        const nome = escaparTextoPedido(
            pedido.agentName || "Agente NGOLA-EXPRES"
        );

        const valorUSD = formatarValorPedido(
            pedido.amountUSD, "USD"
        );

        const valorKz = formatarValorPedido(
            pedido.amountKz, "Kz"
        );

        const metodo = escaparTextoPedido(
            pedido.paymentMethod || "Não indicado"
        );

        const transacao = escaparTextoPedido(
            pedido.transactionId || "Não indicado"
        );

        const estado = String(
            pedido.status || "pending"
        ).toLowerCase();

        const estados = {
            pending: "PENDENTE",
            confirmed: "CONFIRMADO",
            denied: "NEGADO"
        };

        const estadoTexto = estados[estado] || "POR VERIFICAR";
        const pendente = estado === "pending";

        return `
            <article class="cartao-principal topup-request-card">

                <div class="topup-card-content">

                    <div class="topup-card-heading">
                        <span class="topup-card-brand">
                            NGOLA-EXPRES
                        </span>

                        <span class="topup-status topup-status-${estado}">
                            ${estadoTexto}
                        </span>
                    </div>

                    <h3>Pedido de carregamento</h3>

                    <p>
                        <span>Agente</span>
                        <strong>${nome}</strong>
                    </p>

                    <p>
                        <span>Valor solicitado</span>
                        <strong>${valorUSD}</strong>
                    </p>

                    <p>
                        <span>Valor em Kz</span>
                        <strong>${valorKz}</strong>
                    </p>

                    <p>
                        <span>Pagamento</span>
                        <strong>${metodo}</strong>
                    </p>

                    <p class="topup-transaction">
                        <span>ID da transação</span>
                        <strong>${transacao}</strong>
                    </p>

                    ${
                        pendente
                        ? `
                            <div class="topup-card-actions">
                                <button
                                    type="button"
                                    class="topup-btn-deny"
                                    data-topup-action="denied"
                                    data-topup-id="${escaparTextoPedido(pedido.id)}">
                                    NEGAR
                                </button>

                                <button
                                    type="button"
                                    class="topup-btn-confirm"
                                    data-topup-action="confirmed"
                                    data-topup-id="${escaparTextoPedido(pedido.id)}">
                                    CONFIRMAR
                                </button>
                            </div>
                        `
                        : ""
                    }

                </div>
            </article>
        `;
    }).join("");
}

/* Escutar pedidos novos e alterações no Firestore */ 
function iniciarObservacaoPedidosAgentesUSD() { 
  if (cancelarPedidosCarregamento) { 
    cancelarPedidosCarregamento(); 
    cancelarPedidosCarregamento = null; 
  } 
  
  const referencia = collection(db, "agentTopUpRequests"); 
  
  cancelarPedidosCarregamento = onSnapshot( 
    referencia, 
    (resultado) => { 
      pedidosCarregamentoAtuais = resultado.docs 
        .map(documento => ({ id: documento.id, ...documento.data() })) 
        .sort((a, b) => { 
          const dataA = a.createdAt?.toMillis?.() || 0; 
          const dataB = b.createdAt?.toMillis?.() || 0; 
          return dataB - dataA; 
        }); 
        
      // Atualizar a sala se estiver aberta. 
      if (salaChatAtual === "Agentes USD") { 
        apresentarPedidosAgentesUSD(pedidosChatAgentesUSD); 
      } 
      
      // Atualizar também a secção de carregamentos. 
      apresentarPedidosAgentesUSD(listaPedidosCarregamento); 
    }, 
    (erro) => { 
      console.error("Erro ao observar pedidos de carregamento:", erro); 
      const mensagem = "<p>Não foi possível carregar os pedidos. " + "Verifica as regras do Firestore.</p>"; 
      
      if (salaChatAtual === "Agentes USD" && pedidosChatAgentesUSD) { 
        pedidosChatAgentesUSD.innerHTML = mensagem; 
      } 
      
      if (listaPedidosCarregamento) { 
        listaPedidosCarregamento.innerHTML = mensagem; 
      } 
    } 
  ); 
} 

/* Abrir a sala Agentes USD */ 
document.querySelectorAll("[data-room]").forEach(botao => { 
  botao.addEventListener("click", () => { 
    salaChatAtual = botao.dataset.room; 
    
    if (salaChatAtual === "Agentes USD") { 
      apresentarPedidosAgentesUSD(pedidosChatAgentesUSD); 
    } 
  }); 
});

/* ===================================================== 
   8. PROCESSAR PEDIDOS DE CARREGAMENTO 
   NGOLA-EXPRES — GERENTE ADM 
   
   CONFIRMAR: 
   - Desconta da carteira principal do GERENTE ADM. 
   - Credita o saldo do agente. 
   - Marca o pedido como confirmado. 
   
   NEGAR: 
   - Marca o pedido como negado. 
   - Não altera nenhum saldo. 
   
   As alterações são atómicas no Firestore. 
===================================================== */ 

let pedidoUSDEmProcessamento = false; 

document.addEventListener("click", async (evento) => { 
  const botao = evento.target.closest("[data-topup-action]"); 
  if (!botao) return; 
  if (pedidoUSDEmProcessamento) return; 
  
  const acao = botao.dataset.topupAction; 
  const pedidoId = botao.dataset.topupId; 
  
  if (!pedidoId || !["confirmed", "denied"].includes(acao)) { 
    return; 
  } 
  
  const administrador = auth.currentUser; 
  if (!administrador) { 
    alert("Inicia sessão como GERENTE ADM."); 
    return; 
  } 
  
  const descricao = acao === "confirmed" 
    ? "CONFIRMAR este carregamento e descontar o valor da carteira principal?" 
    : "NEGAR este pedido sem alterar os saldos?"; 
    
  if (!confirm(descricao)) return; 
  
  pedidoUSDEmProcessamento = true; 
  botao.disabled = true; 
  const textoOriginal = botao.textContent; 
  botao.textContent = "A processar..."; 
  
  try { 
    // 1. Confirmar a identidade e o papel do administrador. 
    const adminRef = doc(db, "users", administrador.uid); 
    const adminSnapshot = await getDoc(adminRef); 
    
    if (!adminSnapshot.exists() || adminSnapshot.data().role !== "admin") { 
      throw new Error("Apenas o GERENTE ADM pode processar carregamentos."); 
    } 
    
    // 2. Referência à carteira principal e ao pedido. 
    const carteiraPrincipalRef = doc(db, "settings", "adminBalance"); 
    const pedidoRef = doc(db, "agentTopUpRequests", pedidoId); 
    
    // 3. Processar a decisão numa única transação. 
    await runTransaction(db, async (transacao) => { 
      const pedidoSnapshot = await transacao.get(pedidoRef); 
      
      if (!pedidoSnapshot.exists()) { 
        throw new Error("O pedido não foi encontrado."); 
      } 
      
      const pedido = pedidoSnapshot.data(); 
      if (pedido.status !== "pending") { 
        throw new Error("Este pedido já foi processado. Não houve novo movimento de saldo."); 
      } 
      
      // NEGAR: não alterar os saldos. 
      if (acao === "denied") { 
        transacao.update(pedidoRef, { 
          status: "denied", 
          processedAt: serverTimestamp(), 
          processedBy: administrador.uid 
        }); 
        return; 
      } 
      
      // CONFIRMAR: validar o valor e o agente. 
      const valorUSD = Number(pedido.amountUSD); 
      const agenteUid = pedido.agentUid; 
      
      if (!Number.isFinite(valorUSD) || valorUSD <= 0 || !agenteUid) { 
        throw new Error("O valor ou o agente associado ao pedido é inválido."); 
      } 
      
      // Ler carteira principal. 
      const carteiraSnapshot = await transacao.get(carteiraPrincipalRef); 
      if (!carteiraSnapshot.exists()) { 
        throw new Error("A carteira principal do GERENTE ADM não foi encontrada."); 
      } 
      
      const carteira = carteiraSnapshot.data(); 
      const saldoPrincipal = Number(carteira.saldo); 
      
      if (!Number.isFinite(saldoPrincipal) || saldoPrincipal < 0) { 
        throw new Error("O saldo principal do GERENTE ADM é inválido."); 
      } 
      
      if (saldoPrincipal < valorUSD) { 
        throw new Error("Saldo principal insuficiente. O carregamento não foi efetuado."); 
      } 
      
      // Ler o perfil do agente. 
      const agenteRef = doc(db, "users", agenteUid); 
      const agenteSnapshot = await transacao.get(agenteRef); 
      
      if (!agenteSnapshot.exists()) { 
        throw new Error("O perfil do agente não foi encontrado."); 
      } 
      
      const agente = agenteSnapshot.data(); 
      if (agente.role !== "agente" || agente.status !== "active") { 
        throw new Error("O agente não está ativo. Nenhum saldo foi alterado."); 
      } 
      
      const saldoAgente = Number(agente.saldoUSD ?? 0); 
      if (!Number.isFinite(saldoAgente) || saldoAgente < 0) { 
        throw new Error("O saldo atual do agente é inválido."); 
      } 
      
      // Arredondar para duas casas decimais. 
      const novoSaldoPrincipal = Math.round((saldoPrincipal - valorUSD) * 100) / 100; 
      const novoSaldoAgente = Math.round((saldoAgente + valorUSD) * 100) / 100; 
      
      // 4. Descontar da carteira principal. 
      transacao.update(carteiraPrincipalRef, { 
        saldo: novoSaldoPrincipal, 
        atualizadoEm: serverTimestamp() 
      }); 
      
      // 5. Creditar a carteira do agente. 
      transacao.update(agenteRef, { 
        saldoUSD: novoSaldoAgente, 
        atualizadoEm: serverTimestamp() 
      }); 
      
      // 6. Marcar o pedido como confirmado. 
      transacao.update(pedidoRef, { 
        status: "confirmed", 
        processedAt: serverTimestamp(), 
        processedBy: administrador.uid, 
        creditedUSD: valorUSD 
      }); 
    }); 
    
    alert(
      acao === "confirmed" 
        ? "Carregamento confirmado! O valor foi descontado da carteira principal e creditado ao agente." 
        : "Pedido negado. Nenhum saldo foi alterado."
    ); 
  } catch (erro) { 
    console.error("Erro ao processar pedido de carregamento:", erro); 
    alert(erro.message || "Não foi possível processar o pedido. Verifica as regras do Firestore."); 
  } finally { 
    pedidoUSDEmProcessamento = false; 
    if (botao.isConnected) { 
      botao.disabled = false; 
      botao.textContent = textoOriginal; 
    } 
  } 
});
/* ===================================================== 
   CHAT GERAL — GERENTE ADM 
   Receber e enviar mensagens em tempo real 
   Coleção Firestore: generalChatMessages 
   ===================================================== */ 

(() => {
  // Elementos do Chat Geral 
  const chatMessages = document.getElementById("adminGeneralChatMessages");
  const chatForm = document.getElementById("adminGeneralChatForm");
  const chatInput = document.getElementById("adminGeneralChatInput");
  const chatSend = document.getElementById("adminGeneralChatSend");
  const chatStatus = document.getElementById("adminGeneralChatStatus");

  // Evitar erros se os elementos não estiverem nesta página 
  if (!chatMessages || !chatForm || !chatInput || !chatSend || !chatStatus) {
    return;
  }

  let pararDeOuvirMensagens = null;
  let uidChatInicializado = null;

  // Apresentar mensagens no estado do chat 
  function definirEstadoChat(texto) {
    chatStatus.textContent = texto;
  }

  // Criar uma mensagem visualmente segura 
  function mostrarMensagemChat(mensagem) {
    const linha = document.createElement("div");
    const cabecalho = document.createElement("div");
    const texto = document.createElement("div");
    const hora = document.createElement("div");
    const eAdmin = mensagem.senderRole === "admin";

    linha.style.display = "flex";
    linha.style.flexDirection = "column";
    linha.style.alignItems = eAdmin ? "flex-end" : "flex-start";
    linha.style.width = "100%";

    const bolha = document.createElement("div");
    bolha.style.maxWidth = "82%";
    bolha.style.padding = "10px 14px";
    bolha.style.borderRadius = "14px";
    bolha.style.overflowWrap = "anywhere";
    bolha.style.boxSizing = "border-box";
    bolha.style.background = eAdmin ? "#166534" : "#bae6fd";
    bolha.style.color = eAdmin ? "#ffffff" : "#082f49";

    cabecalho.textContent = (mensagem.senderName || "Utilizador") + (eAdmin ? " · GERENTE ADM" : " · Agente");
    cabecalho.style.fontSize = "12px";
    cabecalho.style.fontWeight = "700";
    cabecalho.style.marginBottom = "5px";

    texto.textContent = mensagem.text || "";
    texto.style.whiteSpace = "pre-wrap";
    texto.style.fontSize = "14px";
    texto.style.lineHeight = "1.45";

    if (mensagem.createdAt && typeof mensagem.createdAt.toDate === "function") {
      hora.textContent = mensagem.createdAt.toDate().toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } else {
      hora.textContent = "Agora";
    }

    hora.style.fontSize = "10px";
    hora.style.marginTop = "6px";
    hora.style.opacity = "0.75";

    bolha.append(cabecalho, texto, hora);
    linha.appendChild(bolha);
    chatMessages.appendChild(linha);
  }

  // Iniciar ou reiniciar a ligação quando o administrador estiver autenticado 
  function iniciarChatGeralAdmin() {
    const utilizador = auth.currentUser;
    if (!utilizador) {
      definirEstadoChat("Inicia sessão como administrador para utilizar o chat.");
      return;
    }

    if (uidChatInicializado === utilizador.uid && pararDeOuvirMensagens) {
      return;
    }

    if (pararDeOuvirMensagens) {
      pararDeOuvirMensagens();
      pararDeOuvirMensagens = null;
    }

    uidChatInicializado = utilizador.uid;
    definirEstadoChat("A ligar ao Chat Geral…");

    const mensagensRef = collection(db, "generalChatMessages");
    const consulta = query(
      mensagensRef,
      orderBy("createdAt", "asc"),
      limit(200)
    );

    pararDeOuvirMensagens = onSnapshot(
      consulta,
      (snapshot) => {
        chatMessages.replaceChildren();
        if (snapshot.empty) {
          const vazio = document.createElement("p");
          vazio.className = "admin-general-chat-empty";
          vazio.textContent = "Ainda não existem mensagens no Chat Geral.";
          chatMessages.appendChild(vazio);
        } else {
          snapshot.forEach((documento) => {
            mostrarMensagemChat(documento.data());
          });
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        definirEstadoChat("Chat Geral ligado.");
      },
      (erro) => {
        console.error("Erro ao receber mensagens do Chat Geral:", erro);
        definirEstadoChat(
          "Não foi possível carregar as mensagens. Verifica o acesso ao chat."
        );
      }
    );
  }

  // Enviar mensagem do administrador 
  chatForm.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const utilizador = auth.currentUser;
    const texto = chatInput.value.trim();

    if (!utilizador) {
      definirEstadoChat("A tua sessão terminou. Inicia sessão novamente.");
      return;
    }

    if (!texto) {
      return;
    }

    if (texto.length > 1000) {
      definirEstadoChat("A mensagem não pode ultrapassar 1000 caracteres.");
      return;
    }

    chatSend.disabled = true;
    definirEstadoChat("A enviar mensagem…");

    try {
      // Confirmar o papel do utilizador no Firestore 
      const perfilSnapshot = await getDoc(doc(db, "users", utilizador.uid));
      if (!perfilSnapshot.exists() || perfilSnapshot.data().role !== "admin") {
        throw new Error("A conta não tem autorização de administrador.");
      }

      await addDoc(collection(db, "generalChatMessages"), {
        senderUid: utilizador.uid,
        senderName: perfilSnapshot.data().fullName || perfilSnapshot.data().nome || "GERENTE ADM",
        senderRole: "admin",
        text: texto,
        createdAt: serverTimestamp()
      });

      chatInput.value = "";
      definirEstadoChat("Mensagem enviada.");
      chatInput.focus();
    } catch (erro) {
      console.error("Erro ao enviar mensagem do administrador:", erro);
      definirEstadoChat(
        erro.message || "Não foi possível enviar a mensagem. Verifica a ligação e as permissões."
      );
    } finally {
      chatSend.disabled = false;
    }
  });

  // Aguardar a sessão de autenticação estar disponível 
  const verificarSessao = auth.onAuthStateChanged ? auth.onAuthStateChanged.bind(auth) : null;
  if (verificarSessao) {
    verificarSessao((utilizador) => {
      if (utilizador) {
        iniciarChatGeralAdmin();
      } else {
        definirEstadoChat("Inicia sessão para utilizar o Chat Geral.");
      }
    });
  } else {
    // A sessão pode já estar disponível quando o painel é carregado 
    iniciarChatGeralAdmin();
  }
})();
/* ========================================= 
   TERMINAR SESSÃO DO GERENTE ADM — NGOLA-EXPRES 
   ========================================= */ 

const adminLogoutButton = document.getElementById("adminLogoutButton");

if (adminLogoutButton) {
  adminLogoutButton.addEventListener("click", async () => {
    if (!auth.currentUser) {
      document.getElementById("adminDashboard").hidden = true;
      document.getElementById("adminLoginView").hidden = false;
      return;
    }

    adminLogoutButton.disabled = true;
    adminLogoutButton.textContent = "A terminar sessão...";

    try {
      // Terminar a sessão Firebase 
      await signOut(auth);

      // Esconder o painel administrativo 
      document.getElementById("adminDashboard").hidden = true;

      // Mostrar novamente o formulário de login 
      document.getElementById("adminLoginView").hidden = false;

      // Limpar os campos de acesso 
      if (adminLoginForm) {
        adminLoginForm.reset();
      }

      // Mensagem de confirmação 
      mostrarMensagem("Sessão terminada com sucesso.", "sucesso");
    } catch (erro) {
      console.error("Erro ao terminar sessão:", erro);
      alert("Não foi possível terminar a sessão. Tenta novamente.");
    } finally {
      adminLogoutButton.disabled = false;
      adminLogoutButton.textContent = "Terminar sessão";
    }
  });
}
