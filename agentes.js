"use strict";

/* =========================================
   IMPORTAÇÕES DO FIREBASE
   ========================================= */

import {
    auth,
    db,
    onSnapshot,
    doc,
    getDoc,
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    serverTimestamp
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";


/* =========================================
   1. ELEMENTOS DA PÁGINA
   ========================================= */

const agentName = document.getElementById("agentName");
const agentNumber = document.getElementById("agentNumber");
const agentBalance = document.getElementById("agentBalance");
const agentBalanceKz = document.getElementById("agentBalanceKz");
const agentReservedBalance = document.getElementById("agentReservedBalance");
const agentAccountStatus = document.getElementById("agentAccountStatus");


/* =========================================
   2. CONFIGURAÇÕES DE APRESENTAÇÃO
   ========================================= */

// Taxa usada apenas para apresentar o equivalente em Kz.
// O valor definitivo deverá vir da configuração validada no servidor.
const AGENT_DISPLAY_RATE = 1125;


/* =========================================
   3. FORMATAR VALORES
   ========================================= */

function formatUSD(value) {
    const amount = Number(value);

    return `${(Number.isFinite(amount) && amount >= 0 ? amount : 0)
        .toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} USD`;
}

function formatKz(value) {
    const amount = Number(value);

    return `${(Number.isFinite(amount) && amount >= 0 ? amount : 0)
        .toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} Kz`;
}


/* ========================================= 
   4. MOSTRAR ESTADO DA CONTA 
   ========================================= */ 

function showAccountStatus(status) {
  if (!agentAccountStatus) return;

  const statuses = {
    active: "Conta activa",
    inactive: "Conta inactiva — aguarde activação",
    suspended: "Conta suspensa",
    blocked: "Conta bloqueada",
    disabled: "Conta desactivada"
  };

  const statusText = statuses[status] || "Estado da conta por verificar";

  // Actualizar o texto do estado 
  agentAccountStatus.textContent = statusText;

  // Encontrar o LED que já existe no HTML 
  const statusIndicator = document.querySelector(".agent-status .status-indicator");

  if (statusIndicator) {
    const isActive = status === "active";
    statusIndicator.classList.toggle("account-active", isActive);
    statusIndicator.classList.toggle("account-inactive", !isActive);
    statusIndicator.setAttribute("aria-label", statusText);
  }
}


/* =========================================
   5. VERIFICAR AUTENTICAÇÃO
   ========================================= */

let stopAgentListener = null;

onAuthStateChanged(auth, (user) => {
    // Parar a consulta anterior, se existir.
    if (typeof stopAgentListener === "function") {
        stopAgentListener();
        stopAgentListener = null;
    }

    if (!user) {
        if (agentName) agentName.textContent = "Inicia sessão para continuar";
        if (agentNumber) agentNumber.textContent = "—";
        if (agentBalance) agentBalance.textContent = formatUSD(0);
        if (agentBalanceKz) agentBalanceKz.textContent = formatKz(0);
        if (agentReservedBalance) {
            agentReservedBalance.textContent = formatUSD(0);
        }

        showAccountStatus("inactive");
        return;
    }

    if (agentName) agentName.textContent = "A carregar perfil...";
    showAccountStatus("inactive");

    /*
     * IMPORTANTE:
     * Esta versão pressupõe que o perfil está guardado em:
     * utilizadores/{UID}
     *
     * Se a tua aplicação usar outra colecção ou estrutura,
     * teremos de ajustar este caminho após verificar o registo.
     */

  const userRef = doc(db, "users", user.uid);

    stopAgentListener = onSnapshot(
        userRef,
        (snapshot) => {
            if (!snapshot.exists()) {
                if (agentName) agentName.textContent = "Perfil não encontrado";
                showAccountStatus("inactive");
                return;
            }

            const data = snapshot.data();

// Guardar os dados do perfil para o pedido de carregamento.
currentAgentProfile = {
    uid: user.uid,
    name: data.fullName || data.nomeCompleto || data.nome || "Agente NGOLA-EXPRES",
    number: data.agentNumber || data.numeroAgente || data.agentId || "Por atribuir",
    status: String(data.status || data.estado || "inactive").toLowerCase()
};

            const role = String(data.role || data.tipo || "").toLowerCase();

            if (role !== "agente" && role !== "agent") {
                if (agentName) agentName.textContent = "Conta sem perfil de agente";
                showAccountStatus("inactive");
                return;
            }

            const name =
                data.fullName ||
                data.nomeCompleto ||
                data.nome ||
                "Agente NGOLA-EXPRES";

           // Número de agente: mostrar apenas os 9 primeiros algarismos do BI.
const biRegistado =
    data.biNumber ||
    data.numeroBI ||
    data.bi ||
    "";

const biApenasDigitos = String(biRegistado)
    .replace(/\D/g, "");

const number = biApenasDigitos.length >= 9
    ? biApenasDigitos.substring(0, 9)
    : "Por atribuir";

            const status =
                String(data.status || data.estado || "inactive").toLowerCase();

            const balance = Number(data.balanceUSD ?? data.saldoUSD ?? 0);
            const reserved = Number(
                data.reservedUSD ?? data.saldoReservadoUSD ?? 0
            );

            if (agentName) agentName.textContent = name;
            if (agentNumber) agentNumber.textContent = number;
            if (agentBalance) agentBalance.textContent = formatUSD(balance);
            if (agentBalanceKz) {
                agentBalanceKz.textContent = formatKz(
                    Math.max(0, balance) * AGENT_DISPLAY_RATE
                );
            }
            if (agentReservedBalance) {
                agentReservedBalance.textContent = formatUSD(reserved);
            }

            showAccountStatus(status);
        },
        (error) => {
            console.error("Erro ao consultar o perfil do agente:", error);

            if (agentName) agentName.textContent = "Não foi possível carregar o perfil";
            showAccountStatus("inactive");
        }
    );
});

/* =========================================
   6. NGOLA-EXPRES — COMPRAR SALDO
   Abrir, fechar, calcular e validar o formulário
   ========================================= */

// -----------------------------------------
// 6.1. ELEMENTOS DA JANELA
// -----------------------------------------

const agentTopUpButton = document.getElementById("agentTopUpButton");
const agentTopUpModal = document.getElementById("agentTopUpModal");
const agentTopUpClose = document.getElementById("agentTopUpClose");
const agentTopUpForm = document.getElementById("agentTopUpForm");

const agentTopUpAmount = document.getElementById("agentTopUpAmount");
const agentTopUpAmountKz = document.getElementById("agentTopUpAmountKz");
const agentTopUpMethod = document.getElementById("agentTopUpMethod");

const agentTopUpPaymentDetails =
    document.getElementById("agentTopUpPaymentDetails");

const agentTopUpBankNotice =
    document.getElementById("agentTopUpBankNotice");

const agentTopUpIBANGroup =
    document.getElementById("agentTopUpIBANGroup");

const agentTopUpIBAN =
    document.getElementById("agentTopUpIBAN");

const agentTopUpHolder =
    document.getElementById("agentTopUpHolder");

const agentTopUpExpressGroup =
    document.getElementById("agentTopUpExpressGroup");

const agentTopUpTransactionId =
    document.getElementById("agentTopUpTransactionId");

const agentTopUpSubmit =
    document.getElementById("agentTopUpSubmit");

const agentTopUpMessage =
    document.getElementById("agentTopUpMessage");
/* =========================================
   IDENTIFICAÇÃO DO AGENTE AUTENTICADO
   ========================================= */

// Guardaremos aqui os dados do agente autenticado.
let currentAgentProfile = null;

// -----------------------------------------
// 6.2. TAXA E LIMITES DO CARREGAMENTO
// -----------------------------------------

const AGENT_TOPUP_RATE = 1075;
const AGENT_TOPUP_MIN = 5;
const AGENT_TOPUP_MAX = 1000;


// -----------------------------------------
// 6.3. DADOS DOS MÉTODOS DE PAGAMENTO
// -----------------------------------------

const AGENT_TOPUP_PAYMENTS = {
    BAI: {
        iban: "0040 0000 63984434101 58",
        holder: "JOAQUIM CHILALA TCHIPILICA"
    },

    BFA: {
        iban: "6000600001052157030188",
        holder: "CECÍLIA SANDAMEULA"
    },

    EXPRESS: {
        number: "923354933"
    }
};


// -----------------------------------------
// 6.4. ABRIR A JANELA
// -----------------------------------------

if (agentTopUpButton && agentTopUpModal) {
    agentTopUpButton.addEventListener("click", () => {
        agentTopUpModal.hidden = false;

        if (agentTopUpMessage) {
            agentTopUpMessage.textContent = "";
        }
    });
}


// -----------------------------------------
// 6.5. FECHAR A JANELA
// -----------------------------------------

function closeAgentTopUpModal() {
    if (agentTopUpModal) {
        agentTopUpModal.hidden = true;
    }
}

if (agentTopUpClose) {
    agentTopUpClose.addEventListener(
        "click",
        closeAgentTopUpModal
    );
}

// Fechar quando o agente clicar fora do conteúdo.
if (agentTopUpModal) {
    agentTopUpModal.addEventListener("click", (event) => {
        if (event.target === agentTopUpModal) {
            closeAgentTopUpModal();
        }
    });
}

// Fechar com a tecla Escape.
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        agentTopUpModal &&
        !agentTopUpModal.hidden
    ) {
        closeAgentTopUpModal();
    }
});


// -----------------------------------------
// 6.6. CALCULAR O VALOR EM KZ
// -----------------------------------------

function updateAgentTopUpConversion() {
    if (!agentTopUpAmount || !agentTopUpAmountKz) {
        return;
    }

    const rawAmount = agentTopUpAmount.value.trim();
    const amount = Number(rawAmount);

    const validAmount =
        rawAmount !== "" &&
        Number.isFinite(amount) &&
        amount >= AGENT_TOPUP_MIN &&
        amount <= AGENT_TOPUP_MAX;

    const amountKz = validAmount
        ? amount * AGENT_TOPUP_RATE
        : 0;

    agentTopUpAmountKz.textContent = formatKz(amountKz);

    validateAgentTopUpForm();
}

if (agentTopUpAmount) {
    agentTopUpAmount.addEventListener(
        "input",
        updateAgentTopUpConversion
    );
}


// -----------------------------------------
// 6.7. MOSTRAR OS DADOS DE PAGAMENTO
// -----------------------------------------

function updateAgentTopUpMethod() {
    const method = agentTopUpMethod
        ? agentTopUpMethod.value
        : "";

    const isBank = method === "BAI" || method === "BFA";
    const isExpress = method === "EXPRESS";

    if (agentTopUpPaymentDetails) {
        agentTopUpPaymentDetails.hidden = !method;
    }

    if (agentTopUpBankNotice) {
        agentTopUpBankNotice.hidden = !isBank;
    }

    if (agentTopUpIBANGroup) {
        agentTopUpIBANGroup.hidden = !isBank;
    }

    if (agentTopUpExpressGroup) {
        agentTopUpExpressGroup.hidden = !isExpress;
    }

    const payment = AGENT_TOPUP_PAYMENTS[method];

    if (payment && payment.iban) {
        if (agentTopUpIBAN) {
            agentTopUpIBAN.textContent = payment.iban;
        }

        if (agentTopUpHolder) {
            agentTopUpHolder.textContent = payment.holder;
        }
    }

    const expressNumber = document.getElementById(
        "agentTopUpExpressNumber"
    );

    if (payment && payment.number && expressNumber) {
        expressNumber.textContent = payment.number;
    }

    validateAgentTopUpForm();
}

if (agentTopUpMethod) {
    agentTopUpMethod.addEventListener(
        "change",
        updateAgentTopUpMethod
    );
}


// -----------------------------------------
// 6.8. VALIDAR O ID DA TRANSAÇÃO
// -----------------------------------------

function isValidAgentTransactionId() {
    if (!agentTopUpTransactionId) {
        return false;
    }

    const transactionId =
        agentTopUpTransactionId.value.trim();

    // Aceita entre 5 e 10 algarismos.
    return /^[0-9]{5,10}$/.test(transactionId);
}

if (agentTopUpTransactionId) {
    agentTopUpTransactionId.addEventListener(
        "input",
        validateAgentTopUpForm
    );
}


// -----------------------------------------
// 6.9. VALIDAR TODOS OS CAMPOS
// -----------------------------------------

function validateAgentTopUpForm() {
    if (!agentTopUpSubmit) {
        return;
    }

    const rawAmount = agentTopUpAmount
        ? agentTopUpAmount.value.trim()
        : "";

    const amount = Number(rawAmount);

    const validAmount =
        rawAmount !== "" &&
        Number.isFinite(amount) &&
        amount >= AGENT_TOPUP_MIN &&
        amount <= AGENT_TOPUP_MAX;

    const validMethod =
        Boolean(
            agentTopUpMethod &&
            AGENT_TOPUP_PAYMENTS[agentTopUpMethod.value]
        );

    const validTransactionId =
        isValidAgentTransactionId();

    agentTopUpSubmit.disabled = !(
        validAmount &&
        validMethod &&
        validTransactionId
    );
}


// -----------------------------------------
// 6.10. PREPARAR O FORMULÁRIO
// -----------------------------------------

if (agentTopUpForm) {
    agentTopUpForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        validateAgentTopUpForm();

        if (agentTopUpSubmit.disabled) {
            if (agentTopUpMessage) {
                agentTopUpMessage.textContent =
                    "Verifica o valor, o método de pagamento e o ID da transacção.";
            }
            return;
        }

        const user = auth.currentUser;

        if (!user) {
            if (agentTopUpMessage) {
                agentTopUpMessage.textContent =
                    "Inicia sessão para enviar o pedido.";
            }
            return;
        }

        // Converter o valor introduzido em número.
        const rawAmount = agentTopUpAmount.value
            .trim()
            .replace(",", ".");

        const amountUSD = Number(rawAmount);

        // Taxa de carregamento: 1 USD = 1.075 Kz.
        const amountKz =
            Math.round(amountUSD * AGENT_TOPUP_RATE * 100) / 100;

        const paymentMethod = agentTopUpMethod.value;
        const transactionId = agentTopUpTransactionId.value.trim();

        // Evitar o envio repetido do mesmo formulário.
        agentTopUpSubmit.disabled = true;
        agentTopUpSubmit.textContent = "A enviar...";

        if (agentTopUpMessage) {
            agentTopUpMessage.textContent =
                "A verificar a conta e a enviar o pedido...";
        }

        try {
            // Consultar o perfil actualizado do agente.
            const profileRef = doc(db, "users", user.uid);
            const profileSnapshot = await getDoc(profileRef);

            if (!profileSnapshot.exists()) {
                throw new Error(
                    "Não foi encontrado o perfil desta conta."
                );
            }

            const profile = profileSnapshot.data();

            const role = String(
                profile.role || profile.tipo || ""
            ).toLowerCase();

            const status = String(
                profile.status || profile.estado || "inactive"
            ).toLowerCase();

            // Só os agentes podem enviar pedidos.
            if (role !== "agente" && role !== "agent") {
                throw new Error(
                    "Esta conta não tem um perfil de agente."
                );
            }

            // A conta precisa de estar activa.
            if (status !== "active") {
                throw new Error(
                    "A tua conta ainda não está activa. Aguarda a activação do administrador."
                );
            }

// Os agentes não precisam de verificar o e-mail.
// A autorização depende do perfil e do estado da conta.

            // Registar o pedido no Firestore.
            // IMPORTANTE: o saldo não é alterado nesta operação.
            await addDoc(
                collection(db, "agentTopUpRequests"),
                {
                    agentUid: user.uid,

                    agentName:
                        profile.fullName ||
                        profile.nomeCompleto ||
                        profile.nome ||
                        "Agente NGOLA-EXPRES",

                    agentNumber:
                        profile.agentNumber ||
                        profile.numeroAgente ||
                        profile.agentId ||
                        "Por atribuir",

                    amountUSD: amountUSD,
                    amountKz: amountKz,
                    paymentMethod: paymentMethod,
                    transactionId: transactionId,
                    status: "pending",
                    createdAt: serverTimestamp()
                }
            );

            if (agentTopUpMessage) {
                agentTopUpMessage.textContent =
                    "Pedido enviado com sucesso. Estado: PENDENTE. " +
                    "O saldo só será actualizado após a confirmação do administrador.";
            }

            // Limpar os campos após o envio bem-sucedido.
            agentTopUpForm.reset();

            updateAgentTopUpConversion();
            updateAgentTopUpMethod();
            validateAgentTopUpForm();

        } catch (error) {
            console.error(
                "Erro ao enviar pedido de carregamento:",
                error
            );

            if (agentTopUpMessage) {
                if (error && error.code === "permission-denied") {
                    agentTopUpMessage.textContent =
                        "O Firebase recusou o pedido. Verifica se a conta está activa e se as regras de segurança foram publicadas correctamente.";
                } else {
                    agentTopUpMessage.textContent =
                        error.message ||
                        "Não foi possível enviar o pedido. Tenta novamente.";
                }
            }

        } finally {
            // Restaurar o botão no final da operação.
            if (agentTopUpSubmit) {
                agentTopUpSubmit.textContent = "Enviar pedido";
            }

            validateAgentTopUpForm();
        }
    });
}

// -----------------------------------------
// 6.11. INICIALIZAR A JANELA
// -----------------------------------------

updateAgentTopUpConversion();
updateAgentTopUpMethod();
validateAgentTopUpForm();

/* =========================================
   7. CHAT GERAL — ABRIR E FECHAR A JANELA
   ========================================= */

// Identificar os elementos do Chat Geral.
const agentGeneralChatButton =
    document.getElementById("agentGeneralChatButton");

const agentGeneralChatModal =
    document.getElementById("agentGeneralChatModal");

const agentGeneralChatClose =
    document.getElementById("agentGeneralChatClose");

const agentGeneralChatInput =
    document.getElementById("agentGeneralChatInput");

// Abrir a janela do Chat Geral.
if (agentGeneralChatButton && agentGeneralChatModal) {
    agentGeneralChatButton.addEventListener("click", () => {
        agentGeneralChatModal.hidden = false;

        // Colocar o cursor no campo de mensagem.
        if (agentGeneralChatInput) {
            setTimeout(() => {
                agentGeneralChatInput.focus();
            }, 100);
        }
    });
}

// Fechar pelo botão X.
if (agentGeneralChatClose && agentGeneralChatModal) {
    agentGeneralChatClose.addEventListener("click", () => {
        agentGeneralChatModal.hidden = true;
    });
}

// Fechar ao tocar fora da janela.
if (agentGeneralChatModal) {
    agentGeneralChatModal.addEventListener("click", (event) => {
        if (event.target === agentGeneralChatModal) {
            agentGeneralChatModal.hidden = true;
        }
    });
}

// Fechar com a tecla Escape.
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        agentGeneralChatModal &&
        !agentGeneralChatModal.hidden
    ) {
        agentGeneralChatModal.hidden = true;
    }
});

// =====================================================
// NGOLA-EXPRES — CHAT GERAL EM TEMPO REAL
// ACRESCENTAR NO FINAL DE agentes.js
// =====================================================

const generalChatMessagesBox =
  document.getElementById("agentGeneralChatMessages");

const generalChatForm =
  document.getElementById("agentGeneralChatForm");

const generalChatInput =
  document.getElementById("agentGeneralChatInput");

const generalChatStatus =
  document.getElementById("agentGeneralChatStatus");

let generalChatStopListener = null;
let generalChatSending = false;


// -----------------------------------------------------
// 1. MOSTRAR O ESTADO DO CHAT
// -----------------------------------------------------
function setGeneralChatStatus(message) {
  if (generalChatStatus) {
    generalChatStatus.textContent = message;
  }
}


// -----------------------------------------------------
// 2. APRESENTAR AS MENSAGENS
// -----------------------------------------------------
function renderGeneralChatMessage(messageData) {
  const message = document.createElement("article");

  const isAdminMessage = messageData.senderRole === "admin";

  message.className = isAdminMessage
    ? "agent-chat-message admin"
    : "agent-chat-message agent";

  const sender = document.createElement("strong");
  sender.className = "agent-chat-sender";
  sender.textContent = isAdminMessage
    ? "GERENTE ADM"
    : (messageData.senderName || "Agente");

  const text = document.createElement("p");
  text.className = "agent-chat-text";
  text.textContent = messageData.text || "";

  const time = document.createElement("small");
  time.className = "agent-chat-time";

  if (messageData.createdAt &&
      typeof messageData.createdAt.toDate === "function") {
    time.textContent = messageData.createdAt
      .toDate()
      .toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
  } else {
    time.textContent = "A enviar...";
  }

  message.append(sender, text, time);
  return message;
}


// -----------------------------------------------------
// 3. CARREGAR MENSAGENS EM TEMPO REAL
// -----------------------------------------------------
async function startGeneralChat() {
  const user = auth.currentUser;

  if (!user) {
    setGeneralChatStatus("Inicia sessão para utilizar o chat.");
    return;
  }

  try {
    // Confirmar o perfil e o estado atual do utilizador.
    const profileSnapshot = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!profileSnapshot.exists()) {
      setGeneralChatStatus("Não foi encontrado o teu perfil.");
      return;
    }

    const profile = profileSnapshot.data();

    const isAdmin = user.uid === "11gwAwgD8rX2TtjRpLhc67jE9EO2";
    const isActiveAgent =
      profile.role === "agente" &&
      profile.status === "active";

    if (!isAdmin && !isActiveAgent) {
      setGeneralChatStatus(
        "O chat está disponível apenas para agentes ativos e GERENTE ADM."
      );
      return;
    }

    // Impedir listeners duplicados.
    if (generalChatStopListener) {
      generalChatStopListener();
      generalChatStopListener = null;
    }

    const messagesQuery = query(
      collection(db, "generalChatMessages"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    generalChatStopListener = onSnapshot(
      messagesQuery,
      (snapshot) => {
        if (!generalChatMessagesBox) return;

        generalChatMessagesBox.replaceChildren();

        if (snapshot.empty) {
          const emptyMessage = document.createElement("p");
          emptyMessage.className = "agent-chat-empty";
          emptyMessage.textContent =
            "Ainda não existem mensagens. Sê o primeiro a escrever!";
          generalChatMessagesBox.appendChild(emptyMessage);
          return;
        }

        snapshot.forEach((documentSnapshot) => {
          const messageElement = renderGeneralChatMessage(
            documentSnapshot.data()
          );

          generalChatMessagesBox.appendChild(messageElement);
        });

        // Descer automaticamente até à mensagem mais recente.
        generalChatMessagesBox.scrollTop =
          generalChatMessagesBox.scrollHeight;
      },
      (error) => {
        console.error("Erro ao carregar o Chat Geral:", error);
        setGeneralChatStatus(
          "Não foi possível carregar as mensagens. Verifica as regras do Firestore."
        );
      }
    );

    setGeneralChatStatus("Chat ligado. Podes enviar mensagens.");
  } catch (error) {
    console.error("Erro ao iniciar o Chat Geral:", error);
    setGeneralChatStatus(
      "Não foi possível iniciar o chat. Tenta novamente."
    );
  }
}


// -----------------------------------------------------
// 4. ENVIAR UMA MENSAGEM
// -----------------------------------------------------
if (generalChatForm && generalChatInput) {
  generalChatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (generalChatSending) return;

    const user = auth.currentUser;
    const text = generalChatInput.value.trim();

    if (!user) {
      setGeneralChatStatus("Inicia sessão antes de enviar mensagens.");
      return;
    }

    if (!text) {
      setGeneralChatStatus("Escreve uma mensagem primeiro.");
      return;
    }

    if (text.length > 1000) {
      setGeneralChatStatus(
        "A mensagem não pode ultrapassar 1000 caracteres."
      );
      return;
    }

    generalChatSending = true;

    const sendButton = document.getElementById(
      "agentGeneralChatSend"
    );

    if (sendButton) sendButton.disabled = true;

    try {
      // Confirmar novamente a autorização antes de enviar.
      const profileSnapshot = await getDoc(
        doc(db, "users", user.uid)
      );

      if (!profileSnapshot.exists()) {
        throw new Error("Perfil não encontrado.");
      }

      const profile = profileSnapshot.data();

      const isAdmin = user.uid === "11gwAwgD8rX2TtjRpLhc67######";
      const isActiveAgent =
        profile.role === "agente" &&
        profile.status === "active";

      if (!isAdmin && !isActiveAgent) {
        throw new Error(
          "Apenas agentes ativos e GERENTE ADM podem enviar mensagens."
        );
      }

      const senderName = isAdmin
        ? "GERENTE ADM"
        : (
            profile.fullName ||
            profile.name ||
            profile.nome ||
            "Agente NGOLA-EXPRES"
          );

      await addDoc(
        collection(db, "generalChatMessages"),
        {
          senderUid: user.uid,
          senderName: String(senderName).slice(0, 80),
          senderRole: isAdmin ? "admin" : "agente",
          text: text,
          createdAt: serverTimestamp()
        }
      );

      generalChatInput.value = "";
      setGeneralChatStatus("Mensagem enviada.");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);

      setGeneralChatStatus(
        error.message ||
        "Não foi possível enviar a mensagem."
      );
    } finally {
      generalChatSending = false;

      if (sendButton) sendButton.disabled = false;
    }
  });
}


// -----------------------------------------------------
// 5. INICIAR O CHAT QUANDO A JANELA É ABERTA
// -----------------------------------------------------
const generalChatOpenButton =
  document.getElementById("agentGeneralChatButton");

if (generalChatOpenButton) {
  generalChatOpenButton.addEventListener("click", () => {
    startGeneralChat();
  });
}


// -----------------------------------------------------
// 6. PARAR A ESCUTA QUANDO O CHAT É FECHADO
// -----------------------------------------------------
const generalChatCloseButton =
  document.getElementById("agentGeneralChatClose");

const generalChatModal =
  document.getElementById("agentGeneralChatModal");

function stopGeneralChatListener() {
  if (generalChatStopListener) {
    generalChatStopListener();
    generalChatStopListener = null;
  }
}

if (generalChatCloseButton) {
  generalChatCloseButton.addEventListener(
    "click",
    stopGeneralChatListener
  );
}

if (generalChatModal) {
  generalChatModal.addEventListener("click", (event) => {
    if (event.target === generalChatModal) {
      stopGeneralChatListener();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    generalChatModal &&
    !generalChatModal.hidden
  ) {
    stopGeneralChatListener();
  }
});

// =====================================================
// NGOLA-EXPRES — PEDIDOS DE CARREGAMENTO DOS CLIENTES
// ETAPA 2: MOSTRAR PEDIDOS PENDENTES AOS AGENTES ACTIVOS
// ACRESCENTAR NO FINAL DE agentes.js
// =====================================================


// -----------------------------------------------------
// 1. ELEMENTOS HTML
// -----------------------------------------------------

const agentPendingOrdersContainer =
    document.getElementById("agentPendingOrders");

const agentPendingCountElement =
    document.getElementById("agentPendingCount");


// -----------------------------------------------------
// 2. ESTADO DA ESCUTA EM TEMPO REAL
// -----------------------------------------------------

let stopClientTopUpOrdersListener = null;


// -----------------------------------------------------
// 3. FORMATAR A DATA DO PEDIDO
// -----------------------------------------------------

function formatClientOrderDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Data por confirmar";
    }

    return timestamp.toDate().toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// =====================================================
// NGOLA-EXPRES — CARTÃO DO PEDIDO DO CLIENTE
// SUBSTITUIR a função createClientTopUpOrderCard
// =====================================================

function createClientTopUpOrderCard(orderId, orderData) {
    const card = document.createElement("article");

    // Classe principal para aplicar o estilo visual.
    card.className = "agent-pending-order-card";
    card.dataset.orderId = orderId;

    // Cabeçalho do cartão.
    const header = document.createElement("div");
    header.className = "agent-order-card-header";

    const title = document.createElement("h3");
    title.textContent = "Pedido de carregamento";

    const badge = document.createElement("span");
    badge.className = "agent-order-badge";
    badge.textContent = "PENDENTE";

    header.append(title, badge);

    // Informações financeiras.
    const financialInfo = document.createElement("div");
    financialInfo.className = "agent-order-financial-info";

    const usd = document.createElement("p");
    usd.className = "agent-order-usd";
    usd.textContent = formatUSD(orderData.valorUSD);

    const kz = document.createElement("p");
    kz.className = "agent-order-kz";
    kz.textContent = "Equivalente: " + formatKz(orderData.valorKz);

    financialInfo.append(usd, kz);

    // Método de pagamento.
    const method = document.createElement("p");
    method.className = "agent-order-detail";
    method.textContent =
        "Método de pagamento: " +
        String(orderData.metodoPagamento || "Não indicado");

    // ID da transacção preenchido pelo cliente.
    const transactionBox = document.createElement("div");
    transactionBox.className = "agent-order-transaction";

    const transactionLabel = document.createElement("span");
    transactionLabel.textContent = "ID da transacção";

    const transactionValue = document.createElement("strong");
    transactionValue.textContent =
        String(orderData.idTransacao || "ID não disponível");

    transactionBox.append(transactionLabel, transactionValue);

    // Data de recepção.
    const date = document.createElement("small");
    date.className = "agent-order-date";
    date.textContent =
        "Recebido em: " + formatClientOrderDate(orderData.criadoEm);

    // Estado do pedido.
    const status = document.createElement("p");
    status.className = "agent-order-status";
    status.textContent = "Estado: Pendente";

    // Montar o cartão completo.
    card.append(
        header,
        financialInfo,
        method,
        transactionBox,
        date,
        status
    );

    return card;
}


// -----------------------------------------------------
// 5. INICIAR A ESCUTA DOS PEDIDOS DOS CLIENTES
// -----------------------------------------------------

function startClientTopUpOrdersListener(user) {

    // Parar uma escuta anterior para evitar duplicações.
    if (typeof stopClientTopUpOrdersListener === "function") {
        stopClientTopUpOrdersListener();
        stopClientTopUpOrdersListener = null;
    }

    if (!agentPendingOrdersContainer) {
        console.error(
            "Não foi encontrado o elemento #agentPendingOrders no HTML."
        );
        return;
    }

    // Mostrar estado inicial.
    agentPendingOrdersContainer.replaceChildren();

    const loadingMessage = document.createElement("p");
    loadingMessage.textContent = "A carregar pedidos dos clientes...";
    agentPendingOrdersContainer.appendChild(loadingMessage);

    if (agentPendingCountElement) {
        agentPendingCountElement.textContent = "0";
    }

    // Verificar a conta e o perfil do agente.
    getDoc(doc(db, "users", user.uid))
        .then((profileSnapshot) => {

            if (!profileSnapshot.exists()) {
                throw new Error("Perfil do agente não encontrado.");
            }

            const profile = profileSnapshot.data();

            const role = String(
                profile.role || profile.tipo || ""
            ).toLowerCase();

            const status = String(
                profile.status || profile.estado || "inactive"
            ).toLowerCase();

            if (
                (role !== "agente" && role !== "agent") ||
                status !== "active"
            ) {
                agentPendingOrdersContainer.replaceChildren();

                const message = document.createElement("p");
                message.textContent =
                    "Esta área está disponível apenas para agentes activos.";

                agentPendingOrdersContainer.appendChild(message);
                return;
            }

            // Consultar os pedidos dos clientes.
            // As regras do Firestore continuam a controlar o acesso.
            const clientOrdersQuery = query(
                collection(db, "pedidosCarregamento"),
                orderBy("criadoEm", "desc")
            );

            stopClientTopUpOrdersListener = onSnapshot(
                clientOrdersQuery,

                (snapshot) => {
                    agentPendingOrdersContainer.replaceChildren();

                    // Nesta etapa, mostramos apenas pedidos pendentes.
                    const pendingOrders = [];

                    snapshot.forEach((documentSnapshot) => {
                        const orderData = documentSnapshot.data();

                        if (orderData.estado === "pendente") {
                            pendingOrders.push({
                                id: documentSnapshot.id,
                                data: orderData
                            });
                        }
                    });

                    // Actualizar o contador.
                    if (agentPendingCountElement) {
                        agentPendingCountElement.textContent =
                            String(pendingOrders.length);
                    }

                    // Mostrar mensagem quando não existem pedidos.
                    if (pendingOrders.length === 0) {
                        const emptyMessage = document.createElement("p");

                        emptyMessage.textContent =
                            "Não existem pedidos de carregamento pendentes.";

                        agentPendingOrdersContainer.appendChild(emptyMessage);
                        return;
                    }

                    // Criar um cartão para cada pedido.
                    pendingOrders.forEach((order) => {
                        const card = createClientTopUpOrderCard(
                            order.id,
                            order.data
                        );

                        agentPendingOrdersContainer.appendChild(card);
                    });
                },

                (error) => {
                    console.error(
                        "Erro ao carregar pedidos dos clientes:",
                        error
                    );

                    agentPendingOrdersContainer.replaceChildren();

                    const errorMessage = document.createElement("p");

                    errorMessage.textContent =
                        error.code === "permission-denied"
                            ? "Acesso recusado. Confirma se as regras do Firestore foram publicadas e se a conta está activa."
                            : "Não foi possível carregar os pedidos. Tenta novamente.";

                    agentPendingOrdersContainer.appendChild(errorMessage);

                    if (agentPendingCountElement) {
                        agentPendingCountElement.textContent = "0";
                    }
                }
            );
        })
        .catch((error) => {
            console.error(
                "Erro ao verificar o perfil do agente:",
                error
            );

            agentPendingOrdersContainer.replaceChildren();

            const errorMessage = document.createElement("p");
            errorMessage.textContent =
                "Não foi possível verificar a conta do agente.";

            agentPendingOrdersContainer.appendChild(errorMessage);
        });
}


// -----------------------------------------------------
// 6. LIGAR OS PEDIDOS À AUTENTICAÇÃO
// -----------------------------------------------------

onAuthStateChanged(auth, (user) => {

    // Parar a escuta anterior ao mudar de conta.
    if (typeof stopClientTopUpOrdersListener === "function") {
        stopClientTopUpOrdersListener();
        stopClientTopUpOrdersListener = null;
    }

    if (!agentPendingOrdersContainer) {
        return;
    }

    agentPendingOrdersContainer.replaceChildren();

    if (agentPendingCountElement) {
        agentPendingCountElement.textContent = "0";
    }

    if (!user) {
        const message = document.createElement("p");
        message.textContent = "Inicia sessão para consultar os pedidos.";

        agentPendingOrdersContainer.appendChild(message);
        return;
    }

    startClientTopUpOrdersListener(user);
});