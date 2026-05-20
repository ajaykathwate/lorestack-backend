import { CompanyRole, PlatformRole } from '@prisma/client';

/**
 * Single source of truth for all RBAC rules.
 *
 * The platform has 4 effective permission contexts:
 *
 *   Independent Author  — any registered user (PlatformRole.user, no company membership)
 *   Company Author      — user with CompanyMembership.role = CompanyRole.author
 *   Company Owner       — user with CompanyMembership.role = CompanyRole.owner
 *   Platform Admin      — user with PlatformRole.platform_admin
 *
 * Rules are sourced from the PRODUCT_README.md permissions matrix.
 *
 * This class has ZERO I/O dependencies — no DB, no HTTP, no injected services.
 * Services fetch the relevant CompanyMembership from the DB, then pass the role
 * here for the decision.
 */
export class PermissionChecker {
  // ── Helpers ──────────────────────────────────────────────────────────────────

  private isAdmin(platformRole: PlatformRole): boolean {
    return platformRole === PlatformRole.platform_admin;
  }

  private isCompanyMember(companyRole: CompanyRole | null): boolean {
    return companyRole !== null;
  }

  private isCompanyOwner(companyRole: CompanyRole | null): boolean {
    return companyRole === CompanyRole.owner;
  }

  // ── Admin-only platform permissions ──────────────────────────────────────

  /** Only Platform Admin can access /admin panel. */
  canAccessAdminPanel(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  /** Only Platform Admin can moderate flagged content. */
  canModerateContent(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  /** Only Platform Admin can curate homepage featured content. */
  canCurateHomepage(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  /** Only Platform Admin can manage/merge/approve tags. */
  canManageTags(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  /** Only Platform Admin can list all users on the platform. */
  canListAllUsers(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  /** Only Platform Admin can edit or delete any user account. */
  canManageUsers(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  /** Only Platform Admin can suspend (deactivate) a user account. */
  canSuspendUser(platformRole: PlatformRole): boolean {
    return this.isAdmin(platformRole);
  }

  // ── Company-scoped permissions (require company membership context) ───────

  /**
   * Can publish a blog attributed to a specific company.
   * Requires at minimum Company Author membership.
   */
  canPublishUnderCompany(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyMember(companyRole);
  }

  /**
   * Can edit ANY blog published under the company (not just own blogs).
   * Only Company Owner and Platform Admin.
   */
  canEditAnyCompanyBlog(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyOwner(companyRole);
  }

  /**
   * Can archive ANY blog under the company (not just own blogs).
   * Only Company Owner and Platform Admin.
   */
  canArchiveAnyCompanyBlog(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyOwner(companyRole);
  }

  /**
   * Can edit the company's profile fields (name, tagline, logo, etc.).
   * Only Company Owner and Platform Admin.
   */
  canEditCompanyProfile(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyOwner(companyRole);
  }

  /**
   * Can invite new authors to the company.
   * Only Company Owner and Platform Admin.
   */
  canInviteAuthors(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyOwner(companyRole);
  }

  /**
   * Can remove authors from the company.
   * Only Company Owner and Platform Admin.
   */
  canRemoveAuthors(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyOwner(companyRole);
  }

  /**
   * Can add a milestone to the company's Build-in-Public timeline.
   * Only Company Owner and Platform Admin.
   */
  canAddMilestone(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyOwner(companyRole);
  }

  /**
   * Can view the company dashboard.
   * Company Author (read-only), Company Owner (full), Platform Admin (full).
   * Independent Author has NO access to another company's dashboard.
   */
  canViewCompanyDashboard(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyMember(companyRole);
  }

  /**
   * Can view company analytics.
   * Company Author (read-only), Company Owner (full), Platform Admin (full).
   */
  canViewCompanyAnalytics(platformRole: PlatformRole, companyRole: CompanyRole | null): boolean {
    return this.isAdmin(platformRole) || this.isCompanyMember(companyRole);
  }
}

/** Singleton — import and use directly in service methods. */
export const permissionChecker = new PermissionChecker();
