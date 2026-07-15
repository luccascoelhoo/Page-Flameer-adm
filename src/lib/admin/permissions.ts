/**
 * Role-based access for the admin panel.
 *
 * Two staff roles exist in profiles.role: 'admin' and 'professional'.
 * Professionals get the full content/analytics toolkit; admins additionally
 * control platform-level surfaces (settings, coupons, audit, role changes).
 *
 * NOTE: this is a UX layer. The hard enforcement lives in Supabase
 * (RLS + is_admin()-gated RPCs); never rely on this file alone.
 */

export type StaffRole = 'admin' | 'professional';

export const ADMIN_ONLY_ROUTES = ['/settings', '/referrals', '/audit'] as const;

export interface Permissions {
  manageSettings: boolean; // AI keys, platform config
  manageCoupons: boolean; // referral codes
  viewAudit: boolean; // admin action trail
  changeRoles: boolean; // promote/demote users
  moderate: boolean;
  manageContent: boolean; // challenges/workouts/diets/habits
  viewAnalytics: boolean;
  viewHealth: boolean;
}

export function permissionsFor(role: string | null | undefined): Permissions {
  const isAdmin = role === 'admin';
  const isStaff = isAdmin || role === 'professional';
  return {
    manageSettings: isAdmin,
    manageCoupons: isAdmin,
    viewAudit: isAdmin,
    changeRoles: isAdmin,
    moderate: isStaff,
    manageContent: isStaff,
    viewAnalytics: isStaff,
    viewHealth: isStaff,
  };
}
