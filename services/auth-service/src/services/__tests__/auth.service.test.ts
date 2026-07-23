import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../errors/app-error';
import { AuthService } from '../auth.service';
import { TokenService } from '../token.service';
import { InMemoryUserRepository } from './in-memory-user.repository';

function makeAuthService(): AuthService {
  const tokenService = new TokenService({
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
    accessExpiresIn: '1h',
    refreshExpiresIn: '7d',
  });
  return new AuthService(new InMemoryUserRepository(), tokenService);
}

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = makeAuthService();
  });

  it('registers a new user and returns a public profile plus tokens', async () => {
    const result = await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    expect(result.user.email).toBe('ada@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it('rejects registering the same email twice', async () => {
    await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    await expect(
      authService.register({
        email: 'ada@example.com',
        password: 'anotherpassword',
        displayName: 'Ada L.',
      }),
    ).rejects.toThrow(AppError);
  });

  it('logs in with correct credentials', async () => {
    await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    const result = await authService.login({
      email: 'ada@example.com',
      password: 'supersecret',
    });

    expect(result.user.email).toBe('ada@example.com');
  });

  it('rejects login with the wrong password', async () => {
    await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    await expect(
      authService.login({ email: 'ada@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(AppError);
  });

  it('rejects login for an unknown email', async () => {
    await expect(
      authService.login({ email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toThrow(AppError);
  });

  it('issues a new token pair from a valid refresh token', async () => {
    const { tokens } = await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    const refreshed = await authService.refresh(tokens.refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).toBeTruthy();
  });

  it('rejects refresh with an access token', async () => {
    const { tokens } = await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    await expect(authService.refresh(tokens.accessToken)).rejects.toThrow(AppError);
  });

  it('returns the profile for an existing user id', async () => {
    const { user } = await authService.register({
      email: 'ada@example.com',
      password: 'supersecret',
      displayName: 'Ada Lovelace',
    });

    const profile = await authService.getProfile(user.id);
    expect(profile.displayName).toBe('Ada Lovelace');
  });

  it('throws not-found for a missing user id', async () => {
    await expect(authService.getProfile('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      AppError,
    );
  });
});
