import { supabase } from '@/lib/supabase';
import type { InboxWorkspace } from '@/lib/inbox';

type RpcResult = { data: unknown; error: { message: string } | null };
type TutorialRpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc = supabase.rpc.bind(supabase) as unknown as TutorialRpc;

export async function getTutorialPreference(input: {
  workspace: InboxWorkspace;
  organizationId: string | null;
  tutorialKey: string;
  version: number;
}) {
  const { data, error } = await rpc('get_tutorial_preference', {
    p_workspace_kind: input.workspace,
    p_organization_id: input.organizationId,
    p_tutorial_key: input.tutorialKey,
    p_tutorial_version: input.version,
  });
  if (error) throw new Error(error.message);
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
  return { suppressed: row.suppressed === true };
}

export async function saveTutorialPreference(input: {
  workspace: InboxWorkspace;
  organizationId: string | null;
  tutorialKey: string;
  version: number;
  suppressed: boolean;
  completed: boolean;
}) {
  const { error } = await rpc('set_tutorial_preference', {
    p_workspace_kind: input.workspace,
    p_organization_id: input.organizationId,
    p_tutorial_key: input.tutorialKey,
    p_tutorial_version: input.version,
    p_suppressed: input.suppressed,
    p_completed: input.completed,
  });
  if (error) throw new Error(error.message);
}

