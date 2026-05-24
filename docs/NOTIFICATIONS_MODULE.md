# In-App Real-Time Notifications — Design Document

> Author: Engineering  
> Status: **Design / Pre-Implementation**  
> Scope: `src/modules/notifications/` + event hooks in `follows`, `engagement`, `companies`, `blogs`  
> Constraint: No existing functionality is changed outside of the notification integration points.

---

## 1. Goals

- Every meaningful social/platform event sends a **persisted, real-time in-app notification**.
- Notifications arrive **instantly** via WebSocket (Socket.IO) without a page reload.
- Each notification is **self-contained** — it carries enough data (actor name, avatar, blog title, company name, invite token) that the frontend needs zero additional API calls to render it.
- Notifications support **dynamic actions** (Accept/Decline invite, Go to blog, View profile) embedded in metadata.
- The REST API covers all CRUD operations: paginate, mark read, mark all read, delete one, delete all.
- The system is **safe against fan-out storms**: bulk inserts + async listeners so the caller never waits.

---

## 2. Architecture Overview

```
Trigger (service method)
       │
       │ eventEmitter.emit('notification.*', payload)   ← fire-and-forget
       ▼
NotificationsListener  (@OnEvent)
       │
       ├──► NotificationsService.create()  ──► DB (notifications table)
       │
       └──► NotificationsGateway.push()   ──► Socket.IO room  ──► Client (real-time)
```

**Key packages:**
- `@nestjs/event-emitter` (`EventEmitter2`) — in-process async event bus. Zero coupling between modules.
- `@nestjs/platform-socket.io` + `@nestjs/websockets` — already a NestJS dependency. Socket.IO gateway for real-time push.

**Why in-process events over a job queue (BullMQ)?**  
For MVP, fan-out is bounded (followers list is small). EventEmitter2 with async listeners runs off the request thread. BullMQ can be added later as a drop-in once follower counts grow into the tens of thousands.

---

## 3. Notification Types

Each type maps to a concrete Prisma enum value, a fixed title template, and a body template.

| # | `NotificationType` | Trigger | Recipient(s) | Title | Body |
|---|---|---|---|---|---|
| 1 | `author_followed` | `FollowsService.followAuthor()` | Followed author (1 user) | `"New follower"` | `"{actorName} started following you."` |
| 2 | `company_followed` | `FollowsService.followCompany()` | Company owner(s) | `"New company follower"` | `"{actorName} is now following {companyName}."` |
| 3 | `blog_liked` | `EngagementService.likeBlog()` | Blog author (1 user) | `"Someone liked your article"` | `"{actorName} liked your article "{blogTitle}"."` |
| 4 | `blog_saved` | `EngagementService.saveBlog()` | Blog author (1 user) | `"Article bookmarked"` | `"{actorName} saved your article "{blogTitle}"."` |
| 5 | `blog_shared` | `EngagementService.shareBlog()` | Blog author (1 user, only when sharer is logged in) | `"Article shared"` | `"{actorName} shared your article "{blogTitle}" on {channel}."` |
| 6 | `blog_published` | `BlogsService.publish()` + `BlogSchedulerService` | All author followers + all company followers (fan-out, deduped) | `"New article published"` | `"{authorName} published a new article: "{blogTitle}"."` |
| 7 | `company_invite_received` | `CompaniesService.inviteAuthor()` | Invited user (1 user, looked up by email) | `"You've been invited to join a company"` | `"{inviterName} invited you to join {companyName} as an author."` |
| 8 | `company_invite_accepted` | `CompaniesService.acceptInvite()` | Company owner (1 user) | `"Invite accepted"` | `"{actorName} accepted your invitation to join {companyName}."` |
| 9 | `company_invite_declined` | `CompaniesService.declineInvite()` | Company owner (1 user) | `"Invite declined"` | `"{actorName} declined your invitation to join {companyName}."` |
| 10 | `company_milestone` | `CompaniesService.addMilestone()` | All company followers (fan-out) | `"New company milestone"` | `"{companyName} just hit a new milestone: "{milestoneHeadline}"."` |

**Existing enum values kept for backward compatibility:**  
`follow`, `company_invite`, `blog_published` remain in the enum. They are not emitted by new code — new code uses the specific types above. Old rows referencing them continue to read correctly.

---

## 4. Prisma Schema Changes

### 4a. Expand `NotificationType` enum

```prisma
enum NotificationType {
  // ── legacy (kept for backward compat, not emitted by new code) ──────────────
  follow
  company_invite
  blog_published

  // ── new specific types ────────────────────────────────────────────────────────
  author_followed
  company_followed
  blog_liked
  blog_saved
  blog_shared
  blog_published_fan_out    // fan-out to followers when a blog goes live
  company_invite_received   // to the invitee
  company_invite_accepted   // to the company owner
  company_invite_declined   // to the company owner
  company_milestone         // fan-out to company followers
}
```

### 4b. Enrich `Notification` model

Add four new columns. All are nullable so existing rows are unaffected.

```prisma
model Notification {
  id         String           @id @default(uuid()) @db.Uuid
  userId     String           @db.Uuid                      // recipient
  type       NotificationType
  title      String           @db.VarChar(100)              // NEW — short heading
  message    String           @db.VarChar(300)              // existing — body text
  isRead     Boolean          @default(false)
  metadata   Json?                                          // typed JSON (see §5)
  actorId    String?          @db.Uuid                      // NEW — who triggered it
  entityId   String?          @db.Uuid                      // NEW — blog/company/profile id
  entityType EntityType?                                    // NEW — blog|company|author|tag
  createdAt  DateTime         @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  actor User? @relation("notificationActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([userId, isRead],   name: "idx_notifications_user_read")
  @@index([userId, createdAt], name: "idx_notifications_user_date")
  @@map("notifications")
}
```

Add to `User` model:
```prisma
notificationsReceived Notification[] @relation("notificationActor")
```

### 4c. Migration name

```
prisma migrate dev --name expand_notifications_schema
```

---

## 5. Metadata Schema (per type)

The `metadata Json?` column is a typed object. Frontend reads this to render rich UI and action buttons. All fields are optional/nullable within each shape.

### `author_followed`
```json
{
  "actor": {
    "userId": "uuid",
    "displayName": "Jane Dev",
    "username": "jane-dev",
    "avatarUrl": "https://..."
  }
}
```
**Frontend action:** Navigate to `/author/jane-dev`

---

### `company_followed`
```json
{
  "actor": {
    "userId": "uuid",
    "displayName": "Jane Dev",
    "username": "jane-dev",
    "avatarUrl": "https://..."
  },
  "company": {
    "id": "uuid",
    "name": "Acme Corp",
    "handle": "acme-corp"
  }
}
```
**Frontend action:** Navigate to `/company/acme-corp`

---

### `blog_liked` / `blog_saved`
```json
{
  "actor": {
    "userId": "uuid",
    "displayName": "Jane Dev",
    "username": "jane-dev",
    "avatarUrl": "https://..."
  },
  "blog": {
    "id": "uuid",
    "slug": "how-we-scaled-to-100k-users",
    "title": "How We Scaled to 100k Users"
  }
}
```
**Frontend action:** Navigate to `/blog/how-we-scaled-to-100k-users`

---

### `blog_shared`
```json
{
  "actor": {
    "userId": "uuid",
    "displayName": "Jane Dev",
    "username": "jane-dev",
    "avatarUrl": "https://..."
  },
  "blog": {
    "id": "uuid",
    "slug": "how-we-scaled-to-100k-users",
    "title": "How We Scaled to 100k Users"
  },
  "channel": "twitter"
}
```

---

### `blog_published_fan_out`
```json
{
  "author": {
    "authorProfileId": "uuid",
    "displayName": "Ajay K",
    "username": "ajay-k",
    "avatarUrl": "https://..."
  },
  "blog": {
    "id": "uuid",
    "slug": "my-new-article",
    "title": "My New Article",
    "articleType": "tutorial",
    "summary": "A short summary...",
    "coverImageUrl": "https://..."
  },
  "company": null
}
```
If it's a company blog, `company` is:
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "handle": "acme-corp",
  "logoUrl": "https://..."
}
```
**Frontend action:** Navigate to `/blog/my-new-article`

---

### `company_invite_received` ← **action-bearing notification**
```json
{
  "inviteToken": "abc123...hex64chars",
  "company": {
    "id": "uuid",
    "name": "Acme Corp",
    "handle": "acme-corp",
    "logoUrl": "https://..."
  },
  "invitedBy": {
    "userId": "uuid",
    "displayName": "Ajay K",
    "username": "ajay-k",
    "avatarUrl": "https://..."
  },
  "expiresAt": "2026-06-01T00:00:00.000Z",
  "actions": [
    {
      "label": "Accept",
      "style": "primary",
      "method": "POST",
      "url": "/api/v1/companies/invites/{token}/accept"
    },
    {
      "label": "Decline",
      "style": "secondary",
      "method": "POST",
      "url": "/api/v1/companies/invites/{token}/decline"
    }
  ]
}
```
**Important:** After the user taps Accept or Decline, the frontend should also call `PATCH /notifications/:id/read` to mark this notification read. The backend `acceptInvite` / `declineInvite` endpoints remain unchanged — no modification needed.

---

### `company_invite_accepted` / `company_invite_declined`
```json
{
  "user": {
    "userId": "uuid",
    "displayName": "Jane Dev",
    "username": "jane-dev",
    "avatarUrl": "https://..."
  },
  "company": {
    "id": "uuid",
    "name": "Acme Corp",
    "handle": "acme-corp"
  }
}
```
**Frontend action for accepted:** Navigate to `/company/acme-corp/members`

---

### `company_milestone`
```json
{
  "milestone": {
    "id": "uuid",
    "type": "user_milestone",
    "headline": "Reached 10,000 users",
    "impactMetric": "10k active users",
    "milestoneDate": "2026-04-01"
  },
  "company": {
    "id": "uuid",
    "name": "Acme Corp",
    "handle": "acme-corp",
    "logoUrl": "https://..."
  }
}
```
**Frontend action:** Navigate to `/company/acme-corp` (milestones tab)

---

## 6. Event System

### 6a. Install package

```bash
pnpm add @nestjs/event-emitter
```

### 6b. Register in `AppModule`

```typescript
// src/app.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    // ... existing imports
  ],
})
export class AppModule {}
```

### 6c. Event payload classes

**File:** `src/modules/notifications/events/notification.events.ts`

```typescript
export class AuthorFollowedEvent {
  followerId: string;           // User who followed
  authorProfileId: string;      // AuthorProfile that was followed
  followerDisplayName: string;
  followerUsername: string;
  followerAvatarUrl: string | null;
  recipientUserId: string;      // User who owns the AuthorProfile
}

export class CompanyFollowedEvent {
  followerId: string;
  followerDisplayName: string;
  followerUsername: string;
  followerAvatarUrl: string | null;
  companyId: string;
  companyName: string;
  companyHandle: string;
  ownerUserIds: string[];        // all company owners (batch notify)
}

export class BlogLikedEvent {
  actorUserId: string;
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  blogId: string;
  blogSlug: string;
  blogTitle: string;
  authorUserId: string;         // recipient
}

export class BlogSavedEvent {
  // same shape as BlogLikedEvent
  actorUserId: string;
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  blogId: string;
  blogSlug: string;
  blogTitle: string;
  authorUserId: string;
}

export class BlogSharedEvent {
  actorUserId: string;          // nullable — only fire if sharer is logged in
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  blogId: string;
  blogSlug: string;
  blogTitle: string;
  authorUserId: string;
  channel: string | null;
}

export class BlogPublishedEvent {
  blogId: string;
  blogSlug: string;
  blogTitle: string;
  blogSummary: string | null;
  blogCoverImageUrl: string | null;
  articleType: string;
  authorUserId: string;
  authorProfileId: string;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  companyId: string | null;
  companyName: string | null;
  companyHandle: string | null;
  companyLogoUrl: string | null;
}

export class CompanyInviteReceivedEvent {
  inviteToken: string;
  inviteExpiresAt: Date;
  companyId: string;
  companyName: string;
  companyHandle: string;
  companyLogoUrl: string | null;
  invitedByUserId: string;
  invitedByDisplayName: string;
  invitedByUsername: string;
  invitedByAvatarUrl: string | null;
  invitedEmail: string;          // used to look up recipientUserId
}

export class CompanyInviteRespondedEvent {
  accepted: boolean;             // true = accepted, false = declined
  actorUserId: string;           // who responded
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  companyId: string;
  companyName: string;
  companyHandle: string;
  ownerUserIds: string[];        // company owners to notify
}

export class CompanyMilestoneEvent {
  milestoneId: string;
  milestoneType: string;
  milestoneHeadline: string;
  milestoneImpactMetric: string | null;
  milestoneDateStr: string;      // ISO date string
  companyId: string;
  companyName: string;
  companyHandle: string;
  companyLogoUrl: string | null;
}
```

### 6d. Event names (constants)

```typescript
// src/modules/notifications/events/notification-event-names.ts
export const NOTIFICATION_EVENTS = {
  AUTHOR_FOLLOWED:          'notification.author_followed',
  COMPANY_FOLLOWED:         'notification.company_followed',
  BLOG_LIKED:               'notification.blog_liked',
  BLOG_SAVED:               'notification.blog_saved',
  BLOG_SHARED:              'notification.blog_shared',
  BLOG_PUBLISHED:           'notification.blog_published',
  COMPANY_INVITE_RECEIVED:  'notification.company_invite_received',
  COMPANY_INVITE_RESPONDED: 'notification.company_invite_responded',
  COMPANY_MILESTONE:        'notification.company_milestone',
} as const;
```

---

## 7. Emission Points (What Changes in Each Module)

Each service method gains one `eventEmitter.emit()` call **after** its core DB write succeeds. This is fire-and-forget — the caller response time is not affected.

### 7a. `FollowsService`

**`followAuthor()`** — after `authorFollow.create()`:
```typescript
// Fetch actor's authorProfile for display data
const actorProfile = await this.prisma.authorProfile.findUnique({ where: { userId: followerId } });
this.eventEmitter.emit(NOTIFICATION_EVENTS.AUTHOR_FOLLOWED, {
  followerId,
  authorProfileId,
  followerDisplayName: actorProfile?.displayName ?? 'Someone',
  followerUsername:    actorProfile?.username ?? '',
  followerAvatarUrl:   actorProfile?.avatarUrl ?? null,
  recipientUserId:     profile.userId,   // profile = the followed AuthorProfile
} satisfies AuthorFollowedEvent);
```

**`followCompany()`** — after `companyFollow.create()`:
```typescript
// Fetch all owner userIds for this company
const owners = await this.prisma.companyMembership.findMany({
  where: { companyId, role: 'owner' },
  select: { userId: true },
});
const actorProfile = await this.prisma.authorProfile.findUnique({ where: { userId: followerId } });
this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_FOLLOWED, {
  followerId,
  followerDisplayName: actorProfile?.displayName ?? 'Someone',
  followerUsername:    actorProfile?.username ?? '',
  followerAvatarUrl:   actorProfile?.avatarUrl ?? null,
  companyId,
  companyName:  company.name,
  companyHandle: company.handle,
  ownerUserIds: owners.map(o => o.userId).filter(id => id !== followerId),
} satisfies CompanyFollowedEvent);
```

### 7b. `EngagementService`

**`likeBlog()`** — after `blogLike.create()`, only if `userId !== blog.authorId`:
```typescript
const actorProfile = await this.prisma.authorProfile.findUnique({ where: { userId } });
if (userId !== blog.authorId) {
  this.eventEmitter.emit(NOTIFICATION_EVENTS.BLOG_LIKED, {
    actorUserId:      userId,
    actorDisplayName: actorProfile?.displayName ?? 'Someone',
    actorUsername:    actorProfile?.username ?? '',
    actorAvatarUrl:   actorProfile?.avatarUrl ?? null,
    blogId:           blog.id,
    blogSlug:         blog.slug,
    blogTitle:        blog.title,
    authorUserId:     blog.authorId,
  } satisfies BlogLikedEvent);
}
```

**`saveBlog()`** — same pattern, same self-notification guard.

**`shareBlog()`** — only emit when `userId` is present (logged-in share) and `userId !== blog.authorId`:
```typescript
if (userId && userId !== blog.authorId) {
  // emit BlogSharedEvent
}
```

### 7c. `BlogsService`

**`publish()`** — after `repo.update()` succeeds, before return:
```typescript
// Gather fan-out data asynchronously after the response
setImmediate(async () => {
  const authorProfile = await this.prisma.authorProfile.findUnique({ where: { userId: blog.authorId } });
  const company = blog.companyId
    ? await this.prisma.company.findUnique({ where: { id: blog.companyId } })
    : null;
  this.eventEmitter.emit(NOTIFICATION_EVENTS.BLOG_PUBLISHED, {
    blogId:            updated.id,
    blogSlug:          updated.slug,
    blogTitle:         updated.title,
    blogSummary:       updated.summary,
    blogCoverImageUrl: updated.coverImageUrl,
    articleType:       updated.articleType,
    authorUserId:      blog.authorId,
    authorProfileId:   authorProfile?.id ?? '',
    authorDisplayName: authorProfile?.displayName ?? 'Someone',
    authorUsername:    authorProfile?.username ?? '',
    authorAvatarUrl:   authorProfile?.avatarUrl ?? null,
    companyId:         company?.id ?? null,
    companyName:       company?.name ?? null,
    companyHandle:     company?.handle ?? null,
    companyLogoUrl:    company?.logoUrl ?? null,
  } satisfies BlogPublishedEvent);
});
```

**`BlogSchedulerService.publishDueBlogs()`** — same emit pattern for each blog it publishes.

### 7d. `CompaniesService`

**`inviteAuthor()`** — after `repo.createInvite()` and fire-and-forget email, emit the in-app notification:
```typescript
// Look up inviter's profile
const inviterProfile = await this.prisma.authorProfile.findUnique({ where: { userId: requester.sub } });
this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_INVITE_RECEIVED, {
  inviteToken:          token,
  inviteExpiresAt:      expiresAt,
  companyId:            company.id,
  companyName:          company.name,
  companyHandle:        company.handle,
  companyLogoUrl:       company.logoUrl ?? null,
  invitedByUserId:      requester.sub,
  invitedByDisplayName: inviterProfile?.displayName ?? 'Someone',
  invitedByUsername:    inviterProfile?.username ?? '',
  invitedByAvatarUrl:   inviterProfile?.avatarUrl ?? null,
  invitedEmail:         dto.email,
} satisfies CompanyInviteReceivedEvent);
```

**`acceptInvite()`** — after `repo.createMembership()`:
```typescript
const actorProfile = await this.prisma.authorProfile.findUnique({ where: { userId: requester.sub } });
const owners = await this.prisma.companyMembership.findMany({
  where: { companyId: safeInvite.companyId, role: 'owner' },
  select: { userId: true },
});
this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_INVITE_RESPONDED, {
  accepted:         true,
  actorUserId:      requester.sub,
  actorDisplayName: actorProfile?.displayName ?? 'Someone',
  actorUsername:    actorProfile?.username ?? '',
  actorAvatarUrl:   actorProfile?.avatarUrl ?? null,
  companyId:        safeInvite.companyId,
  companyName:      safeInvite.company.name,
  companyHandle:    safeInvite.company.handle,
  ownerUserIds:     owners.map(o => o.userId).filter(id => id !== requester.sub),
} satisfies CompanyInviteRespondedEvent);
```

**`declineInvite()`** — same as accept, but `accepted: false`.

**`addMilestone()`** — after `repo.createMilestone()`:
```typescript
// Fan-out to all company followers (batched async)
this.eventEmitter.emit(NOTIFICATION_EVENTS.COMPANY_MILESTONE, {
  milestoneId:          milestone.id,
  milestoneType:        milestone.type,
  milestoneHeadline:    milestone.headline,
  milestoneImpactMetric: milestone.impactMetric ?? null,
  milestoneDateStr:     milestone.milestoneDate.toISOString().split('T')[0],
  companyId:            company.id,
  companyName:          company.name,
  companyHandle:        company.handle,
  companyLogoUrl:       company.logoUrl ?? null,
} satisfies CompanyMilestoneEvent);
```

---

## 8. Notification Listener

**File:** `src/modules/notifications/notifications.listener.ts`

This service handles all events and creates notification rows + pushes via WebSocket.

```typescript
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(NOTIFICATION_EVENTS.AUTHOR_FOLLOWED)
  async handleAuthorFollowed(event: AuthorFollowedEvent) {
    const notification = await this.notificationsService.create({
      userId:     event.recipientUserId,
      type:       'author_followed',
      title:      'New follower',
      message:    `${event.followerDisplayName} started following you.`,
      actorId:    event.followerId,
      entityId:   event.authorProfileId,
      entityType: 'author',
      metadata: {
        actor: {
          userId:      event.followerId,
          displayName: event.followerDisplayName,
          username:    event.followerUsername,
          avatarUrl:   event.followerAvatarUrl,
        },
      },
    });
    this.gateway.pushToUser(event.recipientUserId, notification);
  }

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_FOLLOWED)
  async handleCompanyFollowed(event: CompanyFollowedEvent) {
    // Notify all company owners in parallel
    const notifications = await Promise.all(
      event.ownerUserIds.map(ownerId =>
        this.notificationsService.create({
          userId:     ownerId,
          type:       'company_followed',
          title:      'New company follower',
          message:    `${event.followerDisplayName} is now following ${event.companyName}.`,
          actorId:    event.followerId,
          entityId:   event.companyId,
          entityType: 'company',
          metadata: {
            actor:   { userId: event.followerId, displayName: event.followerDisplayName, username: event.followerUsername, avatarUrl: event.followerAvatarUrl },
            company: { id: event.companyId, name: event.companyName, handle: event.companyHandle },
          },
        }),
      ),
    );
    notifications.forEach((n, i) => this.gateway.pushToUser(event.ownerUserIds[i], n));
  }

  @OnEvent(NOTIFICATION_EVENTS.BLOG_LIKED)
  async handleBlogLiked(event: BlogLikedEvent) {
    // Deduplication: skip if same actor already sent an unread like notification for this blog in the last hour
    const recentDuplicate = await this.prisma.notification.findFirst({
      where: {
        userId:    event.authorUserId,
        type:      'blog_liked',
        actorId:   event.actorUserId,
        entityId:  event.blogId,
        isRead:    false,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recentDuplicate) return;

    const notification = await this.notificationsService.create({
      userId:     event.authorUserId,
      type:       'blog_liked',
      title:      'Someone liked your article',
      message:    `${event.actorDisplayName} liked your article "${event.blogTitle}".`,
      actorId:    event.actorUserId,
      entityId:   event.blogId,
      entityType: 'blog',
      metadata: {
        actor: { userId: event.actorUserId, displayName: event.actorDisplayName, username: event.actorUsername, avatarUrl: event.actorAvatarUrl },
        blog:  { id: event.blogId, slug: event.blogSlug, title: event.blogTitle },
      },
    });
    this.gateway.pushToUser(event.authorUserId, notification);
  }

  @OnEvent(NOTIFICATION_EVENTS.BLOG_SAVED)
  async handleBlogSaved(event: BlogSavedEvent) {
    // Same deduplication pattern as blog_liked
    const notification = await this.notificationsService.create({
      userId:     event.authorUserId,
      type:       'blog_saved',
      title:      'Article bookmarked',
      message:    `${event.actorDisplayName} saved your article "${event.blogTitle}".`,
      actorId:    event.actorUserId,
      entityId:   event.blogId,
      entityType: 'blog',
      metadata: {
        actor: { userId: event.actorUserId, displayName: event.actorDisplayName, username: event.actorUsername, avatarUrl: event.actorAvatarUrl },
        blog:  { id: event.blogId, slug: event.blogSlug, title: event.blogTitle },
      },
    });
    this.gateway.pushToUser(event.authorUserId, notification);
  }

  @OnEvent(NOTIFICATION_EVENTS.BLOG_SHARED)
  async handleBlogShared(event: BlogSharedEvent) {
    const channelLabel = event.channel ?? 'the web';
    const notification = await this.notificationsService.create({
      userId:     event.authorUserId,
      type:       'blog_shared',
      title:      'Article shared',
      message:    `${event.actorDisplayName} shared your article "${event.blogTitle}" on ${channelLabel}.`,
      actorId:    event.actorUserId,
      entityId:   event.blogId,
      entityType: 'blog',
      metadata: {
        actor:   { userId: event.actorUserId, displayName: event.actorDisplayName, username: event.actorUsername, avatarUrl: event.actorAvatarUrl },
        blog:    { id: event.blogId, slug: event.blogSlug, title: event.blogTitle },
        channel: event.channel,
      },
    });
    this.gateway.pushToUser(event.authorUserId, notification);
  }

  @OnEvent(NOTIFICATION_EVENTS.BLOG_PUBLISHED)
  async handleBlogPublished(event: BlogPublishedEvent) {
    // Fan-out: collect all follower userIds (author followers + company followers)
    const authorFollowerIds = await this.prisma.authorFollow.findMany({
      where: { authorProfileId: event.authorProfileId },
      select: { followerId: true },
    }).then(rows => rows.map(r => r.followerId));

    const companyFollowerIds = event.companyId
      ? await this.prisma.companyFollow.findMany({
          where: { companyId: event.companyId },
          select: { followerId: true },
        }).then(rows => rows.map(r => r.followerId))
      : [];

    // Deduplicate and exclude the author themselves
    const recipientIds = [...new Set([...authorFollowerIds, ...companyFollowerIds])]
      .filter(id => id !== event.authorUserId);

    if (recipientIds.length === 0) return;

    const metadata = {
      author: {
        authorProfileId: event.authorProfileId,
        displayName:     event.authorDisplayName,
        username:        event.authorUsername,
        avatarUrl:       event.authorAvatarUrl,
      },
      blog: {
        id:           event.blogId,
        slug:         event.blogSlug,
        title:        event.blogTitle,
        articleType:  event.articleType,
        summary:      event.blogSummary,
        coverImageUrl: event.blogCoverImageUrl,
      },
      company: event.companyId ? {
        id:      event.companyId,
        name:    event.companyName,
        handle:  event.companyHandle,
        logoUrl: event.companyLogoUrl,
      } : null,
    };

    // Batch insert all notifications in one query
    await this.prisma.notification.createMany({
      data: recipientIds.map(userId => ({
        userId,
        type:       'blog_published_fan_out',
        title:      'New article published',
        message:    `${event.authorDisplayName} published a new article: "${event.blogTitle}".`,
        actorId:    event.authorUserId,
        entityId:   event.blogId,
        entityType: 'blog',
        metadata,
      })),
      skipDuplicates: true,
    });

    // Push real-time notification to each recipient
    recipientIds.forEach(userId => {
      this.gateway.pushToUser(userId, {
        type:    'blog_published_fan_out',
        title:   'New article published',
        message: `${event.authorDisplayName} published: "${event.blogTitle}"`,
        metadata,
      });
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_INVITE_RECEIVED)
  async handleCompanyInviteReceived(event: CompanyInviteReceivedEvent) {
    // Resolve the invitedEmail to a userId (user may not exist yet — skip if not found)
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: event.invitedEmail },
      select: { id: true },
    });
    if (!invitedUser) return; // User hasn't registered yet — email is the only channel

    const notification = await this.notificationsService.create({
      userId:     invitedUser.id,
      type:       'company_invite_received',
      title:      "You've been invited to join a company",
      message:    `${event.invitedByDisplayName} invited you to join ${event.companyName} as an author.`,
      actorId:    event.invitedByUserId,
      entityId:   event.companyId,
      entityType: 'company',
      metadata: {
        inviteToken: event.inviteToken,
        company: {
          id:      event.companyId,
          name:    event.companyName,
          handle:  event.companyHandle,
          logoUrl: event.companyLogoUrl,
        },
        invitedBy: {
          userId:      event.invitedByUserId,
          displayName: event.invitedByDisplayName,
          username:    event.invitedByUsername,
          avatarUrl:   event.invitedByAvatarUrl,
        },
        expiresAt: event.inviteExpiresAt.toISOString(),
        actions: [
          {
            label:  'Accept',
            style:  'primary',
            method: 'POST',
            url:    `/api/v1/companies/invites/${event.inviteToken}/accept`,
          },
          {
            label:  'Decline',
            style:  'secondary',
            method: 'POST',
            url:    `/api/v1/companies/invites/${event.inviteToken}/decline`,
          },
        ],
      },
    });
    this.gateway.pushToUser(invitedUser.id, notification);
  }

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_INVITE_RESPONDED)
  async handleCompanyInviteResponded(event: CompanyInviteRespondedEvent) {
    const title   = event.accepted ? 'Invite accepted' : 'Invite declined';
    const message = event.accepted
      ? `${event.actorDisplayName} accepted your invitation to join ${event.companyName}.`
      : `${event.actorDisplayName} declined your invitation to join ${event.companyName}.`;

    const notifications = await Promise.all(
      event.ownerUserIds.map(ownerId =>
        this.notificationsService.create({
          userId:     ownerId,
          type:       event.accepted ? 'company_invite_accepted' : 'company_invite_declined',
          title,
          message,
          actorId:    event.actorUserId,
          entityId:   event.companyId,
          entityType: 'company',
          metadata: {
            user:    { userId: event.actorUserId, displayName: event.actorDisplayName, username: event.actorUsername, avatarUrl: event.actorAvatarUrl },
            company: { id: event.companyId, name: event.companyName, handle: event.companyHandle },
          },
        }),
      ),
    );
    notifications.forEach((n, i) => this.gateway.pushToUser(event.ownerUserIds[i], n));
  }

  @OnEvent(NOTIFICATION_EVENTS.COMPANY_MILESTONE)
  async handleCompanyMilestone(event: CompanyMilestoneEvent) {
    // Fan-out to all company followers
    const followerIds = await this.prisma.companyFollow.findMany({
      where: { companyId: event.companyId },
      select: { followerId: true },
    }).then(rows => rows.map(r => r.followerId));

    if (followerIds.length === 0) return;

    const metadata = {
      milestone: {
        id:            event.milestoneId,
        type:          event.milestoneType,
        headline:      event.milestoneHeadline,
        impactMetric:  event.milestoneImpactMetric,
        milestoneDate: event.milestoneDateStr,
      },
      company: {
        id:      event.companyId,
        name:    event.companyName,
        handle:  event.companyHandle,
        logoUrl: event.companyLogoUrl,
      },
    };

    await this.prisma.notification.createMany({
      data: followerIds.map(userId => ({
        userId,
        type:       'company_milestone',
        title:      'New company milestone',
        message:    `${event.companyName} just hit a new milestone: "${event.milestoneHeadline}".`,
        entityId:   event.companyId,
        entityType: 'company',
        metadata,
      })),
      skipDuplicates: true,
    });

    followerIds.forEach(userId => this.gateway.pushToUser(userId, {
      type:    'company_milestone',
      title:   'New company milestone',
      message: `${event.companyName}: "${event.milestoneHeadline}"`,
      metadata,
    }));
  }
}
```

---

## 9. WebSocket Gateway

**File:** `src/modules/notifications/notifications.gateway.ts`

```typescript
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: '*' },  // tighten in production
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    // Validate JWT from handshake auth header or query param
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      const userId: string = payload.sub;
      // Each user joins their personal room
      await client.join(`user:${userId}`);
      this.logger.log(`WS connected: user ${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  pushToUser(userId: string, notification: object) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
```

**Client connection (frontend):**

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/notifications', {
  auth: { token: accessToken },
  transports: ['websocket'],
});

socket.on('notification', (notification) => {
  // notification shape matches the API response (see §11)
  showNotificationToast(notification);
  incrementUnreadBadge();
});

socket.on('disconnect', () => {
  // reconnect handled automatically by socket.io-client
});
```

---

## 10. `NotificationsService` Changes

Add one method — `create()`. All existing methods (`findAll`, `markRead`, `markAllRead`, `getUnreadCount`) are unchanged.

```typescript
async create(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actorId?: string;
  entityId?: string;
  entityType?: EntityType;
  metadata?: object;
}): Promise<Notification> {
  return this.prisma.notification.create({
    data: {
      userId:     data.userId,
      type:       data.type,
      title:      data.title,
      message:    data.message,
      actorId:    data.actorId ?? null,
      entityId:   data.entityId ?? null,
      entityType: data.entityType ?? null,
      metadata:   data.metadata ?? null,
    },
  });
}
```

Also add two new methods:

```typescript
async deleteOne(userId: string, id: string): Promise<void> {
  const n = await this.prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw new NotFoundException('Notification not found.');
  await this.prisma.notification.delete({ where: { id } });
}

async deleteAll(userId: string): Promise<{ deleted: number }> {
  const { count } = await this.prisma.notification.deleteMany({ where: { userId } });
  return { deleted: count };
}
```

---

## 11. REST API Endpoints

All require `Authorization: Bearer {{access_token}}`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/notifications?page=1&limit=20` | Paginated list (existing) |
| `GET` | `/api/v1/notifications/unread-count` | Badge count (existing) |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark one as read (existing) |
| `POST` | `/api/v1/notifications/read-all` | Mark all as read (existing) |
| `DELETE` | `/api/v1/notifications/:id` | Delete a single notification (NEW) |
| `DELETE` | `/api/v1/notifications` | Delete all notifications for user (NEW) |

### New controller additions

```typescript
@Delete()
@HttpCode(HttpStatus.OK)
@ApiOkResponse({ description: 'Deletes all notifications for the authenticated user.' })
deleteAll(@CurrentUser() user: JwtUser) {
  return this.notificationsService.deleteAll(user.sub);
}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOkResponse({ description: 'Deletes a single notification.' })
deleteOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
  return this.notificationsService.deleteOne(user.sub, id);
}
```

### Response shape (GET `/notifications`)

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "type": "author_followed",
        "title": "New follower",
        "message": "Jane Dev started following you.",
        "isRead": false,
        "actorId": "uuid",
        "entityId": "uuid",
        "entityType": "author",
        "metadata": {
          "actor": {
            "userId": "uuid",
            "displayName": "Jane Dev",
            "username": "jane-dev",
            "avatarUrl": "https://..."
          }
        },
        "createdAt": "2026-05-24T10:00:00.000Z"
      },
      {
        "id": "uuid",
        "type": "company_invite_received",
        "title": "You've been invited to join a company",
        "message": "Ajay K invited you to join Acme Corp as an author.",
        "isRead": false,
        "actorId": "uuid",
        "entityId": "uuid",
        "entityType": "company",
        "metadata": {
          "inviteToken": "abc123...",
          "company": { "id": "uuid", "name": "Acme Corp", "handle": "acme-corp", "logoUrl": null },
          "invitedBy": { "userId": "uuid", "displayName": "Ajay K", "username": "ajay-k", "avatarUrl": null },
          "expiresAt": "2026-05-31T00:00:00.000Z",
          "actions": [
            { "label": "Accept",  "style": "primary",   "method": "POST", "url": "/api/v1/companies/invites/abc123.../accept" },
            { "label": "Decline", "style": "secondary", "method": "POST", "url": "/api/v1/companies/invites/abc123.../decline" }
          ]
        },
        "createdAt": "2026-05-24T10:05:00.000Z"
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 5, "hasNextPage": false }
  }
}
```

### WebSocket event shape (real-time push)

Identical to the REST notification object above. The `notification` event fires with the full notification payload so the frontend can insert it into the list without a refetch.

---

## 12. Module Architecture

### `NotificationsModule` (updated)

```typescript
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

### Updated `AppModule`

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),
    // ... all existing imports unchanged
  ],
})
export class AppModule {}
```

### Files to inject `EventEmitter2` into

Each trigger-point service gets the emitter injected:
```typescript
constructor(
  // ... existing deps
  private readonly eventEmitter: EventEmitter2,
) {}
```

And adds to its module's providers/imports:
```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
// EventEmitter2 is globally available from EventEmitterModule.forRoot() — no extra import needed
```

---

## 13. Complete File List

### New files to create

| File | Purpose |
|---|---|
| `src/modules/notifications/notifications.gateway.ts` | WebSocket gateway — real-time push |
| `src/modules/notifications/notifications.listener.ts` | `@OnEvent` handlers — create DB row + push |
| `src/modules/notifications/events/notification.events.ts` | Typed event payload classes |
| `src/modules/notifications/events/notification-event-names.ts` | Event name constants |

### Files to modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Expand `NotificationType` enum + add 4 fields to `Notification` model |
| `src/modules/notifications/notifications.service.ts` | Add `create()`, `deleteOne()`, `deleteAll()` |
| `src/modules/notifications/notifications.controller.ts` | Add `DELETE /:id` and `DELETE /` endpoints |
| `src/modules/notifications/notifications.module.ts` | Add gateway, listener, JwtModule |
| `src/modules/follows/follows.service.ts` | Inject `EventEmitter2`, emit after `followAuthor()` and `followCompany()` |
| `src/modules/engagement/engagement.service.ts` | Inject `EventEmitter2`, emit after `likeBlog()`, `saveBlog()`, `shareBlog()` |
| `src/modules/companies/services/companies.service.ts` | Inject `EventEmitter2`, emit after `inviteAuthor()`, `acceptInvite()`, `declineInvite()`, `addMilestone()` |
| `src/modules/blogs/services/blogs.service.ts` | Inject `EventEmitter2`, emit after `publish()` |
| `src/modules/blogs/services/blog-scheduler.service.ts` | Inject `EventEmitter2`, emit after each scheduled blog published |
| `src/app.module.ts` | Add `EventEmitterModule.forRoot()` |

---

## 14. Self-Notification Prevention Rules

| Trigger | Guard |
|---|---|
| `blog_liked` | Skip if `actorUserId === blog.authorId` |
| `blog_saved` | Skip if `actorUserId === blog.authorId` |
| `blog_shared` | Skip if `actorUserId === blog.authorId` |
| `blog_published_fan_out` | Exclude `authorUserId` from recipient list |
| `company_followed` | Exclude follower from owner list before notifying |
| `company_invite_responded` | Company owner who is also the actor is excluded |

---

## 15. Deduplication Rules

Avoid notification spam when someone repeatedly likes/unlikes/re-likes:

| Type | Dedup window | Key |
|---|---|---|
| `blog_liked` | 1 hour | `(actorId, entityId, type, isRead=false)` |
| `blog_saved` | 1 hour | `(actorId, entityId, type, isRead=false)` |
| `author_followed` | none | One-shot (can only follow once) |
| `company_followed` | none | One-shot |
| `blog_published_fan_out` | none | `createMany + skipDuplicates` guards at DB level |
| `company_milestone` | none | Each milestone is a unique event |

---

## 16. Fan-out Scale Strategy

| Follower count | Strategy |
|---|---|
| 0 – 5,000 | Async listener with `createMany` batch insert (this design) |
| 5,000 – 50,000 | Move fan-out to a BullMQ job queue; listener just enqueues a job |
| 50,000+ | Chunked BullMQ jobs; WebSocket push via Redis pub/sub across multiple instances |

The current design is written so the listener is the only place that changes when scaling up — all event emission code in the domain services remains untouched.

---

## 17. Implementation Order

1. **Schema migration** — expand enum + add columns to `Notification`
2. **`@nestjs/event-emitter` install + `AppModule` change**
3. **Event classes + names** — `notification.events.ts` + `notification-event-names.ts`
4. **`NotificationsService.create()`** — add the `create()` + `deleteOne()` + `deleteAll()` methods
5. **`NotificationsGateway`** — WebSocket gateway with JWT auth
6. **`NotificationsListener`** — all `@OnEvent` handlers
7. **`NotificationsModule` update** — wire gateway + listener + JwtModule
8. **Domain service emission** — one module at a time: Follows → Engagement → Companies → Blogs
9. **Controller** — add `DELETE` endpoints
10. **Run `pnpm build`** — confirm TypeScript compiles clean

---

## 18. Testing Checklist

### Unit / Integration

- `NotificationsListener` should create the correct DB row for each event type
- Self-notification guard: emitting with `actorId === authorId` must not produce a row
- Dedup: two `blog_liked` events for same actor+blog within 1 hour → only one notification row
- Fan-out: `blog_published` with 3 followers → 3 notification rows via `createMany`

### Manual (Postman + WebSocket client)

1. **Follow author**: Connect to WS as author. Follow them from another account. Author's WS client should receive `notification` event immediately.
2. **Like blog**: Author publishes blog. Second user likes it. Author receives `blog_liked` notification in real-time.
3. **Company invite**: Owner invites user. User's notification list shows the invite with Accept/Decline action buttons. User clicks Accept → `POST /companies/invites/:token/accept`. Owner receives `company_invite_accepted` notification.
4. **Publish fan-out**: Author with 3 followers publishes. All 3 followers receive `blog_published_fan_out` notification via WS.
5. **Unread count**: Start at 0. Receive 3 notifications. `GET /notifications/unread-count` returns `{ count: 3 }`. Mark one read. Returns `{ count: 2 }`.
6. **Delete**: `DELETE /notifications/:id` → `204`. Notification no longer in list. `DELETE /notifications` → `{ deleted: N }`. List is empty.

---

## 19. Open Questions / Future Work

| Topic | Decision needed |
|---|---|
| Notification preferences | Do users control which types they receive? Add a `UserNotificationPreferences` table later. |
| Email digest | For users not online, send a daily digest of unread notifications. EventEmitter listener can also call MailService. |
| Push notifications (mobile) | Add Firebase Cloud Messaging (FCM) push alongside WebSocket. Same listener, additional dispatch. |
| Auto-expire | Add a cron job to `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'`. |
| `company_invite_received` for unregistered users | Currently skipped if email has no account. Could queue the notification to be sent when they register. |
| WebSocket auth token refresh | Access tokens expire in 15min. Client must reconnect with a new token; server must handle reconnect gracefully. |
| Horizontal scaling | Redis adapter for Socket.IO: `@socket.io/redis-adapter`. Required when running multiple API instances. |
