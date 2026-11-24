import { useTheme } from '../../lib/theme'

/**
 * iturtle 로고: 거북이(mark) + 글자(wordmark).
 * 테마가 로고 그림을 따로 정했으면(lib/theme.ts 의 logoMark) 거북이 자리에 그 그림을 쓴다 (글자는 그대로).
 * onDark: 어두운 바탕용 흰 로고 / 아니면 밝은 바탕용 남색 로고
 * height: 거북이 높이(px). 글자는 그 2/3, 간격은 기본 height × 0.4
 */
export function BrandLogo({
  onDark = true,
  height = 48,
  gap,
  className,
}: {
  onDark?: boolean
  height?: number
  gap?: number
  className?: string
}) {
  const suffix = onDark ? '' : '-dark'
  const themed = useTheme().info.logoMark
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: gap ?? Math.round(height * 0.4) }}
    >
      <img src={themed ?? `/brand/iturtle-mark${suffix}.png`} alt="" style={{ height, width: 'auto', display: 'block' }} />
      <img
        src={`/brand/iturtle-wordmark${suffix}.png`}
        alt="iturtle"
        style={{ height: Math.round((height * 2) / 3), width: 'auto', display: 'block' }}
      />
    </span>
  )
}
