import { formatDuration } from './duration';

// A time entry belongs to ONE project (the usual way: entry.project_id / entry.projects) or, for companies that switched on
// "several projects per entry", to MANY through entry.time_entry_projects. These helpers hide the difference.

// The select() text that loads an entry's projects. Companies without multi-project keep the simple form so the website
// still works before the matching database update has been run.
export const PROJECT_EMBED_ONE = 'projects!time_entries_project_id_fkey (name)';
export const PROJECT_EMBED_MANY = `${PROJECT_EMBED_ONE},\n        time_entry_projects (project_id, projects (name))`;
// Same, plus the minutes per project (only when the matching database update, script 13, has been run)
export const PROJECT_EMBED_MANY_HOURS = `${PROJECT_EMBED_ONE},\n        time_entry_projects (project_id, minutes, projects (name))`;

// [{ id, name }] for an entry, whichever way it was saved
export const entryProjects = (entry) => {
  const links = entry?.time_entry_projects;
  if (Array.isArray(links) && links.length > 0) {
    return links.map((l) => ({ id: l.project_id, name: l.projects?.name || 'Unknown', minutes: l.minutes ?? null }));
  }
  if (entry?.project_id) return [{ id: entry.project_id, name: entry.projects?.name || 'Unknown' }];
  return [];
};

// "Alpha, Beta" - or "Alpha (5h), Beta (3h)" when the hours per project were entered
export const entryProjectLabel = (entry) =>
  entryProjects(entry).map((p) => (p.minutes ? `${p.name} (${formatDuration(p.minutes)})` : p.name)).join(', ');

// The fraction (0-1) of an entry's hours that belongs to one project: by the minutes entered when EVERY project has them,
// otherwise an equal split.
export const projectShare = (links, projectId) => {
  const list = Array.isArray(links) ? links : [];
  if (list.length === 0) return 1;
  const timed = list.every((l) => l.minutes > 0);
  if (timed) {
    const total = list.reduce((t, l) => t + l.minutes, 0);
    const mine = list.find((l) => l.project_id === projectId);
    return mine ? mine.minutes / total : 0;
  }
  return 1 / list.length;
};

// How many projects an entry's hours are shared between (at least 1)
export const projectCount = (entry) => Math.max(1, entryProjects(entry).length);
