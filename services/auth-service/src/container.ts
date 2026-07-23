import { config } from './config';
import { pool } from './db/pool';
import { PgUserRepository } from './repositories/user.repository';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';

export const tokenService = new TokenService({
  accessSecret: config.JWT_SECRET,
  refreshSecret: config.JWT_REFRESH_SECRET,
  accessExpiresIn: config.JWT_EXPIRES_IN,
  refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
});

export const userRepository = new PgUserRepository(pool);

export const authService = new AuthService(userRepository, tokenService);
