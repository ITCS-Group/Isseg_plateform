import { Job, Worker } from "bullmq";
import { redisConnection } from "../config/redis-connection";
import { MOODLE_SYNC_QUEUE_NAME } from "./moodle-sync.queue";

/**
 * Squelette de structure de queue — aucune logique de synchronisation
 * réelle pour l'instant. Le mapping des données Moodle↔ISSEG (cours,
 * classe, étudiant, inscription) n'est pas décidé : attend les entretiens
 * Moodle. Ce worker se contente de recevoir un job et de logger sa
 * réception.
 */
async function processMoodleSyncJob(job: Job): Promise<void> {
  console.log(`[moodle-sync] job reçu : id=${job.id} name=${job.name}`);
}

export function createMoodleSyncWorker(): Worker {
  return new Worker(MOODLE_SYNC_QUEUE_NAME, processMoodleSyncJob, {
    connection: redisConnection,
  });
}
