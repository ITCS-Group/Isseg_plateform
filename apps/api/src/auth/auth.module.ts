import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      // Import explicite de ConfigModule — garantit la disponibilité de ConfigService
      // même dans les tests unitaires où le module global peut ne pas être initialisé.
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        // Le secret par défaut sert uniquement à la vérification de l'access token
        // via JwtStrategy. La signature (signAsync) override ces options dans AuthService
        // pour distinguer access token et refresh token avec des secrets différents.
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
