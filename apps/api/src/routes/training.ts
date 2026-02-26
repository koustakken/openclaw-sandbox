import { Router } from 'express';
import { z } from 'zod';
import { type AuthenticatedRequest, requireAuth } from '../middleware/authMiddleware';
import {
  addAthlete,
  addPlanComment,
  createExercise,
  createPlan,
  createWorkout,
  deletePlan,
  deleteWorkout,
  getDashboard,
  listExercises,
  listPlans,
  listWorkouts,
  updatePlan,
  updateWorkout
} from '../services/trainingService';

export const trainingRouter: Router = Router();
trainingRouter.use(requireAuth);

const planSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(['draft', 'active', 'archived']).optional()
});

const workoutSchema = z.object({
  exercise: z.string().min(1),
  reps: z.number().int().positive(),
  weight: z.number().nonnegative(),
  notes: z.string().optional(),
  performedAt: z.string().optional()
});

trainingRouter.get('/dashboard', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  return res.json(await getDashboard(userId));
});

trainingRouter.get('/exercises', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  return res.json(await listExercises(userId));
});

trainingRouter.post('/exercises', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const name = z.string().min(1).parse(req.body?.name);
  return res.status(201).json(await createExercise(userId, name));
});

trainingRouter.get('/plans', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  return res.json(await listPlans(userId));
});

trainingRouter.post('/plans', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const payload = planSchema.parse(req.body);
  return res.status(201).json(await createPlan(userId, payload));
});

trainingRouter.put('/plans/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const payload = planSchema.parse(req.body);
  const updated = await updatePlan(userId, req.params.id, payload);
  if (!updated) return res.status(404).json({ message: 'Plan not found' });
  return res.json(updated);
});

trainingRouter.delete('/plans/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  await deletePlan(userId, req.params.id);
  return res.status(204).send();
});

trainingRouter.get('/workouts', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  return res.json(await listWorkouts(userId));
});

trainingRouter.post('/workouts', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const payload = workoutSchema.parse(req.body);
  return res.status(201).json(await createWorkout(userId, payload));
});

trainingRouter.put('/workouts/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const payload = workoutSchema.parse(req.body);
  const updated = await updateWorkout(userId, req.params.id, payload);
  if (!updated) return res.status(404).json({ message: 'Workout not found' });
  return res.json(updated);
});

trainingRouter.delete('/workouts/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.auth?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  await deleteWorkout(userId, req.params.id);
  return res.status(204).send();
});

trainingRouter.post('/coach/athletes', async (req: AuthenticatedRequest, res) => {
  const coachId = req.auth?.sub;
  if (!coachId) return res.status(401).json({ message: 'Unauthorized' });
  const athleteId = z.string().min(1).parse(req.body?.athleteId);
  await addAthlete(coachId, athleteId);
  return res.status(201).json({ ok: true });
});

trainingRouter.post('/coach/comments', async (req: AuthenticatedRequest, res) => {
  const coachId = req.auth?.sub;
  if (!coachId) return res.status(401).json({ message: 'Unauthorized' });
  const payload = z
    .object({ athleteId: z.string().min(1), planId: z.string().min(1), comment: z.string().min(1) })
    .parse(req.body);

  return res
    .status(201)
    .json(await addPlanComment(coachId, payload.athleteId, payload.planId, payload.comment));
});
