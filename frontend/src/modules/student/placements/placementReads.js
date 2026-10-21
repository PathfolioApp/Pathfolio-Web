// Coalesce only active reads for the same signed-in student. No completed data
// is cached: eligibility, deadlines and application status stay fresh on reload.
const pending = new Map();
export function placementRead(studentId, path, read) {
  if (!studentId) return read();
  const key = JSON.stringify([studentId, path]);
  if (pending.has(key)) return pending.get(key);
  const request = Promise.resolve().then(read);
  pending.set(key, request);
  const clear = () => { if (pending.get(key) === request) pending.delete(key); };
  request.then(clear, clear);
  return request;
}
