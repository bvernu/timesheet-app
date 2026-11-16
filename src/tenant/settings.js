import { useTenant } from './TenantContext';

// Per-company options for time entries (stored in tenants.settings; anything not set keeps today's behaviour).
//   entryFields.project = false  -> no Project field on time entries
//   entryFields.mileage = false  -> no Mileage field
//   autoBreak           = false  -> no automatic unpaid break (hours are shown as a single "Hours" figure)
//   entryFields.multiProject = true -> a time entry is linked to one OR MORE projects (hours split equally between them)
//   entryFields.projectHours = true -> the employee says how long they spent on each project of an entry
//   procurement         = true   -> projects track suppliers, client invoices + payments and profit; project fields are
//                                   renamed (Address -> Project name, Company -> Client name); Project type is free text
// Only an explicit `false` switches a default-on feature off (and only an explicit `true` switches an extra feature on), so a missing or odd value can never hide a field by accident.
export function resolveSettings(tenant) {
  const s = tenant?.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
  const fields = s.entryFields && typeof s.entryFields === 'object' ? s.entryFields : {};
  return {
    projectField: fields.project !== false,
    mileageField: fields.mileage !== false,
    autoBreak: s.autoBreak !== false,
    multiProject: fields.multiProject === true,
    // hours entered per project (only meaningful together with multiProject)
    projectHours: fields.multiProject === true && fields.projectHours === true,
    procurement: s.procurement === true,
  };
}

export const useTenantSettings = () => resolveSettings(useTenant());
