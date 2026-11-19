/** 프로젝트 설정 왼쪽 메뉴 항목 */
export const SETTINGS_MENU = ['일반', '참여자', '라벨', '연동 서비스', '서비스 권한', '보관 · 삭제'] as const
export type SettingsMenuItem = (typeof SETTINGS_MENU)[number]
