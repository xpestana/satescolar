import { useAuth } from "@/hooks/useAuth";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useTeacherData } from "@/hooks/useTeacherData";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";

/**
 * School of the signed-in user, whatever their role:
 * school staff (user_roles), teacher (teachers) or representative (family_schools).
 * Admins have no school of their own and get null.
 */
export function useCurrentSchoolId() {
  const { userRole } = useAuth();
  const staff = useSchoolId();
  const teacher = useTeacherData();
  const representative = useRepresentativeFamily();

  switch (userRole) {
    case "school":
      return { schoolId: staff.schoolId ?? null, isLoading: staff.isLoading };
    case "teacher":
      return { schoolId: teacher.schoolId, isLoading: teacher.isLoading };
    case "representative":
      return { schoolId: representative.schoolId, isLoading: representative.isLoading };
    default:
      return { schoolId: null, isLoading: false };
  }
}
