import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Notification } from '../components/ui/Notification';
import { UserSidebarCard } from '../components/UserSidebarCard';
import { api } from '../shared/api';
import css from './HomePage.module.css';

type DashboardData = {
  weeklyTonnage: number;
  currentWeight: number;
  bestWeek: { squat: number; bench: number; deadlift: number };
};

type UserProfile = {
  userId?: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
  currentWeight: number;
  followers: number;
  following: number;
};

type Workout = {
  id: string;
  title: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  tonnage: number;
  intensity: 'light' | 'medium' | 'heavy';
  performed_at: string;
  plan_title?: string | null;
};

type Exercise = { id: string; name: string };
type Plan = { id: string; title: string };
type Row = {
  id: string;
  exercise: string;
  sets: string;
  reps: string;
  weight: string;
  intensity: 'light' | 'medium' | 'heavy';
  customName: string;
  useCustom: boolean;
};

const mockFollowingActivity = [
  {
    id: '1',
    icon: '🏋️',
    title: 'Илья Смирнов закрыл тренировку: Присед 5x5',
    meta: '2 часа назад · План: Base Strength'
  },
  {
    id: '2',
    icon: '📝',
    title: 'Анна Ковалева обновила план Peak Week',
    meta: 'Вчера · версия v4'
  },
  {
    id: '3',
    icon: '🔥',
    title: 'Максим Орлов поставил PR в тяге: 245 кг',
    meta: '2 дня назад · Становая тяга'
  },
  {
    id: '4',
    icon: '💬',
    title: 'Екатерина Л. добавила комментарий к плану подопечного',
    meta: '3 дня назад · Coach review'
  }
];

function newRow(defaultExercise = ''): Row {
  return {
    id: crypto.randomUUID(),
    exercise: defaultExercise,
    sets: '5',
    reps: '5',
    weight: '100',
    intensity: 'medium',
    customName: '',
    useCustom: false
  };
}

export function HomePage() {
  const { username } = useParams();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myUsername, setMyUsername] = useState('');
  const [myFollowing, setMyFollowing] = useState<string[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');

  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [newTitle, setNewTitle] = useState('Тренировка');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newPlanId, setNewPlanId] = useState('');
  const [newBodyWeight, setNewBodyWeight] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  const refresh = async () => {
    setError(null);
    try {
      const ownProfile = await api.getProfile();
      setMyUsername(ownProfile.username);
      const followList = await api.listFollowing();
      setMyFollowing(followList.map((f) => f.username));

      if (username && username !== ownProfile.username) {
        const page = await api.getUserPage(username);
        setDashboard(page.dashboard);
        setProfile(page.user);
        setWorkouts(page.workouts);
        setPlans([]);
        setExercises([]);
        return;
      }

      const [d, p, w, pl, ex] = await Promise.all([
        api.dashboard(),
        api.getProfile(),
        api.listWorkouts(),
        api.listPlans(),
        api.listExercises()
      ]);
      setDashboard(d);
      setProfile(p);
      setWorkouts(w);
      setPlans(pl.map((x) => ({ id: x.id, title: x.title })));
      setExercises(ex.map((e) => ({ id: e.id, name: e.name })));
      if (rows.length === 0) setRows([newRow(ex[0]?.name ?? 'Присед')]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  };

  useEffect(() => {
    refresh();
  }, [username]);

  const filteredWorkouts = useMemo(() => {
    const now = Date.now();
    const msLimit =
      dateFilter === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : dateFilter === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : null;

    return workouts.filter((w) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        q.length === 0 ||
        w.title.toLowerCase().includes(q) ||
        w.exercise.toLowerCase().includes(q) ||
        (w.plan_title ?? '').toLowerCase().includes(q);
      const matchesDate = msLimit === null || now - new Date(w.performed_at).getTime() <= msLimit;
      return matchesQuery && matchesDate;
    });
  }, [workouts, query, dateFilter]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        date: string;
        title: string;
        plan: string;
        totalTonnage: number;
        ids: string[];
        exercises: string[];
      }
    >();

    for (const w of filteredWorkouts) {
      const date = new Date(w.performed_at).toISOString().slice(0, 10);
      const key = `${w.title}|${date}|${w.plan_title ?? ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          date,
          title: w.title || w.exercise,
          plan: w.plan_title || 'Без плана',
          totalTonnage: 0,
          ids: [],
          exercises: []
        });
      }
      const g = map.get(key)!;
      g.totalTonnage += Number(w.tonnage ?? w.sets * w.reps * w.weight);
      g.ids.push(w.id);
      g.exercises.push(`${w.exercise} (${w.sets}x${w.reps}x${w.weight})`);
    }

    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredWorkouts]);

  const isOwn = !profile?.username || profile.username === myUsername;
  const isFollowing = Boolean(profile?.username && myFollowing.includes(profile.username));

  const tonnagePreview = rows.reduce(
    (acc, r) => acc + Number(r.sets || 0) * Number(r.reps || 0) * Number(r.weight || 0),
    0
  );

  return (
    <section className={css.page}>
      {error && <Notification tone="error">{error}</Notification>}

      <div className={css.layout}>
        <UserSidebarCard
          email={profile?.email ?? ''}
          username={profile?.username ?? ''}
          firstName={profile?.firstName ?? ''}
          lastName={profile?.lastName ?? ''}
          contacts={profile?.contacts ?? ''}
          city={profile?.city ?? ''}
          weightCategory={profile?.weightCategory ?? ''}
          currentWeight={profile?.currentWeight ?? 0}
          followers={profile?.followers ?? 0}
          following={profile?.following ?? 0}
          isOwn={isOwn}
          isFollowing={isFollowing}
          onToggleFollow={async () => {
            if (!profile?.username) return;
            if (isFollowing) await api.unfollowUser(profile.username);
            else await api.followUser(profile.username);
            await refresh();
          }}
        />

        <div className={css.main}>
          <div className={css.grid}>
            <div className={css.card}>
              <div className={css.title}>Тоннаж на текущей неделе</div>
              <div className={css.value}>{Math.round(dashboard?.weeklyTonnage ?? 0)} кг</div>
            </div>
            <div className={css.card}>
              <div className={css.title}>Актуальный вес</div>
              <div className={css.value}>{dashboard?.currentWeight ?? 0} кг</div>
            </div>
            <div className={css.card}>
              <div className={css.title}>Лучший вес на неделе (жим/присед/тяга)</div>
              <div className={css.value}>
                {dashboard?.bestWeek.bench ?? 0} / {dashboard?.bestWeek.squat ?? 0} /{' '}
                {dashboard?.bestWeek.deadlift ?? 0} кг
              </div>
            </div>
          </div>

          <div className={css.repoBlock}>
            <div className={css.repoToolbar}>
              <input
                className={css.search}
                placeholder="Найти тренировку..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className={css.select}
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'all' | '7d' | '30d')}
              >
                <option value="all">Любая дата</option>
                <option value="7d">Последние 7 дней</option>
                <option value="30d">Последние 30 дней</option>
              </select>
              {isOwn && (
                <div className={css.toolbarActions}>
                  <button
                    className={css.ghostBtn}
                    type="button"
                    onClick={async () => {
                      await api.deleteAllWorkouts();
                      await refresh();
                    }}
                  >
                    Удалить все
                  </button>
                  <button
                    className={css.newBtn}
                    type="button"
                    onClick={() => setShowNewWorkout(true)}
                  >
                    Новая тренировка
                  </button>
                </div>
              )}
            </div>

            {grouped.length === 0 ? (
              <div className={css.repoEmpty}>
                Тренировок пока нет или ничего не найдено по фильтрам.
              </div>
            ) : (
              grouped.map((g) => (
                <div className={css.repoItem} key={g.key}>
                  <div className={css.repoLeft}>
                    <div className={css.repoTitle}>{g.title}</div>
                    <div className={css.repoMeta}>
                      {new Date(g.date).toLocaleDateString()} · План: {g.plan}
                    </div>
                    <div className={css.repoMeta}>{g.exercises.join(' · ')}</div>
                  </div>
                  <div className={css.repoRight}>
                    <div>{Math.round(g.totalTonnage)} кг</div>
                    {isOwn && (
                      <button
                        className={css.deleteBtn}
                        type="button"
                        onClick={async () => {
                          for (const id of g.ids) await api.deleteWorkout(id);
                          await refresh();
                        }}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className={css.activityColumn}>
          <div className={css.activityHeader}>Активность подписок</div>
          <div className={css.activityMonth}>Февраль 2026</div>
          <div className={css.timeline}>
            {mockFollowingActivity.map((item) => (
              <div className={css.activityItem} key={item.id}>
                <div className={css.activityIcon}>{item.icon}</div>
                <div>
                  <div className={css.activityTitle}>{item.title}</div>
                  <div className={css.activityMeta}>{item.meta}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className={css.showMore}>
            Show more activity
          </button>
        </aside>
      </div>

      {isOwn && showNewWorkout && (
        <div className={css.modalOverlay} onClick={() => setShowNewWorkout(false)}>
          <div className={css.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={css.modalHeader}>
              <h3>Новая тренировка</h3>
              <button
                className={css.closeBtn}
                type="button"
                onClick={() => setShowNewWorkout(false)}
              >
                ✕
              </button>
            </div>

            <div className={css.modalTopGrid}>
              <label className={css.field}>
                <span>Название тренировки</span>
                <input
                  className={css.input}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>
              <label className={css.field}>
                <span>Дата</span>
                <input
                  className={css.input}
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </label>
              <label className={css.field}>
                <span>План</span>
                <select
                  className={css.select}
                  value={newPlanId}
                  onChange={(e) => setNewPlanId(e.target.value)}
                >
                  <option value="">Без плана</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className={css.field}>
                <span>Актуальный вес (кг)</span>
                <input
                  className={css.input}
                  value={newBodyWeight}
                  onChange={(e) => setNewBodyWeight(e.target.value)}
                />
              </label>
            </div>

            <div className={css.rowsWrap}>
              {rows.map((r, idx) => (
                <div className={css.exerciseRow} key={r.id}>
                  <label className={css.field}>
                    <span>Упражнение</span>
                    <select
                      className={css.select}
                      value={r.useCustom ? '__custom__' : r.exercise}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id
                              ? {
                                  ...x,
                                  useCustom: val === '__custom__',
                                  exercise: val === '__custom__' ? x.exercise : val
                                }
                              : x
                          )
                        );
                      }}
                    >
                      <option value="">Выбери</option>
                      {exercises.map((e) => (
                        <option key={e.id} value={e.name}>
                          {e.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Кастомное...</option>
                    </select>
                  </label>
                  {r.useCustom ? (
                    <div className={css.customExerciseWrap}>
                      <label className={css.field}>
                        <span>Кастомное упражнение</span>
                        <input
                          className={css.input}
                          value={r.customName}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x.id === r.id ? { ...x, customName: e.target.value } : x
                              )
                            )
                          }
                        />
                      </label>
                      <button
                        className={css.ghostBtn}
                        type="button"
                        onClick={async () => {
                          if (!r.customName.trim()) return;
                          await api.addExercise(r.customName.trim());
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    useCustom: false,
                                    exercise: r.customName.trim(),
                                    customName: ''
                                  }
                                : x
                            )
                          );
                          await refresh();
                        }}
                      >
                        Создать
                      </button>
                    </div>
                  ) : null}

                  <label className={css.field}>
                    <span>Подходы</span>
                    <input
                      className={css.input}
                      value={r.sets}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, sets: e.target.value } : x))
                        )
                      }
                    />
                  </label>
                  <label className={css.field}>
                    <span>Повторы</span>
                    <input
                      className={css.input}
                      value={r.reps}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, reps: e.target.value } : x))
                        )
                      }
                    />
                  </label>
                  <label className={css.field}>
                    <span>Вес</span>
                    <input
                      className={css.input}
                      value={r.weight}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.id === r.id ? { ...x, weight: e.target.value } : x))
                        )
                      }
                    />
                  </label>
                  <label className={css.field}>
                    <span>Нагрузка</span>
                    <select
                      className={css.select}
                      value={r.intensity}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) =>
                            x.id === r.id
                              ? { ...x, intensity: e.target.value as Row['intensity'] }
                              : x
                          )
                        )
                      }
                    >
                      <option value="light">Лёгкая</option>
                      <option value="medium">Средняя</option>
                      <option value="heavy">Тяжёлая</option>
                    </select>
                  </label>
                  <button
                    className={css.deleteBtn}
                    type="button"
                    onClick={() =>
                      setRows((prev) =>
                        prev.length > 1 ? prev.filter((x) => x.id !== r.id) : prev
                      )
                    }
                  >
                    Убрать
                  </button>
                  <div className={css.rowTonnage}>
                    Тоннаж: {Number(r.sets || 0) * Number(r.reps || 0) * Number(r.weight || 0)} кг
                  </div>
                  <div className={css.rowIndex}>#{idx + 1}</div>
                </div>
              ))}
            </div>

            <div className={css.modalFooter}>
              <button
                className={css.ghostBtn}
                type="button"
                onClick={() => setRows((prev) => [...prev, newRow(exercises[0]?.name ?? '')])}
              >
                + Упражнение
              </button>
              <div className={css.tonnagePreview}>Общий тоннаж: {tonnagePreview} кг</div>
              <button
                className={css.newBtn}
                type="button"
                onClick={async () => {
                  for (const r of rows) {
                    if (!r.exercise) continue;
                    await api.createWorkout({
                      title: newTitle,
                      exercise: r.exercise,
                      sets: Number(r.sets),
                      reps: Number(r.reps),
                      weight: Number(r.weight),
                      intensity: r.intensity,
                      currentBodyWeight: newBodyWeight ? Number(newBodyWeight) : undefined,
                      planId: newPlanId || undefined,
                      performedAt: new Date(newDate).toISOString()
                    });
                  }
                  await refresh();
                  setShowNewWorkout(false);
                }}
              >
                Сохранить тренировку
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
