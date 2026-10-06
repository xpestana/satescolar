import type { ModuleKey, SellableModuleKey } from "./moduleCatalog";

/**
 * What a screen needs to be usable: a single module, or a list meaning "any of these"
 * (see docs/desc/19-modulos.md).
 */
export type ModuleRequirement = ModuleKey | readonly SellableModuleKey[];

/**
 * Docentes, Áreas and Asignación de Áreas only make sense when the school can use its
 * teachers: grade entry, the virtual classroom or teacher attendance. The first one is the
 * module pitched in the overlay when none is active.
 */
export const TEACHING_MODULES = ["grades", "virtual_classroom", "attendance"] as const satisfies readonly SellableModuleKey[];

export function requirementModules(requirement: ModuleRequirement): readonly ModuleKey[] {
  return typeof requirement === "string" ? [requirement] : requirement;
}

export function isRequirementMet(requirement: ModuleRequirement, isActive: (key: ModuleKey) => boolean): boolean {
  return requirementModules(requirement).some(isActive);
}

/** Module whose sales copy the locked overlay shows for this requirement. */
export function pitchedModule(requirement: ModuleRequirement): ModuleKey {
  return requirementModules(requirement)[0] ?? "registration";
}
