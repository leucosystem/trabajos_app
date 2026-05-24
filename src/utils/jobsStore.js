const JOBS_KEY = "trabajos-items";

function readRawJobs() {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRawJobs(jobs) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function listJobs() {
  return readRawJobs().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function saveJob(job) {
  const jobs = readRawJobs();
  const now = new Date().toISOString();

  if (job.id) {
    const idx = jobs.findIndex((item) => item.id === job.id);
    if (idx >= 0) {
      jobs[idx] = { ...jobs[idx], ...job, updatedAt: now };
      writeRawJobs(jobs);
      return jobs[idx];
    }
  }

  const created = {
    ...job,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  jobs.push(created);
  writeRawJobs(jobs);
  return created;
}

export function removeJob(id) {
  const jobs = readRawJobs().filter((item) => item.id !== id);
  writeRawJobs(jobs);
}
