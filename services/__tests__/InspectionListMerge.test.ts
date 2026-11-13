import { mergePendingInspectionArchiveState } from '../InspectionListMerge';
it('uses server archive state while preserving pending local photos and sync errors', () => {
  const local = { id: 'inspection-1', owner_archived_at: null, sincronizado: 0, foto_url: 'file://pending.jpg', erro_sync: 'Upload pendente' };
  const archived = mergePendingInspectionArchiveState([local], [{ id: 'inspection-1', owner_archived_at: '2026-11-12T15:00:00Z' }]);
  expect(archived[0]).toEqual({ ...local, owner_archived_at: '2026-11-12T15:00:00Z' });
  expect(mergePendingInspectionArchiveState(archived, [{ id: 'inspection-1', owner_archived_at: null }])[0].owner_archived_at).toBeNull();
  expect(mergePendingInspectionArchiveState([local], [])[0]).toEqual(local);
});
