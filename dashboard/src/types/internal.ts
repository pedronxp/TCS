export type InternalRole = 'owner' | 'developer' | 'support' | 'auditor';
export type StaffStatus = 'active' | 'suspended' | 'removed';
export type AssuranceLevel = 'aal1' | 'aal2';

export type InternalPermission =
  | 'console.read'
  | 'dashboard.executive.read'
  | 'dashboard.technical.read'
  | 'customer.read'
  | 'customer.sensitive.read'
  | 'customer.sensitive.request'
  | 'customer.write'
  | 'commercial.read'
  | 'commercial.write'
  | 'support.read'
  | 'support.write'
  | 'session.read'
  | 'session.terminate'
  | 'staff.read'
  | 'staff.manage'
  | 'audit.read'
  | 'technical.read'
  | 'technical.write'
  | 'build.request'
  | 'build.approve'
  | 'configuration.prepare'
  | 'configuration.publish'
  | 'protocol.read'
  | 'protocol.rotate'
  | 'account.approve'
  | 'account.lock'
  | 'account.recover_invite'
  | 'token.manage'
  | 'notification.manage';

export interface InternalStaffProfile {
  id: string;
  userId: string;
  displayName: string;
  role: InternalRole | 'master_admin' | 'admin';
  status: StaffStatus;
  permissions: InternalPermission[];
  assuranceLevel: AssuranceLevel;
  uid: string;
  municipio: string | null;
}

export interface InternalProfileRpc {
  id: string;
  user_id: string;
  display_name: string | null;
  role: InternalRole;
  status: StaffStatus;
  permissions: InternalPermission[];
  assurance_level: AssuranceLevel;
}
