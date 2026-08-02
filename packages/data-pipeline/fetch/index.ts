import { fetchPeople } from "./fetch-people.js";
import { fetchEvents } from "./fetch-events.js";

async function main(): Promise<void> {
  await fetchPeople();
  await fetchEvents();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
