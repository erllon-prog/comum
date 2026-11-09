/* =====================================================================
   Núcleo comum dos apps do Erllon (Contas, Média Flex, ...)
   Cuida do que é igual em todos os apps:
     - conexão com o Supabase (mesmo projeto, mesmos usuários)
     - login (e-mail/senha e Google), acesso revogado
     - perfis, usuários e acessos (administrador), amigos e convites
     - compartilhar o app, avisos (toast), aviso de nova versão e novidades
   Cada app chama Nucleo.iniciar({...}) e depois nucleo.comecar().
   O app só cuida dos próprios dados (contas, abastecimentos, ...).
   ===================================================================== */
(() => {
  "use strict";

  const NUCLEO_VERSAO = 1;
  const BASE = new URL(".", document.currentScript.src).href; // .../comum/

  // apps do pacote (aparecem em "Nossos apps" e nos textos)
  const APPS = {
    // caminhos a partir da raiz do site (erllon-prog.github.io): mesma origem, passa pela política de segurança dos apps
    "contas": { nome: "Contas", url: "/contas/", icone: "/contas/icons/icon-192.png", resumo: "Contas a pagar e a receber" },
    "media-flex": { nome: "Média Flex", url: "/media-flex/", icone: "/media-flex/icon-192.png", resumo: "Consumo do carro: etanol x gasolina" }
  };

  // ---------------------------------------------------------------- utilitários
  const $ = (sel) => document.querySelector(sel);
  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v || ""); } catch {} }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function friendlyError(err) {
    const msg = (err && (err.message || err.error_description)) || String(err);
    if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/banned/i.test(msg)) return "Seu acesso ao app foi revogado pelo administrador.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet.";
    if (/JWT|expired/i.test(msg)) return "Sua sessão expirou. Entre novamente.";
    if (/permission denied/i.test(msg)) return "O servidor recusou o acesso (permissão). Avise o administrador do app.";
    return msg;
  }
  async function compartilharTexto(titulo, texto) {
    try {
      if (navigator.share) { await navigator.share({ title: titulo, text: texto }); return; }
    } catch (err) { if (err.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(texto); toast("Mensagem copiada. Cole no WhatsApp para enviar."); }
    catch { prompt("Copie a mensagem:", texto); }
  }

  const GOOGLE_SVG = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

  // ---------------------------------------------------------------- telas comuns
  function montarTelas(cfg) {
    const nome = esc(cfg.nome), icone = esc(cfg.icone);
    const html = `
  <section id="view-login" class="login" hidden>
    <form id="login-form" class="login-card" autocomplete="on">
      <img src="${icone}" alt="" class="login-logo">
      <h1>${nome}</h1>
      <p class="muted">Entre com o Google ou com seu e-mail e senha.</p>
      <label>E-mail
        <input type="email" name="email" autocomplete="username" required>
      </label>
      <label>Senha
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <button type="submit" class="btn primary block">Entrar</button>
      <div class="ou"><span>ou</span></div>
      <button type="button" id="google-login" class="btn block google-btn">${GOOGLE_SVG} Entrar com Google</button>
      <p class="muted small">${esc(cfg.textoPrimeiraVez || "Primeira vez? É só entrar com o Google: sua conta é criada na hora e só você vê os seus dados.")}</p>
      <p id="login-error" class="error" hidden></p>
      <p class="instalar-dica" data-instalar hidden>📲 <b>No iPhone:</b> abra este link no <b>Safari</b>, toque em <b>Compartilhar</b> (o quadrado com a seta para cima) e em <b>Adicionar à Tela de Início</b>. O ${nome} vira um ícone como os outros apps.</p>
    </form>
  </section>

  <section id="view-revogado" class="login" hidden>
    <div class="login-card">
      <img src="${icone}" alt="" class="login-logo">
      <h1>${nome}</h1>
      <p>Seu acesso ao app foi revogado pelo administrador.</p>
      <p class="muted small">Se achar que foi engano, fale com quem te passou o link.</p>
      <button type="button" id="revogado-sair" class="btn block">Sair</button>
    </div>
  </section>

  <dialog id="users-dialog" class="sheet">
    <div class="sheet-body">
      <header class="sheet-head">
        <h2>Usuários e acessos</h2>
        <button type="button" class="icon-btn" id="users-close" aria-label="Fechar">✕</button>
      </header>
      <p class="muted small">Os usuários são os mesmos em todos os nossos apps (${Object.values(APPS).map((a) => esc(a.nome)).join(" e ")}). Quem tiver o link pode entrar com o Google e já começa a usar, com os próprios dados, que só a pessoa vê. Você recebe um aviso e decide aqui: <b>Aprovar</b> ou <b>Revogar</b>. Sem resposta, fica aprovado em 7 dias. Revogar tira o acesso a todos os apps.${cfg.usuariosExtra ? " " + cfg.usuariosExtra : ""}</p>
      <div id="users-list" class="users-list"></div>
      <form id="user-form" class="user-new" autocomplete="off">
        <h3>Cadastrar alguém já aprovado</h3>
        <label>Nome
          <input name="nome" maxlength="60" placeholder="Ex: Mãe">
        </label>
        <label>E-mail
          <input name="email" type="email" required autocomplete="off">
        </label>
        <label>Senha inicial (opcional)
          <input name="senha" type="text" minlength="8" autocomplete="new-password" placeholder="Em branco: o app cria uma sozinho">
        </label>
        <label class="check">
          <input type="checkbox" name="proprias" checked> ${esc(cfg.rotuloProprias)}
        </label>
        <label class="check">
          <input type="checkbox" name="convidar" checked> Enviar convite de amizade para essa pessoa
        </label>
        <button type="submit" class="btn primary block" id="user-create">Criar usuário</button>
        <p id="user-error" class="error" hidden></p>
      </form>
    </div>
  </dialog>

  <dialog id="amigos-dialog" class="sheet">
    <div class="sheet-body">
      <header class="sheet-head">
        <h2>Amigos</h2>
        <button type="button" class="icon-btn" id="amigos-close" aria-label="Fechar">✕</button>
      </header>
      <p class="muted small">${cfg.amigosTexto || "Seus amigos são os mesmos em todos os nossos apps."}</p>

      <form id="apelido-form" class="amigos-bloco" autocomplete="off">
        <span class="flabel">Seu @</span>
        <div class="inline-form">
          <span class="arroba">@</span>
          <input name="apelido" maxlength="21" autocapitalize="off" spellcheck="false" aria-label="Seu apelido">
          <button type="submit" class="btn">Salvar</button>
        </div>
        <p class="muted small">É assim que seus amigos encontram você no app.</p>
      </form>

      <form id="convite-form" class="amigos-bloco" autocomplete="off">
        <span class="flabel">Convidar um amigo</span>
        <div class="inline-form">
          <input name="alvo" maxlength="120" autocapitalize="off" spellcheck="false" placeholder="@apelido ou e-mail" aria-label="Apelido ou e-mail do amigo">
          <button type="submit" class="btn primary">Convidar</button>
        </div>
        <p class="muted small">A pessoa precisa ter acesso ao app e aceitar o convite.</p>
      </form>
      <p id="amigos-error" class="error" hidden></p>

      <div id="amigos-lista"></div>
    </div>
  </dialog>

  <dialog id="apps-dialog" class="sheet">
    <div class="sheet-body">
      <header class="sheet-head">
        <h2>Nossos apps</h2>
        <button type="button" class="icon-btn" id="apps-close" aria-label="Fechar">✕</button>
      </header>
      <p class="muted small">Mesmo login, mesmos amigos. Cada app guarda só os seus dados.</p>
      <div class="app-links">${Object.entries(APPS).map(([id, a]) => `
        <a class="card app-link" href="${esc(a.url)}" ${id === cfg.app ? 'aria-current="page"' : ""}>
          <img src="${esc(a.icone)}" alt="">
          <span><b>${esc(a.nome)}</b><small>${id === cfg.app ? "Você está aqui" : esc(a.resumo)}</small></span>
        </a>`).join("")}
      </div>
      <button type="button" class="btn" id="apps-compartilhar">Compartilhar o ${nome} com alguém</button>
    </div>
  </dialog>

  <div id="nucleo-atualizar" class="nucleo-atualizar" role="status" hidden>
    <span id="nucleo-atualizar-txt">Saiu uma versão nova do ${nome}.</span>
    <button type="button" class="btn" id="nucleo-atualizar-btn">Atualizar</button>
  </div>`;
    document.body.insertAdjacentHTML("afterbegin", html);
    if (!$("#toast")) document.body.insertAdjacentHTML("beforeend", '<div id="toast" class="toast" role="status" hidden></div>');
  }

  // ---------------------------------------------------------------- núcleo
  function iniciar(opcoes) {
    const cfg = Object.assign({
      app: "",
      nome: "App",
      url: location.origin + location.pathname,
      icone: "icon-192.png",
      viewApp: "#view-app",
      descricao: "",               // "para controlar as contas a pagar e a receber"
      privacidade: "Pronto, só você vê os seus dados.",
      rotuloProprias: "Controla as próprias contas no app Contas",
      usuariosExtra: "",
      amigosTexto: "",
      conviteEnviadoTexto: "Convite enviado. Assim que a pessoa aceitar, vocês aparecem como amigos.",
      versao: "0",
      novidades: null,             // { id, titulo, itens: [], dica }
      novidadesAlvo: "main",       // onde o cartão de novidades aparece (no topo)
      fecharMenu: () => { const m = $("#menu"); if (m) m.hidden = true; },
      aoEntrar: null,              // (nucleo) depois do login com perfil liberado
      aoSair: null,                // (nucleo) ao sair
      aoMudarAmigos: null,         // (amigos) quando a lista de amigos mudou
      aoVoltar: null,              // (nucleo) ao voltar para o app (aba visível)
      antesDeSair: null            // async () antes do signOut
    }, opcoes || {});

    const CFG = window.COMUM_CONFIG;
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
    });

    const N = {
      sb, cfg, apps: APPS, versaoNucleo: NUCLEO_VERSAO,
      user: null, perfil: null, amigos: [], novos: [],
      $, esc, toast, friendlyError, lsGet, lsSet, compartilharTexto,
      amigosAceitos: () => N.amigos.filter((a) => a.status === "aceita"),
      convitesRecebidos: () => N.amigos.filter((a) => a.status === "pendente" && !a.enviado_por_mim),
      ehAdmin: () => N.perfil?.papel === "admin",
      comecar, loadAmigos, loadNovos, abrirUsuarios, abrirAmigos, abrirApps, sair
    };

    montarTelas(cfg);

    // ---------- autenticação
    async function comecar() {
      const { data } = await sb.auth.getSession();
      setUser(data.session?.user || null);
      sb.auth.onAuthStateChange((_event, session) => setTimeout(() => setUser(session?.user || null), 0));
      setTimeout(checarVersao, 3000);
    }

    function setUser(user) {
      const mudou = (user?.id || null) !== (N.user?.id || null);
      N.user = user;
      $("#view-login").hidden = !!user;
      $(cfg.viewApp).hidden = !user;
      $("#view-revogado").hidden = true;
      if (user && mudou) loadPerfil().then((ok) => {
        if (!ok) return;
        aplicarAdmin();
        avisoConvites();
        if (cfg.aoEntrar) cfg.aoEntrar(N);
        depoisDoLogin();
      });
      if (!user) {
        N.perfil = null; N.amigos = []; N.novos = [];
        aplicarAdmin(); avisoNovos(); avisoConvites();
        if (cfg.aoSair) cfg.aoSair(N);
      }
    }

    function mostrarRevogado() {
      $(cfg.viewApp).hidden = true;
      $("#view-revogado").hidden = false;
    }
    $("#revogado-sair").addEventListener("click", () => sb.auth.signOut());

    async function loadPerfil() {
      const { data } = await sb.from("perfis").select("*").eq("id", N.user.id).maybeSingle();
      N.perfil = data || null;
      if (N.perfil?.acesso === "revogado") { mostrarRevogado(); return false; }
      await loadAmigos(false);
      return true;
    }

    function depoisDoLogin() {
      if (N.ehAdmin()) loadNovos();
      mostrarNovidades();
      const q = new URLSearchParams(location.search);
      if (q.has("usuarios")) {
        history.replaceState(null, "", location.pathname);
        if (N.ehAdmin()) abrirUsuarios();
      }
    }

    function aplicarAdmin() {
      const b = $("#open-users");
      if (b) b.hidden = !N.ehAdmin();
    }

    $("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector("button[type=submit]");
      const errEl = $("#login-error");
      errEl.hidden = true;
      btn.disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      btn.disabled = false;
      if (error) { errEl.textContent = friendlyError(error); errEl.hidden = false; return; }
      f.password.value = "";
    });

    // login com Google: volta para esta mesma página, e o supabase-js troca o código pela sessão
    $("#google-login").addEventListener("click", async () => {
      const errEl = $("#login-error");
      errEl.hidden = true;
      const { error } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } }
      });
      if (error) { errEl.textContent = friendlyError(error); errEl.hidden = false; }
    });
    // erro devolvido pelo Google/Supabase na volta do login
    (function erroNaVolta() {
      const q = new URLSearchParams(location.search + "&" + location.hash.replace(/^#/, ""));
      const desc = q.get("error_description") || q.get("error");
      if (!desc) return;
      const el = $("#login-error");
      el.textContent = /banned/i.test(desc)
        ? "Seu acesso ao app foi revogado pelo administrador."
        : /signup|sign up|not allowed|disabled/i.test(desc)
          ? "O cadastro de pessoas novas está fechado no momento. Fale com quem te passou o link."
          : `Não deu para entrar com o Google: ${desc}`;
      el.hidden = false;
      history.replaceState(null, "", location.pathname);
    })();

    async function sair() {
      cfg.fecharMenu();
      try { if (cfg.antesDeSair) await cfg.antesDeSair(); } catch {}
      await sb.auth.signOut();
    }
    const logout = $("#logout");
    if (logout) logout.addEventListener("click", sair);

    // ---------- amigos
    async function loadAmigos(redesenhar = true) {
      if (!N.user) return;
      const { data, error } = await sb.rpc("meus_amigos");
      if (error) { N.amigos = []; return; }
      const chave = (l) => JSON.stringify(l.map((a) => [a.amizade_id, a.status, a.apelido]));
      const antes = chave(N.amigos);
      N.amigos = data || [];
      avisoConvites();
      if (redesenhar && antes !== chave(N.amigos)) {
        if (cfg.aoMudarAmigos) cfg.aoMudarAmigos(N.amigos);
        if (amigosDlg.open) renderAmigos();
      }
    }
    function avisoConvites() {
      const n = N.convitesRecebidos().length;
      const dot = $("#menu-dot");
      if (dot) dot.hidden = n === 0 && !N.novos.length;
      const badge = $("#amigos-badge");
      if (badge) { badge.hidden = n === 0; badge.textContent = String(n); }
      const aviso = $("#convite-aviso");
      if (!aviso) return;
      aviso.hidden = n === 0 || !N.user;
      if (n === 1) aviso.textContent = `📨 ${N.convitesRecebidos()[0].nome} quer ser seu amigo no app. Toque para responder.`;
      else if (n > 1) aviso.textContent = `📨 Você tem ${n} convites de amizade. Toque para responder.`;
    }

    const amigosDlg = $("#amigos-dialog");
    const apelidoForm = $("#apelido-form");
    const conviteForm = $("#convite-form");
    function amigosErro(msg) {
      const el = $("#amigos-error");
      el.textContent = msg || "";
      el.hidden = !msg;
    }
    function renderAmigos() {
      const recebidos = N.convitesRecebidos();
      const aceitos = N.amigosAceitos();
      const enviados = N.amigos.filter((a) => a.status === "pendente" && a.enviado_por_mim);
      const pessoa = (a) => `<div class="amigo-nome"><strong>${esc(a.nome)}</strong><span class="muted small">@${esc(a.apelido)}</span></div>`;
      const bloco = (titulo, itens, acoes) => itens.length ? `<h3 class="amigos-tit">${titulo}</h3>` + itens.map((a) =>
        `<div class="card amigo-card" data-id="${a.amizade_id}">${pessoa(a)}<div class="amigo-acoes">${acoes(a)}</div></div>`).join("") : "";
      $("#amigos-lista").innerHTML =
        bloco("Convites recebidos", recebidos, () =>
          `<button type="button" class="btn primary" data-acao="aceitar">Aceitar</button><button type="button" class="link danger" data-acao="recusar">Recusar</button>`) +
        bloco("Amigos", aceitos, () => `<button type="button" class="link danger" data-acao="remover">Desfazer</button>`) +
        bloco("Convites enviados", enviados, () => `<span class="muted small">aguardando</span><button type="button" class="link" data-acao="cancelar">Cancelar</button>`) ||
        `<p class="muted small">Você ainda não tem amigos no app.</p>`;
    }
    async function abrirAmigos() {
      cfg.fecharMenu();
      amigosErro("");
      conviteForm.reset();
      apelidoForm.apelido.value = N.perfil?.apelido || "";
      renderAmigos();
      if (!amigosDlg.open) amigosDlg.showModal();
      await loadAmigos();
      renderAmigos();
    }
    const btnAmigos = $("#open-amigos");
    if (btnAmigos) btnAmigos.addEventListener("click", abrirAmigos);
    const conviteAviso = $("#convite-aviso");
    if (conviteAviso) conviteAviso.addEventListener("click", abrirAmigos);
    $("#amigos-close").addEventListener("click", () => amigosDlg.close());
    amigosDlg.addEventListener("click", (e) => { if (e.target === amigosDlg) amigosDlg.close(); });

    apelidoForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      amigosErro("");
      const { data, error } = await sb.rpc("definir_apelido", { novo: apelidoForm.apelido.value });
      if (error) return amigosErro(friendlyError(error));
      if (N.perfil) N.perfil.apelido = data;
      apelidoForm.apelido.value = data;
      toast(`Seu @ agora é @${data}.`);
    });

    conviteForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      amigosErro("");
      const alvo = conviteForm.alvo.value.trim();
      if (!alvo) return amigosErro("Digite o @ ou o e-mail da pessoa.");
      const btn = conviteForm.querySelector("button");
      btn.disabled = true;
      const { data, error } = await sb.rpc("convidar_amigo", { alvo });
      btn.disabled = false;
      if (error) return amigosErro(friendlyError(error));
      conviteForm.reset();
      toast(data === "aceita" ? "Essa pessoa já tinha convidado você. Agora vocês são amigos." : cfg.conviteEnviadoTexto);
      await loadAmigos();
      renderAmigos();
    });

    $("#amigos-lista").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      const id = b.closest("[data-id]").dataset.id;
      const a = N.amigos.find((x) => x.amizade_id === id);
      const quem = a?.nome || "essa pessoa";
      amigosErro("");
      let error;
      if (b.dataset.acao === "aceitar" || b.dataset.acao === "recusar") {
        ({ error } = await sb.rpc("responder_convite", { convite: id, aceitar: b.dataset.acao === "aceitar" }));
        if (!error) toast(b.dataset.acao === "aceitar" ? `Agora você e ${quem} são amigos.` : "Convite recusado.");
      } else {
        const remover = b.dataset.acao === "remover";
        if (remover && !confirm(`Desfazer a amizade com ${quem}? Nada é apagado, mas vocês deixam de ver o que compartilhavam.`)) return;
        ({ error } = await sb.rpc("remover_amigo", { amizade: id }));
        if (!error) toast(remover ? "Amizade desfeita." : "Convite cancelado.");
      }
      if (error) return amigosErro(friendlyError(error));
      await loadAmigos();
      renderAmigos();
    });

    // ---------- usuários e acessos (somente administrador)
    const usersDlg = $("#users-dialog");
    const userForm = $("#user-form");
    let usuarios = [];

    function gerarSenha() {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%*";
      const r = crypto.getRandomValues(new Uint32Array(20));
      return [...r].map((n) => chars[n % chars.length]).join("");
    }
    async function chamarFuncao(body) {
      const { data, error } = await sb.functions.invoke("usuarios", { body });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); if (j?.error || j?.message || j?.msg) msg = j.error || j.message || j.msg; } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    }
    const dataCurta = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
    function situacaoTxt(u) {
      if (u.acesso === "novo") {
        const fim = new Date(new Date(u.created_at).getTime() + 7 * 86400000);
        return `<span class="badge situacao novo">Novo · entrou em ${dataCurta(u.created_at)}</span>
          <span class="muted small">Sem resposta, fica aprovado em ${dataCurta(fim.toISOString())}.</span>`;
      }
      if (u.acesso === "revogado") return `<span class="badge situacao revogado">Acesso revogado</span>`;
      return "";
    }
    async function loadUsuarios() {
      const { data, error } = await sb.from("perfis").select("*").eq("dono", N.user.id).order("created_at");
      if (error) { toast(friendlyError(error)); return; }
      const ordem = { novo: 0, aprovado: 1, revogado: 2 };
      usuarios = (data || []).sort((a, b) => (ordem[a.acesso] ?? 1) - (ordem[b.acesso] ?? 1));
      N.novos = usuarios.filter((u) => u.acesso === "novo");
      avisoNovos();
      $("#users-list").innerHTML = usuarios.length ? usuarios.map((u) => `
        <div class="card user-card${u.acesso === "novo" ? " novo" : ""}${u.acesso === "revogado" ? " revogado" : ""}" data-id="${u.id}">
          <div class="user-top"><strong>${esc(u.nome || u.email)}</strong><span class="muted small">${u.apelido ? "@" + esc(u.apelido) + " · " : ""}${esc(u.email || "")}</span></div>
          ${situacaoTxt(u)}
          ${u.acesso === "novo" ? `<div class="user-actions decidir">
            <button type="button" class="btn primary" data-acao="aprovar">Aprovar</button>
            <button type="button" class="btn danger-outline" data-acao="revogar">Revogar</button>
          </div>` : ""}
          ${u.acesso === "revogado" ? `<div class="user-actions">
            <button type="button" class="btn" data-acao="aprovar">Devolver o acesso</button>
            <button type="button" class="link danger" data-acao="excluir">Excluir</button>
          </div>` : `
          <label class="check"><input type="checkbox" class="proprias"${u.controla_proprias ? " checked" : ""}> ${esc(cfg.rotuloProprias)}</label>
          <div class="user-actions">
            <button type="button" class="btn" data-acao="salvar">Salvar acesso</button>
            <button type="button" class="link" data-acao="link">Enviar link</button>
            <button type="button" class="link" data-acao="senha">Trocar senha</button>
            ${u.acesso === "aprovado" ? `<button type="button" class="link danger" data-acao="revogar">Revogar</button>` : ""}
            <button type="button" class="link danger" data-acao="excluir">Excluir</button>
          </div>`}
        </div>`).join("") : `<p class="muted small">Ainda não há outros usuários.</p>`;
    }
    async function loadNovos() {
      if (!N.ehAdmin()) return;
      const { data, error } = await sb.from("perfis").select("id, nome, email, created_at, acesso")
        .eq("dono", N.user.id).eq("acesso", "novo").order("created_at");
      if (error) return;
      N.novos = data || [];
      avisoNovos();
    }
    function avisoNovos() {
      const n = N.novos.length;
      const el = $("#novos-aviso");
      if (el) {
        el.hidden = n === 0 || !N.user;
        if (n === 1) el.textContent = `👤 ${N.novos[0].nome || N.novos[0].email} (${N.novos[0].email}) começou a usar o app. Toque para aprovar ou revogar.`;
        else if (n > 1) el.textContent = `👤 ${n} pessoas novas começaram a usar o app. Toque para aprovar ou revogar.`;
      }
      const b = $("#novos-badge");
      if (b) { b.hidden = n === 0; b.textContent = String(n); }
      const dot = $("#menu-dot");
      if (dot) dot.hidden = n === 0 && N.convitesRecebidos().length === 0;
    }
    async function abrirUsuarios() {
      cfg.fecharMenu();
      userForm.reset();
      $("#user-error").hidden = true;
      if (!usersDlg.open) usersDlg.showModal();
      await loadUsuarios();
    }
    const btnUsers = $("#open-users");
    if (btnUsers) btnUsers.addEventListener("click", abrirUsuarios);
    const novosAviso = $("#novos-aviso");
    if (novosAviso) novosAviso.addEventListener("click", abrirUsuarios);
    $("#users-close").addEventListener("click", () => usersDlg.close());
    usersDlg.addEventListener("click", (e) => { if (e.target === usersDlg) usersDlg.close(); });

    userForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#user-error");
      err.hidden = true;
      const proprias = userForm.proprias.checked;
      const convidar = userForm.convidar.checked;
      const senhaDigitada = userForm.senha.value;
      const senha = senhaDigitada || gerarSenha();
      const email = userForm.email.value.trim();
      const btn = $("#user-create");
      btn.disabled = true; btn.textContent = "Criando...";
      try {
        const r = await chamarFuncao({ acao: "criar", nome: userForm.nome.value.trim(), email, senha, origens: [], proprias });
        if (proprias && r?.id) {
          const { error } = await sb.from("perfis").update({ controla_proprias: true }).eq("id", r.id);
          if (error) throw new Error("Usuário criado, mas não deu para liberar as contas próprias. Marque a opção no cartão dele e toque em Salvar acesso.");
        }
        const comoEntra = senhaDigitada ? "Passe o e-mail e a senha para a pessoa." : "Ela entra com o botão do Google, usando esse mesmo e-mail.";
        let aviso = `Usuário criado. ${comoEntra}`;
        if (convidar) {
          const { error } = await sb.rpc("convidar_amigo", { alvo: email });
          aviso = error ? `Usuário criado, mas o convite de amizade não foi: ${friendlyError(error)}` : `Usuário criado e convite de amizade enviado. ${comoEntra}`;
          loadAmigos();
        }
        toast(aviso);
        userForm.reset();
        await loadUsuarios();
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
      } finally {
        btn.disabled = false; btn.textContent = "Criar usuário";
      }
    });

    $("#users-list").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      const card = b.closest("[data-id]");
      const id = card.dataset.id;
      const u = usuarios.find((x) => x.id === id);
      const quem = u?.nome || u?.email || "este usuário";
      try {
        if (b.dataset.acao === "salvar") {
          const proprias = card.querySelector(".proprias").checked;
          const { error } = await sb.from("perfis").update({ controla_proprias: proprias }).eq("id", id);
          if (error) throw error;
          toast("Acesso atualizado.");
        } else if (b.dataset.acao === "aprovar") {
          b.disabled = true;
          await chamarFuncao({ acao: "acesso", id, valor: "aprovado" });
          toast(u?.acesso === "revogado" ? `${quem} tem acesso de novo.` : `${quem} foi aprovado.`);
          await loadUsuarios();
        } else if (b.dataset.acao === "revogar") {
          if (!confirm(`Revogar o acesso de ${quem}? A pessoa sai de todos os apps e não consegue mais entrar. Dá para devolver depois.`)) return;
          b.disabled = true;
          await chamarFuncao({ acao: "acesso", id, valor: "revogado" });
          toast(`Acesso de ${quem} revogado.`);
          await loadUsuarios();
        } else if (b.dataset.acao === "link") {
          await enviarLink(u);
        } else if (b.dataset.acao === "senha") {
          const senha = prompt(`Nova senha para ${quem} (mínimo 8 caracteres):`);
          if (!senha) return;
          await chamarFuncao({ acao: "senha", id, senha });
          toast("Senha alterada.");
        } else if (b.dataset.acao === "excluir") {
          if (!confirm(`Excluir o acesso de ${quem}? Os seus dados não são afetados.`)) return;
          await chamarFuncao({ acao: "excluir", id });
          toast("Usuário excluído.");
          await loadUsuarios();
        }
      } catch (ex) {
        b.disabled = false;
        toast(friendlyError(ex));
      }
    });

    // ---------- compartilhar
    const passos = (comoEntrar) =>
      `1. Abra este link no Safari: ${cfg.url}\n` +
      `2. Toque em Compartilhar (o quadrado com a seta para cima) e em "Adicionar à Tela de Início".\n` +
      `3. Abra o ícone ${cfg.nome} e toque em "Entrar com Google"${comoEntrar}`;
    async function enviarLink(u) {
      const primeiro = (u?.nome || "").split(" ")[0];
      const texto = `Oi${primeiro ? " " + primeiro : ""}! Te cadastrei no ${cfg.nome}, o app que uso ${cfg.descricao}.\n\n` +
        passos(` usando ${u?.email || "o seu Gmail"}.`) +
        `\n4. Aceite meu convite de amizade no aviso que aparece no topo.`;
      await compartilharTexto(cfg.nome, texto);
    }
    async function compartilharApp() {
      cfg.fecharMenu();
      const texto = `Estou usando o ${cfg.nome} ${cfg.descricao}. Experimenta:\n\n` +
        passos(`. ${cfg.privacidade}`) +
        (N.perfil?.apelido ? `\n\nMeu @ no app é @${N.perfil.apelido}, se quiser me adicionar como amigo.` : "");
      await compartilharTexto(cfg.nome, texto);
    }
    const btnComp = $("#compartilhar-app");
    if (btnComp) btnComp.addEventListener("click", compartilharApp);
    $("#apps-compartilhar").addEventListener("click", () => { appsDlg.close(); compartilharApp(); });

    // ---------- nossos apps
    const appsDlg = $("#apps-dialog");
    function abrirApps() { cfg.fecharMenu(); if (!appsDlg.open) appsDlg.showModal(); }
    const btnApps = $("#abrir-apps");
    if (btnApps) btnApps.addEventListener("click", abrirApps);
    $("#apps-close").addEventListener("click", () => appsDlg.close());
    appsDlg.addEventListener("click", (e) => { if (e.target === appsDlg) appsDlg.close(); });

    // ---------- novidades (aparece uma vez por versão, depois do login)
    function mostrarNovidades() {
      const nv = cfg.novidades;
      if (!nv || !nv.id || lsGet(`nucleo.novidades.${nv.id}`)) return;
      const alvo = $(cfg.novidadesAlvo);
      if (!alvo || $("#novidades-card")) return;
      alvo.insertAdjacentHTML("afterbegin", `
        <section class="novidades-card" id="novidades-card">
          <h3>${esc(nv.titulo || "Novidades")}</h3>
          <ul>${(nv.itens || []).map((i) => `<li>${i}</li>`).join("")}</ul>
          ${nv.dica ? `<p>${nv.dica}</p>` : ""}
          <button type="button" class="btn primary" id="novidades-ok">Entendi</button>
        </section>`);
      $("#novidades-ok").addEventListener("click", () => {
        lsSet(`nucleo.novidades.${nv.id}`, "1");
        $("#novidades-card").remove();
      });
      const abrir = $("#novidades-card [data-abrir-apps]");
      if (abrir) abrir.addEventListener("click", (e) => { e.preventDefault(); abrirApps(); });
    }

    // ---------- nova versão publicada: avisa e oferece atualizar
    let ultimaChecagem = 0;
    async function checarVersao() {
      if (Date.now() - ultimaChecagem < 60000) return;
      ultimaChecagem = Date.now();
      try {
        const v = await fetch(BASE + "versoes.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.ok ? r.json() : null);
        if (!v) return;
        const novaApp = cfg.app && v[cfg.app] && Number(v[cfg.app].versao) > Number(cfg.versao);
        const novoNucleo = Number(v.nucleo) > NUCLEO_VERSAO;
        if (!novaApp && !novoNucleo) return;
        const nota = novaApp && v[cfg.app].nota ? ` ${v[cfg.app].nota}` : "";
        $("#nucleo-atualizar-txt").textContent = `Saiu uma versão nova do ${cfg.nome}.${nota}`;
        $("#nucleo-atualizar").hidden = false;
      } catch {}
    }
    $("#nucleo-atualizar-btn").addEventListener("click", async () => {
      $("#nucleo-atualizar-btn").disabled = true;
      try {
        const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      } catch {}
      location.reload();
    });

    // ---------- voltar para o app
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      checarVersao();
      if (N.user && N.perfil?.acesso !== "revogado") {
        loadAmigos(); loadNovos();
        if (cfg.aoVoltar) cfg.aoVoltar(N);
      }
    });

    return N;
  }

  window.Nucleo = { iniciar, versao: NUCLEO_VERSAO, apps: APPS };
})();
