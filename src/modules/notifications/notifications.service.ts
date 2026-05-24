import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityType, NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '@database/prisma/prisma.service';
import { PaginatedResponse } from '@common/dto/paginated-response.dto';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actorId?: string;
  entityId?: string;
  entityType?: EntityType;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        actorId: data.actorId ?? null,
        entityId: data.entityId ?? null,
        entityType: data.entityType ?? null,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async findAll(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<object>> {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return new PaginatedResponse(notifications, total, page, limit);
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read.' };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async deleteOne(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }
    await this.prisma.notification.delete({ where: { id } });
  }

  async deleteAll(userId: string): Promise<{ deleted: number }> {
    const { count } = await this.prisma.notification.deleteMany({ where: { userId } });
    return { deleted: count };
  }
}
