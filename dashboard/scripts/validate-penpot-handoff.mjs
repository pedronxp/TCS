import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { routeManifest, routeTemplates } from '../design/route-manifest.mjs';
import {
  penpotHandoff,
  penpotTarget,
  portalBoards,
  requiredBreakpoints,
  specificBoards,
  templateBoards,
} from '../design/penpot-handoff.mjs';

const requiredTemplates = routeTemplates.filter((template) =>
  template !== 'design-reference');
const handoffTemplates = new Set(templateBoards.map((board) => board.template));
assert.deepEqual(
  [...handoffTemplates].sort(),
  [...requiredTemplates].sort(),
  'O handoff Penpot deve cobrir todos os templates operacionais.',
);

const routeIds = new Set(routeManifest.map((entry) => entry.id));
for (const board of [...templateBoards, ...specificBoards]) {
  assert(board.id && board.name && board.targetPage, 'Board pendente sem identificação ou página.');
  assert.equal(board.approvalStatus, 'approved', `${board.id} deve estar aprovado no Penpot.`);
  if ('representativeRoute' in board) {
    assert(routeIds.has(board.representativeRoute), `Rota representativa ausente: ${board.representativeRoute}`);
  } else {
    assert(routeIds.has(board.id), `Board específico sem entrada no manifesto: ${board.id}`);
  }
  await access(new URL(`../${board.source}`, import.meta.url));
  for (const source of board.responsiveSources ?? []) {
    await access(new URL(`../${source}`, import.meta.url));
  }
}

assert.deepEqual(requiredBreakpoints, [1440, 1024, 768, 390]);
assert.equal(penpotHandoff.project, 'TCS — Web Dashboard');
assert.match(penpotTarget.teamId, /^[0-9a-f-]{36}$/);
assert.match(penpotTarget.fileId, /^[0-9a-f-]{36}$/);
assert.match(penpotTarget.initialPageId, /^[0-9a-f-]{36}$/);
assert.equal(penpotTarget.verifiedExistingPages.length, 34);
assert.equal(new Set(penpotTarget.verifiedExistingPages).size, 34);
assert.equal(portalBoards.length, 21);
assert(portalBoards.every((board) => board.approvalStatus === 'approved'));
assert.equal(penpotHandoff.status, 'approved-in-penpot');
assert.equal(penpotHandoff.pages.length, 12);

console.log(`Handoff Penpot validado: ${templateBoards.length} templates, ${specificBoards.length} boards específicos e ${portalBoards.length} boards de portal.`);
