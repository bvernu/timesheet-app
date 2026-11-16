import { useTenant } from './TenantContext';

// Per-company options for time entries (stored in tenants.settings; anything not set keeps today's behaviour).
//   entryFields.project = false  -> no Project field on time entries
//   entryFields.mileage = false  -> no Mileage field
//   autoBreak           = false  -> no automatic unpaid break (hours are shown as a single "Hours" figure)
//   projectLabels       = true   -> project wording: Address -> Project name, Company -> Client name, and Project type
//                                   becomes free text instead of the fixed list
// Only an explicit `false` switches a default-on feature off, and only an explicit `true` switches an extra one on,
// so a missing or odd value can never change anything by accident.
export function resolveSettings(tenant) {
  const s = tenant?.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
  const fields = s.entryFields && typeof s.entryFields === 'object' ? s.entryFields : {};
  return {
    projectField: fields.project !== false,
    mileageField: fields.mileage !== false,
    autoBreak: s.autoBreak !== false,
    projectLabels: s.projectLabels === true,
  };
}

export const useTenantSettings = () => resolveSettings(useTenant());
