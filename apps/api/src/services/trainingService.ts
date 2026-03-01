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
type PlanEditor = {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  addedAt: string;
};
type PlanInvitation = {
  id: string;
  planId: string;
  planTitle: string;
  ownerUsername: string;
  username: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
};
type PlanMessage = {
  id: string;
  planId: string;
  authorId: string;
  authorUsername: string;
  authorFirstName: string;
  authorLastName: string;
  text: string;
  createdAt: string;
};
type PlanActivity = {
  id: string;
  planId: string;
  actorId: string;
  actorUsername: string;
  actorFirstName: string;
  actorLastName: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
};
type WorkoutInput = {
  title: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  intensity: 'light' | 'medium' | 'heavy';
  notes?: string;
  performedAt?: string;
  planId?: string;
  currentBodyWeight?: number;
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
      title TEXT NOT NULL DEFAULT '',
      exercise TEXT NOT NULL,
      sets INTEGER NOT NULL DEFAULT 1,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      tonnage REAL NOT NULL DEFAULT 0,
      intensity TEXT NOT NULL DEFAULT 'medium',
      body_weight REAL,
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

    CREATE TABLE IF NOT EXISTS user_follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_editors (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(plan_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS plan_invitations (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      username TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS plan_messages (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_activity (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
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
      title TEXT NOT NULL DEFAULT '',
      exercise TEXT NOT NULL,
      sets INTEGER NOT NULL DEFAULT 1,
      reps INTEGER NOT NULL,
      weight DOUBLE PRECISION NOT NULL,
      tonnage DOUBLE PRECISION NOT NULL DEFAULT 0,
      intensity TEXT NOT NULL DEFAULT 'medium',
      body_weight DOUBLE PRECISION,
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

    CREATE TABLE IF NOT EXISTS user_follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS plan_editors (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(plan_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS plan_invitations (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      username TEXT NOT NULL,
      invited_by TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS plan_messages (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_activity (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  if (pool) {
    await pool.query(pgSql);
    await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS plan_id TEXT');
    await pool.query("ALTER TABLE workouts ADD COLUMN IF NOT EXISTS title TEXT DEFAULT ''");
    await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS sets INTEGER DEFAULT 1');
    await pool.query(
      'ALTER TABLE workouts ADD COLUMN IF NOT EXISTS tonnage DOUBLE PRECISION DEFAULT 0'
    );
    await pool.query(
      "ALTER TABLE workouts ADD COLUMN IF NOT EXISTS intensity TEXT DEFAULT 'medium'"
    );
    await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS body_weight DOUBLE PRECISION');
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
      db.exec("ALTER TABLE workouts ADD COLUMN title TEXT NOT NULL DEFAULT ''");
    } catch {
      // already exists
    }
    try {
      db.exec('ALTER TABLE workouts ADD COLUMN sets INTEGER NOT NULL DEFAULT 1');
    } catch {
      // already exists
    }
    try {
      db.exec('ALTER TABLE workouts ADD COLUMN tonnage REAL NOT NULL DEFAULT 0');
    } catch {
      // already exists
    }
    try {
      db.exec("ALTER TABLE workouts ADD COLUMN intensity TEXT NOT NULL DEFAULT 'medium'");
    } catch {
      // already exists
    }
    try {
      db.exec('ALTER TABLE workouts ADD COLUMN body_weight REAL');
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

async function getFollowCounts(userId: string) {
  if (pool) {
    const [followers, following] = await Promise.all([
      pool.query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM user_follows WHERE following_id = $1',
        [userId]
      ),
      pool.query<{ count: string }>(
        'SELECT COUNT(*)::text as count FROM user_follows WHERE follower_id = $1',
        [userId]
      )
    ]);

    return {
      followers: Number(followers.rows[0]?.count ?? 0),
      following: Number(following.rows[0]?.count ?? 0)
    };
  }

  const followers = db
    .prepare('SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?')
    .get(userId) as { count: number };
  const following = db
    .prepare('SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?')
    .get(userId) as { count: number };

  return { followers: followers.count, following: following.count };
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

    const counts = await getFollowCounts(userId);

    return {
      email,
      username: row?.username ?? email.split('@')[0] ?? '',
      firstName: row?.first_name ?? '',
      lastName: row?.last_name ?? '',
      contacts: row?.contacts ?? '',
      city: row?.city ?? '',
      weightCategory: row?.weight_category ?? '',
      currentWeight: Number(row?.current_weight ?? 0),
      followers: counts.followers,
      following: counts.following
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

  const counts = await getFollowCounts(userId);

  return {
    email,
    username: row?.username ?? email.split('@')[0] ?? '',
    firstName: row?.first_name ?? '',
    lastName: row?.last_name ?? '',
    contacts: row?.contacts ?? '',
    city: row?.city ?? '',
    weightCategory: row?.weight_category ?? '',
    currentWeight: Number(row?.current_weight ?? 0),
    followers: counts.followers,
    following: counts.following
  };
}

export async function updateUserProfile(userId: string, email: string, input: UserProfileInput) {
  await ensureUserProfile(userId);
  const now = new Date().toISOString();

  if (input.username && input.username.trim()) {
    const uname = input.username.trim();

    if (pool) {
      const exists = await pool.query<{ user_id: string }>(
        'SELECT user_id FROM user_profiles WHERE username = $1 AND user_id <> $2 LIMIT 1',
        [uname, userId]
      );
      if (exists.rows[0]?.user_id) throw new Error('USERNAME_TAKEN');
    } else {
      const exists = db
        .prepare('SELECT user_id FROM user_profiles WHERE username = ? AND user_id <> ?')
        .get(uname, userId) as { user_id: string } | undefined;
      if (exists?.user_id) throw new Error('USERNAME_TAKEN');
    }
  }

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
      'SELECT SUM(COALESCE(tonnage, sets * reps * weight, reps * weight)) as tonnage FROM workouts WHERE user_id = $1 AND performed_at >= $2',
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
        'SELECT SUM(COALESCE(tonnage, sets * reps * weight, reps * weight)) as tonnage FROM workouts WHERE user_id = ? AND performed_at >= ?'
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

async function logPlanActivity(
  planId: string,
  actorId: string,
  eventType: string,
  payload: Record<string, unknown> = {}
) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify(payload);

  if (pool) {
    await pool.query(
      'INSERT INTO plan_activity (id, plan_id, actor_id, event_type, payload_json, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, planId, actorId, eventType, payloadJson, createdAt]
    );
    return;
  }

  db.prepare(
    'INSERT INTO plan_activity (id, plan_id, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, planId, actorId, eventType, payloadJson, createdAt);
}

async function getPlanRole(userId: string, planId: string): Promise<'owner' | 'editor' | null> {
  if (pool) {
    const owner = await pool.query('SELECT id FROM plans WHERE id = $1 AND user_id = $2 LIMIT 1', [
      planId,
      userId
    ]);
    if (owner.rows[0]) return 'owner';

    const editor = await pool.query(
      'SELECT id FROM plan_editors WHERE plan_id = $1 AND user_id = $2 LIMIT 1',
      [planId, userId]
    );
    return editor.rows[0] ? 'editor' : null;
  }

  const owner = db.prepare('SELECT id FROM plans WHERE id = ? AND user_id = ?').get(planId, userId);
  if (owner) return 'owner';

  const editor = db
    .prepare('SELECT id FROM plan_editors WHERE plan_id = ? AND user_id = ?')
    .get(planId, userId);
  return editor ? 'editor' : null;
}

async function assertPlanRole(
  userId: string,
  planId: string,
  roles: Array<'owner' | 'editor'>
): Promise<'owner' | 'editor'> {
  const role = await getPlanRole(userId, planId);
  if (!role || !roles.includes(role)) {
    throw new Error('FORBIDDEN');
  }
  return role;
}

export async function listPlans(userId: string) {
  await ensureSchema();
  if (pool) {
    const result = await pool.query(
      `SELECT p.*, CASE WHEN p.user_id = $1 THEN 'owner' ELSE 'editor' END as role
       FROM plans p
       LEFT JOIN plan_editors pe ON pe.plan_id = p.id
       WHERE p.user_id = $1 OR pe.user_id = $1
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  return db
    .prepare(
      `SELECT p.*, CASE WHEN p.user_id = ? THEN 'owner' ELSE 'editor' END as role
       FROM plans p
       LEFT JOIN plan_editors pe ON pe.plan_id = p.id
       WHERE p.user_id = ? OR pe.user_id = ?
       GROUP BY p.id
       ORDER BY p.updated_at DESC`
    )
    .all(userId, userId, userId);
}

export async function getPlanById(userId: string, id: string) {
  await ensureSchema();
  await assertPlanRole(userId, id, ['owner', 'editor']);

  if (pool) {
    const result = await pool.query(
      "SELECT p.*, CASE WHEN p.user_id = $1 THEN 'owner' ELSE 'editor' END as role FROM plans p WHERE p.id = $2 LIMIT 1",
      [userId, id]
    );
    return result.rows[0] ?? null;
  }

  return (
    db
      .prepare(
        "SELECT p.*, CASE WHEN p.user_id = ? THEN 'owner' ELSE 'editor' END as role FROM plans p WHERE p.id = ? LIMIT 1"
      )
      .get(userId, id) ?? null
  );
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

  await logPlanActivity(plan.id, userId, 'plan.created', {
    title: plan.title,
    status: plan.status,
    version: 1
  });

  return { ...plan, role: 'owner' as const };
}

export async function updatePlan(userId: string, id: string, input: PlanInput) {
  await ensureSchema();
  const now = new Date().toISOString();
  const role = await getPlanRole(userId, id);
  if (!role) return null;

  if (pool) {
    const existing = await pool.query<{ version: number }>(
      'SELECT version FROM plans WHERE id = $1 LIMIT 1',
      [id]
    );
    if (!existing.rows[0]) return null;
    const nextVersion = Number(existing.rows[0].version) + 1;

    await pool.query(
      'UPDATE plans SET title=$1, content=$2, status=$3, version=$4, updated_at=$5 WHERE id=$6',
      [input.title, input.content, input.status ?? 'draft', nextVersion, now, id]
    );

    await pool.query(
      'INSERT INTO plan_versions (id, plan_id, version, title, content, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), id, nextVersion, input.title, input.content, now]
    );

    await logPlanActivity(id, userId, 'plan.updated', {
      title: input.title,
      status: input.status ?? 'draft',
      version: nextVersion,
      role
    });

    return {
      id,
      title: input.title,
      content: input.content,
      status: input.status ?? 'draft',
      version: nextVersion,
      updatedAt: now,
      role
    };
  }

  const existing = db.prepare('SELECT version FROM plans WHERE id = ?').get(id) as
    | { version: number }
    | undefined;
  if (!existing) return null;
  const nextVersion = existing.version + 1;

  db.prepare(
    'UPDATE plans SET title=?, content=?, status=?, version=?, updated_at=? WHERE id=?'
  ).run(input.title, input.content, input.status ?? 'draft', nextVersion, now, id);
  db.prepare(
    'INSERT INTO plan_versions (id, plan_id, version, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), id, nextVersion, input.title, input.content, now);

  await logPlanActivity(id, userId, 'plan.updated', {
    title: input.title,
    status: input.status ?? 'draft',
    version: nextVersion,
    role
  });

  return {
    id,
    title: input.title,
    content: input.content,
    status: input.status ?? 'draft',
    version: nextVersion,
    updatedAt: now,
    role
  };
}

export async function deletePlan(userId: string, id: string) {
  await ensureSchema();
  await assertPlanRole(userId, id, ['owner']);

  if (pool) {
    await pool.query('DELETE FROM plan_editors WHERE plan_id = $1', [id]);
    await pool.query('DELETE FROM plan_invitations WHERE plan_id = $1', [id]);
    await pool.query('DELETE FROM plan_messages WHERE plan_id = $1', [id]);
    await pool.query('DELETE FROM plan_activity WHERE plan_id = $1', [id]);
    await pool.query('DELETE FROM plans WHERE id = $1 AND user_id = $2', [id, userId]);
    return;
  }

  db.prepare('DELETE FROM plan_editors WHERE plan_id = ?').run(id);
  db.prepare('DELETE FROM plan_invitations WHERE plan_id = ?').run(id);
  db.prepare('DELETE FROM plan_messages WHERE plan_id = ?').run(id);
  db.prepare('DELETE FROM plan_activity WHERE plan_id = ?').run(id);
  db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(id, userId);
}

export async function listPlanEditors(userId: string, planId: string): Promise<PlanEditor[]> {
  await ensureSchema();
  await assertPlanRole(userId, planId, ['owner', 'editor']);

  if (pool) {
    const result = await pool.query<PlanEditor>(
      `SELECT pe.user_id as "userId", up.username, up.first_name as "firstName", up.last_name as "lastName", pe.created_at as "addedAt"
       FROM plan_editors pe
       LEFT JOIN user_profiles up ON up.user_id = pe.user_id
       WHERE pe.plan_id = $1
       ORDER BY pe.created_at ASC`,
      [planId]
    );
    return result.rows;
  }

  return db
    .prepare(
      `SELECT pe.user_id as userId, up.username as username, up.first_name as firstName, up.last_name as lastName, pe.created_at as addedAt
       FROM plan_editors pe
       LEFT JOIN user_profiles up ON up.user_id = pe.user_id
       WHERE pe.plan_id = ?
       ORDER BY pe.created_at ASC`
    )
    .all(planId) as PlanEditor[];
}

export async function invitePlanEditor(userId: string, planId: string, username: string) {
  await ensureSchema();
  await assertPlanRole(userId, planId, ['owner']);
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error('INVALID_USERNAME');

  const targetId = await findUserIdByUsername(normalized);
  if (!targetId) throw new Error('USER_NOT_FOUND');

  if (pool) {
    const owner = await pool.query('SELECT user_id FROM plans WHERE id = $1 LIMIT 1', [planId]);
    if (!owner.rows[0]) throw new Error('PLAN_NOT_FOUND');
    if (owner.rows[0].user_id === targetId) throw new Error('CANNOT_INVITE_OWNER');

    const existingEditor = await pool.query(
      'SELECT id FROM plan_editors WHERE plan_id = $1 AND user_id = $2 LIMIT 1',
      [planId, targetId]
    );
    if (existingEditor.rows[0]) throw new Error('ALREADY_EDITOR');

    const pending = await pool.query(
      "SELECT id FROM plan_invitations WHERE plan_id = $1 AND username = $2 AND status = 'pending' LIMIT 1",
      [planId, normalized]
    );
    if (pending.rows[0]) throw new Error('INVITE_ALREADY_PENDING');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO plan_invitations (id, plan_id, username, invited_by, status, created_at, resolved_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, planId, normalized, userId, 'pending', now, null]
    );
    await logPlanActivity(planId, userId, 'plan.editor_invited', { username: normalized });
    return { id, planId, username: normalized, status: 'pending' as const, createdAt: now };
  }

  const owner = db.prepare('SELECT user_id FROM plans WHERE id = ? LIMIT 1').get(planId) as
    | { user_id: string }
    | undefined;
  if (!owner) throw new Error('PLAN_NOT_FOUND');
  if (owner.user_id === targetId) throw new Error('CANNOT_INVITE_OWNER');

  const existingEditor = db
    .prepare('SELECT id FROM plan_editors WHERE plan_id = ? AND user_id = ? LIMIT 1')
    .get(planId, targetId);
  if (existingEditor) throw new Error('ALREADY_EDITOR');

  const pending = db
    .prepare(
      "SELECT id FROM plan_invitations WHERE plan_id = ? AND username = ? AND status = 'pending' LIMIT 1"
    )
    .get(planId, normalized);
  if (pending) throw new Error('INVITE_ALREADY_PENDING');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO plan_invitations (id, plan_id, username, invited_by, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, planId, normalized, userId, 'pending', now, null);
  await logPlanActivity(planId, userId, 'plan.editor_invited', { username: normalized });
  return { id, planId, username: normalized, status: 'pending' as const, createdAt: now };
}

export async function listMyPlanInvitations(userId: string): Promise<PlanInvitation[]> {
  await ensureSchema();

  if (pool) {
    const myProfile = await pool.query<{ username: string }>(
      'SELECT username FROM user_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const username = (myProfile.rows[0]?.username ?? '').trim().toLowerCase();
    if (!username) return [];

    const result = await pool.query<PlanInvitation>(
      `SELECT pi.id,
              pi.plan_id as "planId",
              p.title as "planTitle",
              owner.username as "ownerUsername",
              pi.username,
              pi.invited_by as "invitedBy",
              pi.status,
              pi.created_at as "createdAt",
              pi.resolved_at as "resolvedAt"
       FROM plan_invitations pi
       JOIN plans p ON p.id = pi.plan_id
       LEFT JOIN user_profiles owner ON owner.user_id = p.user_id
       WHERE pi.username = $1
       ORDER BY pi.created_at DESC`,
      [username]
    );
    return result.rows;
  }

  const myProfile = db
    .prepare('SELECT username FROM user_profiles WHERE user_id = ? LIMIT 1')
    .get(userId) as { username: string } | undefined;
  const username = (myProfile?.username ?? '').trim().toLowerCase();
  if (!username) return [];

  return db
    .prepare(
      `SELECT pi.id,
              pi.plan_id as planId,
              p.title as planTitle,
              owner.username as ownerUsername,
              pi.username,
              pi.invited_by as invitedBy,
              pi.status,
              pi.created_at as createdAt,
              pi.resolved_at as resolvedAt
       FROM plan_invitations pi
       JOIN plans p ON p.id = pi.plan_id
       LEFT JOIN user_profiles owner ON owner.user_id = p.user_id
       WHERE pi.username = ?
       ORDER BY pi.created_at DESC`
    )
    .all(username) as PlanInvitation[];
}

export async function respondToPlanInvitation(
  userId: string,
  invitationId: string,
  decision: 'accept' | 'reject'
) {
  await ensureSchema();

  const now = new Date().toISOString();
  const status = decision === 'accept' ? 'accepted' : 'rejected';

  if (pool) {
    const me = await pool.query<{ username: string }>(
      'SELECT username FROM user_profiles WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    const username = (me.rows[0]?.username ?? '').trim().toLowerCase();
    if (!username) throw new Error('PROFILE_USERNAME_REQUIRED');

    const invitation = await pool.query<{ plan_id: string; status: string }>(
      'SELECT plan_id, status FROM plan_invitations WHERE id = $1 AND username = $2 LIMIT 1',
      [invitationId, username]
    );
    if (!invitation.rows[0]) throw new Error('INVITATION_NOT_FOUND');
    if (invitation.rows[0].status !== 'pending') throw new Error('INVITATION_ALREADY_RESOLVED');

    await pool.query('UPDATE plan_invitations SET status = $1, resolved_at = $2 WHERE id = $3', [
      status,
      now,
      invitationId
    ]);

    if (decision === 'accept') {
      await pool.query(
        'INSERT INTO plan_editors (id, plan_id, user_id, invited_by, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (plan_id, user_id) DO NOTHING',
        [crypto.randomUUID(), invitation.rows[0].plan_id, userId, userId, now]
      );
    }

    await logPlanActivity(invitation.rows[0].plan_id, userId, `plan.editor_${status}`, {
      username
    });

    return { ok: true };
  }

  const me = db
    .prepare('SELECT username FROM user_profiles WHERE user_id = ? LIMIT 1')
    .get(userId) as { username: string } | undefined;
  const username = (me?.username ?? '').trim().toLowerCase();
  if (!username) throw new Error('PROFILE_USERNAME_REQUIRED');

  const invitation = db
    .prepare('SELECT plan_id, status FROM plan_invitations WHERE id = ? AND username = ? LIMIT 1')
    .get(invitationId, username) as { plan_id: string; status: string } | undefined;
  if (!invitation) throw new Error('INVITATION_NOT_FOUND');
  if (invitation.status !== 'pending') throw new Error('INVITATION_ALREADY_RESOLVED');

  db.prepare('UPDATE plan_invitations SET status = ?, resolved_at = ? WHERE id = ?').run(
    status,
    now,
    invitationId
  );

  if (decision === 'accept') {
    const exists = db
      .prepare('SELECT id FROM plan_editors WHERE plan_id = ? AND user_id = ?')
      .get(invitation.plan_id, userId);
    if (!exists) {
      db.prepare(
        'INSERT INTO plan_editors (id, plan_id, user_id, invited_by, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), invitation.plan_id, userId, userId, now);
    }
  }

  await logPlanActivity(invitation.plan_id, userId, `plan.editor_${status}`, { username });
  return { ok: true };
}

export async function removePlanEditor(userId: string, planId: string, editorId: string) {
  await ensureSchema();
  await assertPlanRole(userId, planId, ['owner']);

  if (pool) {
    await pool.query('DELETE FROM plan_editors WHERE plan_id = $1 AND user_id = $2', [
      planId,
      editorId
    ]);
    await logPlanActivity(planId, userId, 'plan.editor_removed', { editorId });
    return { ok: true };
  }

  db.prepare('DELETE FROM plan_editors WHERE plan_id = ? AND user_id = ?').run(planId, editorId);
  await logPlanActivity(planId, userId, 'plan.editor_removed', { editorId });
  return { ok: true };
}

export async function listPlanMessages(userId: string, planId: string): Promise<PlanMessage[]> {
  await ensureSchema();
  await assertPlanRole(userId, planId, ['owner', 'editor']);

  if (pool) {
    const result = await pool.query<PlanMessage>(
      `SELECT pm.id,
              pm.plan_id as "planId",
              pm.author_id as "authorId",
              up.username as "authorUsername",
              up.first_name as "authorFirstName",
              up.last_name as "authorLastName",
              pm.text,
              pm.created_at as "createdAt"
       FROM plan_messages pm
       LEFT JOIN user_profiles up ON up.user_id = pm.author_id
       WHERE pm.plan_id = $1
       ORDER BY pm.created_at ASC`,
      [planId]
    );
    return result.rows;
  }

  return db
    .prepare(
      `SELECT pm.id,
              pm.plan_id as planId,
              pm.author_id as authorId,
              up.username as authorUsername,
              up.first_name as authorFirstName,
              up.last_name as authorLastName,
              pm.text,
              pm.created_at as createdAt
       FROM plan_messages pm
       LEFT JOIN user_profiles up ON up.user_id = pm.author_id
       WHERE pm.plan_id = ?
       ORDER BY pm.created_at ASC`
    )
    .all(planId) as PlanMessage[];
}

export async function addPlanMessage(userId: string, planId: string, text: string) {
  await ensureSchema();
  await assertPlanRole(userId, planId, ['owner', 'editor']);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (pool) {
    await pool.query(
      'INSERT INTO plan_messages (id, plan_id, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)',
      [id, planId, userId, text, createdAt]
    );
  } else {
    db.prepare(
      'INSERT INTO plan_messages (id, plan_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, planId, userId, text, createdAt);
  }

  await logPlanActivity(planId, userId, 'plan.comment_added', { text });
  return { id, planId, authorId: userId, text, createdAt };
}

export async function listPlanActivity(userId: string, planId: string): Promise<PlanActivity[]> {
  await ensureSchema();
  await assertPlanRole(userId, planId, ['owner', 'editor']);

  if (pool) {
    const result = await pool.query<PlanActivity>(
      `SELECT pa.id,
              pa.plan_id as "planId",
              pa.actor_id as "actorId",
              up.username as "actorUsername",
              up.first_name as "actorFirstName",
              up.last_name as "actorLastName",
              pa.event_type as "eventType",
              pa.payload_json as "payloadJson",
              pa.created_at as "createdAt"
       FROM plan_activity pa
       LEFT JOIN user_profiles up ON up.user_id = pa.actor_id
       WHERE pa.plan_id = $1
       ORDER BY pa.created_at DESC`,
      [planId]
    );
    return result.rows;
  }

  return db
    .prepare(
      `SELECT pa.id,
              pa.plan_id as planId,
              pa.actor_id as actorId,
              up.username as actorUsername,
              up.first_name as actorFirstName,
              up.last_name as actorLastName,
              pa.event_type as eventType,
              pa.payload_json as payloadJson,
              pa.created_at as createdAt
       FROM plan_activity pa
       LEFT JOIN user_profiles up ON up.user_id = pa.actor_id
       WHERE pa.plan_id = ?
       ORDER BY pa.created_at DESC`
    )
    .all(planId) as PlanActivity[];
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
    title: input.title,
    exercise: input.exercise,
    sets: input.sets,
    reps: input.reps,
    weight: input.weight,
    tonnage: input.sets * input.reps * input.weight,
    intensity: input.intensity,
    bodyWeight: input.currentBodyWeight ?? null,
    notes: input.notes ?? '',
    planId: input.planId ?? null,
    performedAt: input.performedAt ?? now,
    createdAt: now,
    updatedAt: now
  };

  if (pool) {
    await pool.query(
      'INSERT INTO workouts (id, user_id, plan_id, title, exercise, sets, reps, weight, tonnage, intensity, body_weight, notes, performed_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
      [
        workout.id,
        workout.userId,
        workout.planId,
        workout.title,
        workout.exercise,
        workout.sets,
        workout.reps,
        workout.weight,
        workout.tonnage,
        workout.intensity,
        workout.bodyWeight,
        workout.notes,
        workout.performedAt,
        workout.createdAt,
        workout.updatedAt
      ]
    );
  } else {
    db.prepare(
      'INSERT INTO workouts (id, user_id, plan_id, title, exercise, sets, reps, weight, tonnage, intensity, body_weight, notes, performed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      workout.id,
      workout.userId,
      workout.planId,
      workout.title,
      workout.exercise,
      workout.sets,
      workout.reps,
      workout.weight,
      workout.tonnage,
      workout.intensity,
      workout.bodyWeight,
      workout.notes,
      workout.performedAt,
      workout.createdAt,
      workout.updatedAt
    );
  }

  if (typeof input.currentBodyWeight === 'number') {
    if (pool) {
      await pool.query(
        'UPDATE user_profiles SET current_weight = $1, updated_at = $2 WHERE user_id = $3',
        [input.currentBodyWeight, now, userId]
      );
    } else {
      db.prepare(
        'UPDATE user_profiles SET current_weight = ?, updated_at = ? WHERE user_id = ?'
      ).run(input.currentBodyWeight, now, userId);
    }
  }

  return workout;
}

export async function updateWorkout(userId: string, id: string, input: WorkoutInput) {
  await ensureSchema();
  const now = new Date().toISOString();

  if (pool) {
    const result = await pool.query(
      'UPDATE workouts SET plan_id=$1, title=$2, exercise=$3, sets=$4, reps=$5, weight=$6, tonnage=$7, intensity=$8, body_weight=$9, notes=$10, performed_at=$11, updated_at=$12 WHERE id=$13 AND user_id=$14 RETURNING *',
      [
        input.planId ?? null,
        input.title,
        input.exercise,
        input.sets,
        input.reps,
        input.weight,
        input.sets * input.reps * input.weight,
        input.intensity,
        input.currentBodyWeight ?? null,
        input.notes ?? '',
        input.performedAt ?? now,
        now,
        id,
        userId
      ]
    );

    if (typeof input.currentBodyWeight === 'number') {
      await pool.query(
        'UPDATE user_profiles SET current_weight = $1, updated_at = $2 WHERE user_id = $3',
        [input.currentBodyWeight, now, userId]
      );
    }

    return result.rows[0] ?? null;
  }

  db.prepare(
    'UPDATE workouts SET plan_id=?, title=?, exercise=?, sets=?, reps=?, weight=?, tonnage=?, intensity=?, body_weight=?, notes=?, performed_at=?, updated_at=? WHERE id=? AND user_id=?'
  ).run(
    input.planId ?? null,
    input.title,
    input.exercise,
    input.sets,
    input.reps,
    input.weight,
    input.sets * input.reps * input.weight,
    input.intensity,
    input.currentBodyWeight ?? null,
    input.notes ?? '',
    input.performedAt ?? now,
    now,
    id,
    userId
  );

  if (typeof input.currentBodyWeight === 'number') {
    db.prepare('UPDATE user_profiles SET current_weight = ?, updated_at = ? WHERE user_id = ?').run(
      input.currentBodyWeight,
      now,
      userId
    );
  }

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

export async function deleteAllWorkouts(userId: string) {
  await ensureSchema();
  if (pool) {
    await pool.query('DELETE FROM workouts WHERE user_id = $1', [userId]);
    return;
  }

  db.prepare('DELETE FROM workouts WHERE user_id = ?').run(userId);
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

async function findUserIdByUsername(username: string): Promise<string | null> {
  const login = username.trim();
  if (!login) return null;

  if (pool) {
    const byProfile = await pool.query<{ user_id: string }>(
      'SELECT user_id FROM user_profiles WHERE username = $1 LIMIT 1',
      [login]
    );
    if (byProfile.rows[0]?.user_id) return byProfile.rows[0].user_id;

    const byEmail = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [login]
    );
    return byEmail.rows[0]?.id ?? null;
  }

  const p = db.prepare('SELECT user_id FROM user_profiles WHERE username = ?').get(login) as
    | { user_id: string }
    | undefined;
  if (p?.user_id) return p.user_id;

  const e = db.prepare('SELECT id FROM users WHERE email = ?').get(login) as
    | { id: string }
    | undefined;
  return e?.id ?? null;
}

export async function followUser(followerId: string, targetUsername: string) {
  await ensureSchema();
  const followingId = await findUserIdByUsername(targetUsername);
  if (!followingId) throw new Error('USER_NOT_FOUND');
  if (followingId === followerId) throw new Error('CANNOT_FOLLOW_SELF');

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (pool) {
    await pool.query(
      'INSERT INTO user_follows (id, follower_id, following_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [id, followerId, followingId, createdAt]
    );
    return;
  }

  const exists = db
    .prepare('SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?')
    .get(followerId, followingId);
  if (!exists) {
    db.prepare(
      'INSERT INTO user_follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, followerId, followingId, createdAt);
  }
}

export async function unfollowUser(followerId: string, targetUsername: string) {
  await ensureSchema();
  const followingId = await findUserIdByUsername(targetUsername);
  if (!followingId) return;

  if (pool) {
    await pool.query('DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2', [
      followerId,
      followingId
    ]);
    return;
  }

  db.prepare('DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?').run(
    followerId,
    followingId
  );
}

export async function searchUsers(query: string) {
  await ensureSchema();
  const q = `%${query.toLowerCase()}%`;

  if (pool) {
    const result = await pool.query<{
      username: string;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT COALESCE(p.username, split_part(u.email, '@', 1)) as username, u.email, COALESCE(p.first_name, '') as first_name, COALESCE(p.last_name, '') as last_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE LOWER(COALESCE(p.username, split_part(u.email, '@', 1))) LIKE $1
       ORDER BY username ASC
       LIMIT 20`,
      [q]
    );

    return result.rows.map((r) => ({
      username: r.username,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name
    }));
  }

  const rows = db
    .prepare(
      `SELECT COALESCE(p.username, substr(u.email, 1, instr(u.email, '@') - 1)) as username, u.email as email, COALESCE(p.first_name, '') as first_name, COALESCE(p.last_name, '') as last_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE LOWER(COALESCE(p.username, substr(u.email, 1, instr(u.email, '@') - 1))) LIKE ?
       ORDER BY username ASC
       LIMIT 20`
    )
    .all(q) as Array<{ username: string; email: string; first_name: string; last_name: string }>;

  return rows.map((r) => ({
    username: r.username,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name
  }));
}

export async function getUserByUsername(username: string) {
  await ensureSchema();
  const login = username.trim().toLowerCase();

  if (pool) {
    const result = await pool.query<{
      id: string;
      email: string;
      username: string;
      first_name: string;
      last_name: string;
      contacts: string;
      city: string;
      weight_category: string;
      current_weight: number;
    }>(
      `SELECT u.id, u.email, COALESCE(p.username, split_part(u.email, '@', 1)) as username,
              COALESCE(p.first_name, '') as first_name, COALESCE(p.last_name, '') as last_name,
              COALESCE(p.contacts, '') as contacts, COALESCE(p.city, '') as city,
              COALESCE(p.weight_category, '') as weight_category, COALESCE(p.current_weight, 0) as current_weight
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE LOWER(COALESCE(p.username, split_part(u.email, '@', 1))) = $1
       LIMIT 1`,
      [login]
    );
    const row = result.rows[0];
    if (!row) return null;
    const counts = await getFollowCounts(row.id);
    return {
      userId: row.id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      contacts: row.contacts,
      city: row.city,
      weightCategory: row.weight_category,
      currentWeight: Number(row.current_weight ?? 0),
      followers: counts.followers,
      following: counts.following
    };
  }

  const row = db
    .prepare(
      `SELECT u.id as id, u.email as email,
              COALESCE(p.username, substr(u.email, 1, instr(u.email, '@') - 1)) as username,
              COALESCE(p.first_name, '') as first_name, COALESCE(p.last_name, '') as last_name,
              COALESCE(p.contacts, '') as contacts, COALESCE(p.city, '') as city,
              COALESCE(p.weight_category, '') as weight_category, COALESCE(p.current_weight, 0) as current_weight
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE LOWER(COALESCE(p.username, substr(u.email, 1, instr(u.email, '@') - 1))) = ?
       LIMIT 1`
    )
    .get(login) as
    | {
        id: string;
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        contacts: string;
        city: string;
        weight_category: string;
        current_weight: number;
      }
    | undefined;

  if (!row) return null;
  const counts = await getFollowCounts(row.id);
  return {
    userId: row.id,
    email: row.email,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    contacts: row.contacts,
    city: row.city,
    weightCategory: row.weight_category,
    currentWeight: Number(row.current_weight ?? 0),
    followers: counts.followers,
    following: counts.following
  };
}

export async function listFollowing(followerId: string) {
  await ensureSchema();

  if (pool) {
    const result = await pool.query<{
      username: string;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT COALESCE(p.username, '') as username, u.email, COALESCE(p.first_name, '') as first_name, COALESCE(p.last_name, '') as last_name
       FROM user_follows f
       JOIN users u ON u.id = f.following_id
       LEFT JOIN user_profiles p ON p.user_id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      [followerId]
    );

    return result.rows.map((r) => ({
      username: r.username || r.email.split('@')[0],
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name
    }));
  }

  const rows = db
    .prepare(
      `SELECT COALESCE(p.username, '') as username, u.email as email, COALESCE(p.first_name, '') as first_name, COALESCE(p.last_name, '') as last_name
       FROM user_follows f
       JOIN users u ON u.id = f.following_id
       LEFT JOIN user_profiles p ON p.user_id = f.following_id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`
    )
    .all(followerId) as Array<{
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  }>;

  return rows.map((r) => ({
    username: r.username || r.email.split('@')[0],
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name
  }));
}
