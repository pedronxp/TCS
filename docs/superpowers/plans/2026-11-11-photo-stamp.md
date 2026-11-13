# Carimbo georreferenciado — implementação

**Objetivo aprovado no chat:** gravar localização visível no JPEG; endereço disponível com internet e coordenadas GPS sem internet. Preservar EXIF e hash do arquivo final.

**Arquitetura:** serviço de consulta com limite de tempo e fallback GPS; compositor React Native montado na raiz, capturado com react-native-view-shot; captura → compressão → carimbo → EXIF → hash. Fotos de galeria não recebem GPS atual.

**Decisões:** faixa escura e texto branco no canto inferior esquerdo; data/hora com fuso, coordenadas e precisão sempre; rua/bairro/cidade/UF somente retornados pelo serviço. Sem GPS, declarar indisponibilidade. Falha do compositor deve ser explícita e nunca apagar a foto original. Trabalhar no checkout atual para preservar e testar a implementação não commitada do Claude.

## Tarefas
- [x] Testes primeiro: endereço completo/parcial, offline, falha e timeout; gravação antes de EXIF e hash; erro de composição.
- [x] Implementar consulta e compositor com espera por imagem/layout, timeout e fila.
- [x] Integrar captura, corrigir perda de proveniência e tratar processamento/erros nas duas telas.
- [x] Rodar testes, typecheck, exportação iOS e revisão independente.

## Verificação no aparelho
Expo Go: câmera online com endereço; sem internet com GPS; permissão negada; JPEG aberto fora do app com carimbo; EXIF legível após composição; reabrir foto sincronizada. Não há aparelho conectado confirmado nesta sessão.

## Progresso
Plano criado; alterações anteriores do usuário preservadas. Sem commit automático.

Revisão independente identificou dois problemas, ambos reproduzidos por testes e corrigidos: redimensionamento abandonava o host; fallback de persistência poderia eliminar a cópia durável. Revisão final sem outros pontos importantes. Typecheck passou; suíte final com 44 suítes e 349 testes aprovados; exportação iOS final aprovada. O renderer do teste recebeu limite de 15s para inicialização sob carga do Metro, mantendo os prazos do produto testados por relógio simulado. Teste no aparelho permanece pendente conforme roteiro em `docs/debug/2026-11-11-photo-stamp-validation.md`.
