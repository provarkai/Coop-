import { Injectable } from '@nestjs/common';
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
      mfaEnabled,
      createdAt,
    };
  }
}
