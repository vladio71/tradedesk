import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError, UserNotFoundError } from '../domain/errors';
import { assertAcceptablePassword } from '../domain/password-policy';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/ports';
import { UNIT_OF_WORK, UnitOfWork } from '../domain/unit-of-work';

export interface ChangePasswordCommand {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    assertAcceptablePassword(command.newPassword);
    const newHash = await this.hasher.hash(command.newPassword);

    await this.unitOfWork.run(async (repos) => {
      const user = await repos.users.findById(command.userId);
      if (!user) {
        throw new UserNotFoundError();
      }
      if (!(await this.hasher.verify(command.currentPassword, user.passwordHash))) {
        throw new InvalidCredentialsError();
      }
      const now = new Date();
      user.changePasswordHash(newHash, now);
      await repos.users.update(user);
      // A password change signs the user out everywhere.
      await repos.refreshTokens.revokeAllForUser(user.id, now);
    });
  }
}
