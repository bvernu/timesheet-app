import { useTenant } from './TenantContext';

// Per-company options for time entries (stored in tenants.settings; anything not set keeps today's behaviour).
//   entryFields.project = false  -> no Project field on time entries
//   entryFields.mileage = false  -> no Mileage field
//   autoBreak           = false  -> no automatic unpaid break (hours are shown as a single "Hours" figure)
// Only an explicit `false` switches something off, so a missing or odd value can never hide a field by accident.
export function resolveSettings(tenant) {
  const s = tenant?.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
  const fields = s.entryFields && typeof s.entryFields === 'object' ? s.entryFields : {};
  return {
    projectField: fields.project !== false,
    mileageField: fields.mileage !== false,
    autoBreak: s.autoBreak !== false,
  };
}

export const useTenantSettings = () => resolveSettings(useTenant());
