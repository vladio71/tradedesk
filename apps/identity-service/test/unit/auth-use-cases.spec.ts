import { LoginUserUseCase } from '../../src/application/login-user.use-case';
import { LogoutUserUseCase } from '../../src/application/logout-user.use-case';
import { RefreshSessionUseCase } from '../../src/application/refresh-session.use-case';
import { RegisterUserUseCase } from '../../src/application/register-user.use-case';
import { ChangePasswordUseCase } from '../../src/application/change-password.use-case';
import {
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
} from '../../src/domain/errors';
import { buildFixture, SETTINGS } from './fakes';

function setup() {
  const fixture = buildFixture();
  const register = new RegisterUserUseCase(fixture.users, fixture.hasher);
  const login = new LoginUserUseCase(fixture.users, fixture.refreshTokens, fixture.hasher, fixture.tokens, SETTINGS);
  const refresh = new RefreshSessionUseCase(fixture.unitOfWork, fixture.tokens, SETTINGS);
  const logout = new LogoutUserUseCase(fixture.unitOfWork, fixture.tokens);
  const changePassword = new ChangePasswordUseCase(fixture.unitOfWork, fixture.hasher);
  return { ...fixture, register, login, refresh, logout, changePassword };
}

describe('RegisterUserUseCase', () => {
  it('creates a user with the user role and a hashed password', async () => {
    const { register, users } = setup();
    const user = await register.execute({ email: 'Anna@Example.com', password: 'password1', displayName: ' Anna ' });
    expect(user.email.value).toBe('anna@example.com');
    expect(user.role).toBe('user');
    expect(user.displayName).toBe('Anna');
    expect(user.passwordHash).not.toBe('password1');
    expect(users.items.size).toBe(1);
  });

  it('refuses a second account with the same email', async () => {
    const { register } = setup();
    await register.execute({ email: 'a@example.com', password: 'password1', displayName: 'A' });
    await expect(register.execute({ email: 'A@example.com', password: 'password2', displayName: 'B' })).rejects.toThrow(EmailAlreadyUsedError);
  });
});

describe('LoginUserUseCase', () => {
  it('returns tokens and stores one refresh token', async () => {
    const { register, login, refreshTokens } = setup();
    await register.execute({ email: 'a@example.com', password: 'password1', displayName: 'A' });
    const session = await login.execute({ email: 'a@example.com', password: 'password1' });
    expect(session.accessToken).toContain('access-for-');
    expect(session.refreshToken.length).toBeGreaterThan(10);
    expect(refreshTokens.items.size).toBe(1);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { register, login } = setup();
    await register.execute({ email: 'a@example.com', password: 'password1', displayName: 'A' });
    await expect(login.execute({ email: 'a@example.com', password: 'wrong-password' })).rejects.toThrow(InvalidCredentialsError);
    await expect(login.execute({ email: 'nobody@example.com', password: 'password1' })).rejects.toThrow(InvalidCredentialsError);
  });
});

describe('RefreshSessionUseCase', () => {
  async function loggedIn() {
    const context = setup();
    await context.register.execute({ email: 'a@example.com', password: 'password1', displayName: 'A' });
    const session = await context.login.execute({ email: 'a@example.com', password: 'password1' });
    return { ...context, session };
  }

  it('rotates: the old token is revoked and a new one is issued in the same family', async () => {
    const { refresh, refreshTokens, session } = await loggedIn();
    const next = await refresh.execute(session.refreshToken);

    expect(next.refreshToken).not.toBe(session.refreshToken);
    const tokens = [...refreshTokens.items.values()];
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens.map((token) => token.familyId)).size).toBe(1);
    expect(refreshTokens.activeCount()).toBe(1);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const { refresh, refreshTokens, session } = await loggedIn();
    const next = await refresh.execute(session.refreshToken);

    await expect(refresh.execute(session.refreshToken)).rejects.toThrow(RefreshTokenReuseError);
    expect(refreshTokens.activeCount()).toBe(0);
    // The newest token of the family is dead too.
    await expect(refresh.execute(next.refreshToken)).rejects.toThrow(RefreshTokenReuseError);
  });

  it('rejects unknown and missing tokens', async () => {
    const { refresh } = await loggedIn();
    await expect(refresh.execute('nope')).rejects.toThrow(InvalidRefreshTokenError);
    await expect(refresh.execute(undefined)).rejects.toThrow(InvalidRefreshTokenError);
  });
});

describe('LogoutUserUseCase', () => {
  it('revokes the family so the token cannot be refreshed', async () => {
    const { register, login, logout, refresh, refreshTokens } = setup();
    await register.execute({ email: 'a@example.com', password: 'password1', displayName: 'A' });
    const session = await login.execute({ email: 'a@example.com', password: 'password1' });
    await logout.execute(session.refreshToken);
    expect(refreshTokens.activeCount()).toBe(0);
    await expect(refresh.execute(session.refreshToken)).rejects.toThrow(RefreshTokenReuseError);
  });

  it('ignores a missing token', async () => {
    const { logout } = setup();
    await expect(logout.execute(undefined)).resolves.toBeUndefined();
  });
});

describe('ChangePasswordUseCase', () => {
  it('checks the current password and signs out everywhere', async () => {
    const { register, login, changePassword, refreshTokens } = setup();
    const user = await register.execute({ email: 'a@example.com', password: 'password1', displayName: 'A' });
    await login.execute({ email: 'a@example.com', password: 'password1' });

    await expect(changePassword.execute({ userId: user.id, currentPassword: 'wrong-one', newPassword: 'password2' })).rejects.toThrow(
      InvalidCredentialsError,
    );
    await changePassword.execute({ userId: user.id, currentPassword: 'password1', newPassword: 'password2' });

    expect(refreshTokens.activeCount()).toBe(0);
    await expect(login.execute({ email: 'a@example.com', password: 'password1' })).rejects.toThrow(InvalidCredentialsError);
    await expect(login.execute({ email: 'a@example.com', password: 'password2' })).resolves.toBeDefined();
  });
});
