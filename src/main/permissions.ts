import type { Session } from 'electron'
import { isAllowedUrl } from './service'

/** Chỉ cấp các quyền này, và chỉ cho origin trong allowlist. Mọi quyền khác bị từ chối. */
const GRANTED = new Set(['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen'])

export function isPermissionAllowed(permission: string, originUrl: string): boolean {
  return GRANTED.has(permission) && isAllowedUrl(originUrl)
}

export function applyPermissionHandlers(ses: Session): void {
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    callback(isPermissionAllowed(permission, details.requestingUrl))
  })
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    isPermissionAllowed(permission, requestingOrigin),
  )
}
