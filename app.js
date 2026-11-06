"use strict";

/* =========================================
   1. IMPORTAR OS SERVIÇOS DO FIREBASE
   ========================================= */

import {
    auth,
    db,

    // Autenticação
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    reload,

    // Documentos do Firestore
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,

    // Data e hora do servidor
    serverTimestamp
} from "./firebase.js";
/* =========================================
   2. IDENTIFICAR OS ELEMENTOS DA PÁGINA
   ========================================= */

const toast = document.getElementById("toast");
const currentYear = document.getElementById("currentYear");
const menuButton = document.getElementById("menuButton");

const authOverlay = document.getElementById("authOverlay");
const authClose = document.getElementById("authClose");
const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");
const authMessage = document.getElementById("authMessage");
const authSwitch = document.getElementById("authSwitch");

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

let toastTimeout;


/* =========================================
   3. ATUALIZAR O ANO DO RODAPÉ
   ========================================= */

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


/* =========================================
   4. SISTEMA DE NOTIFICAÇÕES
   ========================================= */

function showMessage(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* =========================================
   5. ABRIR E FECHAR OS FORMULÁRIOS
   ========================================= */

function openAuth(mode) {
    authOverlay.hidden = false;
    authMessage.textContent = "";

    const isRegister = mode === "register";

    registerForm.hidden = !isRegister;
    loginForm.hidden = isRegister;

    authTitle.textContent = isRegister
        ? "Criar conta"
        : "Iniciar sessão";

    authDescription.textContent = isRegister
        ? "Preenche os teus dados para criares a tua conta."
        : "Introduz os teus dados de acesso.";

    authSwitch.textContent = isRegister
        ? "Já tens conta? Iniciar sessão"
        : "Ainda não tens conta? Criar conta";
}

function closeAuth() {
    authOverlay.hidden = true;
    authMessage.textContent = "";
}

document.querySelectorAll('[data-action="register"]')
    .forEach((button) => {
        button.addEventListener("click", () => {
            openAuth("register");
        });
    });

document.querySelectorAll('[data-action="login"]')
    .forEach((button) => {
        button.addEventListener("click", () => {
            openAuth("login");
        });
    });

authClose.addEventListener("click", closeAuth);

authOverlay.addEventListener("click", (event) => {
    if (event.target === authOverlay) {
        closeAuth();
    }
});

authSwitch.addEventListener("click", () => {
    openAuth(registerForm.hidden ? "register" : "login");
});


/* =========================================
   6. REGISTAR UM CLIENTE NO FIREBASE
   ========================================= */

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    authMessage.textContent = "";

    const fullName = registerForm.fullName.value.trim();
    const phone = registerForm.phone.value.trim();
    const city = registerForm.city.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value;
    const confirmPassword = registerForm.confirmPassword.value;

    if (password !== confirmPassword) {
        authMessage.textContent =
            "As palavras-passe não coincidem.";
        return;
    }

    if (fullName.length < 3 || phone.length < 6 || city.length < 2) {
        authMessage.textContent =
            "Verifica o nome, o telefone e a cidade.";
        return;
    }

    const submitButton = document.getElementById("registerSubmit");
    submitButton.disabled = true;
    submitButton.textContent = "A criar conta...";

    let createdUser = null;

    try {
        // Criar a conta através do Firebase Authentication.
        const credential = await createUserWithEmailAndPassword(
            auth,
            email,
            password
        );

        createdUser = credential.user;

        // Guardar apenas os dados do perfil, nunca a palavra-passe.
        await setDoc(doc(db, "users", createdUser.uid), {
            fullName,
            phone,
            city,
            email,
            role: "cliente",
            emailVerified: false,
            createdAt: serverTimestamp()
        });

// Enviar o link de verificação do email e registar o resultado.
console.log("A tentar enviar o email de verificação...");

await sendEmailVerification(createdUser);

console.log("O Firebase aceitou o pedido de envio do email.");

        authMessage.textContent =
            "Conta criada. Consulta o teu email e confirma o endereço antes de iniciares sessão.";

        registerForm.reset();

        // Terminar a sessão até o email ser verificado.
        await signOut(auth);

    } catch (error) {
        console.error("Erro no registo:", error);

        // Se o perfil não foi guardado, não deixamos uma conta
        // parcialmente criada ficar autenticada nesta sessão.
        if (createdUser) {
            try {
                await signOut(auth);
            } catch (signOutError) {
                console.error("Erro ao terminar sessão:", signOutError);
            }
        }

        const messages = {
            "auth/email-already-in-use":
                "Este email já está registado.",
            "auth/invalid-email":
                "O endereço de email não é válido.",
            "auth/weak-password":
                "Escolhe uma palavra-passe mais forte.",
            "auth/operation-not-allowed":
                "Ativa Email/Password nas opções de autenticação do Firebase.",
            "auth/network-request-failed":
                "Falha de ligação. Verifica a tua internet."
        };

        authMessage.textContent =
            messages[error.code] ||
            "Não foi possível concluir o registo. Tenta novamente.";
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Criar conta";
    }
});

// =========================================
// SALDO DEMONSTRATIVO DO CLIENTE
// =========================================

// Apenas para testes; não representa dinheiro real.
const saldoUSD = 0;
const saldoKz = saldoUSD * 1050;

/* =========================================
   7. INICIAR SESSÃO
   ========================================= */

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    authMessage.textContent = "";

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    const submitButton = loginForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "A verificar...";

    try {
        // Iniciar sessão no Firebase.
        const credential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        // Atualizar os dados de autenticação.
        await reload(credential.user);

        // Exigir email verificado.
        if (!credential.user.emailVerified) {
            await signOut(auth);

            authMessage.textContent =
                "Confirma o teu email através do link que recebeste antes de iniciares sessão.";

            return;
        }

        // Atualizar o token de autenticação.
        await credential.user.getIdToken(true);

        // Consultar o perfil no Firestore.
        const userRef = doc(db, "users", credential.user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            await signOut(auth);

            authMessage.textContent =
                "O perfil do cliente não foi encontrado. Contacta o suporte.";

            return;
        }

        const userData = userDoc.data();

        // Confirmar a verificação do email no perfil.
        await updateDoc(userRef, {
            emailVerified: true
        });

        // Obter o nome do cliente.
        const fullName =
            userData.fullName || "Cliente NGOLA-EXPRES";

        // Obter os elementos da página.
        const dashboard = document.getElementById("clientDashboard");
        const main = document.querySelector("main");
        const header = document.querySelector("header");
        const footer = document.querySelector("footer");

        // Confirmar que os elementos essenciais existem.
        if (!dashboard || !main || !header) {
            throw new Error(
                "Não foi possível localizar os elementos da página."
            );
        }

        // Apresentar os dados do cliente.
        document.getElementById("clientWelcome").textContent =
            `Bem-vindo, ${fullName}!`;

        document.getElementById("clientName").textContent =
            fullName;
            
            // Atualizar o nome apresentado no cartão digital.
document.getElementById("clientCardName").textContent =
    fullName.toUpperCase();

// =========================================
// Atualizar o saldo apresentado na carteira.
const clientBalanceElement =
    document.getElementById("clientBalance");

const clientKzBalanceElement =
    document.getElementById("clientKzBalance");

if (clientBalanceElement) {
    clientBalanceElement.textContent =
        saldoUSD.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " USD";
}

if (clientKzBalanceElement) {
    clientKzBalanceElement.textContent =
        saldoKz.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " Kz";
}
        document.getElementById("clientEmail").textContent =
            userData.email || credential.user.email;

        // Esconder a página inicial.
        main.hidden = true;

        // Esconder o cabeçalho público.
        header.hidden = true;

        // Esconder o rodapé público, se existir.
        if (footer) {
            footer.hidden = true;
        }

        // Mostrar apenas a área privada.
        dashboard.hidden = false;

        // Fechar a janela de autenticação.
        closeAuth();

        // Ir para o início do painel.
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // Confirmar o início de sessão.
        showMessage("Sessão iniciada com sucesso.");

    } catch (error) {
        console.error("Erro no início de sessão:", error);

        const messages = {
            "auth/invalid-credential":
                "Email ou palavra-passe incorretos.",

            "auth/invalid-email":
                "O endereço de email não é válido.",

            "auth/too-many-requests":
                "Demasiadas tentativas. Aguarda e tenta novamente.",

            "auth/network-request-failed":
                "Falha de ligação. Verifica a tua internet.",

            "permission-denied":
                "Não tens autorização para consultar ou atualizar o perfil."
        };

        authMessage.textContent =
            messages[error.code] ||
            error.message ||
            "Não foi possível iniciar sessão. Tenta novamente.";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Iniciar sessão";
    }
});
/* =========================================
   8. BOTÃO DO MENU
   ========================================= */

if (menuButton) {
    menuButton.addEventListener("click", () => {
        const expanded =
            menuButton.getAttribute("aria-expanded") === "true";

        menuButton.setAttribute(
            "aria-expanded",
            String(!expanded)
        );

        showMessage(
            expanded
                ? "Menu fechado."
                : "A navegação será adicionada na próxima etapa."
        );
    });
}

/* =========================================
   9. TERMINAR SESSÃO DO CLIENTE
   ========================================= */

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            await signOut(auth);

            const dashboard =
                document.getElementById("clientDashboard");

            const main = document.querySelector("main");
            const header = document.querySelector("header");
            const footer = document.querySelector("footer");

            if (dashboard) dashboard.hidden = true;
            if (main) main.hidden = false;
            if (header) header.hidden = false;
            if (footer) footer.hidden = false;

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            showMessage("Sessão terminada com sucesso.");

        } catch (error) {
            console.error("Erro ao terminar sessão:", error);

            showMessage(
                "Não foi possível terminar a sessão. Tenta novamente."
            );

        } finally {
            logoutButton.disabled = false;
        }
    });
}

/* =========================================
   10. MOSTRAR E OCULTAR PALAVRAS-PASSE
   ========================================= */

document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const inputId = button.dataset.passwordTarget;
        const passwordInput = document.getElementById(inputId);

        if (!passwordInput) return;

        const isHidden = passwordInput.type === "password";

        passwordInput.type = isHidden ? "text" : "password";

        button.textContent = isHidden ? "Ocultar" : "Mostrar";
    });
});

/* =========================================
   11. ABRIR E FECHAR A JANELA DE LEVANTAMENTO
   ========================================= */

const withdrawButton =
    document.getElementById("withdrawBalanceButton");

const withdrawModal =
    document.getElementById("withdrawModal");

const closeWithdrawButton =
    document.getElementById("closeWithdraw");

const withdrawAmountInput =
    document.getElementById("withdrawAmount");

const withdrawKzInput =
    document.getElementById("withdrawKz");

const withdrawContinueButton =
    document.getElementById("withdrawContinue");

const withdrawMessage =
    document.getElementById("withdrawMessage");

const WITHDRAW_RATE = 1050;
const WITHDRAW_DAILY_LIMIT = 200;

const WITHDRAW_MIN_AMOUNT = 5;
const withdrawAvailableBalance = document.getElementById("withdrawAvailableBalance");
const withdrawValidationMessage = document.getElementById("withdrawValidationMessage");

/* Abrir a janela de levantamento. */
function openWithdrawModal() {
    if (!withdrawModal) return;

    withdrawModal.hidden = false;

// Atualizar o saldo disponível
if (withdrawAvailableBalance) {
    withdrawAvailableBalance.textContent =
        `${saldoUSD.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} USD`;
}

// Limpar a mensagem de validação anterior
if (withdrawValidationMessage) {
    withdrawValidationMessage.textContent = "";
}

document.body.style.overflow = "hidden";
    
    if (withdrawAmountInput) {
        withdrawAmountInput.value = "";
    }

    if (withdrawKzInput) {
        withdrawKzInput.value = "";
    }

    if (withdrawContinueButton) {
        withdrawContinueButton.disabled = true;
    }

    if (withdrawMessage) {
    withdrawMessage.textContent = "";
}

if (withdrawAmountStep) {
    withdrawAmountStep.hidden = false;
}

if (withdrawMethodStep) {
    withdrawMethodStep.hidden = true;
}

if (withdrawDetailsStep) {
    withdrawDetailsStep.hidden = true;
}

if (withdrawConfirmationStep) {
    withdrawConfirmationStep.hidden = true;
}

    withdrawAmountInput?.focus();
}

/* Fechar a janela de levantamento. */
function closeWithdrawModal() {
    if (!withdrawModal) return;

    withdrawModal.hidden = true;
    document.body.style.overflow = "";
}

/* Ligar o botão de levantamento. */
if (withdrawButton) {
    withdrawButton.addEventListener(
        "click",
        openWithdrawModal
    );
}


/* Fechar através do botão X. */
if (closeWithdrawButton) {
    closeWithdrawButton.addEventListener(
        "click",
        closeWithdrawModal
    );
}


/* Fechar ao tocar fora da janela. */
if (withdrawModal) {
    withdrawModal.addEventListener("click", (event) => {
        if (event.target === withdrawModal) {
            closeWithdrawModal();
        }
    });
}


/* Fechar com a tecla Escape. */
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        withdrawModal &&
        !withdrawModal.hidden
    ) {
        closeWithdrawModal();
    }
});


/* Calcular o equivalente em Kz e validar o valor introduzido. */
if (withdrawAmountInput) {
    withdrawAmountInput.addEventListener("input", () => {
        const amount = Number(withdrawAmountInput.value);

        // Atualizar o saldo disponível
        if (withdrawAvailableBalance) {
            withdrawAvailableBalance.textContent =
                `${saldoUSD.toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })} USD`;
        }

        // Calcular o valor equivalente em Kz
        if (withdrawKzInput) {
            withdrawKzInput.value =
                Number.isFinite(amount) && amount > 0
                    ? `${(amount * WITHDRAW_RATE).toLocaleString("pt-PT", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })} Kz`
                    : "";
        }

        // Validar o valor introduzido
        let mensagem = "";

        if (withdrawAmountInput.value.trim() === "" || !Number.isFinite(amount)) {
            mensagem = "";
        } else if (amount < WITHDRAW_MIN_AMOUNT) {
            mensagem = "O valor mínimo para levantamento é 5 USD.";
        } else if (amount > saldoUSD) {
            mensagem = `Saldo insuficiente. O teu saldo disponível é ${saldoUSD.toFixed(2)} USD.`;
        } else if (amount > WITHDRAW_DAILY_LIMIT) {
            mensagem = `O limite diário de levantamento é ${WITHDRAW_DAILY_LIMIT} USD.`;
        }

        if (withdrawValidationMessage) {
            withdrawValidationMessage.textContent = mensagem;
        }

        // Só permitir continuar com um valor válido
        if (withdrawContinueButton) {
            withdrawContinueButton.disabled =
                withdrawAmountInput.value.trim() === "" ||
                !Number.isFinite(amount) ||
                amount < WITHDRAW_MIN_AMOUNT ||
                amount > saldoUSD ||
                amount > WITHDRAW_DAILY_LIMIT;
        }
    });
}

/* Validar o saldo antes de avançar. */
if (withdrawContinueButton) {
    withdrawContinueButton.addEventListener("click", () => {
        const amount = Number(withdrawAmountInput?.value);

        /* Validar o valor introduzido. */
        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > WITHDRAW_DAILY_LIMIT
        ) {
            if (withdrawMessage) {
                withdrawMessage.textContent =
                    "Introduz um valor válido até 200 USD.";
            }

            return;
        }

        /* Verificar o saldo disponível. */
        if (amount > saldoUSD) {
            if (withdrawMessage) {
                withdrawMessage.textContent =
                    "Saldo insuficiente para este levantamento.";
            }

            return;
        }

        /* Exigir um saldo superior a 5 USD. */
        if (saldoUSD <= 5) {
            if (withdrawMessage) {
                withdrawMessage.textContent =
                    "A carteira precisa de ter mais de 5 USD para permitir levantamentos.";
            }

            return;
        }

        /* Avançar para a seleção do método. */
        if (withdrawAmountStep && withdrawMethodStep) {
            withdrawAmountStep.hidden = true;
            withdrawMethodStep.hidden = false;
        }

        if (withdrawMessage) {
            withdrawMessage.textContent = "";
        }

        if (withdrawMethodMessage) {
            withdrawMethodMessage.textContent = "";
        }
    });
}
/* =========================================
   12. NAVEGAÇÃO ENTRE ETAPAS DO LEVANTAMENTO
   ========================================= */

const withdrawAmountStep =
    document.getElementById("withdrawAmountStep");

const withdrawMethodStep =
    document.getElementById("withdrawMethodStep");

const withdrawBackButton =
    document.getElementById("withdrawBackButton");

if (withdrawBackButton) {
    withdrawBackButton.addEventListener("click", () => {
        if (withdrawAmountStep && withdrawMethodStep) {
            withdrawMethodStep.hidden = true;
            withdrawAmountStep.hidden = false;
        }

        if (withdrawMethodMessage) {
            withdrawMethodMessage.textContent = "";
        }
    });
}

document.querySelectorAll(".withdraw-method-button").forEach((button) => {
    button.addEventListener("click", () => {
        const method = button.dataset.method;

        if (withdrawMethodMessage) {
            withdrawMethodMessage.textContent =
                `Selecionaste ${method}. A introdução dos dados de recebimento será implementada no próximo passo.`;
        }
    });
});

/* =========================================
   13. SELEÇÃO DO MÉTODO E DADOS DE RECEBIMENTO
   ========================================= */

const withdrawDetailsStep =
    document.getElementById("withdrawDetailsStep");

const withdrawBankFields =
    document.getElementById("withdrawBankFields");

const withdrawExpressFields =
    document.getElementById("withdrawExpressFields");

const withdrawDetailsTitle =
    document.getElementById("withdrawDetailsTitle");

const withdrawDetailsMessage =
    document.getElementById("withdrawDetailsMessage");

let selectedWithdrawMethod = null;

document.querySelectorAll(".withdraw-method-button").forEach((button) => {
    button.addEventListener("click", () => {
        selectedWithdrawMethod = button.dataset.method;

        if (
            !withdrawMethodStep ||
            !withdrawDetailsStep ||
            !withdrawBankFields ||
            !withdrawExpressFields
        ) {
            return;
        }

        withdrawMethodStep.hidden = true;
        withdrawDetailsStep.hidden = false;

        withdrawBankFields.hidden =
            selectedWithdrawMethod === "EXPRESS";

        withdrawExpressFields.hidden =
            selectedWithdrawMethod !== "EXPRESS";

        if (withdrawDetailsTitle) {
            withdrawDetailsTitle.textContent =
                selectedWithdrawMethod === "EXPRESS"
                    ? "Dados do N.º EXPRESS"
                    : `Dados bancários — ${selectedWithdrawMethod}`;
        }

        if (withdrawDetailsMessage) {
            withdrawDetailsMessage.textContent = "";
        }
    });
});

/* =========================================
   14. VALIDAR DADOS DE RECEBIMENTO
   ========================================= */

const withdrawIban =
    document.getElementById("withdrawIban");

const withdrawAccountHolder =
    document.getElementById("withdrawAccountHolder");

const withdrawExpressPhone =
    document.getElementById("withdrawExpressPhone");

const withdrawReviewButton =
    document.getElementById("withdrawReviewButton");


/* =========================================
   15. REVISÃO DOS DADOS DO LEVANTAMENTO
   ========================================= */

const withdrawConfirmationStep =
    document.getElementById("withdrawConfirmationStep");

const withdrawEditButton =
    document.getElementById("withdrawEditButton");

const reviewWithdrawUSD =
    document.getElementById("reviewWithdrawUSD");

const reviewWithdrawKz =
    document.getElementById("reviewWithdrawKz");

const reviewWithdrawMethod =
    document.getElementById("reviewWithdrawMethod");

const reviewWithdrawDetails =
    document.getElementById("reviewWithdrawDetails");

const withdrawConfirmationMessage =
    document.getElementById("withdrawConfirmationMessage");

const withdrawSubmitButton =
    document.getElementById("withdrawSubmitButton");

/* =========================================
   VALIDAR OS DADOS E REVER O LEVANTAMENTO
   ========================================= */

if (withdrawReviewButton) {
    withdrawReviewButton.addEventListener("click", () => {

        // Validar o método de recebimento
        if (!selectedWithdrawMethod) {
            if (withdrawDetailsMessage) {
                withdrawDetailsMessage.textContent =
                    "Seleciona primeiro um método de recebimento.";
            }
            return;
        }

        let details = "";

        // Validar BAI ou BFA
        if (
            selectedWithdrawMethod === "BAI" ||
            selectedWithdrawMethod === "BFA"
        ) {
            const ibanRestante =
                withdrawIban?.value.trim().replace(/\s/g, "") || "";

            const titular =
                withdrawAccountHolder?.value.trim() || "";

            if (!ibanRestante || !titular) {
                withdrawDetailsMessage.textContent =
                    "Preenche o IBAN e o nome do titular da conta.";
                return;
            }

            if (!/^[A-Za-z0-9]+$/.test(ibanRestante)) {
                withdrawDetailsMessage.textContent =
                    "O IBAN contém caracteres inválidos.";
                return;
            }

            if (ibanRestante.length !== 21) {
                withdrawDetailsMessage.textContent =
                    "Depois do prefixo AO06, introduz os restantes 21 caracteres.";
                return;
            }

            if (titular.length < 3) {
                withdrawDetailsMessage.textContent =
                    "Introduz o nome completo do titular da conta.";
                return;
            }

            details = `${titular} — IBAN: AO06${ibanRestante}`;

        } else if (selectedWithdrawMethod === "EXPRESS") {

            // Validar número EXPRESS
            const telefone =
                withdrawExpressPhone?.value.trim() || "";

            if (!/^\+244\s?9\d{2}\s?\d{3}\s?\d{3}$/.test(telefone)) {
                withdrawDetailsMessage.textContent =
                    "Introduz um número EXPRESS válido no formato +244 9XX XXX XXX.";
                return;
            }

            details = telefone;

        } else {
            withdrawDetailsMessage.textContent =
                "O método selecionado não é válido.";
            return;
        }

        // Validar o valor do levantamento
        const amount = Number(withdrawAmountInput?.value);

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > WITHDRAW_DAILY_LIMIT
        ) {
            withdrawDetailsMessage.textContent =
                "O valor do levantamento não é válido. Volta e corrige-o.";
            return;
        }

        // Verificar o saldo demonstrativo
        if (amount > saldoUSD || saldoUSD <= 5) {
            withdrawDetailsMessage.textContent =
                "Saldo insuficiente. Não podes avançar com este levantamento.";
            return;
        }

        // Preencher o resumo do levantamento
        if (reviewWithdrawUSD) {
            reviewWithdrawUSD.textContent =
                amount.toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " USD";
        }

        if (reviewWithdrawKz) {
            reviewWithdrawKz.textContent =
                (amount * WITHDRAW_RATE).toLocaleString("pt-PT", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + " Kz";
        }

        if (reviewWithdrawMethod) {
            reviewWithdrawMethod.textContent =
                selectedWithdrawMethod;
        }

        if (reviewWithdrawDetails) {
            reviewWithdrawDetails.textContent = details;
        }

        // Abrir a revisão depois das validações
        if (withdrawDetailsStep && withdrawConfirmationStep) {
            withdrawDetailsStep.hidden = true;
            withdrawConfirmationStep.hidden = false;
        }

        if (withdrawDetailsMessage) {
            withdrawDetailsMessage.textContent = "";
        }

        if (withdrawConfirmationMessage) {
            withdrawConfirmationMessage.textContent = "";
        }
    });
}

/* Voltar para corrigir os dados. */
if (withdrawEditButton) {
    withdrawEditButton.addEventListener("click", () => {

        if (withdrawConfirmationStep && withdrawDetailsStep) {
            withdrawConfirmationStep.hidden = true;
            withdrawDetailsStep.hidden = false;
        }

        if (withdrawConfirmationMessage) {
            withdrawConfirmationMessage.textContent = "";
        }
    });
}


/* =========================================
   CONFIRMAÇÃO FINANCEIRA DESATIVADA
   ========================================= */

if (withdrawSubmitButton) {
    withdrawSubmitButton.addEventListener("click", () => {

        if (withdrawConfirmationMessage) {
            withdrawConfirmationMessage.textContent =
                "O envio de pedidos ainda não está disponível. Nenhum pedido foi enviado e nenhum saldo foi movimentado.";
        }
    });
}

/* =========================================
   NGOLA-EXPRES — ACESSO E INSCRIÇÃO DE AGENTES
   ========================================= */

const agentAccessButton = document.getElementById("agentAccessButton");
const agentAccessOverlay = document.getElementById("agentAccessOverlay");
const agentAccessClose = document.getElementById("agentAccessClose");

const agentAccessOptions = document.getElementById("agentAccessOptions");
const agentRegisterButton = document.getElementById("agentRegisterButton");
const agentRegisterForm = document.getElementById("agentRegisterForm");
const agentBackToOptions = document.getElementById("agentBackToOptions");

function openAgentAccessModal() {
    if (!agentAccessOverlay || !agentAccessButton) return;

    agentAccessOptions.hidden = false;
    agentRegisterForm.hidden = true;
    agentAccessOverlay.hidden = false;

    agentAccessButton.setAttribute("aria-expanded", "true");

    if (agentAccessClose) {
        agentAccessClose.focus();
    }
}

function closeAgentAccessModal() {
    if (!agentAccessOverlay || !agentAccessButton) return;

    agentAccessOverlay.hidden = true;
    agentAccessButton.setAttribute("aria-expanded", "false");
    agentAccessButton.focus();
}

if (agentAccessButton) {
    agentAccessButton.addEventListener("click", openAgentAccessModal);
}

if (agentAccessClose) {
    agentAccessClose.addEventListener("click", closeAgentAccessModal);
}

if (agentAccessOverlay) {
    agentAccessOverlay.addEventListener("click", (event) => {
        if (event.target === agentAccessOverlay) {
            closeAgentAccessModal();
        }
    });
}

if (agentRegisterButton) {
    agentRegisterButton.addEventListener("click", () => {
        agentAccessOptions.hidden = true;
        agentRegisterForm.hidden = false;

        const firstField = document.getElementById("agentFullName");
        if (firstField) firstField.focus();
    });
}
/* Abrir o formulário de início de sessão dos agentes */

const agentLoginButton = document.getElementById("agentLoginButton");
const agentLoginForm = document.getElementById("agentLoginForm");
const agentLoginBack = document.getElementById("agentLoginBack");

if (agentLoginButton && agentLoginForm) {
    agentLoginButton.addEventListener("click", () => {
        agentAccessOptions.hidden = true;
        agentRegisterForm.hidden = true;
        agentLoginForm.hidden = false;

        const emailField = document.getElementById("agentLoginEmail");

        if (emailField) {
            emailField.focus();
        }
    });
}

if (agentLoginBack && agentLoginForm) {
    agentLoginBack.addEventListener("click", () => {
        agentLoginForm.hidden = true;
        agentAccessOptions.hidden = false;
        agentLoginButton.focus();
    });
}



if (agentBackToOptions) {
    agentBackToOptions.addEventListener("click", () => {
        agentRegisterForm.hidden = true;
        agentAccessOptions.hidden = false;
        agentRegisterButton.focus();
    });
}

document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        agentAccessOverlay &&
        !agentAccessOverlay.hidden
    ) {
        closeAgentAccessModal();
    }
});

/* =========================================
   NGOLA-EXPRES — REGISTO DE AGENTES NO FIREBASE
   ========================================= */

const agentRegisterMessage = document.getElementById(
    "agentRegisterMessage"
);

const agentRegisterSubmit = document.getElementById(
    "agentRegisterSubmit"
);

if (agentRegisterForm) {
    agentRegisterForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!agentRegisterMessage || !agentRegisterSubmit) {
            return;
        }

        agentRegisterMessage.textContent = "";

        const fullName = document
            .getElementById("agentFullName")
            .value.trim();

        const phone = document
            .getElementById("agentPhone")
            .value.trim();

        const biNumber = document
            .getElementById("agentBI")
            .value.trim();

        const email = document
            .getElementById("agentEmail")
            .value.trim();

        const password = document
            .getElementById("agentPassword")
            .value;

        // Validar o nome completo
        if (fullName.length < 3) {
            agentRegisterMessage.textContent =
                "Introduz o nome completo conforme o BI.";
            return;
        }

        // Validar o telefone angolano
        if (!/^[0-9]{9}$/.test(phone)) {
            agentRegisterMessage.textContent =
                "Introduz um número de telefone válido com 9 dígitos.";
            return;
        }

        // Validar o número do BI
        if (biNumber.length < 5) {
            agentRegisterMessage.textContent =
                "Verifica o número do BI.";
            return;
        }

        // Palavra-passe: pelo menos 6 caracteres,
        // uma letra, um número e um carácter especial
        const strongPassword =
            /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{6,}$/;

        if (!strongPassword.test(password)) {
            agentRegisterMessage.textContent =
                "A palavra-passe deve ter pelo menos 6 caracteres, incluindo uma letra, um número e um carácter especial.";
            return;
        }

        agentRegisterSubmit.disabled = true;
        agentRegisterSubmit.textContent = "A ENVIAR CANDIDATURA...";

        let createdUser = null;

        try {
            // Criar a conta de autenticação
            const credential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            createdUser = credential.user;

            // Criar o perfil do agente pendente de aprovação
            await setDoc(doc(db, "users", createdUser.uid), {
                fullName: fullName,
                phone: "+244" + phone,
                biNumber: biNumber,
                email: email,
                role: "agente",
                status: "inactive",
                emailVerified: false,
                createdAt: serverTimestamp()
            });

            // Terminar a sessão para não deixar
            // o novo agente automaticamente ligado
            await signOut(auth);

            agentRegisterMessage.textContent =
                "Candidatura enviada com sucesso. Aguarda a ativação pelo administrador.";

            agentRegisterForm.reset();

        } catch (error) {
            console.error(
                "Erro no registo do agente:",
                error
            );

            // Se a conta foi criada, terminar a sessão
            if (createdUser) {
                try {
                    await signOut(auth);
                } catch (signOutError) {
                    console.error(
                        "Erro ao terminar sessão:",
                        signOutError
                    );
                }
            }

            const messages = {
                "auth/email-already-in-use":
                    "Este e-mail já está registado. Utiliza outro e-mail.",

                "auth/invalid-email":
                    "O endereço de e-mail não é válido.",

                "auth/weak-password":
                    "A palavra-passe é demasiado fraca.",

                "auth/operation-not-allowed":
                    "Ativa o método E-mail/Palavra-passe nas opções de autenticação do Firebase.",

                "auth/network-request-failed":
                    "Falha de ligação. Verifica a tua internet."
            };

            agentRegisterMessage.textContent =
                messages[error.code] ||
                "Não foi possível concluir a candidatura. Tenta novamente.";
       } finally {
            agentRegisterSubmit.disabled = false;
            agentRegisterSubmit.textContent =
                "ENVIAR CANDIDATURA";
        }
    });
}

/* =========================================
   8. INÍCIO DE SESSÃO DOS AGENTES
   NGOLA-EXPRES
   ========================================= */

const agentLoginMessage = document.getElementById("agentLoginMessage");
const agentLoginSubmit = document.getElementById("agentLoginSubmit");

if (agentLoginForm) {
    agentLoginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (agentLoginMessage) {
            agentLoginMessage.textContent = "";
        }

        const email = document
            .getElementById("agentLoginEmail")
            .value.trim();

        const telefoneIntroduzido = document
            .getElementById("agentLoginPhone")
            .value.replace(/\D/g, "");

        const password = document
            .getElementById("agentLoginPassword")
            .value;

        if (agentLoginSubmit) {
            agentLoginSubmit.disabled = true;
            agentLoginSubmit.textContent = "A verificar...";
        }

        let autenticado = false;

        try {
            // 1. Autenticar com o Firebase.
            const credenciais = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            autenticado = true;

            const utilizador = credenciais.user;

            // 2. Consultar o perfil do agente.
            const referenciaPerfil = doc(db, "users", utilizador.uid);
            const documentoPerfil = await getDoc(referenciaPerfil);

            if (!documentoPerfil.exists()) {
                throw new Error("perfil_inexistente");
            }

            const perfil = documentoPerfil.data();

            // 3. Confirmar que a conta pertence a um agente.
            if (perfil.role !== "agente") {
                throw new Error("perfil_nao_agente");
            }

            // 4. Verificar o telefone registado.
            const telefoneRegistado = String(perfil.phone || "")
                .replace(/\D/g, "");

            const telefoneNormalizado = telefoneRegistado.startsWith("244")
                ? telefoneRegistado.slice(3)
                : telefoneRegistado;

            if (telefoneNormalizado !== telefoneIntroduzido) {
                throw new Error("telefone_incorreto");
            }

            // 5. Só permitir acesso a contas ativadas.
            if (perfil.status !== "active") {
                throw new Error(
                    perfil.status === "blocked"
                        ? "conta_bloqueada"
                        : "conta_nao_ativada"
                );
            }

            // 6. Os agentes não precisam de verificar o email.
// A entrada depende da validação do perfil,
// do telefone e da ativação pelo GERENTE ADM.

            /*
             * A autenticação foi validada.
             * O painel privado será aberto quando estiver
             * implementado e identificado no HTML.
             */
            // 6. Acesso confirmado: abrir o painel privado do agente.
if (agentLoginMessage) {
    agentLoginMessage.textContent = "Acesso confirmado. A abrir o painel...";
}

window.location.href = "agentes.html";
return;

        } catch (erro) {
            console.error("Erro no acesso do agente:", erro);

            if (autenticado) {
                try {
                    await signOut(auth);
                } catch (erroSaida) {
                    console.error(
                        "Erro ao terminar sessão:",
                        erroSaida
                    );
                }
            }

            const mensagens = {
                perfil_inexistente:
                    "Não foi encontrado o perfil desta conta.",
                perfil_nao_agente:
                    "Esta conta não está registada como agente.",
                telefone_incorreto:
                    "O número de telefone não corresponde ao registado.",
                conta_bloqueada:
                    "A tua conta está bloqueada. Contacta o administrador.",
                conta_nao_ativada:
                    "A tua conta ainda não foi ativada pelo GERENTE ADM.",
                "auth/invalid-credential":
                    "E-mail ou palavra-passe incorretos.",
                "auth/invalid-email":
                    "O formato do e-mail é inválido.",
                "auth/too-many-requests":
                    "Demasiadas tentativas. Tenta novamente mais tarde."
            };

            if (agentLoginMessage) {
                agentLoginMessage.textContent =
                    mensagens[erro.message] ||
                    mensagens[erro.code] ||
                    "Não foi possível iniciar sessão. Tenta novamente.";
            }

        } finally {
            // Nunca deixar o botão preso no processamento.
            if (agentLoginSubmit) {
                agentLoginSubmit.disabled = false;
                agentLoginSubmit.textContent = "ENTRAR";
            }
        }
    });
}

/* =========================================
   CARREGAR CARTEIRA CLIENTE — NGOLA-EXPRES
   ETAPA 1: VALOR EM USD E CONVERSÃO PARA KZ
   ========================================= */

(() => {
    // Evitar inicializar o mesmo código duas vezes.
    if (document.getElementById("buyWalletModal")) {
        return;
    }

    const buyButton = document.getElementById("buyBalanceButton");

    if (!buyButton) {
        console.error(
            "NGOLA-EXPRES: botão buyBalanceButton não encontrado."
        );
        return;
    }

    // // =========================================
// CONFIGURAÇÃO DO CARREGAMENTO DA CARTEIRA
// =========================================

const TAXA_COMPRA_USD_KZ = 1125;
const VALOR_MINIMO_USD = 5;
const VALOR_MAXIMO_USD = 1000;
   
    // Criar a janela de carregamento.
    const modal = document.createElement("div");

    modal.id = "buyWalletModal";

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0, 0, 0, 0.75);
        box-sizing: border-box;
    `;

    modal.innerHTML = `
        <section style="
            width: 100%;
            max-width: 420px;
            padding: 24px;
            border-radius: 18px;
            background: #ffffff;
            color: #071a35;
            box-sizing: border-box;
            box-shadow: 0 15px 45px rgba(0,0,0,0.3);
        " role="dialog"
           aria-modal="true"
           aria-labelledby="buyWalletTitle">

            <button type="button"
                id="closeBuyWallet"
                aria-label="Fechar janela"
                style="
                    float: right;
                    border: none;
                    background: transparent;
                    font-size: 28px;
                    cursor: pointer;
                    color: #071a35;
                ">
                &times;
            </button>

            <h2 id="buyWalletTitle"
                style="margin: 0 0 12px;">
                Carregar carteira
            </h2>

            <p style="color: #526174; font-size: 14px;">
                Introduz o valor que pretendes carregar
                na tua carteira NGOLA-EXPRES.
            </p>

            <div style="
                padding: 12px;
                margin-bottom: 18px;
                border-radius: 10px;
                background: #edf4ff;
                font-size: 14px;
            ">
                Taxa do momento:
                <strong>1 USD = 1.125 Kz</strong>
            </div>

            <label for="buyWalletUSD"
                style="display:block; margin-bottom:8px;">
                Valor a carregar (USD)
            </label>

            <input
                type="number"
                id="buyWalletUSD"
                min="0.01"
                step="0.01"
                inputmode="decimal"
                placeholder="Ex.: 10,00"
                style="
                    display: block;
                    width: 100%;
                    padding: 14px;
                    margin-bottom: 16px;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    box-sizing: border-box;
                    font-size: 16px;
                "
            >

            <label for="buyWalletKZ"
                style="display:block; margin-bottom:8px;">
                Equivalente em Kz
            </label>

            <input
                type="text"
                id="buyWalletKZ"
                placeholder="0,00 Kz"
                readonly
                style="
                    display: block;
                    width: 100%;
                    padding: 14px;
                    margin-bottom: 18px;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    box-sizing: border-box;
                    background: #f1f5f9;
                    font-size: 16px;
                "
            >

            <p id="buyWalletMessage"
                role="status"
                aria-live="polite"
                style="font-size: 13px; color: #b42318;">
            </p>

            <button type="button"
                id="buyWalletNext"
                disabled
                style="
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    background: #0b65d8;
                    color: white;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    opacity: 0.5;
                ">
                Avançar
            </button>

        </section>
    `;

    document.body.appendChild(modal);

    const amountInput = modal.querySelector("#buyWalletUSD");
    const kzInput = modal.querySelector("#buyWalletKZ");
    const nextButton = modal.querySelector("#buyWalletNext");
    const message = modal.querySelector("#buyWalletMessage");
    const closeButton = modal.querySelector("#closeBuyWallet");

    // Formatar valores em Kz.
    const formatKz = (valor) => {
        return valor.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " Kz";
    };

    // Abrir a janela ao clicar em Carregar carteira.
    buyButton.addEventListener("click", () => {
        amountInput.value = "";
        kzInput.value = "";
        message.textContent = "";

        nextButton.disabled = true;
        nextButton.style.opacity = "0.5";

        modal.style.display = "flex";
        amountInput.focus();
    });

// =========================================
// VALIDAR VALOR E CONVERTER USD PARA KZ
// Mínimo: 5 USD | Máximo: 1000 USD
// =========================================

amountInput.min = String(VALOR_MINIMO_USD);
amountInput.max = String(VALOR_MAXIMO_USD);
amountInput.step = "0.01";

amountInput.addEventListener("input", () => {
    const valorUSD = Number(amountInput.value);

    const valorValido =
        amountInput.value.trim() !== "" &&
        Number.isFinite(valorUSD) &&
        valorUSD >= VALOR_MINIMO_USD &&
        valorUSD <= VALOR_MAXIMO_USD;

    if (valorValido) {
        const valorKz = valorUSD * TAXA_COMPRA_USD_KZ;

        kzInput.value = formatKz(valorKz);

        nextButton.disabled = false;
        nextButton.style.opacity = "1";

        message.style.color = "#16803c";
        message.textContent = "Valor válido. Podes avançar.";
    } else {
        kzInput.value = "";

        nextButton.disabled = true;
        nextButton.style.opacity = "0.5";

        message.style.color = "#b42318";

        if (amountInput.value.trim() === "") {
            message.textContent =
                "Introduz um valor entre 5 USD e 1000 USD.";
        } else if (valorUSD < VALOR_MINIMO_USD) {
            message.textContent =
                "O valor mínimo para carregar é 5 USD.";
        } else {
            message.textContent =
                "O valor máximo para carregar é 1000 USD.";
        }
    }
});
    // Fechar a janela.
    closeButton.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Fechar ao tocar fora da janela.
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

    // Fechar com a tecla Escape.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.style.display === "flex") {
            modal.style.display = "none";
        }
    });

// =========================================
// AVANÇAR PARA ESCOLHER O MÉTODO DE PAGAMENTO
// =========================================

nextButton.addEventListener("click", () => {
    const valorUSD = Number(amountInput.value);

    // Validar o valor introduzido
    if (
        !Number.isFinite(valorUSD) ||
        valorUSD < VALOR_MINIMO_USD ||
        valorUSD > VALOR_MAXIMO_USD
    ) {
        message.style.color = "#b42318";
        message.textContent =
            "O valor deve estar entre 5 USD e 1000 USD.";

        nextButton.disabled = true;
        return;
    }

    // Guardar os valores do carregamento
    window.ngolaWalletTopUp = {
        amountUSD: Math.round(valorUSD * 100) / 100,
        amountKz: Math.round(
            valorUSD * TAXA_COMPRA_USD_KZ * 100
        ) / 100
    };

// =========================================
// LOCALIZAR O CONTEÚDO REAL DO MODAL
// =========================================

const modalContent = document.querySelector(
    '#buyWalletModal [role="dialog"]'
);

if (!modalContent) {
    message.style.color = "#b42318";
    message.textContent =
        "Não foi possível localizar o conteúdo do carregamento.";
    return;
}

    // Evitar criar a mesma secção mais de uma vez
    let paymentSection = document.getElementById(
        "buyWalletPaymentSection"
    );

    if (!paymentSection) {
        paymentSection = document.createElement("div");
        paymentSection.id = "buyWalletPaymentSection";

        paymentSection.innerHTML = `
            <hr style="margin:20px 0;border:0;border-top:1px solid #ddd;">

            <h3 style="margin-bottom:12px;">
                Escolhe o método de pagamento
            </h3>

            <p style="margin-bottom:12px;">
                Valor: <strong id="buyWalletPaymentUSD"></strong>
                USD —
                <strong id="buyWalletPaymentKZ"></strong> Kz
            </p>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
                <button type="button" data-payment="BAI">BAI</button>
                <button type="button" data-payment="BFA">BFA</button>
                <button type="button" data-payment="EXPRESS">EXPRESS</button>
            </div>

            <div id="buyWalletPaymentDetails"></div>
        `;

        modalContent.appendChild(paymentSection);

        // Selecionar o método e mostrar os dados correspondentes
        paymentSection
            .querySelectorAll("[data-payment]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    const metodo = button.dataset.payment;
                    const details = document.getElementById(
                        "buyWalletPaymentDetails"
                    );

                    const dadosPagamento = {
                        BAI: {
                            tipo: "IBAN",
                            valor: "0040 0000 63984434101 58",
                            titular: "JOAQUIM CHILALA TCHIPILICA"
                        },
                        BFA: {
                            tipo: "IBAN",
                            valor: "6000600001052157030188",
                            titular: "CECÍLIA SANDAMEULA"
                        },
                        EXPRESS: {
                            tipo: "Número EXPRESS",
                            valor: "923354933",
                            titular: ""
                        }
                    };

                    const dados = dadosPagamento[metodo];

                    // Guardar o método escolhido
                    window.ngolaWalletTopUp.metodoPagamento = metodo;

                    details.innerHTML = `
                        <div style="padding:12px;border:1px solid #ddd;border-radius:8px;margin-bottom:12px;">
                            <p><strong>${dados.tipo}:</strong></p>
                            <p style="overflow-wrap:anywhere;">
                                ${dados.valor}
                            </p>

                            ${
                                dados.titular
                                    ? `
                                        <p style="margin-top:8px;">
                                            <strong>Titular:</strong>
                                            ${dados.titular}
                                        </p>
                                    `
                                    : ""
                            }
                        </div>

                        <div style="
                            background:#c62828;
                            color:#fff;
                            padding:8px;
                            border-radius:5px;
                            font-size:10px;
                            line-height:1.4;
                            margin-bottom:14px;
                        ">
                            Não uses outros dados bancários fornecidos por colaboradores.
                            Usa exclusivamente os dados fornecidos aqui.
                            O teu pagamento será revisto e validado pelos serviços da NGOLA-EXPRES.
                        </div>

                        <label for="buyWalletTransactionID">
                            ID da transação/operação que está no seu comprovativo
                        </label>

                        <input
                            type="text"
                            id="buyWalletTransactionID"
                            inputmode="numeric"
                            autocomplete="off"
                            maxlength="9"
                            placeholder="Introduz o ID da transação"
                            style="width:100%;box-sizing:border-box;margin:8px 0 12px;padding:10px;"
                        >

                        <button
                            type="button"
                            id="buyWalletFinish"
                            disabled
                            style="width:100%;opacity:0.5;"
                        >
                            Concluir
                        </button>

                        <p
                            id="buyWalletFinishMessage"
                            style="margin-top:10px;font-size:12px;"
                            aria-live="polite"
                        ></p>
                    `;

                    const transactionInput = document.getElementById(
                        "buyWalletTransactionID"
                    );
                    const finishButton = document.getElementById(
                        "buyWalletFinish"
                    );
                    const finishMessage = document.getElementById(
                        "buyWalletFinishMessage"
                    );

                    // Aceitar apenas IDs com 4 a 9 algarismos
                    transactionInput.addEventListener("input", () => {
                        transactionInput.value =
                            transactionInput.value.replace(/\D/g, "").slice(0, 9);

                        const idValido = /^\d{4,9}$/.test(
                            transactionInput.value
                        );

                        finishButton.disabled = !idValido;
                        finishButton.style.opacity =
                            idValido ? "1" : "0.5";

                        finishMessage.style.color = "#b42318";
                        finishMessage.textContent = idValido
                            ? ""
                            : "O ID deve conter entre 4 e 9 dígitos.";
                    });

// =========================================
// ENVIAR O PEDIDO DE CARREGAMENTO PARA FIRESTORE
// =========================================

finishButton.addEventListener("click", async () => {
    const utilizador = auth.currentUser;
    const idTransacao = transactionInput.value.trim();

    // Impedir envios repetidos enquanto o pedido é processado
    if (finishButton.disabled || finishButton.dataset.enviando === "sim") {
        return;
    }

    // Confirmar que existe uma sessão autenticada
    if (!utilizador) {
        finishMessage.style.color = "#b42318";
        finishMessage.textContent =
            "Inicia sessão para enviares o teu pedido de carregamento.";
        return;
    }

    // Exigir que o email esteja verificado
    if (!utilizador.emailVerified) {
        finishMessage.style.color = "#b42318";
        finishMessage.textContent =
            "Confirma o teu email antes de enviares o pedido.";
        return;
    }

    // Validar o ID da transação
    if (!/^\d{4,9}$/.test(idTransacao)) {
        finishMessage.style.color = "#b42318";
        finishMessage.textContent =
            "O ID deve conter entre 4 e 9 dígitos.";
        return;
    }

    // Confirmar os dados do carregamento
    const carregamento = window.ngolaWalletTopUp;

    if (
        !carregamento ||
        !Number.isFinite(carregamento.amountUSD) ||
        !Number.isFinite(carregamento.amountKz) ||
        carregamento.amountUSD < VALOR_MINIMO_USD ||
        carregamento.amountUSD > VALOR_MAXIMO_USD ||
        !["BAI", "BFA", "EXPRESS"].includes(
            carregamento.metodoPagamento
        )
    ) {
        finishMessage.style.color = "#b42318";
        finishMessage.textContent =
            "Os dados do pedido são inválidos. Verifica o valor e o método de pagamento.";
        return;
    }

    // Impedir cliques repetidos durante o envio
    finishButton.dataset.enviando = "sim";
    finishButton.disabled = true;
    finishButton.style.opacity = "0.5";
    finishMessage.style.color = "#555";
    finishMessage.textContent = "A enviar o pedido...";

    try {
        // Criar o pedido associado ao utilizador autenticado
        const pedido = {
            userId: utilizador.uid,
            emailCliente: utilizador.email || "",
            tipo: "carregamento",
            valorUSD: carregamento.amountUSD,
            valorKz: carregamento.amountKz,
            taxaKzPorUSD: TAXA_COMPRA_USD_KZ,
            metodoPagamento: carregamento.metodoPagamento,
            idTransacao: idTransacao,
            estado: "pendente",
            criadoEm: serverTimestamp()
        };

        // Guardar na coleção de pedidos de carregamento
        const referenciaPedido = await addDoc(
            collection(db, "pedidosCarregamento"),
            pedido
        );

        // Guardar o ID criado para referência
        window.ngolaWalletTopUp.pedidoId = referenciaPedido.id;
        window.ngolaWalletTopUp.idTransacao = idTransacao;

        finishMessage.style.color = "#16803c";
        finishMessage.textContent =
            "Pedido enviado com sucesso! Aguarda a validação. O saldo ainda não foi creditado.";

        // Manter o botão bloqueado para evitar novo envio acidental
        finishButton.textContent = "Pedido enviado";
    } catch (erro) {
        console.error("Erro ao enviar pedido de carregamento:", erro);

        finishMessage.style.color = "#b42318";
        finishMessage.textContent =
            "Não foi possível enviar o pedido. Verifica a ligação e tenta novamente.";

        // Permitir nova tentativa se o envio falhar
        finishButton.disabled = false;
        finishButton.style.opacity = "1";
        finishButton.dataset.enviando = "nao";
    }
});
                });
            });
    }

    // Mostrar os valores escolhidos
    document.getElementById("buyWalletPaymentUSD").textContent =
        window.ngolaWalletTopUp.amountUSD.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    document.getElementById("buyWalletPaymentKZ").textContent =
        window.ngolaWalletTopUp.amountKz.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    paymentSection.style.display = "block";

    message.style.color = "#16803c";
    message.textContent =
        "P2P SELECIONA BAI, BFA OU EXPRESS. USE EXPRESS SE NÃO ESTIVER USANDO UM DESTES BANCOS .";
});

})();