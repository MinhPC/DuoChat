// Sinh icon vào resources/: icon.png (app), tray.png, tray-unread.png, badge-1..9.png, badge-9plus.png.
// Không phụ thuộc thư viện ảnh: tự vẽ bằng supersampling và mã hóa PNG bằng zlib.
// Chạy: node scripts/gen-icons.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources')
fs.mkdirSync(outDir, { recursive: true })

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(td) >>> 0)
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** shader(u, v) với u,v ∈ [0,1] trả về [r,g,b,a] (a ∈ 0..1, không premultiplied). */
function render(size, shader, ss = 4) {
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [pr, pg, pb, pa] = shader((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa
        }
      }
      const n = ss * ss
      const o = (y * size + x) * 4
      if (a > 0) {
        buf[o] = Math.round(r / a); buf[o + 1] = Math.round(g / a); buf[o + 2] = Math.round(b / a)
      }
      buf[o + 3] = Math.round((a / n) * 255)
    }
  }
  return encodePng(size, size, buf)
}

const NONE = [0, 0, 0, 0]
const inRoundRect = (u, v, x, y, w, h, r) => {
  const cx = Math.min(Math.max(u, x + r), x + w - r)
  const cy = Math.min(Math.max(v, y + r), y + h - r)
  return u >= x && u <= x + w && v >= y && v <= y + h && (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}

// ---- icon app / tray: nền xanh bo góc + hai bong bóng chat chồng nhau (không dùng chữ "Zalo") ----
function appShader(withDot) {
  return (u, v) => {
    if (withDot && (u - 0.78) ** 2 + (v - 0.22) ** 2 <= 0.2 ** 2) return [239, 68, 68, 1]
    if (!inRoundRect(u, v, 0.02, 0.02, 0.96, 0.96, 0.22)) return NONE
    // bong bóng phải-dưới (xanh nhạt) vẽ trước, bong bóng trái-trên (trắng) đè lên
    if (inRoundRect(u, v, 0.34, 0.38, 0.46, 0.34, 0.1)) {
      if (inRoundRect(u, v, 0.18, 0.2, 0.46, 0.34, 0.1)) return [255, 255, 255, 1]
      return [147, 197, 253, 1]
    }
    if (inRoundRect(u, v, 0.18, 0.2, 0.46, 0.34, 0.1)) return [255, 255, 255, 1]
    // đuôi bong bóng
    if (u > 0.22 && u < 0.34 && v > 0.54 && v < 0.54 + (0.34 - u) * 1.2) return [255, 255, 255, 1]
    return [37, 99, 235, 1]
  }
}

// ---- badge: chấm đỏ + chữ số trắng (font bitmap 5x7) ----
const GLYPHS = {
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
}

function badgeShader(text) {
  const glyphs = [...text]
  const scale = glyphs.length === 1 ? 0.12 : 0.085 // chiều rộng một ô điểm ảnh theo đơn vị u
  const gap = scale
  const totalW = glyphs.length * 5 * scale + (glyphs.length - 1) * gap
  const totalH = 7 * scale
  const x0 = 0.5 - totalW / 2
  const y0 = 0.5 - totalH / 2
  return (u, v) => {
    if ((u - 0.5) ** 2 + (v - 0.5) ** 2 > 0.48 ** 2) return NONE
    const gy = Math.floor((v - y0) / scale)
    if (gy >= 0 && gy < 7 && u >= x0 && u < x0 + totalW) {
      const rel = u - x0
      const cell = 5 * scale + gap
      const gi = Math.floor(rel / cell)
      const within = rel - gi * cell
      const gx = Math.floor(within / scale)
      if (gi < glyphs.length && gx >= 0 && gx < 5 && GLYPHS[glyphs[gi]][gy][gx] === '#') {
        return [255, 255, 255, 1]
      }
    }
    return [220, 38, 38, 1]
  }
}

const write = (name, buf) => fs.writeFileSync(path.join(outDir, name), buf)
write('icon.png', render(512, appShader(false), 3))
write('tray.png', render(32, appShader(false), 6))
write('tray-unread.png', render(32, appShader(true), 6))
for (let n = 1; n <= 9; n++) write(`badge-${n}.png`, render(32, badgeShader(String(n)), 6))
write('badge-9plus.png', render(32, badgeShader('9+'), 6))
console.log('Đã ghi icon vào', outDir)
