import { useEffect, useMemo, useState } from 'react';
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

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [editors, setEditors] = useState<Editor[]>([]);
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [activity, setActivity] = useState<PlanActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [inviteUsername, setInviteUsername] = useState('');
  const [newMessage, setNewMessage] = useState('');

  const selected = useMemo(
    () => plans.find((x) => x.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const loadBase = async () => {
    setError(null);
    try {
      const [planList, inv] = await Promise.all([api.listPlans(), api.listPlanInvitations()]);
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
          <h3>Планы</h3>
          {plans.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`${css.planItem} ${selectedPlanId === p.id ? css.planItemActive : ''}`}
              onClick={() => setSelectedPlanId(p.id)}
            >
              <div className={css.planTop}>
                <strong>{p.title}</strong>
                <span className={css.role}>{p.role === 'owner' ? 'Owner' : 'Editor'}</span>
              </div>
              <div className={css.meta}>
                v{p.version} · {new Date(p.updated_at).toLocaleDateString()}
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
                      onClick={async () => {
                        if (!confirm('Удалить план?')) return;
                        await api.deletePlan(selected.id);
                        setSelectedPlanId('');
                        await loadBase();
                      }}
                    >
                      Удалить план
                    </button>
                  )}
                </div>
              </div>

              <div className={css.card}>
                <h3>Редакторы</h3>
                <div className={css.editorList}>
                  {editors.map((e) => (
                    <div key={e.userId} className={css.editorRow}>
                      <div>@{e.username || e.userId}</div>
                      {selected.role === 'owner' && (
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
                  ))}
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
                <div className={css.feed}>
                  {messages.map((m) => (
                    <div key={m.id} className={css.feedRow}>
                      <div className={css.feedMeta}>
                        @{m.authorUsername} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                      <div>{m.text}</div>
                    </div>
                  ))}
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
                  {activity.map((a) => (
                    <div key={a.id} className={css.feedRow}>
                      <div className={css.feedMeta}>
                        @{a.actorUsername} · {new Date(a.createdAt).toLocaleString()}
                      </div>
                      <div>{a.eventType}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
