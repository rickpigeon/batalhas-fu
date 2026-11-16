# Batalhas FU

Módulo de combate para **Fabula Ultima** no **Foundry VTT v13** (sistema `projectfu`, versões 4.x). O mestre monta a batalha numa cena própria e todos assistem com abertura animada, barra de turnos grupo × inimigos, faixas de turno, clima e mana trocáveis no meio do combate e animações de ataques e magias.

**Só o mestre controla o módulo.** Os jogadores não ganham botão nem painel: eles só veem a batalha. Os tokens continuam sendo os do sistema, então fichas, PV, PM, rolagens e alvos funcionam como sempre. A configuração "Jogadores veem a batalha animada" pode esconder deles a parte animada.

## Como abrir (mestre)

- Botão **Batalhas FU** nos controles de Token.
- Botão **Turnos da batalha** nos controles de Token (a janela de turnos, abaixo).
- Botão **Clima e mana da batalha** nos controles de Token (também na janela de turnos e na aba Batalha atual).
- Configurações do módulo › **Abrir o Batalhas FU**.
- Atalho de teclado (sem tecla padrão; defina em Configurar Controles).
- Macro: `game.modules.get("batalhas-fu").api.open()`, `.api.turns()` ou `.api.climaJanela()`.

## Montar uma batalha (aba Nova batalha)

**Layout**
- **Campo de batalha**: visão lateral. O grupo fica em fileira escalonada à direita e os inimigos à esquerda. Dá para espelhar cada lado e mudar o tamanho dos tokens.
- **Mesa de cartas**: vista de cima. Os inimigos ficam em cartas na metade de cima e o grupo na de baixo, sobre um pano de mesa com marcações para cada carta.

**Bioma**
- Os biomas são planície, floresta, deserto, montanha nevada, vulcão, litoral, caverna, pântano e ruínas.
- No campo, escolha a hora: dia, entardecer ou noite.
- **Mana no ar** colore as partículas e o brilho do chão. Na mesa, também os cristais da caixa de mana.
- **Clima**: o clima com que a batalha começa. "Do bioma" usa as partículas do bioma (folhas na floresta, brasas no vulcão…); dá para escolher qualquer clima da lista ou nenhum. No meio do combate ele pode ser trocado (veja Clima e mana).
- **Variação** sorteia outro arranjo.
- Cada fundo é gerado uma vez e reaproveitado depois.

**Mesa de cartas**
- **Mesa** (o tampo em volta do pano): madeira escura, madeira clara, ébano avermelhado, pedra, mármore, couro, metal rebitado, mesa arcana com runas, mapa antigo ou **imagem da biblioteca**.
  - Com "Imagem da biblioteca", escolha a imagem na galeria (ou qualquer imagem do servidor pelo ícone de pasta). Ela fica por baixo, cobrindo a cena, e o pano, as marcações das cartas e os objetos são pintados por cima. **Recorte da mesa** escolhe que faixa da imagem aparece.
  - **Objetos sobre a mesa** liga ou desliga a caixa de mana, o baralho, os dados, as velas e os objetos do bioma (folhas e cogumelos, conchas e corda, caveira e corrente, colunas e moedas…). Com uma imagem de mesa que já tem objetos, desligue.
- **Pano**: nas cores do bioma, feltro verde, feltro vinho, veludo azul, veludo roxo, feltro preto, couro curtido, mapa de campanha ou sem pano.
- **Disposição** das cartas de cada lado:
  - uma fileira por lado;
  - leque (em arco, como uma mão de cartas; as cartas das pontas ficam inclinadas);
  - escalonado (zigue-zague);
  - duas fileiras por lado;
  - frente a frente (grupo e inimigos em colunas, lado a lado, com a linha de batalha na vertical).
  As marcações no pano seguem a disposição, e o tamanho das cartas se ajusta para todos caberem.
- **Cartas › Na mesa**:
  - **Carta gerada**: cada token vira uma carta com moldura, retrato e nome. Escolha o **estilo** (clássica azul × vermelho, cores do bioma, pergaminho, obsidiana, realeza, tecnomagia, natureza, arcana) e o **desenho** (moldura com placa de nome, arte cheia com o nome numa fita, medalhão com retrato redondo, ou arco como uma carta de tarô). A prévia ao lado mostra a carta com o primeiro personagem do grupo. Se o ator já usa uma carta feita no **Cartas-editor**, essa carta é usada.
  - **Token inteiro**: o token fica do jeito que está, sem moldura (bom para tokens que já são cartas). Se a imagem tem formato de carta, o token segue a proporção dela; se não, a imagem cabe inteira no espaço da carta. Por cima vão só o nome e os contadores.
- **Contadores**: nos cantos da carta (PV embaixo à esquerda, PM embaixo à direita, PI no canto de cima) ou numa faixa embaixo da carta com o nome e PV, PM e PI. Marque o que aparece: nome, PV, PM, PI (Pontos de Inventário, só do grupo) e condições. Quando há outra carta logo abaixo (duas fileiras, frente a frente), a faixa entra na parte de baixo da carta para não cobrir a vizinha.

**Combatentes**
- **Grupo**: os personagens de jogador já vêm marcados.
- **Inimigos**: use os botões "Seleção", "Hostis da cena" ou "Do combate", ou arraste NPCs da barra lateral (com quantidade).
- Tokens trazidos de uma cena mantêm os PV atuais.

**Opções**
- **Abertura**: cartas embaralhadas, versus, choque de lâminas, portal de mana, cortinas de teatro, relâmpago, vidro estilhaçado, sorteada a cada batalha ou sem abertura. O ícone de olho mostra a abertura escolhida só na sua tela (com uma cena de batalha aberta).
- Levar todos para a batalha.
- Começar o combate em seguida. O sistema pergunta qual lado age primeiro, como de costume.

**Começar batalha** faz o seguinte:
1. Cria a cena na pasta "Batalhas FU" (2400 × 1350, sem grade).
2. Copia os tokens.
3. Cria o combate do sistema.
4. Leva todos para lá.

## Durante a batalha

- **Abertura** (todas duram menos de 5 s; quem carregar a cena até 30 s depois também vê):
  - **Cartas embaralhadas**: um baralho é embaralhado no centro da tela, uma carta virada vai até cada combatente e vira mostrando o retrato, depois as cartas se dissolvem nos tokens.
  - **Versus**: os inimigos entram pela esquerda e o grupo pela direita, com retratos e nomes, e um "VS" dourado cai no meio com clarão e tremor.
  - **Choque de lâminas**: duas espadas voam e se cruzam no centro, com faíscas, clarão, tremor e o nome do bioma.
  - **Portal de mana**: um círculo mágico gira e cresce na cor da mana da batalha e engole a tela.
  - **Cortinas de teatro**: cortinas vermelhas com uma placa dourada com o nome do bioma, que se abrem para a batalha.
  - **Relâmpago**: escuridão, um raio cai com clarão, e a batalha aparece no brilho do relâmpago.
  - **Vidro estilhaçado**: a tela com o título trinca e se parte em cacos que voam.
  - **Sorteada**: uma delas, diferente a cada batalha.
- **Barra de turnos** (topo): inimigos à esquerda, grupo à direita e, no meio, o losango da rodada apontando para o lado da vez.
  - Cada retrato mostra os turnos que restam na rodada; elites e campeões têm mais de um.
  - Quem já agiu fica apagado, e quem foi derrotado fica com um ✕.
- **Controles do mestre na barra**:
  - clique num retrato para começar o turno dele e clique de novo para encerrar;
  - os botões "Começar", "Encerrar turno" e "Próxima rodada" usam o combate do próprio sistema (`startTurn`, `endTurn`, `nextRound`).
- **Faixas**: "Vez do grupo" (azul), "Vez dos inimigos" (vermelho), "Rodada N", "Fulano está agindo" e "Vitória!". Cada uma vem com um clarão nas bordas da tela. O lado da vez fica com um brilho pulsando.
- **Marcador de turno**: quem está agindo ganha um brilho (Token Magic) e um anel sob os pés (Sequencer, ou anel próprio). Na troca, o marcador sai de um token antes de entrar no próximo.
- **Plaquinhas**: no campo, nome, PV e PM ao lado de cada token, numa versão compacta. Na mesa, os contadores escolhidos (PV, PM e PI) nos cantos ou na faixa de cada carta; na aba Batalha atual dá para mudar a posição e o que aparece sem recomeçar. Os jogadores só veem os PV dos inimigos se a configuração deixar; senão, só o nome e se o inimigo está em crise. Cada pessoa pode desligar as plaquinhas e mudar o tamanho do HUD na própria tela.
- **Painel do grupo** (campo): PV, PM e PI do grupo embaixo da tela. Pode ser recolhido.

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

### Clima e mana (mestre)

A janela **Clima e mana da batalha** muda o clima no meio do combate, na hora, para todos que estão vendo a batalha:

- **Combinações prontas**: céu limpo, dia chuvoso, tempestade elétrica, inverno cruel, tormenta no deserto, inferno, bosque encantado, pântano venenoso, noite estrelada, domínio das trevas, juízo celestial e fundo do mar.
- **Mana no ar** (até 4 ao mesmo tempo): ar, raio, trevas, terra, fogo, gelo, luz e veneno. Cada uma tem um brilho no chão e partículas próprias (brasas, cristais de gelo, faíscas e arcos elétricos, fumaça escura, brilhos dourados, pedrinhas flutuando, redemoinhos de vento, bolhas venenosas).
- **Clima** (até 6 camadas juntas):
  - chuva e água: chuva, garoa, tempestade (com relâmpagos e clarões), relâmpagos sem chuva, granizo, goteiras e bolhas;
  - frio: neve e nevasca;
  - vento e areia: tempestade de areia, ventania, poeira e feno rolando (bolas de feno que rolam e quicam pelo chão, com sombra e poeira, seguindo o vento);
  - fogo e cinzas: cinzas, brasas e chuva de meteoros;
  - natureza: folhas, pétalas, pólen, dentes-de-leão, vaga-lumes, esporos, pássaros e morcegos;
  - céu e luz: neblina, bruma no chão, estrelas, estrelas cadentes, aurora e raios de luz;
  - magia: brilhos mágicos e penas.
- **Tom da cena**: noite, entardecer, alvorada, céu de tempestade, sombrio, lua de sangue, espectral, sépia, luz dourada e gélido.
- **Intensidade** e **vento** (força e direção; a chuva, a neve, a areia e os pássaros seguem o vento).
- **Clima do bioma** volta às partículas do bioma; **Limpar tudo** tira clima, mana e tom.
- O brilho de mana que foi **pintado no fundo** quando a batalha começou não muda sozinho. Quando a mana escolhida é outra, a janela oferece **Repintar o fundo**, que gera o fundo de novo com a mana nova (todos recarregam a cena).

O clima é desenhado por cima da cena, abaixo das plaquinhas e da barra. Os jogadores veem o clima mesmo com "Jogadores veem a batalha animada" desligado. Cada pessoa pode desligar as partículas na própria tela ("Clima e partículas"); os tons de cor continuam.

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

- **Rejogar abertura** (escolha qual, ou "Sorteada"), **faixas manuais** e **reforços**:
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

Na aba Nova batalha, **Fundo › Biblioteca** abre uma galeria de imagens prontas, com favoritos (★) e busca. A imagem escolhida vale só para aquela batalha; na aba Fundos ela pode ser fixada num bioma.

**Tags e busca rápida**
- Passe o mouse numa miniatura e clique no ícone de etiqueta para dar tags a ela (por exemplo "floresta, noite, chuva"; separe várias por vírgula e tecle Enter). As tags aparecem na miniatura e podem ser tiradas no ×.
- **Marcar várias**: clique em várias imagens (ou em "Marcar as visíveis", depois de filtrar) e adicione ou tire uma tag de todas de uma vez. As tags mais usadas aparecem como sugestão.
- A busca aceita número, nome ou tag, sem acento e pelo começo da palavra ("flor" acha "floresta"). Várias palavras precisam combinar todas.
- A barra de tags acima da galeria filtra com um clique, mostra quantas imagens têm cada tag e tem os filtros **Sem tag** (para achar o que falta etiquetar) e **Novas**.
- **Imagens novas**: qualquer imagem copiada depois para `batalhas-fu-fundos/fundos` ou `batalhas-fu-fundos/novos` aparece na galeria, marcada como nova, e pode receber tags como as outras.
- As tags ficam no mundo e também em `batalhas-fu-fundos/tags.json`, então valem em todos os mundos desse Foundry (o mais recente vale).

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
  - **Clima e partículas** (desligado, ficam só os tons de cor).

## API

```js
const api = game.modules.get("batalhas-fu").api;
api.open();                                   // painel do mestre
api.turns();                                  // janela Turnos da batalha
api.climaJanela();                            // janela Clima e mana
await api.start({
  setup: { layout: "mesa", biome: "caverna", table: "arcano", mat: "roxo", arrangement: "leque",
           cardMode: "gerada", cardStyle: "arcana", cardDesign: "medalhao", counters: "cantos",
           cardInfo: { name: true, hp: true, mp: true, ip: true, status: true },
           mana: "dark", weather: "", intro: true, introStyle: "versus", props: true },
  // mesa da biblioteca: table: "biblioteca", tableLib: "<caminho da imagem>", tableFocus: 0.5
  // cardMode "token" = token inteiro; counters "faixa" = faixa embaixo; weather "" = do bioma, "nenhum" ou uma camada
  // fundo da biblioteca: setup.bgMode = "biblioteca", setup.bgLib = "<caminho da imagem>", setup.bgFocus = 0.5
  party: [{ kind: "actor", id: "<id do ator>" }],
  foes:  [{ kind: "token", uuid: "Scene.x.Token.y" }, { kind: "actor", id: "<id do NPC>" }]
});
await api.add([{ kind: "actor", id: "<id>" }], "foes");   // reforços
await api.end({ giveBack: true, back: true, deleteScene: false });
api.intro("portal");                          // rejoga a abertura (sem nome: a da batalha; "sorteada": uma qualquer)
await api.clima({ mana: ["fire", "dark"], layers: ["brasas", "cinzas"], tint: "sangue", intensity: 1.2, wind: 0.3 });
await api.cartas({ counters: "faixa", cardInfo: { mp: false } });  // contadores das cartas, ao vivo
await api.repintar("fire");                   // repinta o fundo com outra mana ("" = nenhuma)
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
