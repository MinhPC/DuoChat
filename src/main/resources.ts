import path from 'node:path'
import { app, nativeImage, type NativeImage } from 'electron'

/** Thư mục resources/ (icon app, tray, badge). Nằm trong asar khi đóng gói; nativeImage đọc được. */
export function resourcePath(name: string): string {
  return path.join(app.getAppPath(), 'resources', name)
}

const cache = new Map<string, NativeImage>()

export function loadImage(name: string): NativeImage {
  let img = cache.get(name)
  if (!img) {
    img = nativeImage.createFromPath(resourcePath(name))
    cache.set(name, img)
  }
  return img
}
