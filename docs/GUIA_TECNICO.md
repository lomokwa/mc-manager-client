# MC Manager — Guia Técnico do Frontend

> **Repo:** [`lomokwa/mc-manager-client`](https://github.com/lomokwa/mc-manager-client) · React 19 + TypeScript + [Vite](https://vite.dev/) · [React Router](https://reactrouter.com/) · CSS puro (sem Tailwind/biblioteca de componentes)
> **Repo irmão:** [`lomokwa/mc-manager-server`](https://github.com/lomokwa/mc-manager-server) — o backend tem seu próprio [`docs/GUIA_TECNICO.md`](https://github.com/lomokwa/mc-manager-server/blob/main/docs/GUIA_TECNICO.md).
> **English:** [`docs/TECHNICAL_GUIDE.md`](TECHNICAL_GUIDE.md)
>
> Este guia descreve o código no commit [`ce2a64c`](https://github.com/lomokwa/mc-manager-client/commit/ce2a64c). Os links com número de linha podem ficar desatualizados conforme o arquivo muda; se o link cair um pouco fora do lugar, procure pelo nome da função/símbolo indicado ao lado — esse não muda.

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Estrutura do repositório](#2-estrutura-do-repositório)
3. [Roteamento](#3-roteamento)
4. [A camada de API — `apiFetch`](#4-a-camada-de-api--apifetch)
5. [Gerenciamento de estado — contexts](#5-gerenciamento-de-estado--contexts)
6. [Referência de páginas](#6-referência-de-páginas)
7. [Componentes principais](#7-componentes-principais)
8. [O subsistema de console](#8-o-subsistema-de-console)
9. [Sistema de design](#9-sistema-de-design)
10. [Testes](#10-testes)
11. [Build e deploy](#11-build-e-deploy)
12. [Backend, em resumo](#12-backend-em-resumo)
13. [Receituário — "eu quero…"](#13-receituário--eu-quero)
14. [Glossário](#14-glossário)

---

## 1. Visão geral da arquitetura

Uma SPA que fala com a API REST e o WebSocket do console do [mc-manager-server](https://github.com/lomokwa/mc-manager-server) por HTTP(S)/WSS — sem nenhum outro acoplamento de backend; sem cliente gerado, sem pacote de tipos compartilhado. O contrato inteiro é o envelope JSON `{success, data, error}` (ver [§4](#4-a-camada-de-api--apifetch)) e a tabela de rotas documentada no guia do repo do servidor.

**O padrão definidor deste código é degradação graciosa.** Toda funcionalidade que fala com a API é escrita pra continuar funcionando — menos essa funcionalidade específica — contra uma build de servidor *mais antiga* que ainda não tem o endpoint, e pra distinguir isso de "a conta não tem permissão" e de "a rede está fora". Isso não é incidental: este cliente e o servidor saem de dois repositórios separados, com dois pipelines de deploy separados, então o cliente rotineiramente fica uma ou duas versões à frente de qualquer build de servidor que esteja de fato no ar. Ver [§4](#4-a-camada-de-api--apifetch) pro mecanismo exato.

## 2. Estrutura do repositório

```
src/App.tsx                 Tabela de rotas + aninhamento de providers (ver §3)
src/main.tsx                Raiz do ReactDOM

src/context/                Estado global: auth, estado ao vivo do servidor
                              gerenciado, o registro de servidores, permissões.
src/pages/                   Uma pasta por rota. Página + seu próprio .css.
src/components/              Peças reutilizáveis usadas por mais de uma página
                              (ou complexas o bastante pra merecer arquivo próprio).
src/lib/                     Lógica pura, sem framework: chamadas de API,
                              parsers, formatadores. É aqui que moram os testes
                              unitários (pareados 1:1 com tests/*.test.ts).
src/types/                   Interfaces TS pequenas e compartilhadas (Player,
                              User, formato do server.properties).

tests/                       Arquivos node:test, um por módulo de src/lib/*.ts
                              que tem lógica que vale testar.
```

## 3. Roteamento

[`src/App.tsx`](../src/App.tsx) define a tabela de rotas inteira. Duas rotas são públicas e ficam totalmente fora do shell do app — `/legal/selton-mello-bot/privacy` e `/terms`, páginas estáticas pra listagem do próprio bot de Discord no diretório de apps do Discord, não linkadas em nenhum nav. Todo o resto fica atrás de `ProtectedRoute` (redireciona pra `/login` se `!isAuthenticated`) e uma pilha de quatro providers de contexto, aninhados numa ordem que importa:

```tsx
<ServersProvider>       {/* o registro multi-servidor — ServerProvider lê currentServerId daqui */}
  <ServerProvider>       {/* estado ao vivo do servidor ATUALMENTE GERENCIADO + WebSocket */}
    <ToastProvider>
      <PermissionsProvider>   {/* Sidebar/Navbar chamam usePermissions() */}
        <Sidebar /><Navbar /><Routes>...</Routes>
```

**Tabela de rotas** (caminho → componente → arquivo → a(s) permissão(ões) que mostram na sidebar — ver `navItems` de [`src/components/sidebar/Sidebar.tsx`](../src/components/sidebar/Sidebar.tsx); uma rota continua acessível direto por URL mesmo quando a sidebar esconde ela, já que o controle é só cosmético, não é guarda de router):

| Caminho | Componente | Arquivo | Sidebar precisa de |
|---|---|---|---|
| `/` | Console | [`pages/console/Console.tsx`](../src/pages/console/Console.tsx) | `console.read` |
| `/overview` | Overview | [`pages/overview/Overview.tsx`](../src/pages/overview/Overview.tsx) | `overview.view` |
| `/activity` | Activity | [`pages/activity/Activity.tsx`](../src/pages/activity/Activity.tsx) | `activity.view` |
| `/servers` | Servers | [`pages/servers/Servers.tsx`](../src/pages/servers/Servers.tsx) | nenhuma — controlado por `useServers().supported` no lugar (ver [§5.3](#53-serverscontext--o-registro-multi-servidor)) |
| `/players` | Players | [`pages/players/Players.tsx`](../src/pages/players/Players.tsx) | `players.view` |
| `/performance` | Performance | [`pages/performance/Performance.tsx`](../src/pages/performance/Performance.tsx) | `performance.view` |
| `/users` | Users | [`pages/users/Users.tsx`](../src/pages/users/Users.tsx) | `admin.manage_users` ou `admin.manage_roles` |
| `/files` | Files | [`pages/files/Files.tsx`](../src/pages/files/Files.tsx) | `files.read` |
| `/backups` | Backups | [`pages/backups/Backups.tsx`](../src/pages/backups/Backups.tsx) | `backups.view` |
| `/server` | ServerSetup | [`pages/server/ServerSetup.tsx`](../src/pages/server/ServerSetup.tsx) | `server.start` |
| `/settings` | Settings | [`pages/settings/Settings.tsx`](../src/pages/settings/Settings.tsx) | nenhuma — só preferência local do browser |
| `/account` | Account | [`pages/account/Account.tsx`](../src/pages/account/Account.tsx) | não está na lista da sidebar; acessada pelo chip de usuário |
| `/login`, `/register` | Login, Register | [`pages/auth/`](../src/pages/auth/) | pública |

## 4. A camada de API — `apiFetch`

**Arquivo:** [`src/lib/api.ts`](../src/lib/api.ts). Leia ele inteiro — é curto, e todo call site de busca de dado no app depende do contrato que ele define.

```ts
export type ApiResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'unsupported' }                // 404 — essa build de servidor não tem o endpoint
  | { kind: 'unauthorized' }               // 401 — token ausente/expirado
  | { kind: 'forbidden'; message: string } // 403 — logado, mas sem permissão
  | { kind: 'error'; message: string }     // alcançável, mas falhou (4xx/5xx ou success:false)
  | { kind: 'network' }                    // fetch() estourou — de fato inalcançável
```

`apiFetch<T>(path, init)` checa `res.status` **antes** de parsear o corpo — um 404 do Gin é `text/plain`, e chamar `res.json()` nele estoura, o que já foi lido errado como falha de rede (o bug real que chegou a subir uma vez: as páginas Files/Backups mostravam "Could not reach the server" contra uma build de servidor que simplesmente ainda não tinha aquelas rotas).

**Por que `forbidden` é um tipo próprio, não misturado em `error`:** um 403 e um 404 parecem idênticos pra qualquer chamador que só checa `kind !== 'ok'`. Essa ambiguidade tem um custo real, já medido — é exatamente como a própria conta de serviço do bot de Discord perdendo a role virou "o servidor Minecraft está fora" (ver a seção de RBAC do guia do backend) enquanto o servidor estava saudável o tempo todo. Distinguir "você não pode" de "essa build não consegue" é o ponto inteiro do tipo.

**`failureMessage(result, fallback)`** — o lugar único de onde todo call site deveria tirar a string de erro: `result.kind === 'error' || result.kind === 'forbidden' ? result.message : fallback`. Adicionar `forbidden` depois que a maioria dos call sites já existia teria silenciosamente rebaixado cada um deles do motivo real do servidor pra um fallback genérico, se eles tivessem continuado escrevendo isso inline em vez de chamar o helper — é exatamente essa regressão que essa função existe pra prevenir.

**A convenção que toda página segue:**

```tsx
const r = await apiFetch<Thing>('/things', { headers: authHeaders(token) })
if (r.kind === 'ok') setThings(r.data)
else if (r.kind === 'unauthorized') logout()
else if (r.kind === 'forbidden') /* mostra o motivo real, ex.: r.message */
else if (r.kind === 'unsupported') /* "essa build de servidor ainda não suporta X" */
else toast(failureMessage(r, 'Não consegui carregar things'), 'error')
```

## 5. Gerenciamento de estado — contexts

### 5.1 `AuthContext`

**Arquivo:** [`src/context/AuthContext.tsx`](../src/context/AuthContext.tsx). Guarda `token`/`username` (persistidos em `localStorage`), `login`/`register`/`logout`. `username` é decodificado **no cliente, do payload do JWT** (base64url), não buscado à parte — o token já carrega ele (ver as claims JWT no guia do backend). É o provider mais externo, acima do check de rota protegida do router.

### 5.2 `ServerContext`

**Arquivo:** [`src/context/ServerContext.tsx`](../src/context/ServerContext.tsx). O estado de *qualquer servidor que esteja sendo gerenciado agora* (`currentServerId`, vindo de `ServersContext`): `running`, `consoleConnected`, `serverInfo`, os buffers ao vivo `logs`/`chatLog`, e as ações — `handleStart`/`handleStop`/`createServer`/`deleteServer`/`updateProperties`/`fetchProperties`/`sendCommand`. É dono da própria conexão WebSocket do console (reconexão automática com backoff exponencial limitado) e expõe `subscribe(listener)` pra quem quiser um callback por linha recebida em vez de ler o buffer acumulado.

### 5.3 `ServersContext` — o registro multi-servidor

**Arquivo:** [`src/context/ServersContext.tsx`](../src/context/ServersContext.tsx). Busca `GET /api/servers` e expõe `servers`, `currentServerId`, `setCurrentServer`, e dois booleanos independentes fáceis de confundir mas que respondem perguntas diferentes:

- **`supported`** — o backend chegou a dar 200 em `/api/servers`? Padrão `false` (o oposto do `PermissionsContext` abaixo, de propósito — ver o comentário no código pra entender por quê: o 404 de um backend antigo e um soluço de rede precisam produzir comportamento de fallback *idêntico*, então `supported` não pode ser confiado como verdadeiro até um 200 de verdade confirmar que o registro existe).
- **`forbidden`** — deu 403 especificamente? Registrado pra a página Servers poder dizer *"peça a um admin `servers.view`"* em vez do enganoso *"essa build não tem suporte multi-servidor"* — a mesma distinção `forbidden`-vs-`unsupported` do [§4](#4-a-camada-de-api--apifetch), aplicada um nível acima.

### 5.4 `PermissionsContext`

**Arquivo:** [`src/context/PermissionsContext.tsx`](../src/context/PermissionsContext.tsx). Busca o schema de permissões e `GET /api/me/permissions`, expõe `role`, `can(perm)`, `supported`. **`supported` tem padrão `true`** aqui — o oposto do `ServersContext` — porque a *ausência* de um sistema de permissões num backend antigo precisa significar "não esconde nada", não "esconde tudo": antes desse sistema existir, todo usuário logado podia fazer tudo, e um cliente que assumisse o contrário trancaria gente fora de funcionalidades que um servidor antigo nunca controlou pra começo de conversa.

### 5.5 `ToastContext`

**Arquivo:** [`src/components/toast/ToastContext.tsx`](../src/components/toast/ToastContext.tsx). `useToast().toast(mensagem, tipo)`, `tipo` é `'info' | 'success' | 'error'`. Fica acima de `PermissionsContext` na árvore pra o próprio sistema de permissões conseguir dar toast.

## 6. Referência de páginas

| Página | Rota | Lê | Escreve | Notas |
|---|---|---|---|---|
| **Console** | `/` | `ServerContext.logs`/`chatLog` | `sendCommand` | A página inicial padrão. Três visões trocáveis (feed/terminal/raw, ver [§8](#8-o-subsistema-de-console)); é também aqui que uma mensagem de texto simples vira broadcast por padrão (ver `lib/consoleInput.ts`). |
| **Overview** | `/overview` | `GET /players`, `GET /properties`, `GET /backups`, `ServerContext.logs`, o histórico de amostras em `localStorage` da página Performance | `POST /backups`, fluxo de restart | "O servidor está bem, em cinco segundos." Todo tile vem de dado que o app já busca em outro lugar — TPS/memória mostram `—` com link pra Performance em vez de um número inventado quando não existe amostra ainda. Hospeda o [`RestartDialog`](../src/components/restart/RestartDialog.tsx). |
| **Activity** | `/activity` | `GET /activity` (paginado, keyset em `id`) | — | A trilha de auditoria — "quem fez o quê, quando." Chips de categoria filtram no cliente por página; "carregar mais" pagina pra trás. Uma categoria vazia diz isso explicitamente em vez de parecer igual a "nunca aconteceu nada". |
| **Servers** | `/servers` | `GET /servers`, `.../status` e `.../players` por servidor | `.../start`, `.../stop` | O seletor multi-servidor. "Manage" troca `ServersContext.currentServerId`, o que redireciona toda chamada de API das outras páginas. "New server" é um placeholder desabilitado — ainda não existe `POST /api/servers` (ver o guia do backend, §1). |
| **Players** | `/players` | `GET /players` | comandos de console (op/ban/kick/whitelist/teleport — nunca REST) | O elenco. Clicar num jogador abre o [`PlayerPanel`](../src/components/player/PlayerPanel.tsx) (ver [§7](#7-componentes-principais)). |
| **Performance** | `/performance` | saída do `spark` parseada ao vivo direto do stream do console (`lib/spark.ts`) | dispara comandos `spark` pelo console | Tiles de TPS/MSPT/CPU/memória + um gráfico de histórico, amostrado em `localStorage` (`lib/sparkHistory.ts`) — é *a* fonte que os tiles do Overview leem. Sem endpoint dedicado de backend; tudo vem de parsear a própria saída de console do spark. |
| **Users** | `/users` | `GET /users` | convites, mudança de role/override via [`RolePanel`](../src/components/roles/RolePanel.tsx) | Gerenciamento de usuário. O botão "Access" que abre o `RolePanel` é controlado por **`can('admin.manage_roles')` E TAMBÉM** `PermissionsContext.supported` — num backend antigo `can()` sozinho tem padrão `true` (ver [§5.4](#54-permissionscontext)), o que abriria um painel com lista de role vazia se não fosse por isso. |
| **Files** | `/files` | `GET /files`, `.../read`, `.../download` | `.../upload` (arrastar-e-soltar), `PUT /files`, `DELETE /files` | Inclui um [`CodeEditor`](../src/components/editor/CodeEditor.tsx) feito do zero com highlight e validação de JSON; salvar um JSON que falha em `checkJson` pede confirmação em vez de bloquear na marra (muita config do mundo real é meio JSON5). |
| **Backups** | `/backups` | `GET /backups`, `.../config` | criar/restaurar/deletar/baixar, config de agendamento | Restaurar e deletar pedem confirmação inline em dois passos — restaurar é sinalizado como a ação mais destrutiva que o sistema inteiro expõe (ver a tabela de permissão do guia do backend). |
| **Server** (setup) | `/server` | `ServerContext.serverExists`/`serverInfo` | `createServer`, `deleteServer` | Criação do servidor na primeira execução: seletor de versão (lista de releases vanilla, ou Fabric com busca própria de versão de loader direto no `meta.fabricmc.net`), `server.properties` inicial. |
| **Settings** | `/settings` | só `localStorage` | só `localStorage` | Hoje só a URL do mapa ao vivo BlueMap (`lib/settings.ts`) — local no browser, nunca enviado pra API, nunca controlado por permissão. |
| **Account** | `/account` | `GET /me`, `GET /me/permissions`, `GET /me/mclink` | fluxo de vincular/desvincular conta Minecraft | Perfil de auto-atendimento: mostra suas próprias permissões efetivas, só leitura, e o fluxo de vínculo de conta descrito no guia do backend (§7.6). |
| **Login / Register** | `/login`, `/register` | — | `POST /login`, `POST /register` | Registro exige um token de convite na URL (`?token=`), emitido por um admin pela página Users. |

## 7. Componentes principais

| Componente | Arquivo | Propósito |
|---|---|---|
| `RolePanel` | [`components/roles/RolePanel.tsx`](../src/components/roles/RolePanel.tsx) | Editor de role/permissão em painel deslizante pra um usuário — dropdown de role + checklist completo de permissão semeado a partir do padrão da role, comparado e transformado em overrides por usuário ao salvar. A role Owner aparece mas o alvo fica só-leitura (bate com a recusa do próprio backend). |
| `RestartDialog` | [`components/restart/RestartDialog.tsx`](../src/components/restart/RestartDialog.tsx) | Fluxo de restart com contagem-regressiva de aviso multi-seleção (10m/5m/2m/1m/30s/15s/5s, qualquer combinação) usado no Overview. **Não existe endpoint de restart no backend** — isso dirige `stop` e depois `start` sozinho, cronometrado no cliente; a matemática do agendamento (qual offset de fato dispara o restart quando vários são marcados — o *mais longo*, não a soma) mora em [`lib/restartPlan.ts`](../src/lib/restartPlan.ts), testado por conta própria. |
| `PlayerPanel` | [`components/player/PlayerPanel.tsx`](../src/components/player/PlayerPanel.tsx) | Painel deslizante por jogador: toggles de op/whitelist, teleporte (pra jogador / coordenadas / spawn), uma visão de DM/chat filtrada ao vivo, kick/ban/ip-ban com confirmação. Toda ação é um **comando de console** (`lib/playerCommands.ts` monta as strings de comando) — não existe endpoint REST pra nenhuma dessas; é também por isso que a trilha de auditoria do backend grava comando de console separado de requisição HTTP (ver o guia do backend, §7.2 do Activity). |
| `CodeEditor` | [`components/editor/CodeEditor.tsx`](../src/components/editor/CodeEditor.tsx) | Um `<textarea>` transparente em cima de um `<pre>` com highlight de sintaxe, sem dependência de editor. Highlight é memoizado e pulado acima do `HIGHLIGHT_LIMIT` de `jsonHighlight.ts` pra arquivo grande. |
| `TrendChart` | [`components/charts/TrendChart.tsx`](../src/components/charts/TrendChart.tsx) | Gráfico de linha em SVG inline, sem dependência (espaço de coordenada fixo, `preserveAspectRatio="none"`, traço nítido via `vector-effect`). Usado pela visão de histórico do Performance. |
| `Sidebar` / `Navbar` | [`components/sidebar/`](../src/components/sidebar/), [`components/navbar/`](../src/components/navbar/) | Chrome do app. A tabela `navItems` da Sidebar é a fonte única de verdade pra "o que está no nav e que permissão precisa" (ver [§3](#3-roteamento)); a Navbar hospeda o botão Start/Stop e o chip do servidor atual. |
| Toast | [`components/toast/`](../src/components/toast/) | `useToast()` — ver [§5.5](#55-toastcontext). |

## 8. O subsistema de console

Essa é a parte mais elaborada do cliente e vale entender como um sistema só, não quatro arquivos separados.

- **[`lib/consoleLines.ts`](../src/lib/consoleLines.ts)** — `classifyLine(raw)` transforma uma linha crua de console num `ConsoleLine` tipado (`chat | join | leave | adv | death | warn | error | cmd | system`), extraindo `who`/`text`/`time` com regex batendo contra o formato de log real do Minecraft vanilla. Também é onde moram os `QUIET_RULES` (tráfego de query de máquina — round-trips de scoreboard `mcm.*` — escondido da visão por padrão) e os parsers de menção/waypoint/session-storage que Performance e o painel de jogador usam.
- **[`lib/consoleInput.ts`](../src/lib/consoleInput.ts)** — `parseConsoleInput(raw, isCommandName)` decide o que uma linha digitada *significa*: uma `/` na frente força comando, uma palavra de comando reconhecida roda sem barra, texto simples vira broadcast de chat por padrão, e `say` (com ou sem barra) ganha formatação especial.
- **[`lib/mcCommands.ts`](../src/lib/mcCommands.ts)** — o registro de sugestão de comando (`COMMANDS`, `getSuggestions`) que alimenta o popup de Tab-complete do input do console. `spark` está de propósito em `COMMAND_NAMES`/`isCommandName` — sem isso, digitar `spark tps` transmitiria pra todo jogador em vez de rodar o comando.
- **[`lib/spark.ts`](../src/lib/spark.ts)** — um parser completo pra saída de console do profiler [spark](https://spark.lucko.me/) (janelas de TPS/MSPT/CPU/memória/GC/ping, extração de link de relatório, e `foldSparkBlocks` — uma varredura *com estado* que dobra os dumps multi-linha do spark, já que nenhuma regex de linha única consegue ancorar uma linha de continuação que não carrega timestamp próprio). É isso que alimenta tanto os toggles de dobra do spark na página Console quanto a página Performance inteira.
- **[`lib/chat.ts`](../src/lib/chat.ts)** — `parsePlayerChat` filtra o buffer de log compartilhado até as mensagens de um jogador só, pra visão de DM do `PlayerPanel`.
- **[`lib/consolePrefs.ts`](../src/lib/consolePrefs.ts)** — escolha de visão persistida (feed/terminal/raw) e visibilidade por tipo, guardado em `localStorage`.

## 9. Sistema de design

Todo o tema é feito de custom properties de CSS definidas uma vez no `:root` de [`src/index.css`](../src/index.css) — não tem CSS-in-JS, não tem Tailwind, não tem biblioteca de componente. Todo `.css` de página/componente consome esses tokens em vez de fixar uma cor ou duração direto.

| Grupo de token | Exemplos | Notas |
|---|---|---|
| Marca | `--brand` (`#4ecca3`), `--brand-hover`, `--brand-dim`, `--brand-glow`, `--brand-ink` | Identidade teal/verde |
| Superfícies | `--bg-1`/`--bg-2`/`--bg-3`, `--surface`, `--surface-2` | Escala de azul-marinho |
| Linhas | `--line`, `--line-soft`, `--line-strong` | |
| Texto | `--text`, `--text-dim`, `--text-mute` | |
| Status | `--danger`, `--warn`, `--ok`, `--info` | Cor semântica, mantida separada do acento de marca |
| Forma/movimento | `--radius`/`--radius-sm`/`--radius-lg`, `--shadow-1`/`--shadow-2`, `--ring`, `--ease` (out-quint), `--ease-expo` | |

**Convenções de movimento que vale seguir, não reinventar por componente:** feedback de toque via uma escala `--t-press` compartilhada no `:active`; entrada de lista via classe `.stagger-item` + `style={{ '--i': index }}` inline lendo um keyframe `rise` compartilhado; toda animação respeita `prefers-reduced-motion`. Prefira animar `transform`/`opacity` em vez de propriedade de layout (`width`/`height`/`padding`/`margin`) — essa última força layout thrash a cada frame, o que importa aqui especificamente porque o console injeta nó de DOM novo continuamente, então a main thread já costuma estar ocupada.

## 10. Testes

`npm test` roda o test runner nativo do Node direto contra `tests/*.test.ts` (`node --test`) — zero dependência de framework de teste, já que o Node 24 remove tipo TypeScript nativamente. `tests/` fica de propósito **fora** do projeto do `tsconfig` (importar arquivo `.ts` pela extensão real quebra o TS5097 do `tsc -b` senão).

A convenção: um arquivo de teste por módulo de `src/lib/*.ts` que tem lógica não-trivial, afirmando contra **exemplo real capturado** sempre que a entrada vem de um formato externo — linha de log real do Minecraft vanilla, saída real do `spark` — em vez de fixture com cara de inventada, já que o ponto inteiro desses parsers é bater com o que o jogo de fato imprime.

`npm run lint` (ESLint) é rigoroso: `react-hooks/set-state-in-effect` e `react-refresh/only-export-components` são **erros**, não avisos, na config deste repo — não faça `setState` síncrono dentro de um corpo de `useEffect` puro (faça dentro de um `.then()`/callback async, ou semeie o estado inicial via `useState(() => …)` no lugar).

## 11. Build e deploy

`npm run build` é `tsc -b && vite build` — erro de tipo quebra o build, não só o lint. `npm run dev` sobe o dev server do Vite; um `VITE_API_BASE=/api` sozinho + um proxy só-de-dev no `vite.config.ts` é o jeito usual de apontar ele pra um servidor rodando localmente sem atrito de CORS (nunca commite um proxy apontando pra `localhost` — é conveniência por desenvolvedor, não configuração).

**CI** ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)): `npm ci && npm run lint && npm run build && npm test` em todo push/PR pra `main`.

**Deploy** ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)): o mesmo gate de build+teste, depois via SSH no host do homelab: `git pull && npm ci && npm run build` — esse app é um build estático, então "deploy" é só produzir um `dist/` fresco no host (servido por o que quer que esteja na frente dele lá, fora deste repo). Sem um gate `workflow_run` separado como o repo do servidor tem; falha de build e falha de deploy são o mesmo job aqui.

## 12. Backend, em resumo

Tudo que este cliente conversa está documentado no próprio [`docs/GUIA_TECNICO.md`](https://github.com/lomokwa/mc-manager-server/blob/main/docs/GUIA_TECNICO.md) do [`lomokwa/mc-manager-server`](https://github.com/lomokwa/mc-manager-server) — a tabela de rotas inteira, o modelo RBAC/permissão que o `PermissionsContext` espelha, o protocolo do WebSocket de console que o `ServerContext` fala, e a arquitetura de deploy de dois containers por trás do motivo de algumas mudanças de backend (qualquer coisa que toque o container `minecraft`) não conseguirem subir sozinhas do jeito que as mudanças deste cliente sempre conseguem.

## 13. Receituário — "eu quero…"

| Eu quero… | Comece aqui |
|---|---|
| Adicionar uma página nova | Crie `pages/<nome>/<Nome>.tsx` + `.css`, registre a rota em [`App.tsx`](../src/App.tsx), adicione uma entrada em `navItems` de [`Sidebar.tsx`](../src/components/sidebar/Sidebar.tsx) com o `need: Permission[]` certo |
| Chamar um endpoint de backend novo | Passe por `apiFetch` (ver [§4](#4-a-camada-de-api--apifetch)) — nunca um `fetch` cru; trate no mínimo `ok`/`unauthorized`, e `forbidden`/`unsupported` se o endpoint for novo ou controlado por permissão |
| Mostrar algo controlado por permissão | `usePermissions().can('zona.acao')` — **e** confira `.supported` também se a funcionalidade não fizer sentido nenhum num backend antigo (ver [§5.4](#54-permissionscontext) pra entender por quê os dois) |
| Reagir a qual servidor está selecionado | `useServers().currentServerId`, e monte o caminho da requisição com o `serverPath(id, sufixo)` de `lib/servers.ts` |
| Adicionar uma ação de jogador via console | `lib/playerCommands.ts` — monte a string de comando como função pura, mande via `ServerContext.sendCommand` |
| Parsear um tipo novo de linha de console | `classifyLine` de `lib/consoleLines.ts` (formato vanilla) ou `lib/spark.ts` (formato próprio do spark) — adicione um exemplo real capturado no arquivo de teste correspondente primeiro |
| Mudar a mensagem de erro mostrada numa requisição que falhou | `failureMessage(result, fallback)` em [`lib/api.ts`](../src/lib/api.ts) — nunca reconstrua isso inline no call site |
| Adicionar um token de design / mudar uma cor | `:root` de [`src/index.css`](../src/index.css) — nunca um hex fixo num `.css` de componente |
| Persistir uma preferência pequena do usuário | `localStorage`, seguindo o padrão de `lib/settings.ts` ou `lib/consolePrefs.ts` (um par `load`/`save`, JSON, `try/catch` defensivo em volta do acesso ao storage) |
| Entender o que mudou pra uma conta depois de uma permissão de backend subir | Confira a zona/permissão correspondente na tabela de permissão do guia do backend, depois `usePermissions().can(...)` no componente afetado |

## 14. Glossário

- **Envelope** — o formato JSON `{success, data, error}` que toda resposta de backend usa; `apiFetch` desembrulha ele.
- **Kind do `ApiResult`** — o resultado classificado de uma chamada `apiFetch` (`ok`/`unsupported`/`unauthorized`/`forbidden`/`error`/`network`); ver [§4](#4-a-camada-de-api--apifetch).
- **Servidor gerenciado** — qualquer servidor que `ServersContext.currentServerId` aponte agora; `ServerContext` sempre descreve *esse*.
- **Degradação graciosa** — o padrão central deste código: uma funcionalidade que a build de servidor atual não tem falha de forma visível e específica (`unsupported`), nunca silenciosa nem como erro genérico.
- **Fold** (dobra, no console) — esconder uma linha/bloco da visão padrão sem apagar do buffer; ver `QUIET_RULES` e `foldSparkBlocks`.
