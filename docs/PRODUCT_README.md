# Lorestack

> A company-first publishing platform for startups, engineers, and independent authors.
> Write engineering blogs, case studies, founder notes, and build-in-public timelines — as yourself or under a company.

---

## Table of Contents

1. [What is Lorestack?](#what-is-lorestack)
2. [Tech Stack](#tech-stack)
3. [URL Structure](#url-structure)
4. [Roles & Permissions (RBAC)](#roles--permissions-rbac)
5. [MVP Features](#mvp-features)
   - [1. Authentication](#1-authentication)
   - [2. Author Profiles](#2-author-profiles)
   - [3. Blog & Content System](#3-blog--content-system)
   - [4. Company Management](#4-company-management)
   - [5. RBAC & Permissions](#5-rbac--permissions)
   - [6. Tags & Topics](#6-tags--topics)
   - [7. Public Discovery](#7-public-discovery)
   - [8. SEO & Auto-Generated Pages](#8-seo--auto-generated-pages)
   - [9. Build-In-Public Timeline](#9-build-in-public-timeline)
6. [Database Schema](#database-schema)
7. [Architecture Reference](#architecture-reference)
8. [Key Design Decisions](#key-design-decisions)
9. [Architecture Notes & Known Trade-offs](#architecture-notes--known-trade-offs)
10. [Complete Product Features (Phase 2)](#complete-product-features-phase-2)

---

## What is Lorestack?

Lorestack is a **hybrid publishing platform** — open for anyone to write (like Medium or Dev.to) with a strong company knowledge-hub layer (unlike anything else). Three user types coexist:

- **Solo Author** — writes independently, no company required. Zero setup.
- **Company Author** — writes under a company brand they have been invited to join.
- **Company Owner** — creates and manages a company profile, invites authors, controls all company content.

The agency use case is also built-in: the Lorestack team can ghost-write and schedule articles for founder clients, who approve them before publishing (Complete Product phase).

---

## Tech Stack

| Layer        | Technology                                                              |
| ------------ | ----------------------------------------------------------------------- |
| Auth         | Supabase Auth (Email + Password, Google OAuth)                          |
| Database     | PostgreSQL via Supabase                                                 |
| Storage      | Supabase Storage (images, OG assets, sitemap.xml)                       |
| Email        | Resend (via `ResendEmailAdapter` — swappable)                           |
| Backend      | Node.js / TypeScript                                                    |
| Architecture | Repository pattern · DIP service interfaces · Event-driven side effects |

---

## URL Structure

| URL Pattern          | Page                                           |
| -------------------- | ---------------------------------------------- |
| `/`                  | Public homepage                                |
| `/explore`           | Browse all published blogs                     |
| `/blog/[slug]`       | Individual blog reading page                   |
| `/author/[username]` | Public author profile                          |
| `/company/[handle]`  | Public company page                            |
| `/tag/[slug]`        | Auto-generated tag/topic page                  |
| `/me/profile`        | Logged-in user profile settings                |
| `/me/drafts`         | Logged-in user draft management                |
| `/dashboard`         | Logged-in user dashboard                       |
| `/sitemap.xml`       | Dynamic sitemap (served from Supabase Storage) |
| `/robots.txt`        | Robots configuration                           |

---

## Roles & Permissions (RBAC)

Roles are **not selected at signup**. They emerge from actions taken on the platform.

### Role Acquisition

| How                                | Role Gained                       |
| ---------------------------------- | --------------------------------- |
| Any registration                   | `Independent Author` by default   |
| User creates a company             | `Company Owner` for that company  |
| User accepts a company invite      | `Company Author` for that company |
| Manually set in Supabase dashboard | `Platform Admin`                  |

### Key Rules

- A user can hold **multiple roles simultaneously** — e.g. Independent Author + Owner of Company A + Author in Company B.
- Roles are **additive** — gaining Company Owner does not remove Independent Author capability.
- `Company Owner` role is **non-transferable** in MVP.
- `Platform Admin` is set manually in Supabase dashboard — never via the app UI.

### Permissions Matrix

| Permission                            | Independent Author | Company Author   | Company Owner    | Platform Admin |
| ------------------------------------- | ------------------ | ---------------- | ---------------- | -------------- |
| Register & log in                     | ✅                 | ✅               | ✅               | ✅             |
| Edit own profile                      | ✅                 | ✅               | ✅               | ✅             |
| Publish blog as independent author    | ✅                 | ✅               | ✅               | ✅             |
| Publish blog under a company          | ❌                 | ✅ own companies | ✅ own companies | ✅             |
| Edit own blog                         | ✅                 | ✅               | ✅               | ✅             |
| Edit **any** blog under their company | ❌                 | ❌               | ✅               | ✅             |
| Archive own blog                      | ✅                 | ✅               | ✅               | ✅             |
| Archive **any** company blog          | ❌                 | ❌               | ✅               | ✅             |
| Schedule blog publishing              | ✅                 | ✅               | ✅               | ✅             |
| Create a company                      | ✅                 | ✅               | ✅               | ✅             |
| Edit company profile                  | ❌                 | ❌               | ✅ own           | ✅             |
| Invite authors to company             | ❌                 | ❌               | ✅ own           | ✅             |
| Remove authors from company           | ❌                 | ❌               | ✅ own           | ✅             |
| Add company timeline milestone        | ❌                 | ❌               | ✅ own           | ✅             |
| View company dashboard                | ❌                 | ✅ read-only     | ✅ full          | ✅             |
| View company analytics                | ❌                 | ✅ read-only     | ✅ full          | ✅             |
| Access Admin Panel (`/admin`)         | ❌                 | ❌               | ❌               | ✅             |
| Moderate flagged content              | ❌                 | ❌               | ❌               | ✅             |
| Curate homepage featured content      | ❌                 | ❌               | ❌               | ✅             |
| Manage / merge / approve tags         | ❌                 | ❌               | ❌               | ✅             |
| Suspend / manage user accounts        | ❌                 | ❌               | ❌               | ✅             |

> `PermissionChecker` is a pure class with zero I/O dependencies that encodes all these rules. Every service method calls it before any write. There are no inline permission checks scattered across the codebase.

---

## MVP Features

**27 features across 9 domains. These are the only features in scope for Phase 1 (MVP).**

---

### 1. Authentication

#### 1.1 User Registration — Email & Password

Any visitor creates a Lorestack account using email and password via Supabase Auth. No role is selected at signup.

**Form fields:** Full Name (required), Email (required), Password (required, min 8 chars), Confirm Password (required).

**Flow:**

- On success → Supabase sends verification email → user redirected to "Check your inbox" screen.
- User clicks verification link → redirected to 2-field onboarding screen.
- Onboarding complete → user lands on dashboard with 3 empty-state CTAs: "Write your first blog", "Create a company", "Explore articles".

**Edge cases:**

- Email already registered → inline error: "An account with this email already exists."
- Password < 8 chars → inline error.
- Passwords do not match → inline error.
- Verification link expired (> 24 hours) → error page with "Resend verification email" button.
- Verification link already used → error: "This link has already been used."

---

#### 1.2 User Login — Email & Password

Registered users log in with email and password.

**Key behaviours:**

- "Remember me" checkbox for persistent session.
- 5 consecutive failed attempts → account locked for 15 minutes.
- On success → user redirected to their dashboard.

**Edge cases:**

- Email not found → "No account found with this email address."
- Wrong password → "Incorrect password."
- Email not verified → toast with "Resend verification email" link shown below.
- Account suspended → "Your account has been suspended. Contact support."

---

#### 1.3 Google OAuth Login — via Supabase

One-click sign-up or login using a Google account. Supabase handles the full OAuth flow.

**Flow:**

- New user (email not registered) → auto-creates account from Google profile → onboarding screen → dashboard.
- Returning user (email already registered) → links Google account to existing account → dashboard.

**Edge cases:**

- User dismisses Google popup → returns to login page, no error shown.
- Google-side auth failure → toast: "Google sign-in failed. Try again or use email and password."

---

#### 1.4 Forgot Password / Reset Password

Secure password reset via a time-limited email link generated by Supabase Auth.

**Key behaviours:**

- Reset link valid for 1 hour.
- Security: system always shows the same confirmation message regardless of whether the email is registered (prevents email enumeration).
- On successful reset → all existing sessions invalidated → user redirected to login page.

**Edge cases:**

- Expired link → error page with "Request a new reset link" button.
- Already-used link → "This reset link has already been used."
- New password < 8 chars → inline error.

---

### 2. Author Profiles

#### 2.1 Post-Registration Onboarding & Profile Setup

After email verification, new users complete a minimal 2-field screen before accessing the dashboard.

**Fields shown:** Display Name (pre-filled from registration name, editable), Profile Photo (optional, skip-able). Optional bio field shown with "You can add this later" hint.

**Key behaviours:**

- Display name left blank → system uses registered full name automatically.
- Photo upload failure → silent fallback to initials-based default avatar.

---

#### 2.2 Edit Author Profile

Logged-in users update their profile at any time from Settings → My Profile.

**Editable fields:** Display Name, Username (@handle), Bio (max 300 chars), Profile Photo, Expertise Tags (multi-select, max 10), Twitter/X handle, LinkedIn URL, GitHub handle, Personal Website URL.

**Edge cases:**

- Username already taken → inline error with suggested alternative.
- Username contains invalid characters (only letters, numbers, hyphens, underscores allowed) → inline error.
- Profile photo > 2MB → "Photo must be under 2MB."
- Photo wrong type → "Please upload a JPG, PNG, or WebP image."
- Bio > 300 chars → character counter turns red, save button disabled.
- Username change → `SlugChangedEvent` fired → `slug_redirects` row inserted → old `/author/[old-username]` 301-redirects to new username.

---

#### 2.3 Public Author Profile Page — `/author/[username]`

Every user has a public profile page accessible without login.

**Page content:**

- Profile photo, display name, `@username`, bio, expertise tags, social link icons.
- "Writing for" section: company logos for all companies the author belongs to (clicking → company page).
- All published (non-archived) blogs listed newest first: cover image, article type badge, title, publish date, read time, tags.

**Edge cases:**

- No published blogs → "No published articles yet."
- All blogs archived → same empty state. Archived blogs never shown publicly.
- Username not found → custom 404 with "Back to Homepage."

**SEO:** Auto meta title: `[Display Name] – Articles on Lorestack`. OG image auto-generated. Person JSON-LD schema.

---

### 3. Blog & Content System

#### 3.1 Create & Publish Blog

Any logged-in user can write and publish a blog with no pre-required steps. Company association is always optional.

**Editor fields:**

- Title (required, max 150 chars, character counter shown)
- Body (Markdown editor with live preview toggle, toolbar: Bold, Italic, Headings, Code block, Image insert, Link)
- Article Type (required) — full list: `Engineering Blog` · `Architecture Deep Dive` · `Case Study` · `Scaling Story` · `Failure / Postmortem` · `AI Experiment` · `Founder Note` · `Tutorial` · `Opinion / Essay` · `Project Showcase` · `Open Source Release` · `Other`
- Company (optional — only shown if user is member of ≥ 1 company. Defaults to "No company – publish as myself")
- Tags (optional, max 5, searchable multi-select, new tags can be created inline)
- Cover Image (optional, drag-and-drop or click to upload, recommended 1200×630px)
- Summary / Excerpt (optional, max 300 chars)
- SEO Settings panel (collapsed by default): custom meta title (max 60 chars), meta description (max 160 chars)

**Key behaviours:**

- Auto-save every 30 seconds. Subtle "Saved just now" status indicator.
- Browser "Leave page?" warning if tab closed with unsaved content.
- Auto-save failure → banner: "Auto-save failed. Click here to save manually."
- No cover image → system auto-generates OG image (branded gradient + title text + Lorestack logo + author name).
- Publish confirmation modal shows: preview card + URL preview + SEO snippet preview.
- On publish: blog live at `/blog/[slug]`, sitemap updated, tag pages updated, company blog count incremented if company selected.

**Edge cases:**

- Title empty → inline error: "Please add a title before publishing."
- Content < 50 words → warning modal with "Publish Anyway" and "Keep Writing" options.
- Cover image upload fails → "Cover image failed to upload. Default OG image will be used. Continue?" with Yes / Retry.

---

#### 3.2 Edit Published Blog

Authors edit their own published blogs at any time. Company Owners can edit any blog under their company. Changes go live immediately.

**Key behaviours:**

- "Edit" button visible only to: the blog's author OR the Company Owner of the associated company.
- Company Author cannot edit another author's blog within the same company.
- On save → changes live immediately → "Updated on [date]" timestamp shown below publish date.
- Company Owner editing another author's blog → dashboard shows "Last edited by [Owner name]" in edit history.

**Edge cases:**

- Slug/URL change → warning: "Changing the URL will break existing shares. The old URL will redirect automatically. Continue?" → on confirm: `SlugChangedEvent` fires → `slug_redirects` row inserted.

---

#### 3.3 Archive Blog

Authors archive their published blogs to immediately hide them from all public pages.

**Key behaviours:**

- Accessed via `···` menu on blog card in the dashboard.
- Confirmation modal shown before archiving.
- On archive: removed from all public pages, tag pages, company pages, and sitemap. Status set to `archived` in DB. Blog row never deleted.
- Archived blog stays in author dashboard with "Archived" badge and "Unarchive" option.

**Edge cases:**

- Company Owner archiving an Author's blog → Author receives in-app notification: "Your blog [Title] was archived by the company owner."

**Unarchive flow:**

- Author clicks "Unarchive" → confirmation → blog restored to `published` state → re-added to all public pages and sitemap.

---

#### 3.4 Draft Management

Auto-saved and manually saved drafts are accessible from Dashboard → Drafts.

**Draft list shows:** Title (or "Untitled Draft" if no title added), last saved time, word count, company association (if any), article type (if selected).

**Key behaviours:**

- Click draft → editor opens with existing content loaded.
- Delete draft: `···` menu → "Delete Draft" → confirmation modal → permanent removal.
- 20+ drafts → infinite scroll or pagination with search/filter by title.
- Network disconnect during writing → auto-save retries every 10 seconds. Content preserved in browser `localStorage` as backup.

**Edge cases:**

- Publish attempt on a draft with no title → inline error: "Add a title before publishing." Publish button remains disabled.

---

#### 3.5 Schedule Blog Publishing

Authors schedule a blog to auto-publish at a specific future date, time, and timezone.

**Key behaviours:**

- "Schedule" option in publish dropdown (alongside "Publish" and "Save as Draft").
- Schedule modal: date picker (past dates greyed out/blocked), time picker (hour + minute), timezone selector (auto-detected from browser locale, editable).
- Scheduled blog appears in Dashboard → Scheduled with exact datetime and countdown ("Publishes in 2 days, 4 hours").
- Author can edit blog content or reschedule at any time before it publishes.
- Author can cancel schedule → blog reverts to Draft.
- At scheduled time: system auto-publishes. Sitemap and tag pages updated.
- Author receives in-app notification + email (if email notifications enabled): "Your blog [Title] is now live!"

**Edge cases:**

- Today's date selected but time already in the past → error: "Selected time is in the past. Please choose a future time."
- Schedule > 6 months ahead → soft warning: "Scheduling far in the future. Confirm?" with OK / Change Date.
- Publish failure at scheduled time → blog status set to `PUBLISH_FAILED` → author notified via in-app notification + email → manual publish option highlighted in dashboard.

---

#### 3.6 Public Blog Reading View — `/blog/[slug]`

Every published blog has a clean, public reading page accessible without login.

**Page content:**

- Full-width cover image (if uploaded).
- Article type badge, title (H1), author avatar + display name (→ `/author/[username]`), company logo + name if associated (→ `/company/[handle]`), publish date, estimated read time.
- Blog body rendered from Markdown: proper heading hierarchy, syntax-highlighted code blocks with copy button, inline images, blockquotes, links.
- Tags shown below content — each tag is a clickable link to `/tag/[slug]`.
- Author bio card at bottom of article: avatar, name, short bio, expertise tags, social links.
- Company card below author card (if blog is under a company): logo, name, tagline.
- Share buttons: Twitter/X, LinkedIn, Copy Link.

**Edge cases:**

- Blog archived after someone had the link → 404: "This article is no longer available." + "Back to Homepage."
- Slug not found (typo/broken link) → custom 404 with suggested articles.

**SEO:** OG meta tags, Twitter Card tags (`summary_large_image`), Article JSON-LD structured data with author + publisher schemas.

---

### 4. Company Management

#### 4.1 Create Company Profile

Any logged-in user can create a company in a single form (no multi-step wizard). Creator automatically becomes Company Owner.

**Form fields (single page):**

- Company Name (required, max 100 chars)
- Handle / URL Slug (required, auto-suggested from name in lowercase-hyphenated format, editable, max 50 chars)
- Tagline (required, max 160 chars)
- Website URL (optional)
- Company Logo (optional, PNG/JPG/SVG, max 2MB — initials avatar used if skipped)
- Industry (optional dropdown): AI, SaaS, Dev Tools, Fintech, HealthTech, EdTech, Consumer, Other
- Tech Stack (optional, multi-select searchable tags)
- Founder Social Link (optional — Twitter/X or LinkedIn URL)

**On creation:**

- `CompanyMembership(OWNER)` row auto-created for the creator.
- Company page live at `/company/[handle]`.
- `CompanyCreatedEvent` fired → SEO metadata generated + sitemap entry added.

**Edge cases:**

- Handle already taken → inline error with suggested alternative.
- Handle auto-corrected to lowercase-hyphenated as user types (no error needed).
- Logo > 2MB → "Logo must be under 2MB."

---

#### 4.2 Edit Company Profile

Company Owner updates any field of the company profile at any time. Changes reflected immediately on the public page.

**Key behaviours:**

- Same fields as creation form, all pre-filled.
- Handle change → warning modal: "Changing your company handle will update your public URL. The old URL will redirect automatically. Are you sure?" → on confirm: `SlugChangedEvent` fired → `slug_redirects` row inserted.
- Logo upload failure → error toast. Previous logo retained.

**Edge cases:**

- New handle conflicts with another company → inline error.

---

#### 4.3 Invite Author to Company

Company Owner sends an email invite to add a user as an Author under the company. Role is always "Author" (Owner is non-transferable in MVP).

**Invite form:** Email address field only.

**Flow — invitee not registered:**

- Clicking email link → registration page with company invite context shown as a banner.
- After registration + email verification → user auto-added as `Company Author`.
- User lands on dashboard with company shown in their "My Companies" list.

**Flow — invitee already registered:**

- Clicking link → confirmation page: "You've been invited to join [Company] as an Author. Accept?"
- Invitee clicks "Accept" → `CompanyMembership(AUTHOR)` row created.
- Both invitee and Company Owner receive in-app notifications.

**Edge cases:**

- Email already a team member → "This person is already on your team."
- Pending invite already exists for that email → "An invite is already pending for this email."
- Owner invites own email → "You cannot invite yourself."
- Invite link expired (> 7 days) → "This invite has expired. Ask the company owner to resend it."
- Invitee declines → Company Owner not notified. Invite removed from pending list.

---

#### 4.4 Remove Author from Company

Company Owner removes a team member. Removal is immediate. Existing published blogs remain visible and attributed to the author.

**Key behaviours:**

- Team list shows: name, email, join date, blog count under this company.
- Confirmation modal warns that existing blogs will remain visible.
- On remove: `CompanyMembership` row deleted. Author loses write access to this company.
- Removed author receives in-app notification: "You have been removed from [Company Name] by the company owner."

**Edge cases:**

- Author has scheduled blogs → NOT auto-cancelled. Owner must manually review and manage them.

---

#### 4.5 Public Company Page — `/company/[handle]`

Every company has a public profile page accessible without login.

**Page content (3 tabs):**

**Blogs tab (default):**

- All published (non-archived) blogs under this company, newest first.
- Each blog card: cover image, article type badge, title, author avatar + name, publish date, read time, tag chips.
- No published blogs → "No blogs published yet."

**Team tab:**

- Owner listed first with "Owner" badge, followed by Authors.
- Each card: avatar, display name, bio snippet, blog count under this company. Click → `/author/[username]`.

**Timeline tab:**

- Build-in-Public milestone entries (see section 9).

**Edge cases:**

- Handle not found → 404: "Company not found." with "Back to Homepage."

**SEO:** OG tags auto-generated. Organization JSON-LD schema + BreadcrumbList schema. Page added to `sitemap.xml`.

---

### 5. RBAC & Permissions

#### 5.1 Role-Based Access Control — Full Permissions Matrix

See the [Roles & Permissions section](#roles--permissions-rbac) above for the full matrix and role acquisition rules.

**Implementation note:** `PermissionChecker` is a pure class with zero dependencies (no I/O, no DB calls). All RBAC rules live here exclusively. Every service method calls `permissionChecker.can*()` before any mutation. This class is fully unit-testable without mocking.

---

### 6. Tags & Topics

#### 6.1 Tag System — Create, Attach & Manage Tags

Tags are platform-wide keywords attached to blogs for discovery and filtering.

**Key behaviours:**

- Tags field in the blog editor: searchable multi-select dropdown showing existing approved tags.
- Select existing tag → added as chip. Maximum 5 tags per blog.
- Type a tag name not in the system → option shown: `+ Create "[tagname]"`. New tag created with `is_approved=false`.
- `is_approved=false` tags: functional immediately (blog can publish with them) but hidden from the tag suggestion dropdown.
- Smart duplicate suggestion: typing "js" when "javascript" exists → "Did you mean: javascript?"

**Edge cases:**

- 6th tag attempt → input blocked: "Maximum 5 tags per blog."
- Tag name > 50 chars → inline error.
- Selecting a NEW (unapproved) tag → tooltip: "New tags are reviewed by our team. Your blog will still publish with this tag."

---

#### 6.2 Auto-Generated Tag Pages — `/tag/[slug]`

Every tag used in any published blog automatically gets a public topic page.

**Page content:**

- Tag name as H1, description (admin-editable, or auto-placeholder if not set), total blog count.
- Companies using this tag: logo strip with links to company pages.
- All published blogs with this tag listed newest first.
- Related tags sidebar: tags most frequently co-occurring with this tag.

**Key behaviours:**

- Page auto-created when first blog using the tag publishes.
- Page added to `sitemap.xml` automatically.
- `blog_count` on the `tags` table is updated ONLY through event handlers — never via direct SQL.

**Edge cases:**

- Tag with only 1 blog → page still created. Shows "1 article."
- Tag page for a subsequently deleted tag → 301-redirects to `/explore` with "Tag not found" notice.

**SEO:** Meta title: `Best [Tag] Articles – Lorestack`. OG image auto-generated.

---

### 7. Public Discovery

#### 7.1 Public Homepage — `/`

Content-first homepage. Different experience for logged-out vs logged-in users.

**For logged-out visitors:**

- Hero section: platform tagline + two CTAs: "Explore Articles" (smooth-scrolls to content), "Start Writing – it's free" (→ Sign Up page).

**For logged-in users:**

- Personalized greeting + quick-action strip: "+ Write Blog", "View Drafts", "My Dashboard".

**Content sections (both audiences):**

1. **Featured Companies** — admin-curated, max 6 slots. Company card: logo, name, tagline, blog count. Click → company page.
2. **Trending This Week** — 6 blog cards sorted by view velocity. Each card: cover image, type badge, title, author + company, read time, publish date.
3. **Browse by Type** — horizontal scrollable row of article type filter pills. Clicking a pill filters the content below. URL updates: `/?type=case-study`.
4. **Trending Tags** — top 10 platform-wide tags this week as clickable pills → `/tag/[slug]`.
5. **Recent Deep Dives** — Architecture Deep Dives and Case Studies highlighted in a larger card layout.

**Edge cases:**

- Platform has fewer than 10 published blogs (fresh launch) → internal/seeded articles shown. No empty sections visible to public.
- Slow network → skeleton loaders shown for all content sections while data loads.

---

#### 7.2 Explore – Browse All Blogs — `/explore`

Filterable, sortable listing of all published blogs on the platform. Accessible to anyone without login.

**Default view:** All published blogs, newest first, infinite scroll or pagination.

**Filters:**

- Article Type (multi-select checkboxes)
- Tags (searchable multi-select)
- Company (searchable dropdown)
- Date Range: Last week / Last month / Last 6 months / All time

**Sort options:** Newest | Oldest

**Active filters** shown as dismissible chips below the filter bar. "Clear all filters" link shown when any filter is active.

**Each blog card:** cover image, type badge, title, author avatar + name, company name if any, publish date, read time, tag chips.

**Edge cases:**

- No results for applied filters → "No articles match your filters. Try adjusting them." + "Clear Filters" button.
- URL updates with active filters for shareability: `/explore?type=tutorial&tag=react`.

---

### 8. SEO & Auto-Generated Pages

#### 8.1 Blog Page SEO — Auto Meta Tags & OG Images

Every published blog gets full SEO metadata automatically. No manual work required to publish with good SEO.

**Auto-generated on publish (if not overridden by author):**

- Meta title: blog title, truncated to 60 chars if needed. Uses `seo_title_override` if author set one.
- Meta description: first 160 chars of summary or body. Uses `seo_desc_override` if author set one.
- OG image: auto-generated branded image (blog title + Lorestack logo + author name on gradient background) if no cover image uploaded.
- Twitter Card meta tags (`twitter:card = summary_large_image`).
- Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type = article`.
- Article JSON-LD structured data: headline, author (Person schema), publisher (Organization schema), `datePublished`, `dateModified`.
- Canonical URL: `/blog/[slug]`.
- Blog URL added to `sitemap.xml` on publish. Removed on archive.

**Edge cases:**

- Author's custom SEO title > 60 chars → warning in editor: "Your SEO title may be truncated in search results."
- Custom meta description > 160 chars → warning: "Meta description may be truncated by search engines."

---

#### 8.2 Company & Author Page SEO

Company pages and author profile pages get SEO metadata and sitemap entries auto-generated on creation.

**Company page SEO (triggered by `CompanyCreatedEvent`):**

- Meta title: `[Company Name] – Engineering Stories on Lorestack`
- Meta description: company tagline + blog count
- OG image: composite of company logo + cover image with company name text
- JSON-LD: Organization schema (name, url, logo, sameAs social links) + BreadcrumbList
- `/company/[handle]` added to `sitemap.xml`

**Author page SEO (triggered by `AuthorProfileCreatedEvent`):**

- Meta title: `[Display Name] – Articles on Lorestack`
- Meta description: author bio snippet
- JSON-LD: Person schema (name, url, sameAs social links)
- `/author/[username]` added to `sitemap.xml`

**Edge cases:**

- Company handle change → old URL 301-redirects to new URL. `sitemap.xml` updated.
- Author username change → old URL 301-redirects to new URL. `sitemap.xml` updated.
- Both changes handled via `SlugChangedEvent` → `SlugChangedEventHandler` → `slug_redirects` row inserted + sitemap updated.

---

### 9. Build-In-Public Timeline

#### 9.1 Add Milestone to Company Timeline

Company Owner logs milestones, launches, and achievements to a public chronological timeline. Company Author cannot add milestones.

**Milestone form fields:**

- Date (date picker, defaults to today — future dates allowed with soft warning, no hard block)
- Milestone Type (required): `Launch` · `User Milestone` · `Infra Update` · `Funding` · `Feature Release` · `Bug Fixed` · `Partnership` · `Hiring` · `Experiment` · `Other`
- Headline (required, max 100 chars)
- Description (optional, max 500 chars, basic Markdown formatting supported)
- Impact Metric (optional, max 80 chars — e.g. "Reduced p99 latency 40%". Displayed as a highlighted chip.)

**Access:** Company Dashboard → Timeline → "+ Add Milestone". Appears as an inline form or quick modal — no new page navigation.

**Key behaviours:**

- On success: milestone immediately visible on public company page Timeline tab. Toast: "Milestone added."

**Edge cases:**

- Headline blank → inline error: "Headline is required."
- Future date selected → soft warning below date field. Milestone still saves.
- Description > 500 chars → character counter turns red, save blocked with inline error.

---

#### 9.2 View Company Timeline — Public

Visitors view the company's Build-in-Public journey on the Timeline tab of the company page. Accessible without login.

**Display:**

- Reverse chronological order (newest at top).
- Milestones grouped by month/year headers: "May 2026", "April 2026", etc.
- Each entry: milestone type icon (color-coded per type), date badge, headline in bold, optional description, optional impact metric as a highlighted chip.
- Each milestone has a direct, shareable anchor URL: `/company/[handle]#timeline-[id]`.
- "Share Timeline" button: copies a shareable link with OG preview.

**Edge cases:**

- No milestones added yet → "This company hasn't shared their journey yet."

**SEO:** Timeline entries are crawlable. They contribute to company page SEO via structured content.

---

## Database Schema

Full schema in DBML format for use with dbdiagram.io:

```
./docs/lorestack_schema.dbml
```

### Tables Summary

| Table                 | Type                    | Purpose                                                                  |
| --------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `users`               | Entity                  | Identity only. Mirrors Supabase `auth.users`.                            |
| `author_profiles`     | Entity (1:1 with users) | Public display data. Created at onboarding.                              |
| `companies`           | Aggregate Root          | Company profile. Governs memberships, invites, milestones.               |
| `company_memberships` | Join / RBAC             | Per-company role per user. `PermissionChecker` source of truth.          |
| `company_invites`     | Entity                  | Invite lifecycle. 7-day expiry. Creates membership on accept.            |
| `blogs`               | Aggregate Root          | Full blog state. `company_id` nullable for independent authors.          |
| `blog_tags`           | Join table              | Composite PK. Max 5 rows per blog (service-enforced, not DB).            |
| `tags`                | Entity                  | Platform-wide topics. `blog_count` denormalized via event handlers only. |
| `company_milestones`  | Entity                  | Build-in-Public timeline entries. Owner-only write access.               |
| `seo_metadata`        | Value Object            | Cached SEO output per entity. Polymorphic via `entity_type`.             |
| `slug_redirects`      | Entity                  | 301 redirect mappings when slugs/handles change. Append-only.            |

---

## Architecture Reference

### Layers

```
API Controllers             thin — validate, delegate, respond
        ↓ depends on abstractions only
Service Interfaces          DIP boundary — business layer never imports Supabase
        ↓ implemented by
Application Services        orchestrate domain logic + fire domain events
+ Event Handlers            react to events — all side effects decoupled here
        ↓ depends on abstractions only
Repository Interfaces       11 interfaces — services never touch Supabase directly
        ↓ implemented by
Infrastructure              Adapters + Repository Impls — only layer that imports Supabase
        ↓ operates on
Domain Entities             User, Company, Blog, Tag — pure state, no framework deps
Domain Events               BlogPublishedEvent, SlugChangedEvent, etc.
Enums                       BlogStatus, ArticleType, CompanyRole, etc.
```

### Design Patterns Used

| Pattern         | Applied To                                                            | Purpose                                                                                     |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Repository      | All 11 entity tables                                                  | Decouple data access from business logic                                                    |
| Adapter         | `SupabaseAuthAdapter`, `SupabaseStorageAdapter`, `ResendEmailAdapter` | Business layer is provider-agnostic. Swap by replacing the adapter only.                    |
| Observer        | `IEventBus` + 6 event handlers                                        | Sitemap, SEO generation, tag counts never leak into core service logic                      |
| Policy          | `PermissionChecker`                                                   | All RBAC rules in one pure, testable class                                                  |
| Template Method | `ISEOService`                                                         | All `generateFor*()` methods share one pipeline; entity-specific steps override             |
| Strategy        | `ISlugService`                                                        | Entity-specific slug generation rules unified behind one interface                          |
| Factory         | `BlogFactory`                                                         | Centralises Blog construction defaults — no scattered `new Blog(...)` with varying defaults |

---

## Key Design Decisions

| Decision                                            | Reason                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `users` and `author_profiles` are separate tables   | SRP — identity ≠ display profile. Onboarding creates the profile separately after verification.                                     |
| `blogs.company_id` is nullable                      | Spec: company is optional. Independent authors are first-class citizens, not an edge case.                                          |
| `PermissionChecker` has zero I/O dependencies       | Fully unit-testable without any mocks. Single source of truth for all 4-role RBAC rules. No inline permission checks anywhere else. |
| `IAuthService` implemented by `SupabaseAuthAdapter` | Business logic never imports Supabase SDK. The entire auth provider is swappable by replacing one class.                            |
| `IEventBus` with dedicated event handlers           | `BlogService.publish()` never directly calls sitemap updates, tag count increments, or SEO generation. All decoupled via events.    |
| `BlogFactory`                                       | Prevents scattered `new Blog(...)` with inconsistent defaults across the codebase.                                                  |
| `slug_redirects` persisted to DB                    | Spec requires 301 redirects when slugs/handles change. Must survive server restarts.                                                |
| `seo_metadata` is a separate table                  | SRP — domain entities stay lean. SEO has its own lifecycle (event-triggered regeneration).                                          |
| `DiscoveryController` uses repos directly           | MVP read-only trade-off. Pure queries, zero business logic. **Fix in Complete Product: `DiscoveryService`.**                        |

---

## Architecture Notes & Known Trade-offs

These are documented trade-offs — not bugs. Each has a recommended fix for the Complete Product phase.

### ⚠ DiscoveryController accesses repositories directly

- **Problem:** `DiscoveryController` (homepage + explore page) uses `IBlogRepository`, `ICompanyRepository`, `ITagRepository` directly, bypassing the service layer.
- **Why acceptable in MVP:** Pure read-only queries with no business logic or state mutations.
- **Fix in Complete Product:** Introduce `DiscoveryService` with query composition, caching layer, and eventually personalization logic.

### ⚠ `tags.blog_count` is denormalized

- **Problem:** `blog_count` is a cached count column. If anything other than the designated event handlers writes to it, counts drift.
- **Hard rule:** This column MUST only be modified via `BlogPublishedEventHandler.incrementBlogCount()` and `BlogArchivedEventHandler.decrementBlogCount()`. Never with direct SQL updates.
- **Fix in Complete Product:** Add a periodic reconciliation job that recalculates counts from `blog_tags` and corrects any drift.

### ⚠ `InMemoryEventBus` is synchronous

- **Problem:** The MVP event bus executes all handlers synchronously in-process. A handler failure can fail the originating request.
- **Mitigation:** Each handler call is wrapped in try-catch. Failures are logged but not propagated to the caller.
- **Fix in Complete Product:** Replace with BullMQ (Redis-backed) or Supabase `pg_notify` for async, durable event processing.

### ⚠ `SitemapService` maintains in-memory state

- **Problem:** If the server restarts, the in-memory sitemap state is lost. The next incremental update will operate on a stale or empty base.
- **Mitigation:** `SitemapService.rebuild()` is called on server boot — reads all public entity slugs from the DB and reconstructs the sitemap from scratch.
- **Fix in Complete Product:** Always read `sitemap.xml` from Supabase Storage before each write. Eliminate in-memory state entirely.

---

## Complete Product Features (Phase 2)

These features are **out of scope for MVP**. Do not implement or reference them until Phase 1 is shipped and validated.

| Domain                 | Features                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-Assisted Publishing | Summary Generator · SEO Metadata Generator · Tag Suggester · Title Improver · Rough Notes → Structured Article                                                                                                      |
| Content Scheduling     | Visual Content Calendar (company view) · Recurring Content Schedules with placeholder drafts                                                                                                                        |
| Content Approval       | Submit for Review · Review Queue (Approve / Request Changes / Reject) · 72-hour reviewer reminder                                                                                                                   |
| Analytics              | Blog-level analytics · Author dashboard analytics · Company dashboard analytics · Platform Admin analytics                                                                                                          |
| Notifications          | In-app notification centre · Email notification preferences with per-event toggles                                                                                                                                  |
| Social & Community     | Follow companies / authors / tags · Personalised `/feed` page · Bookmarks / reading list · Report content                                                                                                           |
| Search                 | Global real-time search (`/search`) · Auto-suggest dropdown · Recent searches                                                                                                                                       |
| Admin Panel            | Content moderation queue · Homepage curation · Tag management (approve / merge / deprecate) · User management · Company claim review                                                                                |
| Platform UX            | Dark / light mode toggle · Reading progress bar · Auto Table of Contents · RSS feeds (platform / company / author / tag level) · Auto tag cross-linking in blog body · Related blogs and related companies sections |

---

_This README is the canonical feature scope reference for Lorestack MVP. When in doubt about what is or is not in scope for Phase 1, refer to this file and the Feature Specification Excel._
