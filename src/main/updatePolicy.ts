/**
 * Tự cập nhật chỉ chạy khi app đã đóng gói và không phải bản portable
 * (electron-updater chỉ cập nhật được bản cài NSIS).
 */
export function canAutoUpdate(opts: {
  packaged: boolean
  portable: boolean
}): boolean {
  return opts.packaged && !opts.portable
}
