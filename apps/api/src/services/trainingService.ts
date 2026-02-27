import crypto from 'node:crypto';
import { Pool } from 'pg';
import { db } from '../db';

const databaseUrl = process.env.DATABASE_URL;
const normalizedDatabaseUrl = databaseUrl?.replace('sslmode=require', 'sslmode=no-verify');
const pool = normalizedDatabaseUrl
  ? new Pool({ connectionString: normalizedDatabaseUrl, ssl: { rejectUnauthorized: false } })
  : null;
let schemaReady = false;

type LiftStat = { exercise: string; bestWeight: number };
type WeeklyLiftBest = { squat: number; bench: number; deadlift: number };

type PlanInput = { title: string; content: string; status?: 'draft' | 'active' | 'archived' };
type UserProfileInput = {
  username?: string;
  firstName?: string;
  lastName?: string;
  contacts?: string;
  city?: string;
  weightCategory?: string;
  currentWeight?: number;
};
type WorkoutInput = {
  exercise: string;
  reps: number;
  weight: number;
  notes?: string;
  performedAt?: string;
  planId?: string;
};

const BASE_EXERCISES = ['Присед', 'Жим лежа', 'Становая тяга'];

async function ensureSchema() {
  if (schemaReady) return;

  const sqliteSql = `
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_base INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_versions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT,
      exercise TEXT NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      notes TEXT,
      performed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coach_links (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      athlete_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      contacts TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      weight_category TEXT NOT NULL DEFAULT '',
      current_weight REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_comments (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      coach_id TEXT NOT NULL,
      athlete_id TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  const pgSql = `
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_base BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_versions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT,
      exercise TEXT NOT NULL,
      reps INTEGER NOT NULL,
      weight DOUBLE PRECISION NOT NULL,
      notes TEXT,
      performed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coach_links (
      id TEXT PRIMARY KEY,
      coach_id TEXT NOT NULL,
      athlete_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(coach_id, athlete_id)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      contacts TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      weight_category TEXT NOT NULL DEFAULT '',
      current_weight DOUBLE PRECISION NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_comments (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      coach_id TEXT NOT NULL,
      athlete_id TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  if (pool) {
    await pool.query(pgSql);
    await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS plan_id TEXT');
    await pool.query("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT DEFAULT ''");
    await pool.query(
      'ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_weight DOUBLE PRECISION DEFAULT 0'
    );
  } else {
    db.exec(sqliteSql);
    try {
      db.exec('ALTER TABLE workouts ADD COLUMN plan_id TEXT');
    } catch {
      // already exists
    }
    try {
      db.exec("ALTER TABLE user_profiles ADD COLUMN username TEXT NOT NULL DEFAULT ''");
    } catch {
      // already exists
    }
    try {
      db.exec('ALTER TABLE user_profiles ADD COLUMN current_weight REAL NOT NULL DEFAULT 0');
    } catch {
      // already exists
    }
  }

  schemaReady = true;
}

async function ensureBaseExercises(userId: string) {
  await ensureSchema();

  if (pool) {
    const result = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM exercises WHERE user_id = $1',
      [userId]
    );
    if (Number(result.rows[0]?.count ?? 0) > 0) return;

    for (const name of BASE_EXERCISES) {
      await pool.query(
        'INSERT INTO exercises (id, user_id, name, is_base, created_at) VALUES ($1, $2, $3, $4, $5)',
        [crypto.randomUUID(), userId, name, true, new Date().toISOString()]
      );
    }
    return;
  }

  const existing = db
    .prepare('SELECT COUNT(*) as count FROM exercises WHERE user_id = ?')
    .get(userId) as { count: number };
  if (existing.count > 0) return;

  for (const name of BASE_EXERCISES) {
    db.prepare(
      'INSERT INTO exercises (id, user_id, name, is_base, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), userId, name, 1, new Date().toISOString());
  }
}

async function ensureUserProfile(userId: string) {
  await ensureSchema();
  const now = new Date().toISOString();

  if (pool) {
    await pool.query(
      `INSERT INTO user_profiles (user_id, username, first_name, last_name, contacts, city, weight_category, current_weight, updated_at)
       VALUES ($1, '', '', '', '', '', '', 0, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, now]
    );
    return;
  }

  const exists = db.prepare('SELECT user_id FROM user_profiles WHERE user_id = ?').get(userId);
  if (!exists) {
    db.prepare(
      'INSERT INTO user_profiles (user_id, username, first_name, last_name, contacts, city, weight_category, current_weight, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, '', '', '', '', '', '', 0, now);
  }
}

export async function getUserProfile(userId: string, email: string) {
  await ensureUserProfile(userId);

  if (pool) {
    const result = await pool.query(
      'SELECT username, first_name, last_name, contacts, city, weight_category, current_weight FROM user_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const row = result.rows[0] as
      | {
          username: string;
          first_name: string;
          last_name: string;
          contacts: string;
          city: string;
          weight_category: string;
          current_weight: number;
        }
      | undefined;

    return {
      email,
      username: row?.username ?? email.split('@')[0] ?? '',
      firstName: row?.first_name ?? '',
      lastName: row?.last_name ?? '',
      contacts: row?.contacts ?? '',
      city: row?.city ?? '',
      weightCategory: row?.weight_category ?? '',
      currentWeight: Number(row?.current_weight ?? 0)
    };
  }

  const row = db
    .prepare(
      'SELECT username, first_name, last_name, contacts, city, weight_category, current_weight FROM user_profiles WHERE user_id = ?'
    )
    .get(userId) as
    | {
        username: string;
        first_name: string;
        last_name: string;
        contacts: string;
        city: string;
        weight_category: string;
        current_weight: number;
      }
    | undefined;

  return {
    email,
    username: row?.username ?? email.split('@')[0] ?? '',
    firstName: row?.first_name ?? '',
    lastName: row?.last_name ?? '',
    contacts: row?.contacts ?? '',
    city: row?.city ?? '',
    weightCategory: row?.weight_category ?? '',
    currentWeight: Number(row?.current_weight ?? 0)
  };
}

export async function updateUserProfile(userId: string, email: string, input: UserProfileInput) {
  await ensureUserProfile(userId);
  const now = new Date().toISOString();

  if (pool) {
    await pool.query(
      `UPDATE user_profiles
       SET username = $1, first_name = $2, last_name = $3, contacts = $4, city = $5, weight_category = $6, current_weight = $7, updated_at = $8
       WHERE user_id = $9`,
      [
        input.username ?? '',
        input.firstName ?? '',
        input.lastName ?? '',
        input.contacts ?? '',
        input.city ?? '',
        input.weightCategory ?? '',
        Number(input.currentWeight ?? 0),
        now,
        userId
      ]
    );
    return getUserProfile(userId, email);
  }

  db.prepare(
    'UPDATE user_profiles SET username = ?, first_name = ?, last_name = ?, contacts = ?, city = ?, weight_category = ?, current_weight = ?, updated_at = ? WHERE user_id = ?'
  ).run(
    input.username ?? '',
    input.firstName ?? '',
    input.lastName ?? '',
    input.contacts ?? '',
    input.city ?? '',
    input.weightCategory ?? '',
    Number(input.currentWeight ?? 0),
    now,
    userId
  );

  return getUserProfile(userId, email);
}

export async function getDashboard(userId: string) {
  await ensureBaseExercises(userId);
  await ensureUserProfile(userId);

  const weekStart = new Date();
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();

  const lifts = ['Присед', 'Жим лежа', 'Становая тяга'];
  const stats: LiftStat[] = [];
  const bestWeek: WeeklyLiftBest = { squat: 0, bench: 0, deadlift: 0 };

  for (const lift of lifts) {
    if (pool) {
      const allTime = await pool.query<{ best: number | null }>(
        'SELECT MAX(weight) as best FROM workouts WHERE user_id = $1 AND exercise = $2',
        [userId, lift]
      );
      stats.push({ exercise: lift, bestWeight: Number(allTime.rows[0]?.best ?? 0) });

      const week = await pool.query<{ best: number | null }>(
        'SELECT MAX(weight) as best FROM workouts WHERE user_id = $1 AND exercise = $2 AND performed_at >= $3',
        [userId, lift, weekStartIso]
      );
      const weekBest = Number(week.rows[0]?.best ?? 0);
      if (lift === 'Присед') bestWeek.squat = weekBest;
      if (lift === 'Жим лежа') bestWeek.bench = weekBest;
      if (lift === 'Становая тяга') bestWeek.deadlift = weekBest;
    } else {
      const allTime = db
        .prepare('SELECT MAX(weight) as best FROM workouts WHERE user_id = ? AND exercise = ?')
        .get(userId, lift) as { best: number | null };
      stats.push({ exercise: lift, bestWeight: Number(allTime.best ?? 0) });

      const week = db
        .prepare(
          'SELECT MAX(weight) as best FROM workouts WHERE user_id = ? AND exercise = ? AND performed_at >= ?'
        )
        .get(userId, lift, weekStartIso) as { best: number | null };
      const weekBest = Number(week.best ?? 0);
      if (lift === 'Присед') bestWeek.squat = weekBest;
      if (lift === 'Жим лежа') bestWeek.bench = weekBest;
      if (lift === 'Становая тяга') bestWeek.deadlift = weekBest;
    }
  }

  let weeklyTonnage = 0;
  let currentWeight = 0;

  if (pool) {
    const tonnage = await pool.query<{ tonnage: number | null }>(
      'SELECT SUM(reps * weight) as tonnage FROM workouts WHERE user_id = $1 AND performed_at >= $2',
      [userId, weekStartIso]
    );
    weeklyTonnage = Number(tonnage.rows[0]?.tonnage ?? 0);

    const profile = await pool.query<{ current_weight: number | null }>(
      'SELECT current_weight FROM user_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    currentWeight = Number(profile.rows[0]?.current_weight ?? 0);
  } else {
    const tonnage = db
      .prepare(
        'SELECT SUM(reps * weight) as tonnage FROM workouts WHERE user_id = ? AND performed_at >= ?'
      )
      .get(userId, weekStartIso) as { tonnage: number | null };
    weeklyTonnage = Number(tonnage.tonnage ?? 0);

    const profile = db
      .prepare('SELECT current_weight FROM user_profiles WHERE user_id = ?')
      .get(userId) as { current_weight: number | null };
    currentWeight = Number(profile?.current_weight ?? 0);
  }

  return { stats, weeklyTonnage, currentWeight, bestWeek };
}

export async function listExercises(userId: string) {
  await ensureBaseExercises(userId);

  if (pool) {
    const result = await pool.query(
      'SELECT id, name, is_base as "isBase" FROM exercises WHERE user_id = $1 ORDER BY is_base DESC, name ASC',
      [userId]
    );
    return result.rows;
  }

  return db
    .prepare(
      'SELECT id, name, is_base as isBase FROM exercises WHERE user_id = ? ORDER BY is_base DESC, name ASC'
    )
    .all(userId);
}

export async function createExercise(userId: string, name: string) {
  await ensureBaseExercises(userId);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (pool) {
    await pool.query(
      'INSERT INTO exercises (id, user_id, name, is_base, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, userId, name, false, createdAt]
    );
  } else {
    db.prepare(
      'INSERT INTO exercises (id, user_id, name, is_base, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, name, 0, createdAt);
  }

  return { id, name, isBase: false };
}

export async function listPlans(userId: string) {
  await ensureSchema();
  if (pool) {
    const result = await pool.query(
      'SELECT * FROM plans WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return result.rows;
  }

  return db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
}

export async function createPlan(userId: string, input: PlanInput) {
  await ensureSchema();
  const now = new Date().toISOString();
  const plan = {
    id: crypto.randomUUID(),
    userId,
    title: input.title,
    content: input.content,
    status: input.status ?? 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now
  };

  if (pool) {
    await pool.query(
      'INSERT INTO plans (id, user_id, title, content, status, version, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        plan.id,
        plan.userId,
        plan.title,
        plan.content,
        plan.status,
        plan.version,
        plan.createdAt,
        plan.updatedAt
      ]
    );
    await pool.query(
      'INSERT INTO plan_versions (id, plan_id, version, title, content, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), plan.id, 1, plan.title, plan.content, now]
    );
  } else {
    db.prepare(
      'INSERT INTO plans (id, user_id, title, content, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      plan.id,
      plan.userId,
      plan.title,
      plan.content,
      plan.status,
      1,
      plan.createdAt,
      plan.updatedAt
    );
    db.prepare(
      'INSERT INTO plan_versions (id, plan_id, version, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), plan.id, 1, plan.title, plan.content, now);
  }

  return plan;
}

export async function updatePlan(userId: string, id: string, input: PlanInput) {
  await ensureSchema();
  const now = new Date().toISOString();

  if (pool) {
    const existing = await pool.query<{ version: number }>(
      'SELECT version FROM plans WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId]
    );
    if (!existing.rows[0]) return null;
    const nextVersion = Number(existing.rows[0].version) + 1;

    await pool.query(
      'UPDATE plans SET title=$1, content=$2, status=$3, version=$4, updated_at=$5 WHERE id=$6 AND user_id=$7',
      [input.title, input.content, input.status ?? 'draft', nextVersion, now, id, userId]
    );

    await pool.query(
      'INSERT INTO plan_versions (id, plan_id, version, title, content, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), id, nextVersion, input.title, input.content, now]
    );

    return {
      id,
      title: input.title,
      content: input.content,
      status: input.status ?? 'draft',
      version: nextVersion,
      updatedAt: now
    };
  }

  const existing = db
    .prepare('SELECT version FROM plans WHERE id = ? AND user_id = ?')
    .get(id, userId) as { version: number } | undefined;
  if (!existing) return null;
  const nextVersion = existing.version + 1;

  db.prepare(
    'UPDATE plans SET title=?, content=?, status=?, version=?, updated_at=? WHERE id=? AND user_id=?'
  ).run(input.title, input.content, input.status ?? 'draft', nextVersion, now, id, userId);
  db.prepare(
    'INSERT INTO plan_versions (id, plan_id, version, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), id, nextVersion, input.title, input.content, now);

  return {
    id,
    title: input.title,
    content: input.content,
    status: input.status ?? 'draft',
    version: nextVersion,
    updatedAt: now
  };
}

export async function deletePlan(userId: string, id: string) {
  await ensureSchema();
  if (pool) {
    await pool.query('DELETE FROM plans WHERE id = $1 AND user_id = $2', [id, userId]);
    return;
  }

  db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(id, userId);
}

export async function listWorkouts(userId: string) {
  await ensureSchema();
  if (pool) {
    const result = await pool.query(
      `SELECT w.*, p.title as plan_title
       FROM workouts w
       LEFT JOIN plans p ON p.id = w.plan_id
       WHERE w.user_id = $1
       ORDER BY w.performed_at DESC`,
      [userId]
    );
    return result.rows;
  }
  return db
    .prepare(
      `SELECT w.*, p.title as plan_title
       FROM workouts w
       LEFT JOIN plans p ON p.id = w.plan_id
       WHERE w.user_id = ?
       ORDER BY w.performed_at DESC`
    )
    .all(userId);
}

export async function createWorkout(userId: string, input: WorkoutInput) {
  await ensureSchema();
  const now = new Date().toISOString();
  const workout = {
    id: crypto.randomUUID(),
    userId,
    exercise: input.exercise,
    reps: input.reps,
    weight: input.weight,
    notes: input.notes ?? '',
    planId: input.planId ?? null,
    performedAt: input.performedAt ?? now,
    createdAt: now,
    updatedAt: now
  };

  if (pool) {
    await pool.query(
      'INSERT INTO workouts (id, user_id, plan_id, exercise, reps, weight, notes, performed_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        workout.id,
        workout.userId,
        workout.planId,
        workout.exercise,
        workout.reps,
        workout.weight,
        workout.notes,
        workout.performedAt,
        workout.createdAt,
        workout.updatedAt
      ]
    );
  } else {
    db.prepare(
      'INSERT INTO workouts (id, user_id, plan_id, exercise, reps, weight, notes, performed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      workout.id,
      workout.userId,
      workout.planId,
      workout.exercise,
      workout.reps,
      workout.weight,
      workout.notes,
      workout.performedAt,
      workout.createdAt,
      workout.updatedAt
    );
  }

  return workout;
}

export async function updateWorkout(userId: string, id: string, input: WorkoutInput) {
  await ensureSchema();
  const now = new Date().toISOString();

  if (pool) {
    const result = await pool.query(
      'UPDATE workouts SET plan_id=$1, exercise=$2, reps=$3, weight=$4, notes=$5, performed_at=$6, updated_at=$7 WHERE id=$8 AND user_id=$9 RETURNING *',
      [
        input.planId ?? null,
        input.exercise,
        input.reps,
        input.weight,
        input.notes ?? '',
        input.performedAt ?? now,
        now,
        id,
        userId
      ]
    );
    return result.rows[0] ?? null;
  }

  db.prepare(
    'UPDATE workouts SET plan_id=?, exercise=?, reps=?, weight=?, notes=?, performed_at=?, updated_at=? WHERE id=? AND user_id=?'
  ).run(
    input.planId ?? null,
    input.exercise,
    input.reps,
    input.weight,
    input.notes ?? '',
    input.performedAt ?? now,
    now,
    id,
    userId
  );

  return db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(id, userId) ?? null;
}

export async function deleteWorkout(userId: string, id: string) {
  await ensureSchema();
  if (pool) {
    await pool.query('DELETE FROM workouts WHERE id = $1 AND user_id = $2', [id, userId]);
    return;
  }

  db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(id, userId);
}

export async function addAthlete(coachId: string, athleteId: string) {
  await ensureSchema();
  const linkId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (pool) {
    await pool.query(
      'INSERT INTO coach_links (id, coach_id, athlete_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [linkId, coachId, athleteId, createdAt]
    );
    return;
  }

  const exists = db
    .prepare('SELECT id FROM coach_links WHERE coach_id = ? AND athlete_id = ?')
    .get(coachId, athleteId);
  if (!exists) {
    db.prepare(
      'INSERT INTO coach_links (id, coach_id, athlete_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(linkId, coachId, athleteId, createdAt);
  }
}

export async function addPlanComment(
  coachId: string,
  athleteId: string,
  planId: string,
  comment: string
) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (pool) {
    await pool.query(
      'INSERT INTO plan_comments (id, plan_id, coach_id, athlete_id, comment, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, planId, coachId, athleteId, comment, createdAt]
    );
    return { id, planId, coachId, athleteId, comment, createdAt };
  }

  db.prepare(
    'INSERT INTO plan_comments (id, plan_id, coach_id, athlete_id, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, planId, coachId, athleteId, comment, createdAt);
  return { id, planId, coachId, athleteId, comment, createdAt };
}
