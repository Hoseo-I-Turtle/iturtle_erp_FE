/** 프로젝트 설정 왼쪽 메뉴 항목 (디자인: 프로젝트 설정 · 일반 · 참여자 · 라벨 · 보관 · 삭제) */
export const SETTINGS_MENU = ['일반', '참여자', '라벨', '서비스 권한', '보관 · 삭제'] as const
export type SettingsMenuItem = (typeof SETTINGS_MENU)[number]

/** 주소 ?tab= 값 ↔ 메뉴 */
export const MENU_TAB: Record<SettingsMenuItem, string> = {
  일반: 'general',
  참여자: 'members',
  라벨: 'labels',
  '서비스 권한': 'service',
  '보관 · 삭제': 'archive',
}
export const menuOfTab = (tab: string | null): SettingsMenuItem =>
  (Object.entries(MENU_TAB).find(([, t]) => t === tab)?.[0] as SettingsMenuItem | undefined) ?? '일반'
