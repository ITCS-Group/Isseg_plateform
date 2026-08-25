import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { MoodleClientModule } from './moodle-client/moodle-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    MoodleClientModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
