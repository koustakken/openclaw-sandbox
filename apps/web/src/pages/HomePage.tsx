import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Notification } from '../components/ui/Notification';
import { UserSidebarCard } from '../components/UserSidebarCard';
import { api } from '../shared/api';
import css from './HomePage.module.css';

type DashboardData = {
  stats: { exercise: string; bestWeight: number }[];
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
  body_weight?: number | null;
  notes?: string;
  performed_at: string;
  plan_id?: string | null;
  plan_title?: string | null;
};

type Plan = { id: string; title: string };
type Exercise = { id: string; name: string; isBase: boolean };

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

export function HomePage() {
  const { username } = useParams();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myUsername, setMyUsername] = useState('');
  const [myFollowing, setMyFollowing] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');
  const [showNewWorkout, setShowNewWorkout] = useState(false);

  const [newTitle, setNewTitle] = useState('Тренировка');
  const [newExercise, setNewExercise] = useState('');
  const [customExercise, setCustomExercise] = useState('');
  const [newSets, setNewSets] = useState('5');
  const [newReps, setNewReps] = useState('5');
  const [newWeight, setNewWeight] = useState('100');
  const [newIntensity, setNewIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [newBodyWeight, setNewBodyWeight] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

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
      setExercises(ex);
      if (ex.length > 0) setNewExercise((prev) => prev || ex[0].name);
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
      const matchesQuery =
        query.trim().length === 0 ||
        w.exercise.toLowerCase().includes(query.toLowerCase()) ||
        (w.plan_title ?? '').toLowerCase().includes(query.toLowerCase());
      const matchesDate = msLimit === null || now - new Date(w.performed_at).getTime() <= msLimit;
      return matchesQuery && matchesDate;
    });
  }, [workouts, query, dateFilter]);

  const isOwn = !profile?.username || profile.username === myUsername;
  const isFollowing = Boolean(profile?.username && myFollowing.includes(profile.username));

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
                <button
                  className={css.newBtn}
                  type="button"
                  onClick={() => setShowNewWorkout((v) => !v)}
                >
                  {showNewWorkout ? 'Закрыть' : 'Новая тренировка'}
                </button>
              )}
            </div>

            {isOwn && showNewWorkout && (
              <div className={css.newWorkoutForm}>
                <input
                  className={css.input}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Название тренировки"
                />
                <input
                  className={css.input}
                  value={customExercise}
                  onChange={(e) => setCustomExercise(e.target.value)}
                  placeholder="Кастомное упражнение"
                />
                <button
                  className={css.ghostBtn}
                  type="button"
                  onClick={async () => {
                    if (!customExercise.trim()) return;
                    await api.addExercise(customExercise.trim());
                    setNewExercise(customExercise.trim());
                    setCustomExercise('');
                    await refresh();
                  }}
                >
                  + Добавить упражнение
                </button>

                <select
                  className={css.select}
                  value={newExercise}
                  onChange={(e) => setNewExercise(e.target.value)}
                >
                  {exercises.map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <input
                  className={css.input}
                  value={newSets}
                  onChange={(e) => setNewSets(e.target.value)}
                  placeholder="Подходы"
                />
                <input
                  className={css.input}
                  value={newReps}
                  onChange={(e) => setNewReps(e.target.value)}
                  placeholder="Повторы"
                />
                <input
                  className={css.input}
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="Вес"
                />
                <select
                  className={css.select}
                  value={newIntensity}
                  onChange={(e) => setNewIntensity(e.target.value as 'light' | 'medium' | 'heavy')}
                >
                  <option value="light">Лёгкая</option>
                  <option value="medium">Средняя</option>
                  <option value="heavy">Тяжёлая</option>
                </select>
                <input
                  className={css.input}
                  value={newBodyWeight}
                  onChange={(e) => setNewBodyWeight(e.target.value)}
                  placeholder="Актуальный вес (кг)"
                />
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
                <input
                  className={css.input}
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
                <div className={css.tonnagePreview}>
                  Тоннаж: {Number(newSets || 0) * Number(newReps || 0) * Number(newWeight || 0)} кг
                </div>
                <button
                  className={css.newBtn}
                  type="button"
                  onClick={async () => {
                    await api.createWorkout({
                      title: newTitle,
                      exercise: newExercise,
                      sets: Number(newSets),
                      reps: Number(newReps),
                      weight: Number(newWeight),
                      intensity: newIntensity,
                      currentBodyWeight: newBodyWeight ? Number(newBodyWeight) : undefined,
                      planId: newPlanId || undefined,
                      performedAt: new Date(newDate).toISOString()
                    });
                    await refresh();
                    setShowNewWorkout(false);
                  }}
                >
                  Добавить
                </button>
              </div>
            )}

            {filteredWorkouts.length === 0 ? (
              <div className={css.repoEmpty}>
                Тренировок пока нет или ничего не найдено по фильтрам.
              </div>
            ) : (
              filteredWorkouts.map((w) => (
                <div className={css.repoItem} key={w.id}>
                  <div className={css.repoLeft}>
                    <div className={css.repoTitle}>{w.title || w.exercise}</div>
                    <div className={css.repoMeta}>
                      {new Date(w.performed_at).toLocaleDateString()} · {w.exercise} · План:{' '}
                      {w.plan_title || 'Без плана'} · Нагрузка:{' '}
                      {w.intensity === 'heavy'
                        ? 'Тяжёлая'
                        : w.intensity === 'medium'
                          ? 'Средняя'
                          : 'Лёгкая'}
                    </div>
                  </div>
                  <div className={css.repoRight}>
                    {Math.round(w.tonnage ?? w.sets * w.reps * w.weight)} кг
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
    </section>
  );
}
