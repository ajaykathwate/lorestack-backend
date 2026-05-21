/**
 * Lorestack seed — run with:  pnpm prisma:seed
 *
 * Creates:
 *   • 1 platform admin  (admin@lorestack.com)
 *   • 6 authors         (2 per company except FinLedger which has 1)
 *   • 4 companies       (StackPilot · NeuralFlow · FinLedger · EduPath)
 *   • 15 tags
 *   • 22 blogs          (mix of published / draft)
 *   • company milestones
 *
 * All passwords:  Password@Seed1
 * Fully idempotent — safe to run multiple times.
 */

import {
  ArticleType,
  BlogStatus,
  CompanyRole,
  CompanyStage,
  IndustryType,
  MilestoneType,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASSWORD = 'Password@Seed1';
const HASH_ROUNDS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ogImage(slug: string) {
  return 'https://picsum.photos/seed/' + slug + '/1200/630';
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Seeding Lorestack database…\n');

  const hash = await bcrypt.hash(PASSWORD, HASH_ROUNDS);

  // ── 1. Tags ──────────────────────────────────────────────────────────────────

  const tagDefs = [
    { name: 'TypeScript', slug: 'typescript', description: 'Typed superset of JavaScript' },
    { name: 'Rust', slug: 'rust', description: 'Systems language focused on safety and performance' },
    { name: 'PostgreSQL', slug: 'postgresql', description: 'Advanced open-source relational database' },
    { name: 'Redis', slug: 'redis', description: 'In-memory data structure store' },
    { name: 'AI', slug: 'ai', description: 'Artificial intelligence and machine learning' },
    { name: 'Machine Learning', slug: 'machine-learning', description: 'Statistical learning algorithms' },
    { name: 'Next.js', slug: 'nextjs', description: 'React framework for production' },
    { name: 'Dev Tools', slug: 'devtools', description: 'Developer productivity tooling' },
    { name: 'Fintech', slug: 'fintech', description: 'Financial technology' },
    { name: 'Open Source', slug: 'open-source', description: 'Free and open source software' },
    { name: 'Performance', slug: 'performance', description: 'System and application performance optimisation' },
    { name: 'Distributed Systems', slug: 'distributed-systems', description: 'Design of distributed computing systems' },
    { name: 'React', slug: 'react', description: 'JavaScript UI library' },
    { name: 'Node.js', slug: 'nodejs', description: 'JavaScript runtime for servers' },
    { name: 'Kubernetes', slug: 'kubernetes', description: 'Container orchestration' },
  ];

  const tags: Record<string, string> = {}; // slug → id

  for (const t of tagDefs) {
    const tag = await prisma.tag.upsert({
      where: { slug: t.slug },
      update: {},
      create: { name: t.name, slug: t.slug, description: t.description, isApproved: true },
    });
    tags[t.slug] = tag.id;
  }
  console.log('✅  Tags');

  // ── 2. Platform admin ─────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: 'admin@lorestack.com' },
    update: {},
    create: {
      email: 'admin@lorestack.com',
      password: hash,
      isEmailVerified: true,
      isActive: true,
      platformRole: PlatformRole.platform_admin,
    },
  });

  await prisma.authorProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      displayName: 'Lorestack Team',
      username: 'lorestack',
      bio: 'The team behind Lorestack — building the home for engineering stories.',
    },
  });
  console.log('✅  Platform admin');

  // ── 3. Authors ────────────────────────────────────────────────────────────────

  const ajay = await prisma.user.upsert({
    where: { email: 'ajay@stackpilot.dev' },
    update: {},
    create: { email: 'ajay@stackpilot.dev', password: hash, isEmailVerified: true, isActive: true },
  });
  await prisma.authorProfile.upsert({
    where: { userId: ajay.id },
    update: {},
    create: {
      userId: ajay.id,
      displayName: 'Ajay Mathur',
      username: 'ajay-mathur',
      bio: 'Founder of StackPilot. Building dev tools that developers actually love.',
      githubHandle: 'ajay-mathur',
      twitterHandle: '@ajaymathur',
      expertiseTags: ['devtools', 'rust', 'typescript'],
    },
  });

  const priya = await prisma.user.upsert({
    where: { email: 'priya@neuralflow.ai' },
    update: {},
    create: { email: 'priya@neuralflow.ai', password: hash, isEmailVerified: true, isActive: true },
  });
  await prisma.authorProfile.upsert({
    where: { userId: priya.id },
    update: {},
    create: {
      userId: priya.id,
      displayName: 'Priya Sharma',
      username: 'priya-sharma',
      bio: 'CEO at NeuralFlow. Ex-ML researcher. Passionate about making AI accessible.',
      twitterHandle: '@priyasharma_ai',
      linkedinUrl: 'https://linkedin.com/in/priyasharmaai',
      expertiseTags: ['ai', 'machine-learning'],
    },
  });

  const marcus = await prisma.user.upsert({
    where: { email: 'marcus@finledger.io' },
    update: {},
    create: { email: 'marcus@finledger.io', password: hash, isEmailVerified: true, isActive: true },
  });
  await prisma.authorProfile.upsert({
    where: { userId: marcus.id },
    update: {},
    create: {
      userId: marcus.id,
      displayName: 'Marcus Webb',
      username: 'marcus-webb',
      bio: 'Founder of FinLedger. Ex-Stripe engineer obsessed with payment infrastructure.',
      githubHandle: 'marcuswebb',
      expertiseTags: ['fintech', 'postgresql', 'distributed-systems'],
    },
  });

  const aisha = await prisma.user.upsert({
    where: { email: 'aisha@edupath.co' },
    update: {},
    create: { email: 'aisha@edupath.co', password: hash, isEmailVerified: true, isActive: true },
  });
  await prisma.authorProfile.upsert({
    where: { userId: aisha.id },
    update: {},
    create: {
      userId: aisha.id,
      displayName: 'Aisha Okonkwo',
      username: 'aisha-okonkwo',
      bio: 'Founder of EduPath. Building the future of online education with AI-driven personalisation.',
      twitterHandle: '@aishaokonkwo',
      websiteUrl: 'https://aishaokonkwo.com',
      expertiseTags: ['ai', 'react', 'typescript'],
    },
  });

  const chen = await prisma.user.upsert({
    where: { email: 'chen@stackpilot.dev' },
    update: {},
    create: { email: 'chen@stackpilot.dev', password: hash, isEmailVerified: true, isActive: true },
  });
  await prisma.authorProfile.upsert({
    where: { userId: chen.id },
    update: {},
    create: {
      userId: chen.id,
      displayName: 'Chen Li',
      username: 'chen-li',
      bio: 'Senior engineer at StackPilot. Writes about Rust, performance, and distributed systems.',
      githubHandle: 'chenli',
      expertiseTags: ['rust', 'performance', 'distributed-systems'],
    },
  });

  const riya = await prisma.user.upsert({
    where: { email: 'riya@neuralflow.ai' },
    update: {},
    create: { email: 'riya@neuralflow.ai', password: hash, isEmailVerified: true, isActive: true },
  });
  await prisma.authorProfile.upsert({
    where: { userId: riya.id },
    update: {},
    create: {
      userId: riya.id,
      displayName: 'Riya Desai',
      username: 'riya-desai',
      bio: 'ML engineer at NeuralFlow. Specialises in fine-tuning LLMs and inference optimisation.',
      githubHandle: 'riyadesai',
      expertiseTags: ['machine-learning', 'ai'],
    },
  });
  console.log('✅  Authors');

  // ── 4. Companies ──────────────────────────────────────────────────────────────

  const stackPilot = await prisma.company.upsert({
    where: { handle: 'stackpilot' },
    update: {},
    create: {
      handle: 'stackpilot',
      name: 'StackPilot',
      tagline: 'AI-powered code review and developer workflow automation',
      websiteUrl: 'https://stackpilot.dev',
      industry: IndustryType.dev_tools,
      stage: CompanyStage.early_stage,
      techStack: ['Rust', 'TypeScript', 'PostgreSQL', 'Redis'],
      founderSocialLink: 'https://twitter.com/ajaymathur',
      isPublic: true,
      createdByUserId: ajay.id,
    },
  });

  await prisma.companyMembership.upsert({
    where: { uq_company_memberships_company_user: { companyId: stackPilot.id, userId: ajay.id } },
    update: {},
    create: { companyId: stackPilot.id, userId: ajay.id, role: CompanyRole.owner },
  });
  await prisma.companyMembership.upsert({
    where: { uq_company_memberships_company_user: { companyId: stackPilot.id, userId: chen.id } },
    update: {},
    create: { companyId: stackPilot.id, userId: chen.id, role: CompanyRole.author },
  });

  const neuralFlow = await prisma.company.upsert({
    where: { handle: 'neuralflow' },
    update: {},
    create: {
      handle: 'neuralflow',
      name: 'NeuralFlow',
      tagline: 'Production-grade LLM infrastructure for teams that move fast',
      websiteUrl: 'https://neuralflow.ai',
      industry: IndustryType.ai,
      stage: CompanyStage.growth,
      techStack: ['Python', 'TypeScript', 'PostgreSQL', 'Kubernetes'],
      founderSocialLink: 'https://twitter.com/priyasharma_ai',
      isPublic: true,
      createdByUserId: priya.id,
    },
  });

  await prisma.companyMembership.upsert({
    where: { uq_company_memberships_company_user: { companyId: neuralFlow.id, userId: priya.id } },
    update: {},
    create: { companyId: neuralFlow.id, userId: priya.id, role: CompanyRole.owner },
  });
  await prisma.companyMembership.upsert({
    where: { uq_company_memberships_company_user: { companyId: neuralFlow.id, userId: riya.id } },
    update: {},
    create: { companyId: neuralFlow.id, userId: riya.id, role: CompanyRole.author },
  });

  const finLedger = await prisma.company.upsert({
    where: { handle: 'finledger' },
    update: {},
    create: {
      handle: 'finledger',
      name: 'FinLedger',
      tagline: 'Real-time payment infrastructure for modern fintech builders',
      websiteUrl: 'https://finledger.io',
      industry: IndustryType.fintech,
      stage: CompanyStage.mvp_stage,
      techStack: ['TypeScript', 'PostgreSQL', 'Redis', 'Kubernetes'],
      founderSocialLink: 'https://linkedin.com/in/marcuswebb',
      isPublic: true,
      createdByUserId: marcus.id,
    },
  });

  await prisma.companyMembership.upsert({
    where: { uq_company_memberships_company_user: { companyId: finLedger.id, userId: marcus.id } },
    update: {},
    create: { companyId: finLedger.id, userId: marcus.id, role: CompanyRole.owner },
  });

  const eduPath = await prisma.company.upsert({
    where: { handle: 'edupath' },
    update: {},
    create: {
      handle: 'edupath',
      name: 'EduPath',
      tagline: 'Personalised learning that adapts to every student in real time',
      websiteUrl: 'https://edupath.co',
      industry: IndustryType.ed_tech,
      stage: CompanyStage.early_stage,
      techStack: ['Next.js', 'TypeScript', 'PostgreSQL', 'Redis'],
      founderSocialLink: 'https://twitter.com/aishaokonkwo',
      isPublic: true,
      createdByUserId: aisha.id,
    },
  });

  await prisma.companyMembership.upsert({
    where: { uq_company_memberships_company_user: { companyId: eduPath.id, userId: aisha.id } },
    update: {},
    create: { companyId: eduPath.id, userId: aisha.id, role: CompanyRole.owner },
  });
  console.log('✅  Companies + memberships');

  // ── 5. Milestones ─────────────────────────────────────────────────────────────

  if ((await prisma.companyMilestone.count({ where: { companyId: stackPilot.id } })) === 0) {
    await prisma.companyMilestone.createMany({
      data: [
        {
          companyId: stackPilot.id,
          createdByUserId: ajay.id,
          type: MilestoneType.launch,
          headline: 'Launched private beta to 200 developers',
          description:
            'After 8 months building in stealth we opened the doors to our first 200 beta users. Feedback was overwhelmingly positive.',
          impactMetric: '200 beta users',
          milestoneDate: new Date('2025-03-15'),
        },
        {
          companyId: stackPilot.id,
          createdByUserId: ajay.id,
          type: MilestoneType.user_milestone,
          headline: '1,000 developers on the waitlist',
          impactMetric: '1,000 waitlist signups',
          milestoneDate: new Date('2025-06-01'),
        },
        {
          companyId: stackPilot.id,
          createdByUserId: ajay.id,
          type: MilestoneType.feature_release,
          headline: 'Open-sourced stackpilot-cli — 500 GitHub stars in a week',
          description: 'Our CLI is now open source. The community response exceeded every expectation.',
          impactMetric: '500 GitHub stars',
          milestoneDate: new Date('2025-09-20'),
        },
      ],
    });
  }

  if ((await prisma.companyMilestone.count({ where: { companyId: neuralFlow.id } })) === 0) {
    await prisma.companyMilestone.createMany({
      data: [
        {
          companyId: neuralFlow.id,
          createdByUserId: priya.id,
          type: MilestoneType.funding,
          headline: 'Raised $3.2M seed round led by Index Ventures',
          description: 'Participation from several angels. Runway extended to 24 months.',
          impactMetric: '$3.2M raised',
          milestoneDate: new Date('2025-01-10'),
        },
        {
          companyId: neuralFlow.id,
          createdByUserId: priya.id,
          type: MilestoneType.user_milestone,
          headline: 'Serving 1M inference requests per day',
          impactMetric: '1M req/day',
          milestoneDate: new Date('2025-08-01'),
        },
        {
          companyId: neuralFlow.id,
          createdByUserId: priya.id,
          type: MilestoneType.hiring,
          headline: 'Hired first 5 full-time engineers',
          description: 'Grew from 2 founders to a team of 7.',
          milestoneDate: new Date('2025-04-15'),
        },
      ],
    });
  }

  if ((await prisma.companyMilestone.count({ where: { companyId: finLedger.id } })) === 0) {
    await prisma.companyMilestone.createMany({
      data: [
        {
          companyId: finLedger.id,
          createdByUserId: marcus.id,
          type: MilestoneType.launch,
          headline: 'Processed first $1M in payments',
          impactMetric: '$1M processed',
          milestoneDate: new Date('2025-04-22'),
        },
        {
          companyId: finLedger.id,
          createdByUserId: marcus.id,
          type: MilestoneType.feature_release,
          headline: 'Shipped real-time fraud detection — <50ms per transaction',
          description: 'ML-powered fraud detection now runs inline on every payment.',
          impactMetric: '<50ms detection latency',
          milestoneDate: new Date('2025-07-15'),
        },
      ],
    });
  }

  if ((await prisma.companyMilestone.count({ where: { companyId: eduPath.id } })) === 0) {
    await prisma.companyMilestone.createMany({
      data: [
        {
          companyId: eduPath.id,
          createdByUserId: aisha.id,
          type: MilestoneType.launch,
          headline: 'Launched EduPath public beta',
          milestoneDate: new Date('2025-02-01'),
        },
        {
          companyId: eduPath.id,
          createdByUserId: aisha.id,
          type: MilestoneType.user_milestone,
          headline: '50,000 students enrolled after viral growth',
          description: 'A single tweet brought 50K signups in 7 days. Infrastructure survived.',
          impactMetric: '50K students',
          milestoneDate: new Date('2025-08-22'),
        },
      ],
    });
  }
  console.log('✅  Milestones');

  // ── 6. Blogs ──────────────────────────────────────────────────────────────────

  type BlogInput = {
    title: string;
    slug: string;
    summary: string;
    body: string;
    authorId: string;
    companyId: string;
    articleType: ArticleType;
    status: BlogStatus;
    publishedAt?: Date;
    tagSlugs: string[];
  };

  async function blog(b: BlogInput) {
    if (await prisma.blog.findUnique({ where: { slug: b.slug } })) return;
    await prisma.blog.create({
      data: {
        title: b.title,
        slug: b.slug,
        summary: b.summary,
        body: b.body,
        authorId: b.authorId,
        companyId: b.companyId,
        articleType: b.articleType,
        status: b.status,
        publishedAt: b.publishedAt ?? null,
        ogImageUrl: ogImage(b.slug),
        tags: {
          create: b.tagSlugs.map((s) => ({ tagId: tags[s] })),
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // StackPilot  (6 blogs: ajay × 3, chen × 3)
  // ──────────────────────────────────────────────────────────────────────────────

  await blog({
    title: 'How We Built Our AI-Powered Code Review Tool',
    slug: 'how-we-built-ai-powered-code-review',
    summary:
      "A deep dive into StackPilot's core AI review engine — from prompt engineering to the latency constraints that kept us up at night.",
    authorId: ajay.id,
    companyId: stackPilot.id,
    articleType: ArticleType.engineering_blog,
    status: BlogStatus.published,
    publishedAt: new Date('2025-04-10'),
    tagSlugs: ['ai', 'typescript', 'devtools'],
    body: `## The Problem We Set Out to Solve

Every developer knows the pain: you open a pull request and either nobody reviews it for days, or the review is a pile of formatting nitpicks while real architectural issues sail through unnoticed.

We started StackPilot because we believed AI could do better — not replace human reviewers, but act as a tireless first pass that catches the things humans miss when they're in a hurry.

## Architecture Overview

Our review pipeline runs in three stages:

1. **Context extraction** — we parse the diff, the surrounding file context, and relevant commit history to build a rich representation of the change.
2. **Analysis** — a fine-tuned model identifies potential issues across correctness, security, performance, and style dimensions.
3. **Synthesis** — we deduplicate and rank findings, filtering low-confidence results before they reach the developer.

\`\`\`typescript
interface ReviewContext {
  diff: ParsedDiff;
  fileContext: FileSnapshot[];
  commitHistory: CommitSummary[];
  repoMetadata: RepoConfig;
}
\`\`\`

## The Hardest Part: Latency

Developers won't use a tool that makes them wait. Our target was **under 8 seconds** for a typical PR. Achieving that required:

- Parallel context fetching across file chunks
- Aggressive prompt caching for repository-level context that rarely changes
- Streaming responses so the UI feels responsive before the full analysis completes

We're now consistently hitting **4–6 seconds** for PRs under 500 lines.

## What's Next

We're building a learning layer that observes accepted vs. rejected suggestions to personalise the model per codebase. Every "thumbs down" makes the next review smarter.`,
  });

  await blog({
    title: 'From 0 to 10,000 Developers: Our Distribution Story',
    slug: 'from-zero-to-10k-developers-distribution',
    summary:
      "What actually worked when we tried to grow StackPilot — and the expensive lessons we learned along the way.",
    authorId: ajay.id,
    companyId: stackPilot.id,
    articleType: ArticleType.founder_note,
    status: BlogStatus.published,
    publishedAt: new Date('2025-06-20'),
    tagSlugs: ['devtools', 'open-source'],
    body: `## The First 200

We launched the private beta with 200 spots and filled them in 48 hours — mostly from a single post on a developer subreddit. That was encouraging, and also deceiving. Organic spikes feel like traction when they're really just noise.

The next 800 users took three months.

## What Actually Worked

**Deeply technical content.** Posts about real problems that developers care about outperformed every ad campaign we ran. Engineers share good writing. They don't share ads.

**Open-sourcing our CLI.** When we open-sourced \`stackpilot-cli\`, we got 500 GitHub stars in the first week. More importantly, we got 50 pull requests. Contributors became advocates.

**Zero-friction integrations.** Shipping a GitHub Action that works on every PR without a config change was our biggest acquisition lever. Removing setup friction matters enormously for developer tools.

## What Didn't Work

Newsletter sponsorships: expensive, almost no conversion. Developer conference sponsorships: better for brand awareness than signups.

## The Honest Truth

Distribution is a product problem, not a marketing problem. The teams that grow fastest make something so good that users can't help but tell someone. We're still working on that.`,
  });

  await blog({
    title: 'The Outage That Taught Us Everything About Reliability',
    slug: 'outage-that-taught-us-reliability',
    summary:
      "In March 2025, StackPilot went down for 4 hours during peak load. This is the full post-mortem — what happened, why, and what we changed.",
    authorId: ajay.id,
    companyId: stackPilot.id,
    articleType: ArticleType.failure_postmortem,
    status: BlogStatus.published,
    publishedAt: new Date('2025-03-28'),
    tagSlugs: ['distributed-systems', 'postgresql', 'devtools'],
    body: `## Timeline

| Time (UTC) | Event |
|------------|-------|
| 09:14 | v2.3.1 deployment completes. No alerts fire. |
| 09:22 | First customer reports errors. On-call not yet paged. |
| 09:35 | PagerDuty fires. Error rate 94%. |
| 09:41 | Root cause identified: missing index on hot query path. |
| 10:10 | Index created. Error rate drops to 2%. |
| 13:20 | Second wave. Index creation took an exclusive lock in production. |
| 13:35 | Full rollback to v2.3.0. Service restored. |

**Total customer impact: 4 hours 21 minutes.**

## Root Causes

**Primary:** The new \`review_threads\` query was missing an index on \`author_id\`. Under low load this was imperceptible. Under peak load it caused full sequential scans on a 12 million-row table.

**Secondary:** Our index creation script used \`CREATE INDEX\` instead of \`CREATE INDEX CONCURRENTLY\`. In production, the blocking lock cascaded into connection pool exhaustion and a second outage.

## What We Changed

1. **Automated query plan analysis in CI.** Any query that would scan a table over 100k rows without an index fails the pipeline.
2. **Schema migration review checklist** with a mandatory "does this lock?" step.
3. **Canary deployments** with automatic rollback on error-rate threshold.
4. **Incident runbook** pinned in our engineering Slack channel.

## The Cultural Shift

We stopped treating reliability as an ops concern and started treating it as a product feature. Our customers don't care why we went down. They care that we did.`,
  });

  await blog({
    title: 'Why We Rewrote Our Core Engine in Rust',
    slug: 'why-we-rewrote-core-engine-in-rust',
    summary:
      "We migrated StackPilot's diff parsing engine from TypeScript to Rust. Here's what we gained, what we gave up, and whether it was worth it.",
    authorId: chen.id,
    companyId: stackPilot.id,
    articleType: ArticleType.architecture_deep_dive,
    status: BlogStatus.published,
    publishedAt: new Date('2025-07-05'),
    tagSlugs: ['rust', 'performance', 'typescript'],
    body: `## The Starting Point

Our TypeScript implementation was fast enough for most PRs. But when customers began reviewing repositories with thousands of files and complex dependency graphs, we started seeing timeouts.

The bottleneck wasn't the AI — it was the context extraction layer.

## Why Rust?

We evaluated Go and Rust. Go would have been faster to write. We chose Rust for three reasons:

- **Memory safety without GC pauses.** Parsing large codebases means holding significant state in memory. GC pauses at the wrong moment cause visible latency spikes.
- **Fearless concurrency.** Rust's ownership model makes it straightforward to parallelise work across file chunks without data races.
- **WASM target.** We're planning a browser-based diff preview, and Rust compiles cleanly to WebAssembly.

## The Numbers

| Metric | TypeScript | Rust | Improvement |
|--------|-----------|------|-------------|
| Avg parse time (large repo) | 2,400 ms | 180 ms | **13×** |
| Peak memory (large repo) | 1.2 GB | 210 MB | **5.7× less** |
| p99 latency | 8,900 ms | 620 ms | **14×** |

## Was It Worth It?

Yes — but the cost was real. The rewrite took two engineers four weeks. We had to build FFI bindings to call the Rust library from our Node.js service. And hiring Rust engineers is significantly harder than hiring TypeScript engineers.

If you're considering this, budget for the hiring premium. The performance gains are real, but the engineering cost is substantial.`,
  });

  await blog({
    title: 'Open-Sourcing stackpilot-cli: What We Learned',
    slug: 'open-sourcing-stackpilot-cli',
    summary:
      "We open-sourced our CLI and got 500 GitHub stars in a week. But the real value wasn't the stars — it was what happened after.",
    authorId: chen.id,
    companyId: stackPilot.id,
    articleType: ArticleType.open_source_release,
    status: BlogStatus.published,
    publishedAt: new Date('2025-09-22'),
    tagSlugs: ['open-source', 'devtools', 'typescript'],
    body: `## Why We Open-Sourced

The CLI lives in your terminal, your CI pipeline, and your editor. It's the part that has to earn trust. When a tool lives in your development workflow, you want to see the source.

We also wanted contributors. Developer tools live and die by ecosystem integrations, and we couldn't build every one ourselves.

## The Release Process

We didn't just push to GitHub and announce it. Two weeks before the release we:

- Wrote comprehensive \`CONTRIBUTING.md\` and \`ARCHITECTURE.md\`
- Labelled 30 issues as \`good-first-issue\`
- Prepared a detailed post explaining design decisions

The preparation paid off. In the first week, 12 contributors submitted their first PRs — all on the good-first-issue tickets.

## What Surprised Us

**The quality of external contributions.** One community member built a Neovim plugin in three days. We wouldn't have shipped that for months.

**The support burden.** GitHub Issues became a partial support channel almost immediately. We had to add issue templates and pin a FAQ.

**Responsible disclosures.** Within 48 hours we received two valid security reports. We now have a \`SECURITY.md\` and a CVD process.

## Should You Open-Source?

If your tool touches developer workflows: yes. The trust signal alone is worth the maintenance overhead.`,
  });

  await blog({
    title: 'Building Multi-Model AI Pipelines for Code Analysis',
    slug: 'building-multi-model-ai-pipelines-code-analysis',
    summary:
      "We're routing different analysis tasks to specialised models. Early results show 18% better precision and 34% cost reduction. Here's how it works.",
    authorId: chen.id,
    companyId: stackPilot.id,
    articleType: ArticleType.ai_experiment,
    status: BlogStatus.draft,
    tagSlugs: ['ai', 'typescript', 'performance'],
    body: `## The Hypothesis

No single model is best at everything. Security vulnerability detection requires different capabilities than style consistency checking. What if we routed each analysis task to the model best suited for it?

## The Experiment

We built a lightweight routing layer that classifies incoming tasks and dispatches them to one of three models:

- **Model A** (GPT-4o) — complex architectural analysis, cross-file reasoning
- **Model B** (Claude Haiku) — style and naming conventions; fast and cheap
- **Model C** (fine-tuned Codestral) — security patterns, trained on CVE databases

\`\`\`typescript
type AnalysisTask = 'architecture' | 'style' | 'security' | 'performance';

async function routeTask(task: AnalysisTask, context: ReviewContext) {
  const model = modelRouter.select(task);
  return model.analyze(context);
}
\`\`\`

## Early Results (500 real PRs)

- **Precision improved 18%** for security findings
- **Cost reduced 34%** overall (cheap model handles ~60% of tasks)
- **Latency unchanged** (tasks run in parallel)

## What's Still Broken

The routing classifier has a 12% error rate — it occasionally sends architectural questions to the style model. We're collecting labels to fine-tune the router. We won't ship this to production until precision exceeds 90%.`,
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // NeuralFlow  (6 blogs: priya × 4, riya × 2)
  // ──────────────────────────────────────────────────────────────────────────────

  await blog({
    title: 'Fine-Tuning LLMs on Domain-Specific Data: A Practical Guide',
    slug: 'fine-tuning-llms-domain-specific-data',
    summary:
      "We've fine-tuned over 30 models for enterprise customers. Here's our actual workflow — the tooling, the pitfalls, and the evaluation framework we use in production.",
    authorId: riya.id,
    companyId: neuralFlow.id,
    articleType: ArticleType.ai_experiment,
    status: BlogStatus.published,
    publishedAt: new Date('2025-02-14'),
    tagSlugs: ['ai', 'machine-learning'],
    body: `## Why Fine-Tuning Still Matters

With general-purpose models available off the shelf, you might wonder why fine-tuning exists. The answer is **consistency**. A general-purpose model gives you good answers most of the time. A fine-tuned model gives you the *right* answer in *your* format, reliably.

For enterprise customers processing thousands of documents per day with strict output schemas, "most of the time" is not good enough.

## Our Workflow

### 1. Dataset Curation (the hard part)

The model is only as good as the data. We spend 70% of project time here.

- **Minimum viable dataset:** 500 high-quality examples beat 5,000 mediocre ones.
- **Label quality over quantity:** One carefully verified example is worth ten hastily annotated ones.
- **Adversarial examples:** Include edge cases the base model handles badly.

### 2. Base Model Selection

We evaluate base models on the customer's eval set *before* fine-tuning. The best starting point is not always the biggest model.

### 3. Training

We use QLoRA for most jobs — it fits on a single A100 and converges in 2–4 hours for most datasets.

\`\`\`python
training_args = TrainingArguments(
    learning_rate=2e-4,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    warmup_ratio=0.03,
)
\`\`\`

### 4. Evaluation

We maintain a hold-out eval set for every customer. A model only ships if it beats the base model on precision, recall, and hallucination rate.

## The Most Common Failure Mode

Overfitting on small datasets. If training loss is excellent but eval loss diverges early, you need more data — not more epochs.`,
  });

  await blog({
    title: "From RAG to Agentic Workflows: What We Wish We'd Known Earlier",
    slug: 'from-rag-to-agentic-workflows',
    summary:
      "RAG was our first production AI architecture. Agentic workflows are where we are now. The journey between them was messier than the conference talks suggest.",
    authorId: priya.id,
    companyId: neuralFlow.id,
    articleType: ArticleType.architecture_deep_dive,
    status: BlogStatus.published,
    publishedAt: new Date('2025-04-02'),
    tagSlugs: ['ai', 'machine-learning', 'distributed-systems'],
    body: `## RAG: The Honest Assessment

Retrieval-Augmented Generation works well for a surprisingly narrow set of use cases: Q&A over a well-structured, frequently updated corpus. If your data is messy, retrieval quality tanks. If your data rarely changes, a fine-tuned model is probably better.

We shipped RAG for a legal document search product in 2024. It worked — but the hidden cost was the embedding pipeline. Keeping embeddings fresh as documents updated required more infrastructure than the model itself.

## What Agentic Means in Practice

An agent is a model that uses tools and decides what to do next based on intermediate results. Our production agents have access to:

- Web search
- Document retrieval (vector + keyword hybrid)
- Sandboxed code execution
- Customer internal APIs

\`\`\`
User request
    ↓
Planner (decides tool sequence)
    ↓
Tool executor (parallel where safe)
    ↓
Synthesiser (assembles output)
    ↓
Verifier (checks against constraints)
\`\`\`

## The Parts That Are Still Hard

**Reliability.** Agents fail in novel ways — hallucinated API calls, infinite loops, valid-looking but semantically wrong outputs.

**Observability.** You need full trace logging of every decision and tool call. Without it, production debugging is impossible.

**Cost.** Agentic workflows use 10–50× more tokens than simple RAG. Budget accordingly before committing to this architecture.`,
  });

  await blog({
    title: 'Scaling ML Inference to 1 Million Requests Per Day',
    slug: 'scaling-ml-inference-1-million-requests',
    summary:
      "How NeuralFlow serves 1M+ daily inference requests with p99 latency under 200ms — the infrastructure decisions, the trade-offs, and what we'd do differently.",
    authorId: priya.id,
    companyId: neuralFlow.id,
    articleType: ArticleType.scaling_story,
    status: BlogStatus.published,
    publishedAt: new Date('2025-07-18'),
    tagSlugs: ['machine-learning', 'performance', 'kubernetes'],
    body: `## Layer 1: Request Queue

We use Redis Streams as our inference queue. Requests arrive via the API, get enqueued, and are consumed by worker pods. This decouples API latency from inference latency — the API always responds fast, and the queue absorbs traffic spikes gracefully.

## Layer 2: Worker Fleet

Each worker runs NVIDIA Triton Inference Server because:

- Concurrent model execution across GPU streams
- Dynamic batching — groups small requests together, maximising GPU utilisation
- Native ONNX support for our exported models

Autoscaling is based on **queue depth**, not CPU. A worker with high CPU but an empty queue is not a scaling signal.

## Layer 3: Two-Tier Caching

1. **Semantic cache** — semantically similar requests return cached results. ~18% hit rate in production.
2. **Prompt prefix cache** — for long system prompts shared across requests. Reduces TTFT (time to first token) by 40%.

## The Numbers

| Metric | 6 months ago | Today |
|--------|-------------|-------|
| Daily requests | 50K | 1.1M |
| p50 latency | 380 ms | 95 ms |
| p99 latency | 2,100 ms | 190 ms |
| GPU utilisation | 23% | 74% |
| Cost per 1K requests | $0.18 | $0.04 |

## What We'd Do Differently

We built the caching layer six months too late. We were so focused on raw throughput that we left significant cost savings on the table. Add caching early — it pays for itself quickly at any meaningful scale.`,
  });

  await blog({
    title: 'Why Traditional Databases Fall Short for Vector Search',
    slug: 'traditional-databases-vector-search-limits',
    summary:
      'We tested five approaches to vector similarity search over 50M embeddings. Here is an honest comparison with real benchmark data.',
    authorId: riya.id,
    companyId: neuralFlow.id,
    articleType: ArticleType.engineering_blog,
    status: BlogStatus.published,
    publishedAt: new Date('2025-05-08'),
    tagSlugs: ['ai', 'postgresql', 'performance'],
    body: `## The Setup

Our retrieval pipeline requires fast approximate nearest-neighbour search over 1536-dimension embeddings. We have ~50M vectors in production. We evaluated: **pgvector**, **Pinecone**, **Weaviate**, **Qdrant**, and a **custom FAISS cluster**.

## Results

**pgvector** is excellent for ≤5M vectors. Above that, IVFFlat index performance degrades significantly even with careful tuning. We hit query timeouts on complex filtered queries.

**Pinecone** is the easiest to operate and has excellent managed tooling. The cost is real: at our scale, $4,200/month for the pod size we needed.

**Qdrant** surprised us. Closest to pgvector in developer ergonomics, significantly better scaling characteristics, and on-disk storage support keeps RAM requirements manageable.

**FAISS** is fastest raw but requires you to build your own serving layer. We spent two weeks on infrastructure that Qdrant gives you for free.

## What We Chose

**Qdrant** for new deployments. **pgvector** for use cases under 5M vectors where staying in PostgreSQL justifies the operational simplicity.

The hybrid pattern — pgvector for metadata filters, Qdrant for vector similarity — works well when queries span both structured and unstructured dimensions.`,
  });

  await blog({
    title: 'Building Ethical AI: The Framework We Use Internally',
    slug: 'building-ethical-ai-our-framework',
    summary:
      "We think hard about responsible AI — not as a compliance exercise, but as decisions we make every day. Here are the five principles we've committed to.",
    authorId: priya.id,
    companyId: neuralFlow.id,
    articleType: ArticleType.opinion_essay,
    status: BlogStatus.published,
    publishedAt: new Date('2025-09-01'),
    tagSlugs: ['ai', 'machine-learning'],
    body: `## Why Infrastructure Providers Have More Responsibility

NeuralFlow is infrastructure. Our models power hundreds of downstream products. The ethical decisions we make — or fail to make — get multiplied across every customer's users.

That is a significant responsibility.

## Our Five Principles

**1. No training on customer data without explicit opt-in.**
We see a lot of sensitive data: medical records, financial filings, legal documents. We never train on it without clear written consent. Our data handling is documented and auditable.

**2. Hallucination rates are a product metric.**
We track hallucination rates the same way we track latency. Every model has a measured hallucination rate on a held-out evaluation set. If it increases in a new version, we don't ship.

**3. Humans stay in the loop for consequential outputs.**
For any application where output affects a real decision — a loan, a medical triage, a moderation action — we require human review integration. We won't sign contracts that remove this.

**4. Be honest about uncertainty.**
Our models communicate confidence. A low-confidence output looks different to the user than a high-confidence one. We believe this is both more honest and more useful.

**5. Security by design.**
Prompt injection is a real attack vector. Our inference layer sanitises inputs and runs code execution in rate-limited sandboxes. We maintain a vulnerability disclosure programme.

## The Hard Part

Principles are easy to write. The hard part is the edge case: when a customer wants something that's technically possible but feels wrong. We've said no to deals because of this. We'll do it again.`,
  });

  await blog({
    title: 'From Hackathon to Seed Round: The NeuralFlow Origin Story',
    slug: 'neuralflow-from-hackathon-to-seed-round',
    summary:
      'We started NeuralFlow at a 48-hour hackathon with a demo that worked 70% of the time. Eighteen months later we raised a $3.2M seed round.',
    authorId: priya.id,
    companyId: neuralFlow.id,
    articleType: ArticleType.founder_note,
    status: BlogStatus.draft,
    tagSlugs: ['ai'],
    body: `## The Hackathon

The brief said "build something with AI". Our team of three built a document Q&A tool in 48 hours. The demo worked about 70% of the time. We won second place and went home thinking that was the end of it.

Two weeks later, one of the judges — a VC partner — emailed asking if we were planning to turn it into a company. We weren't. Then we were.

## The First Six Months

We had no funding and a part-time team. Priya left her job first. Riya joined three months later. We worked from a shared flat and took consulting work to stay solvent.

The first paying customer came from the hackathon. The second came from the first. It wasn't real traction — it was survival. But it was real revenue, and it proved the problem was worth solving.

## What Changed Everything

Getting into YC was our inflection point — not for the money, but for the network and the intensity. Twelve weeks working on nothing but product and growth. We came out with 30 active customers and a clear narrative.

The seed round closed four months after Demo Day.

## What I'd Tell Earlier-Stage Founders

The hackathon demo that barely works is enough. You don't need a perfect product. You need a real problem and evidence that someone will pay for a bad solution to it. If they'll pay for bad, imagine what they'll do for good.`,
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // FinLedger  (5 blogs: marcus × 5)
  // ──────────────────────────────────────────────────────────────────────────────

  await blog({
    title: 'How We Achieved PCI-DSS Compliance in 6 Months',
    slug: 'pci-dss-compliance-6-months',
    summary:
      "Most fintech founders underestimate PCI compliance. We did too. Here's the full timeline, what it actually cost, and the shortcuts that aren't worth taking.",
    authorId: marcus.id,
    companyId: finLedger.id,
    articleType: ArticleType.case_study,
    status: BlogStatus.published,
    publishedAt: new Date('2025-05-12'),
    tagSlugs: ['fintech', 'distributed-systems'],
    body: `## What PCI-DSS Actually Means for a Startup

PCI-DSS is a set of security requirements for any company handling cardholder data. There are four compliance levels based on transaction volume. As a startup you'll start at Level 4 — the lightest requirements. Level 4 still requires serious work. Don't let anyone tell you otherwise.

## Our 6-Month Timeline

**Month 1: Gap analysis.**
We hired a QSA (Qualified Security Assessor) for a gap analysis. They produced a 47-page report. It was humbling.

**Months 2–3: Infrastructure hardening.**
Encrypted all cardholder data at rest with AES-256. Implemented network segmentation to isolate the cardholder data environment. Deployed a WAF. Rotated all credentials and adopted HashiCorp Vault for secrets management.

**Month 4: Logging and monitoring.**
PCI requires comprehensive audit trails. We centralised log aggregation, added IDS, and implemented file integrity monitoring.

**Month 5: Process documentation.**
PCI requires written policies for everything. We wrote 23 policy documents.

**Month 6: Remediation and assessment.**
The QSA returned, we addressed remaining gaps, and we received our Report on Compliance.

## What It Cost

| Item | Cost |
|------|------|
| QSA fees | $24,000 |
| Additional AWS spend | ~$3,500/mo |
| Engineering time | ~$60,000 |
| Vault + security tooling | ~$800/mo |
| **Year 1 total** | **~$130,000** |

Start earlier than you think you need to.`,
  });

  await blog({
    title: 'Real-Time Payment Processing at Scale: Our Architecture',
    slug: 'real-time-payment-processing-architecture',
    summary:
      "How FinLedger processes payments with end-to-end latency under 400ms while maintaining ACID guarantees — the system design choices that made it possible.",
    authorId: marcus.id,
    companyId: finLedger.id,
    articleType: ArticleType.scaling_story,
    status: BlogStatus.published,
    publishedAt: new Date('2025-06-15'),
    tagSlugs: ['fintech', 'postgresql', 'distributed-systems'],
    body: `## The Core Challenge

Payments are special. Unlike most systems where eventual consistency is acceptable, payments require hard ACID guarantees. Money should not be created or destroyed by a system failure. Double charges must be impossible.

At the same time, customers expect payments to be *fast*. Sub-second is table stakes.

## The Ledger Model

We use a double-entry ledger implemented in PostgreSQL. Every payment creates two rows: a debit and a credit. The invariant is that the sum of all entries always equals zero.

\`\`\`sql
-- Runs inside a transaction — atomically inserts both sides
INSERT INTO ledger_entries (account_id, amount, currency, reference_id, entry_type)
VALUES
  ($1, -$2, $3, $4, 'debit'),
  ($5,  $2, $3, $4, 'credit');
\`\`\`

This model makes it structurally impossible to create or destroy money.

## Achieving Sub-400ms End-to-End

| Step | Approx. time |
|------|-------------|
| API receives request | 0 ms |
| Idempotency key check (Redis) | ~2 ms |
| Fraud pre-check (ML, async) | ~45 ms |
| Acquire distributed lock (Redlock) | ~5 ms |
| Bank network submission | ~200 ms |
| Ledger write (PostgreSQL) | ~8 ms |
| **Total (median)** | **~260 ms** |

Async steps (webhooks, notifications) go to Kafka and don't block the response.

## Idempotency: The Critical Detail

Every payment endpoint accepts an idempotency key. If the same key arrives twice — due to a network retry or a client bug — we return the original response without re-processing the payment. Without this, retries cause duplicate charges. This is a catastrophic failure mode for a payment company.`,
  });

  await blog({
    title: 'PostgreSQL as a Financial Ledger: Six Months of Lessons',
    slug: 'postgresql-financial-ledger-lessons',
    summary:
      "We chose PostgreSQL over purpose-built financial databases. A year in, we still think it was the right call — with caveats.",
    authorId: marcus.id,
    companyId: finLedger.id,
    articleType: ArticleType.engineering_blog,
    status: BlogStatus.published,
    publishedAt: new Date('2025-08-10'),
    tagSlugs: ['postgresql', 'fintech', 'distributed-systems'],
    body: `## Why PostgreSQL

Several purpose-built financial databases exist — TigerBeetle, CockroachDB, Fauna. We evaluated all of them.

We chose PostgreSQL because: our team knew it deeply, the operational story is mature (RDS, managed backups, read replicas), and we were confident we could make it work at our scale.

That last point turned out to be mostly right, with caveats.

## What Works Extremely Well

**ACID guarantees are real.** We have never had a ledger inconsistency in production. Not once. Serializable isolation is slower than read committed, but the correctness guarantees are worth it for financial data.

**Row-level locking for account operations.** \`SELECT FOR UPDATE\` on an account row serialises concurrent operations without a full table lock.

## What Surprised Us

**VACUUM pressure at high write volume.** At 50K transactions/day, autovacuum couldn't keep up with table bloat. We had to tune \`autovacuum_vacuum_scale_factor\` aggressively and schedule manual \`VACUUM ANALYZE\` on hot tables.

**Connection pool exhaustion.** PostgreSQL has a hard limit on connections. At scale you need PgBouncer or a similar pooler. We learned this at 2AM.

**Index bloat on append-only tables.** Our ledger entries table is append-only. B-tree indexes become less efficient on pure-append workloads. BRIN indexes solved our time-range query problem.

## The Bottom Line

PostgreSQL at fintech scale is achievable, but you will hit non-obvious performance walls. Budget for deep PostgreSQL expertise on the team — or a DBA.`,
  });

  await blog({
    title: 'Building Real-Time Fraud Detection with Machine Learning',
    slug: 'building-fraud-detection-machine-learning',
    summary:
      "Our ML fraud detection runs in under 50ms per transaction and catches 94% of fraudulent payments. Here's how we built it without blocking the happy path.",
    authorId: marcus.id,
    companyId: finLedger.id,
    articleType: ArticleType.ai_experiment,
    status: BlogStatus.published,
    publishedAt: new Date('2025-07-28'),
    tagSlugs: ['ai', 'fintech', 'machine-learning'],
    body: `## The Problem Space

Fraud detection is a needle-in-a-haystack problem. In a typical payment portfolio, 0.1–0.5% of transactions are fraudulent. A model that classifies everything as legitimate will be 99.5% accurate — and completely useless.

The metrics that matter are **precision** (don't block legitimate payments) and **recall** (don't miss fraud). Our target: 94% recall, <0.3% false positive rate.

## Feature Engineering

The features that matter most are behavioural, not transactional:

- **Velocity features:** How many transactions from this account in the last hour? Day?
- **Geo-velocity:** Is the current transaction location physically reachable from the previous one?
- **Device fingerprint:** Is this a known device for this account?
- **MCC patterns:** Is this merchant category unusual for this cardholder?

We compute these features in real time using Redis sorted sets and sliding window queries.

## The Model

We use XGBoost for the primary signal. We evaluated neural networks but tree models offer two advantages here:

1. **Explainability** — regulators want to understand why a transaction was flagged.
2. **Inference speed** — XGBoost inference takes ~3ms. Our neural network equivalent took 40ms.

## The Human Layer

All flagged transactions go to a human review queue before being blocked, except the highest-confidence flags which are blocked immediately. This human-in-the-loop design is why our false positive rate stays low despite high recall.`,
  });

  await blog({
    title: 'The Hidden Costs of Building Fintech Infrastructure from Scratch',
    slug: 'hidden-costs-fintech-infrastructure',
    summary:
      "We thought the hard part was building payment processing. It wasn't. Here's everything nobody told us about the real cost of fintech infrastructure.",
    authorId: marcus.id,
    companyId: finLedger.id,
    articleType: ArticleType.founder_note,
    status: BlogStatus.published,
    publishedAt: new Date('2025-10-05'),
    tagSlugs: ['fintech', 'distributed-systems'],
    body: `## What We Knew Going In

Marcus spent five years at Stripe. He understood payment systems deeply. We knew we'd need banking relationships, a compliance programme, and a solid engineering team. We thought we'd budgeted for all of it.

## What We Underestimated

**Banking relationships take 6–12 months.** Banks do extensive due diligence on fintech startups. We started the process on day one and didn't have a live banking partner until month seven.

**Compliance is a full-time job.** We assumed compliance could be handled part-time alongside engineering. By month four we had a full-time compliance officer. It's the second hire we'd recommend to any fintech founder.

**Testing production payment rails is expensive.** You can't fully test payment processing without real transactions. We spent $8,000 in testing costs in the first three months.

**Payment dispute support volume is enormous.** Every dispute requires documentation and a response within tight deadlines. We underestimated this by a factor of five.

## The Real Numbers

| Category | Budgeted | Actual (Year 1) |
|----------|----------|-----------------|
| Engineering | $240K | $260K |
| Compliance & Legal | $60K | $140K |
| Banking fees | $20K | $48K |
| Infrastructure | $30K | $72K |
| **Total** | **$350K** | **$520K** |

If you're building fintech, add 50% to your cost estimates and start the banking relationship process the day you decide to build. The technical problems are tractable. The regulatory and operational problems are where most fintech startups run out of runway.`,
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // EduPath  (5 blogs: aisha × 5)
  // ──────────────────────────────────────────────────────────────────────────────

  await blog({
    title: 'How We Built AI-Powered Personalised Learning Paths',
    slug: 'ai-powered-personalised-learning-paths',
    summary:
      "Our recommendation engine adapts to each student's pace, prior knowledge, and learning style in real time. Here's the architecture behind it.",
    authorId: aisha.id,
    companyId: eduPath.id,
    articleType: ArticleType.ai_experiment,
    status: BlogStatus.published,
    publishedAt: new Date('2025-03-20'),
    tagSlugs: ['ai', 'machine-learning'],
    body: `## The Problem with Static Curricula

Every student who takes a web development course starts at the same HTML tutorial, even if they already know HTML. Every student proceeds at the same pace, even if some need three attempts to understand closures while others breeze through in minutes.

This is inefficient and discouraging. We built EduPath to fix it.

## How the Recommendation Engine Works

We model each student as a **knowledge state vector** — a probability distribution over their mastery of each concept in the curriculum. Every interaction updates this vector using Bayesian inference.

\`\`\`
Answer correct  → P(mastery) increases
Answer incorrect → P(mastery) decreases + prerequisite gap flagged
\`\`\`

The next lesson selected is the one that maximises **expected learning gain** given the current knowledge state. We draw on Knowledge Space Theory for the formal model.

## The Signals That Drive It

1. **Assessment responses** — correct/incorrect, time taken, number of attempts
2. **Engagement signals** — video rewatch patterns, section revisits, help-seeking behaviour
3. **Retention checks** — spaced repetition quizzes surfaced days or weeks after initial learning

## Early Results

Students on adaptive paths complete courses at a **42% higher rate** than students on fixed curricula. They also score 28% higher on post-course assessments.

The effect is strongest at the extremes: students who already know part of the material (they skip ahead) and students who struggle (they get targeted practice on weak concepts before moving on).`,
  });

  await blog({
    title: 'Building a Real-Time Collaborative Code Editor from Scratch',
    slug: 'building-real-time-collaborative-editor',
    summary:
      "We tried four off-the-shelf collaborative editors before building our own. Here's why, and how CRDTs made it possible.",
    authorId: aisha.id,
    companyId: eduPath.id,
    articleType: ArticleType.tutorial,
    status: BlogStatus.published,
    publishedAt: new Date('2025-05-25'),
    tagSlugs: ['typescript', 'react', 'distributed-systems'],
    body: `## Why We Built It

We evaluated CodeMirror with Y.js, Monaco with ShareDB, Liveblocks, and CodeSandbox embeds. Each had dealbreakers:

- **CodeMirror + Y.js:** Great primitives, poor teacher annotation tooling
- **Monaco + ShareDB:** OT conflicts under high concurrency with 30+ students
- **Liveblocks:** Doesn't support our custom language modes
- **CodeSandbox:** Expensive at scale, no white-label option

Six weeks of evaluation later, we started building our own.

## The Core: CRDTs

We use Conflict-free Replicated Data Types (specifically a CRDT-based text sequence) instead of Operational Transformation (OT). CRDTs are simpler to reason about under network partitions and work correctly without a central server ordering operations.

The trade-off is memory: CRDTs have higher overhead per character for tombstoned deletions. For our session profile (2-hour classes, files up to 500 lines), this is acceptable.

## Architecture

\`\`\`
Client (React + CRDT state)
    ↕ WebSocket
Server (Node.js relay — stateless)
    ↕ Redis pub/sub (multi-pod routing)
    ↕ PostgreSQL (session snapshots every 30s)
\`\`\`

## Teacher Features

The real differentiation is teacher tooling:

- **Cursor presence** — see every student's cursor position live
- **Highlight annotation** — comment on any code range for all to see
- **Execution trace** — step-by-step execution with variable state visible to the class

## The Performance Problem We Solved

At 30+ concurrent students, cursor position broadcasts created visible lag. We batch cursor updates at 50ms intervals — imperceptible to users, but it reduces message volume by ~90%.`,
  });

  await blog({
    title: 'How We Onboarded 50,000 Students in a Single Week',
    slug: 'onboarding-50k-students-one-week',
    summary:
      "A single tweet brought 50K signups in 7 days. Here's how we survived the infrastructure scramble — and what we built afterwards so it won't happen again.",
    authorId: aisha.id,
    companyId: eduPath.id,
    articleType: ArticleType.scaling_story,
    status: BlogStatus.published,
    publishedAt: new Date('2025-08-22'),
    tagSlugs: ['typescript', 'postgresql', 'performance'],
    body: `## The Tweet That Changed Everything

On a Monday morning, a developer educator with 400K followers posted about EduPath. By noon we had 12,000 signups. By Friday, 50,000.

Our infrastructure was not ready.

## The First 48 Hours: Triage

**Database connections exhausted.** We were on a single RDS instance sized for 1,000 concurrent users. At 15,000 concurrent users, connections were gone. We added PgBouncer in 20 minutes — tripling effective connection capacity.

**Email verification backlog at 8,000 items.** Our provider rate-limited us. We implemented tiered retry with exponential backoff and added a second provider as failover.

**CDN caching misconfigured.** Course video delivery slowed to a crawl. An evening of CloudFront cache rule tuning fixed it.

## The Week-Long Infrastructure Sprint

We ran with no feature development for a week. Everything went into capacity:

- RDS: \`db.t3.medium\` → \`db.r6g.2xlarge\`
- Added two read replicas for read-heavy queries
- Moved standalone Redis to a cluster
- Properly configured ECS service autoscaling based on queue depth

## What We Wish We'd Done Earlier

**Load testing.** We had never run a proper load test against production-like load. This is negligent in retrospect. We now run load tests to 10× expected peak before every major launch.

**Circuit breakers.** When email was slow, it cascaded into registration failures. Proper circuit breakers would have degraded gracefully — skip email, queue for retry — instead of failing hard.

The silver lining: we have runbooks and infrastructure documentation we couldn't have written without going through this.`,
  });

  await blog({
    title: 'The CMS We Had to Build Ourselves',
    slug: 'content-management-system-we-built-ourselves',
    summary:
      "We tried WordPress, Contentful, and Sanity. None worked for technical education content. So we spent 6 weeks building exactly what we needed.",
    authorId: aisha.id,
    companyId: eduPath.id,
    articleType: ArticleType.engineering_blog,
    status: BlogStatus.published,
    publishedAt: new Date('2025-04-14'),
    tagSlugs: ['typescript', 'nextjs', 'react'],
    body: `## Why Off-the-Shelf CMSs Failed Us

Our content requirements are genuinely unusual:

- **Executable code blocks** — students run code inside the lesson
- **Embedded interactive quizzes** — in the lesson flow, not at the end
- **Prerequisite graphs** — content is a DAG, not a hierarchy
- **Versioned lessons** — updates must not break student progress state
- **Localisation** — English and Hindi from day one

WordPress failed on developer experience and DAG support. Contentful had no concept of content as a graph. Sanity was the closest, but couldn't represent executable code blocks natively.

## What We Built

A Next.js admin interface backed by our own PostgreSQL content store with a custom block renderer.

**Block types we support:**
- Text (Markdown with math via KaTeX)
- Code (executable, language-specific runtimes)
- Quiz (multiple choice, fill-in-the-blank, code completion)
- Video (with chapter markers linked to concept IDs)
- Diagram (Mermaid rendered server-side to SVG)

**The prerequisite graph** is stored as a DAG in PostgreSQL using a closure table. "What are all prerequisites of lesson X?" is a single SQL query.

## Was It Worth It?

Six weeks of engineering time. That's a real cost for a startup. The payoff has been a content team that moves significantly faster than with any third-party tool, and the ability to ship interactive content types no off-the-shelf CMS supports.

Build it if you have truly unusual requirements. Otherwise, Sanity is genuinely good.`,
  });

  await blog({
    title: "Why EdTech Has a Completion Rate Problem — And How We're Fixing It",
    slug: 'edtech-completion-rate-problem',
    summary:
      "The dirty secret of online education: most courses have completion rates under 15%. We've spent two years studying why, and what actually moves the number.",
    authorId: aisha.id,
    companyId: eduPath.id,
    articleType: ArticleType.opinion_essay,
    status: BlogStatus.published,
    publishedAt: new Date('2025-10-12'),
    tagSlugs: ['ai', 'react'],
    body: `## The Numbers Are Worse Than You Think

Industry average completion rate for online courses: **5–15%**. For free courses, often below 5%.

These numbers are rarely discussed openly because EdTech companies don't want to advertise them. But they represent real people who invested time and money, got excited, and gave up.

We believe this is solvable. Here's what the research — and our own data — says about why people drop out.

## The Three Root Causes

**1. The course isn't calibrated to the student's level.**
Students who already know 40% of the material disengage from boredom. Students who find 40% incomprehensible give up from frustration. The learning sweet spot is challenge *slightly* above current ability — what Vygotsky called the Zone of Proximal Development.

**2. No social accountability.**
Solo learning is hard. Cohort-based courses have dramatically higher completion rates because other people are watching.

**3. The reward signal comes too late.**
A 20-hour course has a payoff that's 20 hours away. The brain isn't wired for motivation on that timescale without intermediate wins.

## What We're Doing

- **Adaptive paths** — skip what you know, revisit what you don't
- **Weekly cohorts** — group students who start the same week; completion is 3.1× higher in cohorts vs. solo
- **Micro-milestones** — every 45 minutes of learning, a visible progress marker and shareable achievement
- **Early-intervention AI** — detects disengagement signals and sends timely, personalised nudges

## Our Current Numbers

Across courses with all four features active: **41% completion rate**.

Not perfect. But a long way from 5%.`,
  });

  console.log('✅  Blogs (22 total)');

  // ── 7. Update tag blog counts ─────────────────────────────────────────────────

  const published = await prisma.blogTag.findMany({
    where: { blog: { status: BlogStatus.published } },
    select: { tagId: true },
  });

  const countMap = published.reduce<Record<string, number>>((acc, bt) => {
    acc[bt.tagId] = (acc[bt.tagId] ?? 0) + 1;
    return acc;
  }, {});

  // Reset all to 0 first, then set accurate counts
  await prisma.tag.updateMany({ data: { blogCount: 0 } });
  for (const [tagId, count] of Object.entries(countMap)) {
    await prisma.tag.update({ where: { id: tagId }, data: { blogCount: count } });
  }
  console.log('✅  Tag blog counts');

  // ── Done ──────────────────────────────────────────────────────────────────────

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              🎉  Seed complete                            ║
╠═══════════════════════════════════════════════════════════╣
║  Password for all accounts:  Password@Seed1               ║
╠═══════════════════════════════════════════════════════════╣
║  Platform Admin  admin@lorestack.com     platform_admin   ║
╠═══════════════════════════════════════════════════════════╣
║  StackPilot      ajay@stackpilot.dev     owner            ║
║                  chen@stackpilot.dev     author           ║
╠═══════════════════════════════════════════════════════════╣
║  NeuralFlow      priya@neuralflow.ai     owner            ║
║                  riya@neuralflow.ai      author           ║
╠═══════════════════════════════════════════════════════════╣
║  FinLedger       marcus@finledger.io     owner            ║
╠═══════════════════════════════════════════════════════════╣
║  EduPath         aisha@edupath.co        owner            ║
╚═══════════════════════════════════════════════════════════╝
`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
