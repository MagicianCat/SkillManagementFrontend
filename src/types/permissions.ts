export type Permission =
  | 'skill:browse'
  | 'skill:download'
  | 'skill:upload'
  | 'skill:edit'
  | 'skill:review'
  | 'wiki:review'
  | 'skill:publish'
  | 'skill:offline'
  | 'admin:identity'
  | 'admin:audit'
  | 'admin:alert:operate'
  | 'admin:alert:configure'
  | 'admin:telemetry'

export function hasPermission(
  userPermissions: readonly string[] | undefined,
  permission: Permission,
): boolean {
  return Boolean(userPermissions?.includes(permission))
}

export function hasAnyPermission(
  userPermissions: readonly string[] | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) =>
    hasPermission(userPermissions, permission),
  )
}
