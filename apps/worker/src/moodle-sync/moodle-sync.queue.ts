import { Queue } from "bullmq";
import { redisConnection } from "../config/redis-connection";

export const MOODLE_SYNC_QUEUE_NAME = "moodle-sync";

export const moodleSyncQueue = new Queue(MOODLE_SYNC_QUEUE_NAME, {
  connection: redisConnection,
});
