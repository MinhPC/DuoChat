/**
 * Parser title → số tin chưa đọc (hàm thuần).
 * Format title thật chưa kiểm chứng (xem docs/spike-windows.md), nên nhận vài kiểu phổ biến.
 * Trả về null nếu title không chứa số.
 */
export function parseUnreadFromTitle(title: string): number | null {
  const t = title.trim()
  // "(3) Zalo", "(12+) Zalo", "[3] Zalo"
  const prefix = /^[([]\s*(\d{1,4})\s*\+?\s*[)\]]/.exec(t)
  if (prefix) return Number(prefix[1])
  // "Zalo (3)", "Zalo [3]"
  const suffix = /[([]\s*(\d{1,4})\s*\+?\s*[)\]]\s*$/.exec(t)
  if (suffix) return Number(suffix[1])
  // "3 tin nhắn mới", "3 tin nhắn chưa đọc"
  const words = /^(\d{1,4})\s+tin\s+nh[ắa]n/i.exec(t)
  if (words) return Number(words[1])
  return null
}

export interface UnreadTracking {
  /** Giá trị parse từ title gần nhất (null nếu title không có số). */
  titleCount: number | null
  /** Title của account này đã từng chứa số chưa? Nếu có thì tin title, null nghĩa là 0. */
  titleEverHadCount: boolean
  /** Số thông báo nhận được kể từ lần cuối account được focus. */
  notificationCount: number
}

export function emptyTracking(): UnreadTracking {
  return { titleCount: null, titleEverHadCount: false, notificationCount: 0 }
}

export function applyTitle(state: UnreadTracking, title: string): UnreadTracking {
  const count = parseUnreadFromTitle(title)
  return {
    ...state,
    titleCount: count,
    titleEverHadCount: state.titleEverHadCount || count !== null,
    // Title có số thì nguồn đáng tin hơn bộ đếm thông báo.
    notificationCount: count !== null ? 0 : state.notificationCount,
  }
}

export function applyNotification(state: UnreadTracking): UnreadTracking {
  return { ...state, notificationCount: state.notificationCount + 1 }
}

export function applyFocus(state: UnreadTracking): UnreadTracking {
  return { ...state, notificationCount: 0 }
}

export function displayedUnread(state: UnreadTracking): number {
  if (state.titleEverHadCount) return state.titleCount ?? 0
  return state.notificationCount
}
