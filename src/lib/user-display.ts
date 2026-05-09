export const getInitials = (email?: string): string => {
  if (!email) return "U";
  return email.charAt(0).toUpperCase();
};

export const getRoleLabel = (role: string | null): string => {
  switch (role) {
    case "admin":
      return "Administrador";
    case "school":
      return "Usuario Escolar";
    case "representative":
      return "Representante";
    case "teacher":
      return "Docente";
    default:
      return "Usuario";
  }
};

export const getRoleLabelShort = (role: string | null): string => {
  switch (role) {
    case "admin":
      return "Admin";
    case "school":
      return "Escolar";
    case "representative":
      return "Representante";
    case "teacher":
      return "Docente";
    default:
      return "Usuario";
  }
};
