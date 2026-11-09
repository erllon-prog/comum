# Comum

Núcleo compartilhado pelos apps (Contas e Média Flex), servido em `https://erllon-prog.github.io/comum/`.

Mexeu aqui, muda em todos os apps:

| Arquivo | O que tem |
|---|---|
| `config.js` | URL do Supabase e publishable key (iguais para todos) |
| `nucleo.css` | Cores, botões, login, janelas, usuários, amigos, avisos |
| `nucleo.js` | Login (e-mail/senha e Google), acesso revogado, perfis, usuários e acessos, amigos e convites, compartilhar, "Nossos apps", aviso de nova versão e cartão de novidades |
| `versoes.json` | Versão atual de cada app e do núcleo (dispara o aviso "Saiu uma versão nova") |

## Como um app usa

```html
<link rel="stylesheet" href="../comum/nucleo.css">
<link rel="stylesheet" href="app.css">
...
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../comum/config.js"></script>
<script src="../comum/nucleo.js"></script>
<script src="app.js"></script>
```

```js
const nucleo = Nucleo.iniciar({
  app: "media-flex", nome: "Média Flex", url: "https://erllon-prog.github.io/media-flex/",
  icone: "icon-192.png", versao: 4, descricao: "para medir o consumo do carro",
  novidades: { id: "media-flex-4", titulo: "...", itens: ["..."] },
  aoEntrar(n) { /* carrega os dados do app */ },
  aoSair(n) { /* limpa a tela */ },
  aoVoltar(n) { /* recarrega ao voltar para o app */ }
});
nucleo.comecar();
```

Elementos opcionais que o núcleo liga sozinho se existirem no app: `#menu`, `#menu-dot`, `#open-amigos` + `#amigos-badge`, `#open-users` + `#novos-badge`, `#compartilhar-app`, `#abrir-apps`, `#logout`, `#convite-aviso`, `#novos-aviso`, `#toast`.

## Publicar uma atualização

1. Altere o arquivo (no app ou aqui).
2. Suba a versão em `versoes.json` (do app ou `nucleo`) e a mesma versão no `iniciar({ versao })` do app (ou `NUCLEO_VERSAO` em `nucleo.js`).
3. Quem estiver com o app aberto vê "Saiu uma versão nova" com o botão **Atualizar**.
4. Para explicar o que mudou, troque `novidades` (com um `id` novo) no app: aparece uma vez para cada pessoa.

## Banco (Supabase, projeto contas-erllon)

Tabelas comuns: `perfis`, `amizades`, `pre_aprovados`, `push_*`. Funções: `meus_amigos`, `convidar_amigo`, `responder_convite`, `remover_amigo`, `definir_apelido`, Edge Function `usuarios`.
Tabelas de cada app: `contas` (Contas), `abastecimentos` (Média Flex).
