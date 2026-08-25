import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Wrapper générique pour le protocole "Web Services" REST de Moodle
 * (POST vers /webservice/rest/server.php avec wstoken + wsfunction +
 * moodlewsrestformat=json — protocole standard Moodle, indépendant de
 * toute fonction précise). Ne connaît aucune fonction Moodle ni aucun
 * champ métier ISSEG : le mapping des données attend les entretiens
 * Moodle, pas encore couverts.
 */
@Injectable()
export class MoodleClientService {
  private readonly logger = new Logger(MoodleClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>('moodle.baseUrl') ?? '';
    this.apiKey = this.config.get<string>('moodle.apiKey') ?? '';
  }

  /**
   * Appelle une fonction du Web Service Moodle et retourne le JSON brut,
   * sans interprétation ni typage métier — au consommateur de mapper le
   * résultat une fois les règles de correspondance ISSEG↔Moodle décidées.
   */
  async callFunction<T = unknown>(
    wsfunction: string,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    if (!this.baseUrl || !this.apiKey) {
      throw new Error(
        'Configuration Moodle manquante : MOODLE_BASE_URL et MOODLE_API_KEY doivent être définis.',
      );
    }

    const body = new URLSearchParams({
      wstoken: this.apiKey,
      wsfunction,
      moodlewsrestformat: 'json',
      ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    });

    this.logger.log(`Appel Moodle : ${wsfunction}`);

    const response = await firstValueFrom(
      this.http.post<T>(`${this.baseUrl}/webservice/rest/server.php`, body),
    );

    return response.data;
  }

  /**
   * Vérifie connectivité + authentification via la fonction Moodle
   * standard d'introspection (aucune donnée métier) — utile en healthcheck.
   */
  async ping(): Promise<unknown> {
    return this.callFunction('core_webservice_get_site_info');
  }
}
