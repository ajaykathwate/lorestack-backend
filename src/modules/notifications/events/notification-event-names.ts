export const NOTIFICATION_EVENTS = {
  AUTHOR_FOLLOWED: 'notification.author_followed',
  COMPANY_FOLLOWED: 'notification.company_followed',
  BLOG_LIKED: 'notification.blog_liked',
  BLOG_SAVED: 'notification.blog_saved',
  BLOG_SHARED: 'notification.blog_shared',
  BLOG_PUBLISHED: 'notification.blog_published',
  COMPANY_INVITE_RECEIVED: 'notification.company_invite_received',
  COMPANY_INVITE_RESPONDED: 'notification.company_invite_responded',
  COMPANY_MILESTONE: 'notification.company_milestone',
} as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
