import { SETTINGS_MENU, type SettingsMenuItem } from './menu'
import s from '../ProjectSettingsPage.module.css'

/** 설정 왼쪽 메뉴 */
export function SettingsMenu({ value, onChange }: { value: SettingsMenuItem; onChange: (m: SettingsMenuItem) => void }) {
  return (
    <nav className={s.menu}>
      {SETTINGS_MENU.map((m) => (
        <button key={m} type="button" className={m === value ? `${s.menuItem} ${s.menuOn}` : s.menuItem} onClick={() => onChange(m)}>
          {m}
        </button>
      ))}
    </nav>
  )
}
