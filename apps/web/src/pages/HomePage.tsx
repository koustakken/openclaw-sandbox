import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { api } from '../shared/api';
import css from './HomePage.module.css';

type DashboardData = {
  stats: { exercise: string; bestWeight: number }[];
  weeklyTonnage: number;
  currentWeight: number;
  bestWeek: { squat: number; bench: number; deadlift: number };
};

type Plan = { id: string; title: string; content: string; status: string; version: number };
type Workout = {
  id: string;
  exercise: string;
  reps: number;
  weight: number;
  notes?: string;
  performed_at: string;
  plan_id?: string | null;
  plan_title?: string | null;
};

type UserProfile = {
  email: string;
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
  currentWeight: number;
};

export function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [exercises, setExercises] = useState<Array<{ id: string; name: string; isBase: boolean }>>(
    []
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [exerciseName, setExerciseName] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planContent, setPlanContent] = useState('');
  const [workoutExercise, setWorkoutExercise] = useState('Присед');
  const [workoutReps, setWorkoutReps] = useState('5');
  const [workoutWeight, setWorkoutWeight] = useState('100');
  const [workoutPlanId, setWorkoutPlanId] = useState('');

  const [athleteId, setAthleteId] = useState('');
  const [commentPlanId, setCommentPlanId] = useState('');
  const [commentText, setCommentText] = useState('');

  const refresh = async () => {
    setError(null);
    try {
      const [d, p, e, plansData, workoutsData] = await Promise.all([
        api.dashboard(),
        api.getProfile(),
        api.listExercises(),
        api.listPlans(),
        api.listWorkouts()
      ]);
      setDashboard(d);
      setProfile(p);
      setExercises(e);
      setPlans(plansData);
      setWorkouts(workoutsData);
      if (e[0]) setWorkoutExercise((prev) => prev || e[0].name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const initials = (() => {
    const left = profile?.email?.split('@')[0] ?? 'pl';
    return left.slice(0, 2).toUpperCase();
  })();

  return (
    <section className={css.page}>
      {error && <Notification tone="error">{error}</Notification>}

      <div className={css.layout}>
        <aside className={css.sidebarCard}>
          <div className={css.avatar}>{initials}</div>
          <h3>
            {profile?.firstName || profile?.lastName
              ? `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim()
              : 'Профиль спортсмена'}
          </h3>
          <div className={css.muted}>{profile?.email ?? '-'}</div>
          <div>
            <strong>Контакты:</strong> {profile?.contacts || '—'}
          </div>
          <div>
            <strong>Город:</strong> {profile?.city || '—'}
          </div>
          <div>
            <strong>Весовая категория:</strong> {profile?.weightCategory || '—'}
          </div>
          <div>
            <strong>Актуальный вес:</strong> {profile?.currentWeight ?? 0} кг
          </div>
          <div className={css.muted}>Редактирование доступно на вкладке Profile</div>
        </aside>

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
            <div className={css.repoHeader}>История тренировок</div>
            {workouts.length === 0 ? (
              <div className={css.repoEmpty}>Пока нет тренировок. Добавь первую запись ниже.</div>
            ) : (
              workouts.map((w) => (
                <div key={w.id} className={css.repoItem}>
                  <div className={css.repoTitle}>{w.exercise}</div>
                  <div className={css.repoMeta}>
                    {new Date(w.performed_at).toLocaleDateString()} · План:{' '}
                    {w.plan_title || 'Без плана'}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={css.section}>
            <h3>Упражнения</h3>
            <div className={css.row2}>
              <Field
                label="Новое упражнение"
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={async () => {
                  if (!exerciseName.trim()) return;
                  await api.addExercise(exerciseName.trim());
                  setExerciseName('');
                  await refresh();
                }}
              >
                Добавить
              </Button>
            </div>
            <div className={css.list}>
              {exercises.map((e) => (
                <div className={css.item} key={e.id}>
                  <strong>{e.name}</strong>
                  <span className={css.muted}>{e.isBase ? 'Базовое упражнение' : 'Кастомное'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={css.section}>
            <h3>План тренировок (CRUD + versioning)</h3>
            <div className={css.row}>
              <Field
                label="Название"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
              />
              <Field
                label="Содержание"
                value={planContent}
                onChange={(e) => setPlanContent(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={async () => {
                  if (!planTitle || !planContent) return;
                  await api.createPlan({
                    title: planTitle,
                    content: planContent,
                    status: 'active'
                  });
                  setPlanTitle('');
                  setPlanContent('');
                  await refresh();
                }}
              >
                Создать
              </Button>
            </div>
            <div className={css.list}>
              {plans.map((p) => (
                <div className={css.item} key={p.id}>
                  <strong>
                    {p.title} · v{p.version}
                  </strong>
                  <div>{p.content}</div>
                  <div className={css.row2}>
                    <Button
                      onClick={async () => {
                        await api.updatePlan(p.id, {
                          title: p.title,
                          content: `${p.content}\nОбновлено: ${new Date().toLocaleString()}`,
                          status: 'active'
                        });
                        await refresh();
                      }}
                    >
                      Обновить
                    </Button>
                    <Button
                      onClick={async () => {
                        await api.deletePlan(p.id);
                        await refresh();
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={css.section}>
            <h3>Лог тренировок (CRUD)</h3>
            <div className={css.row}>
              <Field
                label="Упражнение"
                value={workoutExercise}
                onChange={(e) => setWorkoutExercise(e.target.value)}
              />
              <Field
                label="Повторы"
                value={workoutReps}
                onChange={(e) => setWorkoutReps(e.target.value)}
              />
              <Field
                label="Вес (кг)"
                value={workoutWeight}
                onChange={(e) => setWorkoutWeight(e.target.value)}
              />
            </div>
            <div className={css.row2}>
              <Field
                label="ID плана (опционально)"
                value={workoutPlanId}
                onChange={(e) => setWorkoutPlanId(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={async () => {
                  await api.createWorkout({
                    exercise: workoutExercise,
                    reps: Number(workoutReps),
                    weight: Number(workoutWeight),
                    planId: workoutPlanId || undefined
                  });
                  await refresh();
                }}
              >
                Записать тренировку
              </Button>
            </div>

            <div className={css.list}>
              {workouts.map((w) => (
                <div key={w.id} className={css.item}>
                  <strong>{w.exercise}</strong>
                  <span className={css.muted}>
                    {w.reps}x{w.weight} кг · {new Date(w.performed_at).toLocaleDateString()} · План:{' '}
                    {w.plan_title || 'Без плана'}
                  </span>
                  <div className={css.row2}>
                    <Button
                      onClick={async () => {
                        await api.updateWorkout(w.id, {
                          exercise: w.exercise,
                          reps: w.reps,
                          weight: w.weight + 2.5,
                          notes: w.notes,
                          planId: w.plan_id ?? undefined
                        });
                        await refresh();
                      }}
                    >
                      +2.5 кг
                    </Button>
                    <Button
                      onClick={async () => {
                        await api.deleteWorkout(w.id);
                        await refresh();
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={css.section}>
            <h3>Тренерский режим</h3>
            <div className={css.row2}>
              <Field
                label="ID атлета"
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
              />
              <Button
                onClick={async () => {
                  if (!athleteId) return;
                  await api.addAthlete(athleteId);
                }}
              >
                Добавить атлета
              </Button>
            </div>
            <div className={css.row}>
              <Field
                label="ID плана"
                value={commentPlanId}
                onChange={(e) => setCommentPlanId(e.target.value)}
              />
              <Field
                label="Комментарий"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <Button
                onClick={async () => {
                  if (!athleteId || !commentPlanId || !commentText) return;
                  await api.addComment({ athleteId, planId: commentPlanId, comment: commentText });
                  setCommentText('');
                }}
              >
                Комментировать
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
