/** React Query keys of the admin clients & billing screens. */
export const clientQueryKeys = {
  all: ["admin-clients"] as const,
  list: () => [...clientQueryKeys.all, "list"] as const,
  detail: (accountId: string | undefined) => [...clientQueryKeys.all, "detail", accountId] as const,
  emails: (accountId: string | undefined) => [...clientQueryKeys.all, "emails", accountId] as const,
  owners: () => [...clientQueryKeys.all, "owners"] as const,
  settings: () => [...clientQueryKeys.all, "settings"] as const,
};
