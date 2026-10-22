/**
 * Tự cập nhật chỉ chạy khi: người dùng bật, app đã đóng gói, và không phải bản portable
 * (electron-updater chỉ cập nhật được bản cài NSIS).
 */
export function canAutoUpdate(opts: {
  enabled: boolean
  packaged: boolean
  portable: boolean
}): boolean {
  return opts.enabled && opts.packaged && !opts.portable
}
