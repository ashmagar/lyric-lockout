import type { HostOverrideType } from '../enums';

export interface HostOverride {
  id: string;
  type: HostOverrideType;
  targetId?: string | undefined;
  previousValue?: unknown;
  newValue: unknown;
  reason?: string | undefined;
  createdAt: string;
}
