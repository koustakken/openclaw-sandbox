import { useEffect, useState } from 'react';
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
  email: string;
  firstName: string;
  lastName: string;
  contacts: string;
  city: string;
  weightCategory: string;
  currentWeight: number;
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

export function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    try {
      const [d, p] = await Promise.all([api.dashboard(), api.getProfile()]);
      setDashboard(d);
      setProfile(p);
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
        <UserSidebarCard
          email={profile?.email ?? ''}
          firstName={profile?.firstName ?? ''}
          lastName={profile?.lastName ?? ''}
          contacts={profile?.contacts ?? ''}
          city={profile?.city ?? ''}
          weightCategory={profile?.weightCategory ?? ''}
          currentWeight={profile?.currentWeight ?? 0}
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
