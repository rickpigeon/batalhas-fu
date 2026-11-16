# Changelog

## 1.2.0

Biblioteca de fundos:
- **Tags**: o mestre etiqueta as imagens (uma a uma pelo ícone de etiqueta, ou várias de uma vez em "Marcar várias"), com sugestões das tags mais usadas.
- **Busca rápida** por número, nome ou tag (sem acento, pelo começo da palavra, várias palavras juntas) e barra de tags com contagem, mais os filtros "Sem tag" e "Novas".
- Imagens copiadas depois para `batalhas-fu-fundos/fundos` ou `batalhas-fu-fundos/novos` aparecem na galeria como novas.
- As tags ficam no mundo e em `batalhas-fu-fundos/tags.json`, valendo para todos os mundos.

Mesa de cartas:
- 9 tampos de mesa (novos: ébano, mármore, couro, metal rebitado, mesa arcana, mapa antigo) e 9 panos (cores do bioma, feltros, veludos, couro, mapa de campanha ou sem pano).
- 5 disposições das cartas: uma fileira, leque em arco (cartas inclinadas), escalonado, duas fileiras e frente a frente (colunas lado a lado). As marcações do pano e o brilho do lado da vez seguem a disposição.
- Cartas geradas com 8 estilos (clássica, cores do bioma, pergaminho, obsidiana, realeza, tecnomagia, natureza, arcana) e 4 desenhos (moldura, arte cheia, medalhão, arco/tarô), com prévia no painel.
- **Token inteiro**: o token fica como está (para tokens que já são cartas), com só o nome e os contadores por cima.
- **Contador de Pontos de Inventário (PI)** do grupo nas cartas.
- Contadores nos cantos ou numa faixa embaixo da carta, escolhendo o que aparece (nome, PV, PM, PI, condições). Dá para mudar durante a batalha.

Clima e mana no meio do combate:
- Nova janela **Clima e mana da batalha** (controles de Token, janela de turnos, aba Batalha atual), ao vivo para todos.
- 31 climas para combinar até 6 de uma vez: chuva, garoa, tempestade com relâmpagos, relâmpagos, granizo, goteiras, bolhas, neve, nevasca, tempestade de areia, ventania, poeira, cinzas, brasas, chuva de meteoros, folhas, pétalas, pólen, dentes-de-leão, vaga-lumes, esporos, pássaros, morcegos, neblina, bruma no chão, estrelas, estrelas cadentes, aurora, raios de luz, brilhos mágicos e penas.
- Até 4 manas no ar ao mesmo tempo, cada uma com brilho no chão e partículas próprias.
- 11 tons de cena, intensidade, vento com direção e 12 combinações prontas.
- Clima inicial escolhido na Nova batalha (padrão: o do bioma).
- "Repintar o fundo" para trocar o brilho de mana pintado no fundo.
- As partículas antigas do bioma foram trocadas por esse motor de clima (um canvas só, mais leve). Os jogadores veem o clima mesmo com a batalha animada escondida.

## 1.1.0

Correções:
- **Passar a vez**: a barra e as faixas reagiam a cada atualização intermediária do `endTurn` do sistema (que grava em várias etapas) e podiam ficar presas em "Vez do grupo". Agora esperam o combate assentar e o lado da vez segue o sistema (`getCurrentTurn`, e na falta dele `determineNextTurn`).
- **Vez dos inimigos**: com o lado certo, a barra, o brilho lateral e a faixa vermelha aparecem. A nova janela de turnos tem "Encerrar e passar", que já começa o primeiro inimigo.
- **Marcador de turno**: a troca é feita em fila (sai de um token antes de entrar no próximo), cada anel do Sequencer tem nome por token e o brilho do Token Magic é conferido nos dados do token antes de ser removido. Não sobra marcador no token anterior.
- **Efeitos de combate**:
  - antes só o mestre tocava as animações e só se estivesse na cena da batalha. Agora quem rolou toca a animação (o Sequencer sincroniza; sem ele o módulo envia com a cena certa) e o mestre aplica só as reações do Token Magic;
  - "Animar também fora das batalhas" agora vem ligada;
  - crise e derrota não animam mais ao sair da crise ou ao voltar do nocaute (o sistema dispara o mesmo evento nos dois sentidos).
- **Galeria e listas** não piscam mais a cada mudança de PV (atualizações agrupadas).

Novidades:
- **Janela Turnos da batalha** para o mestre: móvel e redimensionável, abre sozinha na batalha, com grupo e inimigos, começar/encerrar turno, "Começar o próximo", "Encerrar e passar", próxima rodada, troca manual do lado da vez e faixas manuais. Também tem botão nos controles de Token e `api.turns()`.
- **Biblioteca de fundos**: galeria com miniaturas, busca por número e favoritos; recorte no formato da cena com altura ajustável, mana e luz da hora por cima. A pasta das imagens fica fora do módulo (configuração "Pasta da biblioteca de fundos").
- **HUD com mais respiro**: tamanho ajustável em cada tela (0,7× a 1,4×), plaquinhas compactas que podem ser desligadas, mais espaço na barra, nas faixas e no painel. O painel do mestre se reorganiza quando a janela é redimensionada.
- **Registro de eventos** na aba Efeitos (de todos os clientes, com o caminho que cada animação tomou) e aviso quando o evento de dano do sistema não foi encontrado.

## 1.0.0

- Primeira versão (Foundry v13, sistema Fabula Ultima 4.x; só o mestre controla).
- Dois layouts:
  - campo de batalha lateral, com fileiras;
  - mesa de cartas, com as cartas de combate geradas e a carta do Cartas-editor reaproveitada.
- 9 biomas com fundos gerados:
  - no campo: dia, entardecer e noite;
  - na mesa: três tampos e objetos de cada bioma;
  - mana no ar e variações em ambos;
  - fundo próprio por bioma.
- Abertura com baralho embaralhado, cartas distribuídas viradas e reveladas sobre os tokens.
- Barra de turnos grupo × inimigos ligada ao combate do sistema:
  - turnos restantes, derrotados e crise;
  - iniciar e encerrar turnos e próxima rodada.
- Faixas de turno, rodada, combatente e vitória; brilho do lado da vez; plaquinhas de PV/PM; painel do grupo; partículas do bioma.
- Animações a partir dos eventos do sistema: ataque, magia, habilidade, item, dano com afinidade, cura, crise e derrota.
  - Sequencer e Token Magic FX quando ativos, JB2A opcional, animações próprias como alternativa.
  - 21 imagens de efeito próprias.
- Reforços durante a batalha; encerramento devolvendo PV/PM aos tokens de origem e voltando à cena anterior.
- Painel do mestre com abas Nova batalha, Batalha atual, Fundos e Efeitos (teste de animações).
