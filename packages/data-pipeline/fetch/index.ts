import { fetchPeople } from "./fetch-people.js";
import { fetchEvents } from "./fetch-events.js";
import { fetchReigns } from "./fetch-reigns.js";

async function main(): Promise<void> {
  await fetchPeople();
  // Depends on people.raw.json already being on disk (reads the candidate
  // person IDs back out of it) — must run after fetchPeople().
  await fetchReigns();
  await fetchEvents();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
