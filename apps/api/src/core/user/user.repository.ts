import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import type { Prisma, User } from '@prisma/client'

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } })
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } })
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email, deletedAt: null } })
    return count > 0
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data })
  }

  async updateById(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async decrementAiCreditsById(id: string, amount: number): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { aiCredits: { decrement: amount } },
    })
  }
}
