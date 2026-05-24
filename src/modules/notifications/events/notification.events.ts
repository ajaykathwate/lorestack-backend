export class AuthorFollowedEvent {
  followerId: string;
  authorProfileId: string;
  followerDisplayName: string;
  followerUsername: string;
  followerAvatarUrl: string | null;
  recipientUserId: string;
}

export class CompanyFollowedEvent {
  followerId: string;
  followerDisplayName: string;
  followerUsername: string;
  followerAvatarUrl: string | null;
  companyId: string;
  companyName: string;
  companyHandle: string;
  ownerUserIds: string[];
}

export class BlogLikedEvent {
  actorUserId: string;
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  blogId: string;
  blogSlug: string;
  blogTitle: string;
  authorUserId: string;
}

export class BlogSavedEvent {
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
  actorUserId: string;
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
  invitedEmail: string;
}

export class CompanyInviteRespondedEvent {
  accepted: boolean;
  actorUserId: string;
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  companyId: string;
  companyName: string;
  companyHandle: string;
  ownerUserIds: string[];
}

export class CompanyMilestoneEvent {
  milestoneId: string;
  milestoneType: string;
  milestoneHeadline: string;
  milestoneImpactMetric: string | null;
  milestoneDateStr: string;
  companyId: string;
  companyName: string;
  companyHandle: string;
  companyLogoUrl: string | null;
}
