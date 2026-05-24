import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PrismaService } from '@database/prisma/prisma.service';

import { NOTIFICATION_EVENTS } from './events/notification-event-names';
import {
  AuthorFollowedEvent,
  BlogLikedEvent,
  BlogPublishedEvent,
  BlogSavedEvent,
  BlogSharedEvent,
  CompanyFollowedEvent,
  CompanyInviteReceivedEvent,
  CompanyInviteRespondedEvent,
  CompanyMilestoneEvent,
} from './events/notification.events';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto, NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  // ── Author followed ───────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.AUTHOR_FOLLOWED)
  async handleAuthorFollowed(event: AuthorFollowedEvent) {
    try {
      const notification = await this.notificationsService.create({
        userId: event.recipientUserId,
        type: 'author_followed',
        title: 'New follower',
        message: `${event.followerDisplayName} started following you.`,
        actorId: event.followerId,
        entityId: event.authorProfileId,
        entityType: 'author',
        metadata: {
          actor: {
            userId: event.followerId,
            displayName: event.followerDisplayName,
            username: event.followerUsername,
            avatarUrl: event.followerAvatarUrl,
          },
        },
      } satisfies CreateNotificationDto);

      this.gateway.pushToUser(event.recipientUserId, notification);
    } catch (err) {
      this.logger.error('handleAuthorFollowed failed', err);
    }
  }

  // ── Company followed ──────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_FOLLOWED)
  async handleCompanyFollowed(event: CompanyFollowedEvent) {
    try {
      await Promise.all(
        event.ownerUserIds.map(async (ownerId) => {
          const notification = await this.notificationsService.create({
            userId: ownerId,
            type: 'company_followed',
            title: 'New company follower',
            message: `${event.followerDisplayName} is now following ${event.companyName}.`,
            actorId: event.followerId,
            entityId: event.companyId,
            entityType: 'company',
            metadata: {
              actor: {
                userId: event.followerId,
                displayName: event.followerDisplayName,
                username: event.followerUsername,
                avatarUrl: event.followerAvatarUrl,
              },
              company: {
                id: event.companyId,
                name: event.companyName,
                handle: event.companyHandle,
              },
            },
          } satisfies CreateNotificationDto);

          this.gateway.pushToUser(ownerId, notification);
        }),
      );
    } catch (err) {
      this.logger.error('handleCompanyFollowed failed', err);
    }
  }

  // ── Blog liked ────────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.BLOG_LIKED)
  async handleBlogLiked(event: BlogLikedEvent) {
    try {
      // Dedup: skip if same actor already sent an unread like notification for this blog in last hour
      const recentDuplicate = await this.prisma.notification.findFirst({
        where: {
          userId: event.authorUserId,
          type: 'blog_liked',
          actorId: event.actorUserId,
          entityId: event.blogId,
          isRead: false,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recentDuplicate) return;

      const notification = await this.notificationsService.create({
        userId: event.authorUserId,
        type: 'blog_liked',
        title: 'Someone liked your article',
        message: `${event.actorDisplayName} liked your article "${event.blogTitle}".`,
        actorId: event.actorUserId,
        entityId: event.blogId,
        entityType: 'blog',
        metadata: {
          actor: {
            userId: event.actorUserId,
            displayName: event.actorDisplayName,
            username: event.actorUsername,
            avatarUrl: event.actorAvatarUrl,
          },
          blog: { id: event.blogId, slug: event.blogSlug, title: event.blogTitle },
        },
      } satisfies CreateNotificationDto);

      this.gateway.pushToUser(event.authorUserId, notification);
    } catch (err) {
      this.logger.error('handleBlogLiked failed', err);
    }
  }

  // ── Blog saved ────────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.BLOG_SAVED)
  async handleBlogSaved(event: BlogSavedEvent) {
    try {
      const recentDuplicate = await this.prisma.notification.findFirst({
        where: {
          userId: event.authorUserId,
          type: 'blog_saved',
          actorId: event.actorUserId,
          entityId: event.blogId,
          isRead: false,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recentDuplicate) return;

      const notification = await this.notificationsService.create({
        userId: event.authorUserId,
        type: 'blog_saved',
        title: 'Article bookmarked',
        message: `${event.actorDisplayName} saved your article "${event.blogTitle}".`,
        actorId: event.actorUserId,
        entityId: event.blogId,
        entityType: 'blog',
        metadata: {
          actor: {
            userId: event.actorUserId,
            displayName: event.actorDisplayName,
            username: event.actorUsername,
            avatarUrl: event.actorAvatarUrl,
          },
          blog: { id: event.blogId, slug: event.blogSlug, title: event.blogTitle },
        },
      } satisfies CreateNotificationDto);

      this.gateway.pushToUser(event.authorUserId, notification);
    } catch (err) {
      this.logger.error('handleBlogSaved failed', err);
    }
  }

  // ── Blog shared ───────────────────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.BLOG_SHARED)
  async handleBlogShared(event: BlogSharedEvent) {
    try {
      const channelLabel = event.channel ?? 'the web';
      const notification = await this.notificationsService.create({
        userId: event.authorUserId,
        type: 'blog_shared',
        title: 'Article shared',
        message: `${event.actorDisplayName} shared your article "${event.blogTitle}" on ${channelLabel}.`,
        actorId: event.actorUserId,
        entityId: event.blogId,
        entityType: 'blog',
        metadata: {
          actor: {
            userId: event.actorUserId,
            displayName: event.actorDisplayName,
            username: event.actorUsername,
            avatarUrl: event.actorAvatarUrl,
          },
          blog: { id: event.blogId, slug: event.blogSlug, title: event.blogTitle },
          channel: event.channel,
        },
      } satisfies CreateNotificationDto);

      this.gateway.pushToUser(event.authorUserId, notification);
    } catch (err) {
      this.logger.error('handleBlogShared failed', err);
    }
  }

  // ── Blog published (fan-out) ──────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.BLOG_PUBLISHED)
  async handleBlogPublished(event: BlogPublishedEvent) {
    try {
      const [authorFollowerRows, companyFollowerRows] = await Promise.all([
        this.prisma.authorFollow.findMany({
          where: { authorProfileId: event.authorProfileId },
          select: { followerId: true },
        }),
        event.companyId
          ? this.prisma.companyFollow.findMany({
              where: { companyId: event.companyId },
              select: { followerId: true },
            })
          : Promise.resolve([] as { followerId: string }[]),
      ]);

      const recipientIds = [
        ...new Set([
          ...authorFollowerRows.map((r) => r.followerId),
          ...companyFollowerRows.map((r) => r.followerId),
        ]),
      ].filter((id) => id !== event.authorUserId);

      if (recipientIds.length === 0) return;

      const metadata = {
        author: {
          authorProfileId: event.authorProfileId,
          displayName: event.authorDisplayName,
          username: event.authorUsername,
          avatarUrl: event.authorAvatarUrl,
        },
        blog: {
          id: event.blogId,
          slug: event.blogSlug,
          title: event.blogTitle,
          articleType: event.articleType,
          summary: event.blogSummary,
          coverImageUrl: event.blogCoverImageUrl,
        },
        company: event.companyId
          ? {
              id: event.companyId,
              name: event.companyName,
              handle: event.companyHandle,
              logoUrl: event.companyLogoUrl,
            }
          : null,
      };

      const message = `${event.authorDisplayName} published a new article: "${event.blogTitle}".`;

      await this.prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          type: 'blog_published_fan_out' as const,
          title: 'New article published',
          message,
          actorId: event.authorUserId,
          entityId: event.blogId,
          entityType: 'blog' as const,
          metadata,
        })),
        skipDuplicates: true,
      });

      const wsPayload = { type: 'blog_published_fan_out', title: 'New article published', message, metadata };
      recipientIds.forEach((userId) => this.gateway.pushToUser(userId, wsPayload));

      this.logger.log(`Fan-out blog_published to ${recipientIds.length} recipients`);
    } catch (err) {
      this.logger.error('handleBlogPublished fan-out failed', err);
    }
  }

  // ── Company invite received ───────────────────────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_INVITE_RECEIVED)
  async handleCompanyInviteReceived(event: CompanyInviteReceivedEvent) {
    try {
      const invitedUser = await this.prisma.user.findUnique({
        where: { email: event.invitedEmail },
        select: { id: true },
      });
      if (!invitedUser) return; // user hasn't registered yet — email-only channel covers this case

      const notification = await this.notificationsService.create({
        userId: invitedUser.id,
        type: 'company_invite_received',
        title: "You've been invited to join a company",
        message: `${event.invitedByDisplayName} invited you to join ${event.companyName} as an author.`,
        actorId: event.invitedByUserId,
        entityId: event.companyId,
        entityType: 'company',
        metadata: {
          inviteToken: event.inviteToken,
          company: {
            id: event.companyId,
            name: event.companyName,
            handle: event.companyHandle,
            logoUrl: event.companyLogoUrl,
          },
          invitedBy: {
            userId: event.invitedByUserId,
            displayName: event.invitedByDisplayName,
            username: event.invitedByUsername,
            avatarUrl: event.invitedByAvatarUrl,
          },
          expiresAt: event.inviteExpiresAt.toISOString(),
          actions: [
            {
              label: 'Accept',
              style: 'primary',
              method: 'POST',
              url: `/api/v1/companies/invites/${event.inviteToken}/accept`,
            },
            {
              label: 'Decline',
              style: 'secondary',
              method: 'POST',
              url: `/api/v1/companies/invites/${event.inviteToken}/decline`,
            },
          ],
        },
      } satisfies CreateNotificationDto);

      this.gateway.pushToUser(invitedUser.id, notification);
    } catch (err) {
      this.logger.error('handleCompanyInviteReceived failed', err);
    }
  }

  // ── Company invite responded (accepted / declined) ────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_INVITE_RESPONDED)
  async handleCompanyInviteResponded(event: CompanyInviteRespondedEvent) {
    try {
      const title = event.accepted ? 'Invite accepted' : 'Invite declined';
      const message = event.accepted
        ? `${event.actorDisplayName} accepted your invitation to join ${event.companyName}.`
        : `${event.actorDisplayName} declined your invitation to join ${event.companyName}.`;
      const type = event.accepted ? ('company_invite_accepted' as const) : ('company_invite_declined' as const);

      await Promise.all(
        event.ownerUserIds.map(async (ownerId) => {
          const notification = await this.notificationsService.create({
            userId: ownerId,
            type,
            title,
            message,
            actorId: event.actorUserId,
            entityId: event.companyId,
            entityType: 'company',
            metadata: {
              user: {
                userId: event.actorUserId,
                displayName: event.actorDisplayName,
                username: event.actorUsername,
                avatarUrl: event.actorAvatarUrl,
              },
              company: {
                id: event.companyId,
                name: event.companyName,
                handle: event.companyHandle,
              },
            },
          } satisfies CreateNotificationDto);

          this.gateway.pushToUser(ownerId, notification);
        }),
      );
    } catch (err) {
      this.logger.error('handleCompanyInviteResponded failed', err);
    }
  }

  // ── Company milestone (fan-out to followers) ──────────────────────────────────

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_MILESTONE)
  async handleCompanyMilestone(event: CompanyMilestoneEvent) {
    try {
      const followerRows = await this.prisma.companyFollow.findMany({
        where: { companyId: event.companyId },
        select: { followerId: true },
      });

      const followerIds = followerRows.map((r) => r.followerId);
      if (followerIds.length === 0) return;

      const metadata = {
        milestone: {
          id: event.milestoneId,
          type: event.milestoneType,
          headline: event.milestoneHeadline,
          impactMetric: event.milestoneImpactMetric,
          milestoneDate: event.milestoneDateStr,
        },
        company: {
          id: event.companyId,
          name: event.companyName,
          handle: event.companyHandle,
          logoUrl: event.companyLogoUrl,
        },
      };

      const message = `${event.companyName} just hit a new milestone: "${event.milestoneHeadline}".`;

      await this.prisma.notification.createMany({
        data: followerIds.map((userId) => ({
          userId,
          type: 'company_milestone' as const,
          title: 'New company milestone',
          message,
          entityId: event.companyId,
          entityType: 'company' as const,
          metadata,
        })),
        skipDuplicates: true,
      });

      const wsPayload = { type: 'company_milestone', title: 'New company milestone', message, metadata };
      followerIds.forEach((userId) => this.gateway.pushToUser(userId, wsPayload));

      this.logger.log(`Fan-out company_milestone to ${followerIds.length} followers`);
    } catch (err) {
      this.logger.error('handleCompanyMilestone failed', err);
    }
  }
}
