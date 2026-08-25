import "dotenv/config";
import { Job, Worker } from "bullmq";
import { redisConnection } from "../config/redis-connection";
import { MOODLE_SYNC_QUEUE_NAME } from "./moodle-sync.queue";

const MOODLE_SERVICE_URL = process.env.MOODLE_SERVICE_URL ?? "http://localhost:3003";

/**
 * Squelette de structure de queue — aucune logique de synchronisation
 * réelle pour l'instant. Le mapping des données Moodle↔ISSEG (cours,
 * classe, étudiant, inscription) n'est pas décidé : attend les entretiens
 * Moodle. Ce processor se contente de vérifier la connectivité bout-en-bout
 * (worker → moodle-service → Moodle) via /health — aucune donnée métier.
 */
async function processMoodleSyncJob(job: Job): Promise<void> {
  console.log(`[moodle-sync] job reçu : id=${job.id} name=${job.name}`);

  const response = await fetch(`${MOODLE_SERVICE_URL}/health`);
  const body = await response.json();
  console.log(
    `[moodle-sync] moodle-service /health → status=${response.status} moodle.sitename=${body?.moodle?.sitename ?? "?"}`,
  );
}

export function createMoodleSyncWorker(): Worker {
  return new Worker(MOODLE_SYNC_QUEUE_NAME, processMoodleSyncJob, {
    connection: redisConnection,
  });
}
