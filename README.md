# Batalhas FU

Módulo de combate para **Fabula Ultima** no **Foundry VTT v13** (sistema `projectfu`, versões 4.x). O mestre monta a batalha numa cena própria e todos assistem com abertura animada, barra de turnos grupo × inimigos, faixas de turno e animações de ataques e magias.

**Só o mestre controla o módulo.** Os jogadores não ganham botão nem painel: eles só veem a batalha. Os tokens continuam sendo os do sistema, então fichas, PV, PM, rolagens e alvos funcionam como sempre. A configuração "Jogadores veem a batalha animada" pode esconder deles a parte animada.

## Como abrir (mestre)

- Botão **Batalhas FU** nos controles de Token.
- Botão **Turnos da batalha** nos controles de Token (a janela de turnos, abaixo).
- Configurações do módulo › **Abrir o Batalhas FU**.
- Atalho de teclado (sem tecla padrão; defina em Configurar Controles).
- Macro: `game.modules.get("batalhas-fu").api.open()` ou `.api.turns()`.

## Montar uma batalha (aba Nova batalha)

**Layout**
- **Campo de batalha**: visão lateral. O grupo fica em fileira escalonada à direita e os inimigos à esquerda. Dá para espelhar cada lado e mudar o tamanho dos tokens.
- **Mesa de cartas**: vista de cima. Os inimigos ficam em cartas na metade de cima e o grupo na de baixo, sobre um pano de mesa com marcações para cada carta.
  - Cada token vira uma carta (moldura, retrato e nome). Se o ator já usa uma carta feita no **Cartas-editor**, essa carta é usada.

**Bioma**
- Os biomas são planície, floresta, deserto, montanha nevada, vulcão, litoral, caverna, pântano e ruínas.
- No campo, escolha a hora: dia, entardecer ou noite.
- Na mesa, escolha o tampo: madeira escura, madeira clara ou pedra. Os objetos sobre a madeira mudam com o bioma (folhas e cogumelos, conchas e corda, caveira e corrente, colunas e moedas…).
- **Mana no ar** colore as partículas e o brilho do chão. Na mesa, também os cristais da caixa de mana.
- **Variação** sorteia outro arranjo.
- Cada fundo é gerado uma vez e reaproveitado depois.

**Combatentes**
- **Grupo**: os personagens de jogador já vêm marcados.
- **Inimigos**: use os botões "Seleção", "Hostis da cena" ou "Do combate", ou arraste NPCs da barra lateral (com quantidade).
- Tokens trazidos de uma cena mantêm os PV atuais.

**Opções**
- Abertura com cartas embaralhadas.
- Levar todos para a batalha.
- Começar o combate em seguida. O sistema pergunta qual lado age primeiro, como de costume.

**Começar batalha** faz o seguinte:
1. Cria a cena na pasta "Batalhas FU" (2400 × 1350, sem grade).
2. Copia os tokens.
3. Cria o combate do sistema.
4. Leva todos para lá.

## Durante a batalha

- **Abertura**: um baralho é embaralhado no centro da tela. Uma carta virada para baixo vai até cada combatente e vira mostrando o retrato. Depois as cartas se dissolvem nos tokens. Quem carregar a cena até 30 s depois também vê a abertura.
- **Barra de turnos** (topo): inimigos à esquerda, grupo à direita e, no meio, o losango da rodada apontando para o lado da vez.
  - Cada retrato mostra os turnos que restam na rodada; elites e campeões têm mais de um.
  - Quem já agiu fica apagado, e quem foi derrotado fica com um ✕.
- **Controles do mestre na barra**:
  - clique num retrato para começar o turno dele e clique de novo para encerrar;
  - os botões "Começar", "Encerrar turno" e "Próxima rodada" usam o combate do próprio sistema (`startTurn`, `endTurn`, `nextRound`).
- **Faixas**: "Vez do grupo" (azul), "Vez dos inimigos" (vermelho), "Rodada N", "Fulano está agindo" e "Vitória!". Cada uma vem com um clarão nas bordas da tela. O lado da vez fica com um brilho pulsando.
- **Marcador de turno**: quem está agindo ganha um brilho (Token Magic) e um anel sob os pés (Sequencer, ou anel próprio). Na troca, o marcador sai de um token antes de entrar no próximo.
- **Plaquinhas**: no campo, nome, PV e PM ao lado de cada token, numa versão compacta. Na mesa, PV (vermelho) e PM (azul) nos cantos de cada carta. Os jogadores só veem os PV dos inimigos se a configuração deixar; senão, só o nome e se o inimigo está em crise. Cada pessoa pode desligar as plaquinhas e mudar o tamanho do HUD na própria tela.

### Janela Turnos da batalha (mestre)

Uma janela normal do Foundry, que pode ser movida e redimensionada. Ela abre sozinha quando o mestre entra numa cena de batalha (dá para desligar nas configurações) e concentra os controles de turno:

- **Rodada** e **lado da vez** ("Vez do grupo" / "Vez dos inimigos"), com quem está agindo.
- **Grupo** e **Inimigos** em duas listas, com PV, PM e os turnos que restam. Larga, a janela mostra as listas lado a lado; estreita, uma embaixo da outra. Clique no retrato ou no nome para centralizar o mapa no token.
- **▶** ao lado de cada combatente começa o turno dele; **■** encerra.
- **Começar o próximo** começa o turno do primeiro disponível do lado da vez (de cima para baixo no mapa).
- **Encerrar e passar** encerra o turno de quem está agindo e já começa o próximo do lado que o sistema indicar. É o jeito mais rápido de alternar grupo e inimigos.
- **Próxima rodada** (⏩) e **trocar o lado da vez** (⇄), para corrigir a vez à mão quando a mesa precisar.
- **Faixa: grupo / Faixa: inimigos** mostram a faixa para todos sem mexer no combate.

Tudo isso usa o combate do próprio sistema (`startTurn`, `endTurn`, `nextRound`, `setCurrentTurn`), então o Combat Tracker continua certo.
- **Painel do grupo** (campo): PV, PM e PI do grupo embaixo da tela. Pode ser recolhido.
- **Partículas do bioma**: folhas, neve, brasas, areia, vaga-lumes, poeira, brisa ou pólen, mais as partículas de mana. Cada jogador pode desligá-las na própria tela.

## Animações

As animações saem dos eventos do próprio sistema Fabula Ultima. Quem rola não precisa fazer nada:

| Evento do sistema | Animação |
|---|---|
| Ataque corpo a corpo | corte no alvo + impacto do elemento |
| Ataque à distância | flecha voando até o alvo + impacto |
| Magia ofensiva | círculo mágico sob quem conjura, orbe até o alvo, explosão do elemento (raio também desenha o relâmpago) |
| Crítico | explosão de luz e tremor de câmera |
| Falha crítica | "Falha!" |
| Magia de suporte, habilidade, item | círculo, brilhos subindo, onda |
| Dano | número no alvo com a cor do elemento, mais "FRAQUEZA!", "RESISTE", "IMUNE" ou "ABSORVE"; fraqueza sacode a câmera |
| Cura / recuperar PM | número verde ou azul + brilhos |
| Crise | aura vermelha pulsando no token |
| Derrota | caveira + vórtice; o token fica cinza |

- **Sequencer** (recomendado): as animações aparecem no canvas, para todos. O token de quem está agindo ganha um anel girando sob os pés.
- **Token Magic FX** (recomendado): brilho de turno, impacto, cura, crise e nocaute aparecem no próprio token.
- **Sem eles**, o módulo desenha as mesmas animações por cima do mapa, e um anel marca quem está agindo.
- **JB2A** (opcional): se estiver ativo, alguns golpes e magias usam os vídeos dele.
- As 21 imagens de efeito (`assets/fx`) são do próprio módulo. Os desenhos-fonte estão em `tools/` (fora do pacote).

**Quem toca cada parte**
- A animação sai do computador de quem rolou (jogador ou mestre). Pelo Sequencer, ela é sincronizada para todos; sem ele, o módulo a envia aos outros clientes com a cena certa. Assim os efeitos funcionam mesmo que o mestre esteja olhando outra cena.
- As reações nos tokens (brilho de impacto, cura, crise, nocaute, via Token Magic) são aplicadas pelo mestre, porque mexem nos dados do token. O pedido chega ao mestre pelo socket do módulo.
- Crise e derrota só animam quando o token **entra** em crise ou **cai**. Sair da crise ou voltar do nocaute não toca o efeito.

A aba **Efeitos** do painel mostra quais módulos estão ativos, se o evento de dano do sistema foi encontrado, testa cada animação no token selecionado e nos alvos e traz um **registro dos últimos eventos** (de todos os clientes) com o que foi tocado em cada um. Se uma animação não aparecer, esse registro mostra se o evento chegou e por qual caminho ele saiu.

## Batalha atual e encerramento

- **Rejogar abertura**, **faixas manuais** e **reforços**:
  - "Seleção → inimigos" e "Seleção → grupo" puxam tokens selecionados de outra cena;
  - "Reforços da lista" usa a lista de inimigos.
  - Os reforços entram na batalha e no combate, e o lado se reorganiza.
- **Encerrar batalha**:
  - devolve PV, PM e efeitos aos tokens de origem (NPCs não vinculados; personagens vinculados já compartilham o ator);
  - apaga o combate;
  - volta todos para a cena anterior;
  - se marcado, apaga a cena da batalha.

## Fundos (aba Fundos)

Para cada layout e bioma, o módulo usa o fundo gerado por ele, uma imagem da biblioteca (**Da biblioteca**) ou uma imagem sua (**Escolher imagem**). Imagens próprias ocupam a cena inteira (2400 × 1350). Os arquivos gerados ficam em `worlds/<mundo>/batalhas-fu/fundos` e as cartas da mesa em `worlds/<mundo>/batalhas-fu/cartas`.

### Biblioteca de fundos

Na aba Nova batalha, **Fundo › Biblioteca** abre uma galeria de imagens prontas, com busca por número e favoritos (★). A imagem escolhida vale só para aquela batalha; na aba Fundos ela pode ser fixada num bioma.

- As imagens de batalha costumam ser mais baixas que a cena (16:9). O módulo recorta a imagem no formato da cena, aplica por cima as partículas de mana e a luz da hora e salva o resultado em `worlds/<mundo>/batalhas-fu/fundos`, uma vez por imagem.
- **Altura do recorte** escolhe que faixa da imagem aparece (céu, meio ou chão).
- A biblioteca **não vem dentro do módulo**. Ela é uma pasta separada (`batalhas-fu-fundos`, com `indice.json`, `fundos/` e `miniaturas/`) que vai na raiz dos dados do Foundry, ao lado de `modules` e `worlds`. A pasta é configurável em **Pasta da biblioteca de fundos**. Sem ela, a galeria explica como instalar e o resto do módulo funciona normalmente.

## Configurações

- **Jogadores veem a batalha animada**: barra, faixas, abertura e números.
- **Animar ataques, magias, dano e cura**.
- **Animar também fora das batalhas** (ligada por padrão).
- **Usar efeitos do JB2A quando houver**.
- **Tremer a tela em golpes fortes**.
- **Jogadores veem os PV dos inimigos**.
- **Pasta da biblioteca de fundos** (padrão `batalhas-fu-fundos`).
- Na tela de cada um:
  - **Tamanho do HUD da batalha** (0,7× a 1,4×): barra de turnos, plaquinhas, painel do grupo e faixas;
  - **Plaquinhas com nome e PV nos tokens**;
  - **Abrir a janela de turnos ao entrar numa batalha** (mestre);
  - **Partículas do bioma**.

## API

```js
const api = game.modules.get("batalhas-fu").api;
api.open();                                   // painel do mestre
api.turns();                                  // janela Turnos da batalha
await api.start({
  setup: { layout: "mesa", biome: "caverna", table: "pedra", mana: "dark", intro: true },
  // fundo da biblioteca: setup.bgMode = "biblioteca", setup.bgLib = "<caminho da imagem>", setup.bgFocus = 0.5
  party: [{ kind: "actor", id: "<id do ator>" }],
  foes:  [{ kind: "token", uuid: "Scene.x.Token.y" }, { kind: "actor", id: "<id do NPC>" }]
});
await api.add([{ kind: "actor", id: "<id>" }], "foes");   // reforços
await api.end({ giveBack: true, back: true, deleteScene: false });
api.intro();                                  // rejoga a abertura
api.play({ kind: "attack", style: "spell", element: "ice", source: "<uuid do token>", targets: ["<uuid>"] });
api.backends();                               // { sequencer, tokenmagic, jb2a }
```

## Observações

- **Teste**: feito num ambiente que simula o Foundry v13 e o combate do sistema, com Sequencer e Token Magic simulados (as chamadas foram conferidas com a documentação deles). Não foi testado num Foundry real.
- **Se algo falhar, comece por**:
  - o registro de eventos da aba Efeitos;
  - o envio de arquivos (fundos e cartas);
  - a ativação da cena;
  - o diálogo do sistema que pergunta quem age primeiro;
  - o evento de dano: o sistema o despacha pelo `AsyncHooks` interno, que o módulo importa de `systems/projectfu/module/helpers/async-hooks.mjs`. Se essa importação falhar, os números de dano vêm das mudanças de PV, sem elemento nem afinidade.
- **Versão do sistema**: o sistema Fabula Ultima 5.x é para Foundry v14. Este módulo segue o 4.x (v4.16.3), que é o do v13.

## Licença

Código e imagens sob licença MIT (veja `LICENSE`).
