import { Copy, Lock } from 'lucide-react'
import { Button } from '../../../components/ui'
import s from '../CodesPage.module.css'

const masked = (v: string) => v.slice(0, 8) + '•'.repeat(Math.max(0, v.length - 12)) + v.slice(-4)

/** 새로 발급한 client secret (한 번만 보임) */
export function SecretBox({ secret, copied, onCopy }: { secret: { app: string; value: string }; copied: boolean; onCopy: () => void }) {
  return (
    <div className={s.secret}>
        <strong>
          <Lock size={16} /> {secret.app} 의 새 client secret
        </strong>
        <div className={s.secretBox}>
          <code>{masked(secret.value)}</code>
          <Button
            variant="tint"
            icon={Copy}
            onClick={onCopy}
          >
            {copied ? '복사함' : '복사'}
          </Button>
        </div>
        <small>
          이 값은 지금 한 번만 보여요. 서버에는 해시만 저장하고, 감사 로그에도 값을 남기지 않아요. {secret.app} 설정도 함께 바꿔 주세요.
        </small>
      </div>
  )
}
