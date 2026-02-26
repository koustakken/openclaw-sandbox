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

type PlanInput = { title: string; content: string; status?: 'draft' | 'active' | 'archived' };
type WorkoutInput = {
  exercise: string;
  reps: number;
  weight: number;
  notes?: string;
  performedAt?: string;
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

    CREATE TABLE IF NOT EXISTS plan_comments (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      coach_id TEXT NOT NULL,
      athlete_id TEXT NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  if (pool) await pool.query(pgSql);
  else db.exec(sqliteSql);

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

export async function getDashboard(userId: string) {
  await ensureBaseExercises(userId);

  const lifts = ['Присед', 'Жим лежа', 'Становая тяга'];
  const stats: LiftStat[] = [];

  for (const lift of lifts) {
    if (pool) {
      const row = await pool.query<{ best: number | null }>(
        'SELECT MAX(weight) as best FROM workouts WHERE user_id = $1 AND exercise = $2',
        [userId, lift]
      );
      stats.push({ exercise: lift, bestWeight: Number(row.rows[0]?.best ?? 0) });
    } else {
      const row = db
        .prepare('SELECT MAX(weight) as best FROM workouts WHERE user_id = ? AND exercise = ?')
        .get(userId, lift) as {
        best: number | null;
      };
      stats.push({ exercise: lift, bestWeight: Number(row.best ?? 0) });
    }
  }

  const plansCount = pool
    ? Number(
        (
          await pool.query<{ count: string }>(
            'SELECT COUNT(*)::text as count FROM plans WHERE user_id = $1',
            [userId]
          )
        ).rows[0].count
      )
    : (
        db.prepare('SELECT COUNT(*) as count FROM plans WHERE user_id = ?').get(userId) as {
          count: number;
        }
      ).count;

  const workoutsCount = pool
    ? Number(
        (
          await pool.query<{ count: string }>(
            'SELECT COUNT(*)::text as count FROM workouts WHERE user_id = $1',
            [userId]
          )
        ).rows[0].count
      )
    : (
        db.prepare('SELECT COUNT(*) as count FROM workouts WHERE user_id = ?').get(userId) as {
          count: number;
        }
      ).count;

  return { stats, plansCount, workoutsCount };
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
      'SELECT * FROM workouts WHERE user_id = $1 ORDER BY performed_at DESC',
      [userId]
    );
    return result.rows;
  }
  return db
    .prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY performed_at DESC')
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
    performedAt: input.performedAt ?? now,
    createdAt: now,
    updatedAt: now
  };

  if (pool) {
    await pool.query(
      'INSERT INTO workouts (id, user_id, exercise, reps, weight, notes, performed_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        workout.id,
        workout.userId,
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
      'INSERT INTO workouts (id, user_id, exercise, reps, weight, notes, performed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      workout.id,
      workout.userId,
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
      'UPDATE workouts SET exercise=$1, reps=$2, weight=$3, notes=$4, performed_at=$5, updated_at=$6 WHERE id=$7 AND user_id=$8 RETURNING *',
      [
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
    'UPDATE workouts SET exercise=?, reps=?, weight=?, notes=?, performed_at=?, updated_at=? WHERE id=? AND user_id=?'
  ).run(
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
