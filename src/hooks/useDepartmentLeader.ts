import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook that determines if the current user is a department leader
 * for a given department, or an admin. Permissions are tied to the
 * `isDepartmentLeader` flag so they transfer automatically when
 * the role is reassigned to a new person.
 */
export function useDepartmentLeader(department?: string) {
  const { user, allUsers } = useAuth();

  // Is admin → full access everywhere
  const isAdmin = user?.isAdmin === true;

  // Is the department leader for the specified department (or their own)
  const targetDept = department || user?.department;
  const isLeader =
    isAdmin ||
    (user?.isDepartmentLeader === true && user?.department === targetDept);

  // Get all users in the leader's department (for delegation UI)
  const departmentUsers = allUsers.filter(
    (u) => u.department === targetDept && u.id !== user?.id
  );

  return {
    isAdmin,
    isLeader,
    /** true when user is admin or department leader for the target dept */
    canManageContent: isLeader,
    departmentUsers,
    currentDepartment: targetDept,
    user,
  };
}

export interface DeletionRecord {
  itemId: string;
  itemTitle: string;
  module: string;
  deletedBy: string;
  deletedAt: string;
  reason: string;
  metadata?: Record<string, unknown>;
}
