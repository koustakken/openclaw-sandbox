import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Notification } from '../components/ui/Notification';
import { api } from '../shared/api';
import css from './HomePage.module.css';

type DashboardData = {
  stats: { exercise: string; bestWeight: number }[];
  plansCount: number;
  workoutsCount: number;
};

type Plan = { id: string; title: string; content: string; status: string; version: number };
type Workout = {
  id: string;
  exercise: string;
  reps: number;
  weight: number;
  notes?: string;
  performed_at: string;
};

type UserProfile = {
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
};

const PROFILE_STORAGE_KEY = 'profile.sidebar';

export function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [exercises, setExercises] = useState<Array<{ id: string; name: string; isBase: boolean }>>(
    []
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    contacts: '',
    city: '',
    weightCategory: ''
  });

  const [exerciseName, setExerciseName] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planContent, setPlanContent] = useState('');
  const [workoutExercise, setWorkoutExercise] = useState('Присед');
  const [workoutReps, setWorkoutReps] = useState('5');
  const [workoutWeight, setWorkoutWeight] = useState('100');

  const [athleteId, setAthleteId] = useState('');
  const [commentPlanId, setCommentPlanId] = useState('');
  const [commentText, setCommentText] = useState('');

  const initials = useMemo(() => {
    if (!email) return 'PL';
    const left = email.split('@')[0] ?? '';
    return left.slice(0, 2).toUpperCase();
  }, [email]);

  useEffect(() => {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      try {
        setProfile(JSON.parse(raw) as UserProfile);
      } catch {
        // ignore invalid cache
      }
    }
  }, []);

  const saveProfile = () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  };

  const refresh = async () => {
    setError(null);
    try {
      const [d, e, p, w, me] = await Promise.all([
        api.dashboard(),
        api.listExercises(),
        api.listPlans(),
        api.listWorkouts(),
        api.me()
      ]);
      setDashboard(d);
      setExercises(e);
      setPlans(p);
      setWorkouts(w);
      setEmail(me.user.email);
      if (e[0]) setWorkoutExercise((prev) => prev || e[0].name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className={css.page}>
      {error && <Notification tone="error">{error}</Notification>}

      <div className={css.layout}>
        <aside className={css.sidebarCard}>
          <div className={css.avatar}>{initials}</div>
          <h3>Профиль спортсмена</h3>
          <Field
            label="Имя"
            value={profile.firstName}
            onChange={(e) => setProfile((s) => ({ ...s, firstName: e.target.value }))}
          />
          <Field
            label="Фамилия"
            value={profile.lastName}
            onChange={(e) => setProfile((s) => ({ ...s, lastName: e.target.value }))}
          />
          <Field
            label="Контакты"
            value={profile.contacts}
            onChange={(e) => setProfile((s) => ({ ...s, contacts: e.target.value }))}
          />
          <Field
            label="Город"
            value={profile.city}
            onChange={(e) => setProfile((s) => ({ ...s, city: e.target.value }))}
          />
          <Field
            label="Весовая категория"
            value={profile.weightCategory}
            onChange={(e) => setProfile((s) => ({ ...s, weightCategory: e.target.value }))}
          />
          <div className={css.muted}>{email || 'email@unknown'}</div>
          <Button onClick={saveProfile}>Сохранить профиль</Button>
        </aside>

        <div className={css.main}>
          <div className={css.grid}>
            {(dashboard?.stats ?? []).map((s) => (
              <div key={s.exercise} className={css.card}>
                <div className={css.title}>{s.exercise}</div>
                <div className={css.value}>{s.bestWeight} кг</div>
              </div>
            ))}
            <div className={css.card}>
              <div className={css.title}>Планов</div>
              <div className={css.value}>{dashboard?.plansCount ?? 0}</div>
            </div>
            <div className={css.card}>
              <div className={css.title}>Тренировок</div>
              <div className={css.value}>{dashboard?.workoutsCount ?? 0}</div>
            </div>
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
            <Button
              variant="primary"
              onClick={async () => {
                await api.createWorkout({
                  exercise: workoutExercise,
                  reps: Number(workoutReps),
                  weight: Number(workoutWeight)
                });
                await refresh();
              }}
            >
              Записать тренировку
            </Button>

            <div className={css.list}>
              {workouts.map((w) => (
                <div key={w.id} className={css.item}>
                  <strong>{w.exercise}</strong>
                  <span className={css.muted}>
                    {w.reps}x{w.weight} кг · {new Date(w.performed_at).toLocaleDateString()}
                  </span>
                  <div className={css.row2}>
                    <Button
                      onClick={async () => {
                        await api.updateWorkout(w.id, {
                          exercise: w.exercise,
                          reps: w.reps,
                          weight: w.weight + 2.5,
                          notes: w.notes
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
