import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role?: Role;
  }) {
    return this.prisma.user.create({ data });
  }

  // Used by bulk member import: the cooperative is uploading people who
  // don't have a platform account yet. The generated password is never
  // returned or logged anywhere -- the member sets their own via the
  // existing "Forgot password" flow before they ever log in.
  async createWithRandomPassword(data: {
    email: string;
    firstName: string;
    lastName: string;
  }) {
    const passwordHash = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      BCRYPT_ROUNDS,
    );
    return this.create({ ...data, passwordHash });
  }

  updateProfile(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: Date;
      gender?: string;
      phone?: string;
      address?: string;
      bvn?: string;
      nin?: string;
    },
  ) {
    return this.prisma.user.update({ where: { id }, data });
  }

  listAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  updateRole(id: string, role: Role) {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  async updateAvatar(
    id: string,
    dto: { mimeType: string; contentBase64: string },
  ) {
    await this.prisma.user.update({
      where: { id },
      data: {
        avatar: Buffer.from(dto.contentBase64, 'base64'),
        avatarMimeType: dto.mimeType,
      },
      select: { id: true },
    });
  }

  async getAvatar(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { avatar: true, avatarMimeType: true },
    });
    if (!user?.avatar || !user.avatarMimeType) {
      throw new NotFoundException('No avatar uploaded for this user');
    }
    return { content: user.avatar, mimeType: user.avatarMimeType };
  }

  toPublicProfile(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    dateOfBirth: Date | null;
    gender: string | null;
    phone: string | null;
    address: string | null;
    bvn: string | null;
    nin: string | null;
    avatarMimeType: string | null;
    mfaEnabled: boolean;
    createdAt: Date;
  }) {
    const {
      id,
      email,
      firstName,
      lastName,
      role,
      dateOfBirth,
      gender,
      phone,
      address,
      bvn,
      nin,
      avatarMimeType,
      mfaEnabled,
      createdAt,
    } = user;
    return {
      id,
      email,
      firstName,
      lastName,
      role,
      dateOfBirth,
      gender,
      phone,
      address,
      bvn,
      nin,
      avatarMimeType,
      mfaEnabled,
      createdAt,
    };
  }
}
