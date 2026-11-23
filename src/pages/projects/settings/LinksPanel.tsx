import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, ExternalLink, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button, Card, Empty, Loadable } from '../../../components/ui'
import { whenLive } from '../../../api/useResource'
import { errText, type ProjectSettings } from '../../../api/projectSettings'
import {
  createLink,
  deleteLink,
  groupLinks,
  LINK_SERVICE_NAME,
  LINK_SERVICE_ORDER,
  LINK_URL_HINT,
  mockCreateLink,
  patchLinkOrder,
  reorderPlan,
  updateLink,
  useProjectLinks,
  type LinkInput,
  type LinkService,
  type ManagedLink,
} from '../../../api/projectLinks'
import { ServiceIcon } from '../common'
import s from './panels.module.css'
import l from './LinksPanel.module.css'

type Props = { settings: ProjectSettings }

/** 설정 › 연동 서비스 (P-11 ~ P-14): 서비스별 묶음으로 링크를 더하고 고치고 순서를 바꾸고 지운다. 프로젝트 관리자만 */
export function LinksPanel({ settings }: Props) {
  const links = useProjectLinks(settings.projectKey)
  const readOnly = settings.status === 'ARCHIVED' || !settings.canManage
  return (
    <Card className={s.card}>
      <header className={s.headRow}>
        <div className={s.head}>
          <h2>연동 서비스</h2>
          <p>프로젝트 개요의 연동 서비스 카드에 보이는 링크예요. 주소를 넣으면 저장소 · 작업 · 파일 · 경로를 알아서 읽어요.</p>
        </div>
      </header>
      <Loadable resource={links} label="연동 서비스">
        {(list) => <LinksBody projectKey={settings.projectKey} list={list} readOnly={readOnly} setList={(f) => links.setData(f)} reload={links.reload} />}
      </Loadable>
    </Card>
  )
}

type BodyProps = {
  projectKey: string
  list: ManagedLink[]
  readOnly: boolean
  setList: (f: (prev: ManagedLink[]) => ManagedLink[]) => void
  reload: () => void
}

function LinksBody({ projectKey, list, readOnly, setList, reload }: BodyProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groups = groupLinks(list)

  /** 실서버면 부르고 다시 읽고, 목업이면 화면 값만 바꾼다 */
  const run = (call: () => Promise<unknown>, local: () => void, after?: () => void) => {
    setBusy(true)
    setError(null)
    whenLive(call)
      .then((r) => {
        if (r === undefined) local()
        else reload()
        after?.()
      })
      .catch((e: unknown) => setError(errText(e, '저장하지 못했어요.')))
      .finally(() => setBusy(false))
  }

  const add = (input: LinkInput) =>
    run(() => createLink(projectKey, input), () => setList((prev) => [...prev, mockCreateLink(input)]), () => setAdding(false))

  const save = (link: ManagedLink, input: LinkInput) =>
    run(
      () => updateLink(projectKey, link.linkId, input),
      () => setList((prev) => prev.map((x) => (x.linkId === link.linkId ? { ...x, url: input.url.trim(), displayName: input.displayName.trim(), description: input.description.trim() || null } : x))),
      () => setEditing(null),
    )

  const remove = (link: ManagedLink) =>
    run(() => deleteLink(projectKey, link.linkId), () => setList((prev) => prev.filter((x) => x.linkId !== link.linkId)), () => setDeleting(null))

  const move = (group: ManagedLink[], link: ManagedLink, dir: -1 | 1) => {
    const plan = reorderPlan(group, link.linkId, dir)
    if (plan.length === 0) return
    run(
      () => Promise.all(plan.map((p) => patchLinkOrder(projectKey, p.linkId, p.displayOrder))),
      () => setList((prev) => prev.map((x) => ({ ...x, displayOrder: plan.find((p) => p.linkId === x.linkId)?.displayOrder ?? x.displayOrder }))),
    )
  }

  return (
    <>
      {error && <p className={s.failText}>{error}</p>}
      {groups.length === 0 && !adding && <Empty>연결한 서비스가 없어요.</Empty>}

      {groups.map((g) => (
        <section key={g.service} className={l.group} aria-label={LINK_SERVICE_NAME[g.service]}>
          <header className={l.groupHead}>
            <span className={l.badge}>{g.service === 'OTHER' ? <Link2 size={16} /> : <ServiceIcon code={g.service} size={16} />}</span>
            <strong>{LINK_SERVICE_NAME[g.service]}</strong>
            <span className={l.count}>{g.items.length}</span>
          </header>
          {g.items.map((link, i) =>
            editing === link.linkId ? (
              <LinkForm
                key={link.linkId}
                initial={{ service: link.service, url: link.url, displayName: link.displayName, description: link.description ?? '' }}
                lockService
                busy={busy}
                onCancel={() => setEditing(null)}
                onSubmit={(input) => save(link, input)}
              />
            ) : (
              <div key={link.linkId} className={l.row}>
                <span className={l.text}>
                  <strong>{link.displayName}</strong>
                  <small>{link.externalRef ?? link.url}</small>
                  {link.description && <small className={l.desc}>{link.description}</small>}
                </span>
                <a className={s.iconBtn} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${link.displayName} 열기`} title="새 탭에서 열기">
                  <ExternalLink size={16} />
                </a>
                {!readOnly &&
                  (deleting === link.linkId ? (
                    <span className={s.confirm}>
                      <span className={s.bad}>지울까요?</span>
                      <Button variant="secondary" className={s.dangerBtn} disabled={busy} onClick={() => remove(link)}>
                        지우기
                      </Button>
                      <button type="button" className={s.iconBtn} onClick={() => setDeleting(null)} aria-label="그만두기">
                        <X size={16} />
                      </button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className={s.iconBtn} disabled={busy || i === 0} onClick={() => move(g.items, link, -1)} aria-label="위로" title="위로">
                        <ArrowUp size={16} />
                      </button>
                      <button type="button" className={s.iconBtn} disabled={busy || i === g.items.length - 1} onClick={() => move(g.items, link, 1)} aria-label="아래로" title="아래로">
                        <ArrowDown size={16} />
                      </button>
                      <button type="button" className={s.iconBtn} disabled={busy} onClick={() => setEditing(link.linkId)} aria-label={`${link.displayName} 고치기`} title="고치기">
                        <Pencil size={16} />
                      </button>
                      <button type="button" className={s.iconBtn} disabled={busy} onClick={() => setDeleting(link.linkId)} aria-label={`${link.displayName} 지우기`} title="지우기">
                        <Trash2 size={16} />
                      </button>
                    </>
                  ))}
              </div>
            ),
          )}
        </section>
      ))}

      {!readOnly &&
        (adding ? (
          <LinkForm initial={{ service: 'GITHUB', url: '', displayName: '', description: '' }} busy={busy} onCancel={() => setAdding(false)} onSubmit={add} />
        ) : (
          <div>
            <Button icon={Plus} variant="secondary" onClick={() => setAdding(true)}>
              연동 서비스 추가
            </Button>
          </div>
        ))}
      {readOnly && <p className={s.hint}>프로젝트 관리자만 바꿀 수 있어요.</p>}
    </>
  )
}

type FormProps = { initial: LinkInput; lockService?: boolean; busy: boolean; onCancel: () => void; onSubmit: (v: LinkInput) => void }

function LinkForm({ initial, lockService, busy, onCancel, onSubmit }: FormProps) {
  const [v, setV] = useState<LinkInput>(initial)
  const set = (p: Partial<LinkInput>) => setV((prev) => ({ ...prev, ...p }))
  const invalid = !v.url.trim() || !v.displayName.trim() || v.displayName.trim().length > 50 || v.url.trim().length > 500 || v.description.length > 200
  return (
    <form
      className={l.form}
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) onSubmit(v)
      }}
    >
      {!lockService && (
        <div className={l.services} role="radiogroup" aria-label="서비스">
          {LINK_SERVICE_ORDER.map((svc: LinkService) => (
            <button key={svc} type="button" role="radio" aria-checked={v.service === svc} className={v.service === svc ? `${s.candidate} ${l.on}` : s.candidate} onClick={() => set({ service: svc })}>
              {v.service === svc && <Check size={14} />} {LINK_SERVICE_NAME[svc]}
            </button>
          ))}
        </div>
      )}
      <label className={s.field}>
        <span className={s.label}>주소</span>
        <span className={s.input}>
          <input value={v.url} placeholder={LINK_URL_HINT[v.service]} onChange={(e) => set({ url: e.target.value })} autoFocus />
        </span>
      </label>
      <div className={s.grid}>
        <label className={s.field}>
          <span className={s.label}>표시 이름</span>
          <span className={s.input}>
            <input value={v.displayName} maxLength={50} placeholder="예: ERP 백엔드" onChange={(e) => set({ displayName: e.target.value })} />
          </span>
        </label>
        <label className={s.field}>
          <span className={s.label}>설명 (선택)</span>
          <span className={s.input}>
            <input value={v.description} maxLength={200} placeholder="예: 운영 배포 작업" onChange={(e) => set({ description: e.target.value })} />
          </span>
        </label>
      </div>
      <div className={s.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" icon={Check} disabled={invalid || busy}>
          {lockService ? '저장' : '추가'}
        </Button>
      </div>
    </form>
  )
}
