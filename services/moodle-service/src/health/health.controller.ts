import { Controller, Get } from '@nestjs/common';
import { MoodleClientService } from '../moodle-client/moodle-client.service';

/**
 * Endpoint unique de connectivité — vérifie que ce service répond ET que
 * l'instance Moodle configurée est joignable, via la même méthode
 * d'introspection déjà utilisée pour le healthcheck (core_webservice_get_site_info,
 * aucune donnée métier). Pas une fonction métier : le mapping de données
 * attend les entretiens Moodle.
 */
@Controller()
export class HealthController {
  constructor(private readonly moodleClient: MoodleClientService) {}

  @Get('health')
  async health() {
    const moodle = await this.moodleClient.ping();
    return { status: 'ok', moodle };
  }
}
