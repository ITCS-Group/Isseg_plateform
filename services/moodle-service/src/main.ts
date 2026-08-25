import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // Port dédié (distinct de apps/api, qui écoute déjà sur 3001 par défaut).
  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  logger.log(`Moodle service démarré sur http://localhost:${port}`);
}
bootstrap();
