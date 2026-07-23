import { describe, expect, it } from 'vitest';
import { AppError } from '../../errors/app-error';
import { TokenService } from '../token.service';

function makeService(): TokenService {
  return new TokenService({
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
    accessExpiresIn: '1h',
    refreshExpiresIn: '7d',
  });
}

describe('TokenService', () => {
  it('issues an access and refresh token that both verify to the same subject', () => {
    const service = makeService();
    const { accessToken, refreshToken } = service.issueTokenPair({
      id: 'user-1',
      email: 'user@example.com',
    });

    const accessClaims = service.verifyAccessToken(accessToken);
    const refreshClaims = service.verifyRefreshToken(refreshToken);

    expect(accessClaims.sub).toBe('user-1');
    expect(accessClaims.type).toBe('access');
    expect(refreshClaims.sub).toBe('user-1');
    expect(refreshClaims.type).toBe('refresh');
  });

  it('rejects a refresh token when verified as an access token', () => {
    const service = makeService();
    const { refreshToken } = service.issueTokenPair({ id: 'user-1', email: 'user@example.com' });

    expect(() => service.verifyAccessToken(refreshToken)).toThrow(AppError);
  });

  it('rejects a token signed with a different secret', () => {
    const service = makeService();
    const otherService = new TokenService({
      accessSecret: 'different-secret',
      refreshSecret: 'different-refresh-secret',
      accessExpiresIn: '1h',
      refreshExpiresIn: '7d',
    });
    const { accessToken } = otherService.issueTokenPair({ id: 'user-1', email: 'a@b.com' });

    expect(() => service.verifyAccessToken(accessToken)).toThrow(AppError);
  });

  it('rejects a garbage token', () => {
    const service = makeService();
    expect(() => service.verifyAccessToken('not-a-real-token')).toThrow(AppError);
  });
});
