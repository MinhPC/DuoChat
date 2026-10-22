import fs from 'node:fs'
import path from 'node:path'
import {
  ACCOUNT_PALETTE,
  ACCOUNT_SOUNDS,
  PREVIEW_MODES,
  AUTO_LOCK_OPTIONS,
  MAX_ZOOM,
  MIN_ZOOM,
  type Account,
  type AccountSound,
  type DndSchedule,
  type LockSettings,
  type PreviewMode,
  type LayoutSettings,
  type Settings,
} from '../shared/types'
import { clampRatio } from './layout'
import { isAvatarDataUrl } from './profile'

export const CURRENT_SCHEMA_VERSION = 3

export function defaultSettings(): Settings {
  return {
    schemaVersion: 3,
    accounts: [],
    layout: {
      mode: 'single',
      activeAccountId: null,
      leftAccountId: null,
      rightAccountId: null,
      splitRatio: 0.5,
      focusedPane: 'left',
    },
    startWithWindows: false,
    startMinimized: true,
    minimizeToTray: true,
    zoomFactor: 1,
    notifyPreview: false,
    autoUpdate: false,
    lock: { enabled: false, salt: '', hash: '', autoLockMinutes: 5 },
    window: { width: 1280, height: 800, maximized: false },
    pendingPartitionCleanup: [],
  }
}

export const DEFAULT_DND: DndSchedule = { enabled: false, from: '22:00', to: '07:00' }
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/**
 * Schema v1 (chưa phát hành, chỉ để đảm bảo đường nâng cấp): không có layout/split, muted,
 * startMinimized, zoomFactor, pendingPartitionCleanup. Account hiện tại nằm ở `activeAccountId`.
 */
function migrateV1ToV2(raw: Json): Json {
  const d = defaultSettings()
  const accounts = Array.isArray(raw.accounts)
    ? raw.accounts.map((a) => (isObj(a) ? { muted: false, ...a } : a))
    : []
  return {
    ...raw,
    schemaVersion: 2,
    accounts,
    layout: { ...d.layout, mode: 'single', activeAccountId: raw.activeAccountId ?? null },
    startMinimized: d.startMinimized,
    zoomFactor: d.zoomFactor,
    pendingPartitionCleanup: [],
  }
}

/** v2 → v3: thêm `Account.avatar` (tùy chọn). normalize lo phần còn lại nên chỉ cần đổi số phiên bản. */
function migrateV2ToV3(raw: Json): Json {
  return { ...raw, schemaVersion: 3 }
}

/** Nhận JSON bất kỳ (kể cả rác) và trả về Settings v3 hợp lệ. */
export function migrate(raw: unknown): Settings {
  if (!isObj(raw)) return defaultSettings()
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1
  let cur: Json = raw
  if (version < 2) cur = migrateV1ToV2(cur)
  if (version < 3) cur = migrateV2ToV3(cur)
  // Phiên bản mới hơn app: đọc theo khả năng, normalize sẽ loại field lạ.
  return normalizeSettings(cur)
}

function normalizeAccounts(input: unknown): Account[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const list: { acc: Account; idx: number }[] = []
  input.forEach((a, idx) => {
    if (!isObj(a)) return
    const id = str(a.id)
    if (!id || seen.has(id)) return
    seen.add(id)
    const color = str(a.color)
    list.push({
      idx,
      acc: {
        id,
        name: str(a.name) ?? 'Tài khoản',
        color:
          color && (ACCOUNT_PALETTE as readonly string[]).includes(color)
            ? color
            : ACCOUNT_PALETTE[0],
        order: num(a.order, idx),
        muted: bool(a.muted, false),
        sound: (ACCOUNT_SOUNDS as readonly unknown[]).includes(a.sound)
          ? (a.sound as AccountSound)
          : 'default',
        dnd: normalizeDnd(a.dnd),
        preview: (PREVIEW_MODES as readonly unknown[]).includes(a.preview)
          ? (a.preview as PreviewMode)
          : 'default',
        ...(isAvatarDataUrl(a.avatar) ? { avatar: a.avatar } : {}),
        createdAt: str(a.createdAt) ?? new Date(0).toISOString(),
      },
    })
  })
  list.sort((x, y) => x.acc.order - y.acc.order || x.idx - y.idx)
  return list.map((x, i) => ({ ...x.acc, order: i }))
}

function normalizeDnd(v: unknown): DndSchedule {
  if (!isObj(v)) return { ...DEFAULT_DND }
  return {
    enabled: bool(v.enabled, false),
    from: typeof v.from === 'string' && TIME_RE.test(v.from) ? v.from : DEFAULT_DND.from,
    to: typeof v.to === 'string' && TIME_RE.test(v.to) ? v.to : DEFAULT_DND.to,
  }
}

function normalizeLock(v: unknown): LockSettings {
  const l = isObj(v) ? v : {}
  const salt = typeof l.salt === 'string' ? l.salt : ''
  const hash = typeof l.hash === 'string' ? l.hash : ''
  const minutes = (AUTO_LOCK_OPTIONS as readonly unknown[]).includes(l.autoLockMinutes)
    ? (l.autoLockMinutes as number)
    : 5
  // Bật khóa mà thiếu salt/hash thì coi như chưa bật (tránh tự khóa app không thể mở).
  return {
    enabled: bool(l.enabled, false) && salt !== '' && hash !== '',
    salt,
    hash,
    autoLockMinutes: minutes,
  }
}

function normalizeLayout(input: unknown, accounts: Account[]): LayoutSettings {
  const d = defaultSettings().layout
  const l = isObj(input) ? input : {}
  const ids = new Set(accounts.map((a) => a.id))
  const valid = (v: unknown): string | null => (typeof v === 'string' && ids.has(v) ? v : null)
  const first = accounts[0]?.id ?? null

  const active = valid(l.activeAccountId) ?? first
  let left = valid(l.leftAccountId)
  let right = valid(l.rightAccountId)
  let mode: LayoutSettings['mode'] = l.mode === 'split' ? 'split' : 'single'
  const focusedPane = l.focusedPane === 'right' ? 'right' : 'left'

  if (mode === 'split') {
    if (accounts.length < 2) {
      mode = 'single'
    } else {
      left = left ?? active ?? first
      if (right === null || right === left) {
        right = accounts.find((a) => a.id !== left)?.id ?? null
      }
      if (left === right) mode = 'single' // phòng hờ
    }
  } else if (left !== null && left === right) {
    right = null
  }
  return {
    mode,
    activeAccountId: active,
    leftAccountId: left,
    rightAccountId: right,
    splitRatio: clampRatio(num(l.splitRatio, d.splitRatio)),
    focusedPane,
  }
}

export function normalizeSettings(input: Json): Settings {
  const d = defaultSettings()
  const accounts = normalizeAccounts(input.accounts)
  const w = isObj(input.window) ? input.window : {}
  const liveIds = new Set(accounts.map((a) => a.id))
  const pending = Array.isArray(input.pendingPartitionCleanup)
    ? [...new Set(input.pendingPartitionCleanup.filter((x): x is string => typeof x === 'string'))]
    : []
  return {
    schemaVersion: 3,
    accounts,
    layout: normalizeLayout(input.layout, accounts),
    startWithWindows: bool(input.startWithWindows, d.startWithWindows),
    startMinimized: bool(input.startMinimized, d.startMinimized),
    minimizeToTray: bool(input.minimizeToTray, d.minimizeToTray),
    notifyPreview: bool(input.notifyPreview, d.notifyPreview),
    autoUpdate: bool(input.autoUpdate, d.autoUpdate),
    lock: normalizeLock(input.lock),
    zoomFactor: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, num(input.zoomFactor, d.zoomFactor))),
    window: {
      x: typeof w.x === 'number' ? w.x : undefined,
      y: typeof w.y === 'number' ? w.y : undefined,
      width: Math.max(480, num(w.width, d.window.width)),
      height: Math.max(360, num(w.height, d.window.height)),
      maximized: bool(w.maximized, false),
    },
    // Không bao giờ xóa partition của account còn sống.
    pendingPartitionCleanup: pending.filter((id) => !liveIds.has(id)),
  }
}

export function readSettingsFile(file: string): Settings {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return defaultSettings()
  }
  try {
    return migrate(JSON.parse(text))
  } catch {
    // File hỏng: giữ lại bản sao để người dùng cứu dữ liệu rồi bắt đầu lại.
    try {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}`)
    } catch {
      /* bỏ qua */
    }
    return defaultSettings()
  }
}

/** Ghi atomic: ghi file tạm cùng thư mục rồi rename. */
export function writeSettingsFile(file: string, settings: Settings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

type Listener = (s: Settings) => void

/** Giữ settings trong bộ nhớ, tự chuẩn hóa mỗi lần sửa, ghi đĩa có debounce. */
export class SettingsStore {
  private current: Settings
  private timer: NodeJS.Timeout | null = null
  private listeners = new Set<Listener>()

  constructor(
    private readonly file: string,
    private readonly debounceMs = 300,
  ) {
    this.current = readSettingsFile(file)
  }

  get(): Settings {
    return this.current
  }

  update(fn: (draft: Settings) => Settings): Settings {
    this.current = normalizeSettings(fn(structuredClone(this.current)) as unknown as Json)
    this.schedule()
    for (const l of this.listeners) l(this.current)
    return this.current
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    writeSettingsFile(this.file, this.current)
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }
}
