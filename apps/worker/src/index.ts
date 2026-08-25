import { createMoodleSyncWorker } from "./moodle-sync/moodle-sync.worker";

console.log("Worker initialisé");

const moodleSyncWorker = createMoodleSyncWorker();

const shutdown = async () => {
  console.log("Arrêt du worker...");
  await moodleSyncWorker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
