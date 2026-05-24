# Frontend Notifications Implementation Checklist

This document is for the frontend team. It covers everything needed to integrate the Lorestack real-time notification system — WebSocket connection, REST endpoints, notification rendering, and action handling.

---

## 1. Install Socket.IO Client

```bash
npm install socket.io-client
# or
pnpm add socket.io-client
```

---

## 2. WebSocket Connection

### 2.1 Connect to the notifications namespace

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function connectNotifications(accessToken: string) {
  socket = io(`${process.env.NEXT_PUBLIC_API_BASE_URL}`, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: accessToken },
  });

  socket.on('connect', () => {
    console.log('Notifications socket connected');
  });

  socket.on('connect_error', (err) => {
    console.error('Notifications socket error', err.message);
  });

  socket.on('disconnect', () => {
    console.log('Notifications socket disconnected');
  });
}
```

> The namespace is `/notifications`. The full Socket.IO URL is  
> `http://localhost:3000/notifications` (or your production host).

### 2.2 Listen for incoming notifications

```typescript
socket.on('notification', (payload: NotificationPayload) => {
  // Add to local notification store / state
  addNotification(payload);
  // Increment unread badge count
  incrementUnreadCount();
});
```

### 2.3 Disconnect on logout

```typescript
function disconnectNotifications() {
  socket?.disconnect();
  socket = null;
}
```

### 2.4 Connection checklist

- [ ] Connect socket after successful login (access token available)
- [ ] Reconnect socket after token refresh (create new socket with new token)
- [ ] Disconnect socket on logout
- [ ] Handle `connect_error` — show an unobtrusive "real-time updates unavailable" indicator if connection fails repeatedly

---

## 3. Notification Payload Shape

Every `notification` event from the WebSocket, and every item in the REST list response, shares this shape:

```typescript
interface NotificationPayload {
  id?: string;              // present for REST list items; absent for WS push (persisted by backend)
  type: NotificationType;
  title: string;
  message: string;
  isRead?: boolean;         // always false for fresh WS push
  actorId?: string;
  entityId?: string;
  entityType?: 'blog' | 'company' | 'author' | 'tag';
  metadata?: Record<string, unknown>; // type-specific, see Section 6
  createdAt?: string;       // ISO string, present in REST response
}

type NotificationType =
  | 'author_followed'
  | 'company_followed'
  | 'blog_liked'
  | 'blog_saved'
  | 'blog_shared'
  | 'blog_published_fan_out'
  | 'company_invite_received'
  | 'company_invite_accepted'
  | 'company_invite_declined'
  | 'company_milestone';
```

---

## 4. REST Endpoints

Base URL: `{{API_BASE}}/api/v1`  
All endpoints require `Authorization: Bearer <access_token>` header.

### 4.1 Fetch paginated notifications

```
GET /notifications?page=1&limit=20
```

Response:
```json
{
  "data": {
    "data": [ /* NotificationPayload[] */ ],
    "meta": { "page": 1, "limit": 20, "total": 42, "hasNextPage": true }
  }
}
```

- [ ] Load first page on mount when notification panel opens
- [ ] Implement infinite scroll / "load more" using `meta.hasNextPage`
- [ ] Merge with live WS notifications (prepend WS items to top of list)

### 4.2 Get unread count

```
GET /notifications/unread-count
```

Response: `{ "data": { "count": 5 } }`

- [ ] Fetch this on initial app load to populate the badge
- [ ] Do NOT re-fetch after every WS event — instead increment/decrement locally for performance

### 4.3 Mark a notification as read

```
PATCH /notifications/:id/read
```

- [ ] Call on panel item click (or hover with delay)
- [ ] Optimistically update `isRead` in local state before the response comes back
- [ ] Decrement unread badge count

### 4.4 Mark all as read

```
POST /notifications/read-all
```

- [ ] Wire to a "Mark all as read" button in the notification panel
- [ ] Set all local notification items to `isRead: true`
- [ ] Reset unread badge to 0

### 4.5 Delete a single notification

```
DELETE /notifications/:id
```

Response: 204 No Content

- [ ] Wire to a dismiss/delete icon per notification item
- [ ] Remove from local state on success

### 4.6 Delete all notifications

```
DELETE /notifications
```

Response: `{ "data": { "deleted": 5 } }`

- [ ] Wire to a "Clear all" button in the notification panel
- [ ] Clear local notification list and reset badge to 0

---

## 5. Unread Badge Component

- [ ] Display badge on notification bell icon with `count` from `GET /notifications/unread-count`
- [ ] Cap display at `99+` (don't show "123")
- [ ] Hide badge when count is 0
- [ ] Increment badge by 1 on each live WS `notification` event
- [ ] Decrement badge by 1 when a notification is marked read (if it was unread)
- [ ] Reset badge to 0 when "Mark all as read" is called

---

## 6. Notification Item Rendering

Each notification item should render: **avatar** | **title** | **message** | **relative timestamp** | **unread indicator dot** | **action buttons (if any)**.

### 6.1 Type-specific routing

Use `type` and `entityType`/`entityId` to build deep links:

| `type` | Link target |
|--------|------------|
| `author_followed` | `/authors/:metadata.actor.username` |
| `company_followed` | `/companies/:metadata.company.handle` |
| `blog_liked` | `/blogs/:metadata.blog.slug` |
| `blog_saved` | `/blogs/:metadata.blog.slug` |
| `blog_shared` | `/blogs/:metadata.blog.slug` |
| `blog_published_fan_out` | `/blogs/:metadata.blog.slug` |
| `company_invite_received` | — (use action buttons, see 6.2) |
| `company_invite_accepted` | `/companies/:metadata.company.handle` |
| `company_invite_declined` | `/companies/:metadata.company.handle` |
| `company_milestone` | `/companies/:metadata.company.handle` |

### 6.2 Action buttons — company invite

For `company_invite_received`, the `metadata.actions` array contains ready-to-use button configs:

```typescript
interface NotificationAction {
  label: string;           // "Accept" | "Decline"
  style: 'primary' | 'secondary';
  method: 'POST';
  url: string;             // e.g. "/api/v1/companies/invites/:token/accept"
}
```

- [ ] Render two buttons: **Accept** (primary) and **Decline** (secondary)
- [ ] On click, `POST` to `${API_BASE}${action.url}` with JWT header
- [ ] On success, remove the invite notification from the list (or replace with a status message)
- [ ] Show loading state on buttons while request is in-flight

### 6.3 Avatar fallback

```typescript
const avatarUrl = notification.metadata?.actor?.avatarUrl
  ?? notification.metadata?.author?.avatarUrl
  ?? null;
// Fall back to initials or generic icon
```

### 6.4 Relative timestamp

Use a library like `date-fns/formatDistanceToNow` or `dayjs().fromNow()` to show "2 minutes ago", "3 days ago", etc.

---

## 7. Notification Panel UX

- [ ] Slide-in panel or dropdown triggered by bell icon
- [ ] Show empty state when list is empty: "You're all caught up!"
- [ ] Show loading skeleton on first load
- [ ] Group notifications by day ("Today", "Yesterday", "Earlier") for panels with many items
- [ ] Unread items visually distinct (background color, bold text, or dot indicator)
- [ ] Clicking a notification: mark as read → navigate to the linked entity
- [ ] "Mark all as read" button — only show when `unreadCount > 0`
- [ ] "Clear all" button with confirmation dialog

---

## 8. Toast / Pop-up for Live Events

For real-time WS notifications, show a non-blocking toast:

- [ ] Render a toast/snackbar at bottom-right (or top-right) of screen
- [ ] Auto-dismiss after 4–6 seconds
- [ ] Show avatar + message + "View" button that marks as read and navigates
- [ ] Queue toasts if multiple arrive rapidly — show one at a time or stack with a limit of 3

---

## 9. Notification Types — Rendering Reference

| Type | Icon | Message pattern | Has deep link? | Has actions? |
|------|------|----------------|----------------|--------------|
| `author_followed` | 👤 person+ | "Jane Doe started following you." | Yes → author profile | No |
| `company_followed` | 🏢 building+ | "Jane Doe is now following Acme Inc." | Yes → company page | No |
| `blog_liked` | ❤️ heart | "Jane Doe liked your article '...'" | Yes → blog | No |
| `blog_saved` | 🔖 bookmark | "Jane Doe saved your article '...'" | Yes → blog | No |
| `blog_shared` | 🔗 share | "Jane Doe shared your article '...' on Twitter." | Yes → blog | No |
| `blog_published_fan_out` | 📝 document | "Jane Doe published a new article: '...'" | Yes → blog | No |
| `company_invite_received` | 📩 envelope | "Jane Doe invited you to join Acme Inc. as an author." | No | Yes — Accept / Decline |
| `company_invite_accepted` | ✅ check | "Jane Doe accepted your invitation to join Acme Inc." | Yes → company | No |
| `company_invite_declined` | ❌ cross | "Jane Doe declined your invitation to join Acme Inc." | Yes → company | No |
| `company_milestone` | 🏆 trophy | "Acme Inc. just hit a new milestone: '...'" | Yes → company | No |

---

## 10. Edge Cases Checklist

- [ ] **Duplicate prevention**: Backend deduplicates `blog_liked` / `blog_saved` within 1 hour — no frontend action needed; just render what arrives
- [ ] **User offline**: Notifications are persisted in DB. On reconnect / next app load, `GET /notifications` returns all missed items — merge these with any live WS items already shown
- [ ] **Token expiry during socket session**: Listen for `disconnect` with reason `io server disconnect` — this means the JWT was rejected. Reconnect with a fresh token after token refresh
- [ ] **Invite expiry**: The backend rejects expired invite tokens with `400 Bad Request`. Show an error message: "This invite has expired." and remove the notification from the panel
- [ ] **Self-notification prevention**: Backend never sends notifications to yourself (e.g., you like your own article). No frontend handling needed
- [ ] **Fan-out notifications**: `blog_published_fan_out` and `company_milestone` are bulk-pushed — may arrive in rapid succession. Queue toasts and don't overwhelm the UI
- [ ] **Unregistered invitees**: Users invited by email who have not yet registered will see the `company_invite_received` notification only after they sign up. No special frontend handling needed

---

## 11. Summary of API Calls to Implement

| When | Call |
|------|------|
| App load / login | `GET /notifications/unread-count` |
| Notification panel opens | `GET /notifications?page=1&limit=20` |
| User scrolls to bottom of panel | `GET /notifications?page=N&limit=20` |
| User clicks a notification item | `PATCH /notifications/:id/read` |
| User clicks "Mark all as read" | `POST /notifications/read-all` |
| User clicks dismiss on a notification | `DELETE /notifications/:id` |
| User clicks "Clear all" | `DELETE /notifications` |
| Accept invite button | `POST /api/v1/companies/invites/:token/accept` |
| Decline invite button | `POST /api/v1/companies/invites/:token/decline` |
