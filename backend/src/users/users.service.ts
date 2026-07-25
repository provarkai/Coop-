import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
