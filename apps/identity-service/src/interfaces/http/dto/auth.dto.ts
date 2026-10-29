import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'anna@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Anna' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  displayName: string;
}

export class LoginDto {
  @ApiProperty()
  @IsString()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(72)
  password: string;
}
