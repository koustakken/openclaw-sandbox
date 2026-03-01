import { useEffect, useMemo, useRef, useState } from 'react';
import { Notification } from '../components/ui/Notification';
import { api } from '../shared/api';
import css from './PlansPage.module.css';

type Plan = {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'active' | 'archived';
  version: number;
  role: 'owner' | 'editor';
  updated_at: string;
};

type Editor = {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  addedAt: string;
};

type Invitation = {
  id: string;
  planId: string;
  planTitle: string;
  ownerUsername: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

type PlanMessage = {
  id: string;
  authorUsername: string;
  text: string;
  createdAt: string;
};

type PlanActivity = {
  id: string;
  actorUsername: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
};

function formatEventText(eventType: string, payloadJson: string) {
  let payload: Record<string, unknown> = {};
  try {
    payload = payloadJson ? (JSON.parse(payloadJson) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  if (eventType === 'plan.created') return 'создал план';
  if (eventType === 'plan.updated') {
    const title = typeof payload.title === 'string' ? payload.title : '';
    return title ? `обновил план «${title}»` : 'обновил план';
  }
  if (eventType === 'plan.editor_invited') {
    const username = typeof payload.username === 'string' ? payload.username : '';
    return username ? `пригласил редактора @${username}` : 'пригласил редактора';
  }
  if (eventType === 'plan.editor_accepted') return 'принял приглашение в редакторы';
  if (eventType === 'plan.editor_rejected') return 'отклонил приглашение';
  if (eventType === 'plan.editor_removed') {
    const editorId = typeof payload.editorId === 'string' ? payload.editorId : '';
    return editorId ? `убрал редактора (${editorId.slice(0, 8)}...)` : 'убрал редактора';
  }
  if (eventType === 'plan.comment_added') return 'оставил сообщение в обсуждении';

  return eventType;
}

function formatPlanStatus(status: Plan['status']) {
  if (status === 'draft') return 'Черновик';
  if (status === 'active') return 'Активный';
  return 'Архив';
}

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [editors, setEditors] = useState<Editor[]>([]);
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [activity, setActivity] = useState<PlanActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [inviteUsername, setInviteUsername] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => plans.find((x) => x.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const loadBase = async () => {
    setError(null);
    try {
      const [planList, inv, me] = await Promise.all([
        api.listPlans(),
        api.listPlanInvitations(),
        api.getProfile()
      ]);
      setMyUsername(me.username);
      const normalizedPlans = planList.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        status: p.status as 'draft' | 'active' | 'archived',
        version: p.version,
        role: p.role,
        updated_at: p.updated_at
      }));
      setPlans(normalizedPlans);
      setInvitations(
        inv.map((x) => ({
          id: x.id,
          planId: x.planId,
          planTitle: x.planTitle,
          ownerUsername: x.ownerUsername,
          status: x.status,
          createdAt: x.createdAt
        }))
      );
      if (!selectedPlanId && normalizedPlans[0]) {
        setSelectedPlanId(normalizedPlans[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить планы');
    }
  };

  const loadPlanDetails = async (planId: string) => {
    try {
      const [plan, eds, msgs, act] = await Promise.all([
        api.getPlan(planId),
        api.listPlanEditors(planId),
        api.listPlanMessages(planId),
        api.listPlanActivity(planId)
      ]);

      setTitle(plan.title);
      setContent(plan.content);
      setStatus(plan.status);
      setEditors(eds);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          authorUsername: m.authorUsername,
          text: m.text,
          createdAt: m.createdAt
        }))
      );
      setActivity(
        act.map((a) => ({
          id: a.id,
          actorUsername: a.actorUsername,
          eventType: a.eventType,
          payloadJson: a.payloadJson,
          createdAt: a.createdAt
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить детали плана');
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (selectedPlanId) loadPlanDetails(selectedPlanId);
  }, [selectedPlanId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className={css.page}>
      {error && <Notification tone="error">{error}</Notification>}

      {invitations.some((x) => x.status === 'pending') && (
        <div className={css.invitesBlock}>
          <h3>Входящие приглашения</h3>
          {invitations
            .filter((x) => x.status === 'pending')
            .map((inv) => (
              <div key={inv.id} className={css.inviteRow}>
                <div>
                  <strong>{inv.planTitle}</strong> · от @{inv.ownerUsername}
                </div>
                <div className={css.rowActions}>
                  <button
                    className={css.acceptBtn}
                    type="button"
                    onClick={async () => {
                      await api.acceptPlanInvitation(inv.id);
                      await loadBase();
                    }}
                  >
                    Принять
                  </button>
                  <button
                    className={css.ghostBtn}
                    type="button"
                    onClick={async () => {
                      await api.rejectPlanInvitation(inv.id);
                      await loadBase();
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      <div className={css.layout}>
        <aside className={css.left}>
          <div className={css.leftHeader}>
            <h3>Планы</h3>
            <button
              className={css.newBtn}
              type="button"
              onClick={async () => {
                const created = (await api.createPlan({
                  title: `Новый план ${new Date().toLocaleDateString('ru-RU')}`,
                  content: 'Опиши структуру плана: дни, упражнения, объём, интенсивность.',
                  status: 'draft'
                })) as { id: string };
                await loadBase();
                setSelectedPlanId(created.id);
              }}
            >
              + Новый
            </button>
          </div>
          {plans.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`${css.planItem} ${selectedPlanId === p.id ? css.planItemActive : ''}`}
              onClick={() => setSelectedPlanId(p.id)}
            >
              <div className={css.planTop}>
                <strong>{p.title}</strong>
                <span
                  className={`${css.roleBadge} ${p.role === 'owner' ? css.roleOwner : css.roleEditor}`}
                >
                  {p.role === 'owner' ? 'Owner' : 'Editor'}
                </span>
              </div>
              <div className={css.planMetaRow}>
                <span className={`${css.statusBadge} ${css[`status_${p.status}`]}`}>
                  {formatPlanStatus(p.status)}
                </span>
                <span className={css.meta}>v{p.version}</span>
                <span className={css.meta}>
                  {new Date(p.updated_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </button>
          ))}
        </aside>

        <div className={css.main}>
          {!selected ? (
            <div className={css.empty}>Выбери план слева</div>
          ) : (
            <>
              <div className={css.card}>
                <h3>Overview</h3>
                <div className={css.formGrid}>
                  <label>
                    <span>Название</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </label>
                  <label>
                    <span>Статус</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Plan['status'])}
                    >
                      <option value="draft">Черновик</option>
                      <option value="active">Активный</option>
                      <option value="archived">Архив</option>
                    </select>
                  </label>
                  <label className={css.full}>
                    <span>Содержимое</span>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                    />
                  </label>
                </div>
                <div className={css.rowActions}>
                  <button
                    className={css.saveBtn}
                    type="button"
                    onClick={async () => {
                      await api.updatePlan(selected.id, { title, content, status });
                      await loadBase();
                      await loadPlanDetails(selected.id);
                    }}
                  >
                    Сохранить
                  </button>
                  {selected.role === 'owner' && (
                    <button
                      className={css.deleteBtn}
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Удалить план
                    </button>
                  )}
                </div>
              </div>

              <div className={css.card}>
                <h3>Редакторы</h3>
                {selected.role === 'owner' && (
                  <div className={css.ownerBadge}>Ты владелец этого плана</div>
                )}
                <div className={css.editorList}>
                  {editors.length === 0 ? (
                    <div className={css.meta}>Пока нет приглашённых редакторов</div>
                  ) : (
                    editors.map((e) => (
                      <div key={e.userId} className={css.editorRow}>
                        <div>
                          @{e.username || e.userId}
                          {e.username === myUsername && (
                            <span className={css.selfBadge}> · это ты</span>
                          )}
                        </div>
                        {selected.role === 'owner' && e.username !== myUsername && (
                          <button
                            className={css.deleteBtn}
                            type="button"
                            onClick={async () => {
                              await api.removePlanEditor(selected.id, e.userId);
                              await loadPlanDetails(selected.id);
                            }}
                          >
                            Убрать
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {selected.role === 'owner' && (
                  <div className={css.rowActions}>
                    <input
                      placeholder="username"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                    />
                    <button
                      className={css.ghostBtn}
                      type="button"
                      onClick={async () => {
                        if (!inviteUsername.trim()) return;
                        await api.invitePlanEditor(selected.id, inviteUsername.trim());
                        setInviteUsername('');
                        await loadPlanDetails(selected.id);
                      }}
                    >
                      Пригласить
                    </button>
                  </div>
                )}
              </div>

              <div className={css.card}>
                <h3>Conversations</h3>
                <div className={css.feedScrollable}>
                  <div className={css.feed}>
                    {messages.length === 0 && <div className={css.meta}>Пока нет сообщений</div>}
                    {messages.map((m) => (
                      <div key={m.id} className={css.feedRow}>
                        <div className={css.feedMeta}>
                          @{m.authorUsername} · {new Date(m.createdAt).toLocaleString('ru-RU')}
                        </div>
                        <div>{m.text}</div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <div className={css.rowActions}>
                  <input
                    className={css.flex}
                    placeholder="Добавить сообщение..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button
                    className={css.ghostBtn}
                    type="button"
                    onClick={async () => {
                      if (!newMessage.trim()) return;
                      await api.addPlanMessage(selected.id, newMessage.trim());
                      setNewMessage('');
                      await loadPlanDetails(selected.id);
                    }}
                  >
                    Отправить
                  </button>
                </div>
              </div>

              <div className={css.card}>
                <h3>Activity</h3>
                <div className={css.feed}>
                  {activity.length === 0 && <div className={css.meta}>Пока нет событий</div>}
                  {activity.map((a) => (
                    <div key={a.id} className={css.feedRow}>
                      <div className={css.feedMeta}>
                        @{a.actorUsername} · {new Date(a.createdAt).toLocaleString('ru-RU')}
                      </div>
                      <div>{formatEventText(a.eventType, a.payloadJson)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && selected && (
        <div className={css.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={css.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3>Удалить план?</h3>
            <p>План «{selected.title}» будет удалён без возможности восстановления.</p>
            <div className={css.rowActions}>
              <button
                className={css.ghostBtn}
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Отмена
              </button>
              <button
                className={css.deleteBtn}
                type="button"
                onClick={async () => {
                  await api.deletePlan(selected.id);
                  setShowDeleteConfirm(false);
                  setSelectedPlanId('');
                  await loadBase();
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
