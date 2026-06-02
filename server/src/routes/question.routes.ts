import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Question } from '../models/Question';
import { uploadBuffer } from '../services/storage.service';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

const idSchema = z.object({ params: z.object({ id: z.string().min(1) }) });
const questionSchema = z.object({
  body: z.object({
    stem: z.string().min(3),
    skill: z.enum(['Listening', 'Speaking', 'Reading', 'Writing']),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
    type: z.enum(['MCQ', 'T-F-NG', 'Task', 'Essay']),
    options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).default([]),
    correctAnswer: z.string().optional(),
    explanation: z.string().optional(),
    status: z.enum(['Draft', 'Active', 'Archived']).default('Active'),
  }),
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skill, level, status, type, random, limit } = req.query;
    const query: Record<string, unknown> = {};
    if (skill) query.skill = skill;
    if (level) query.level = level;
    if (status) query.status = status;
    if (type) query.type = type;

    if (random === 'true') {
      const sampleSize = Math.min(Number(limit) || 10, 50);
      const questions = await Question.aggregate([
        { $match: { ...query, status: query.status ?? 'Active' } },
        { $sample: { size: sampleSize } },
      ]);
      res.json(questions);
      return;
    }

    const questions = await Question.find(query).sort({
      skillOrder: 1,
      levelOrder: 1,
      journeyOrder: 1,
      createdAt: 1,
    });
    res.json(questions);
  }),
);

router.get(
  '/:id',
  validate(idSchema),
  asyncHandler(async (req, res) => {
    const question = await Question.findById(req.params.id);
    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    res.json(question);
  }),
);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const question = await Question.create(req.body);
    res.status(201).json(question);
  }),
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idSchema.merge(questionSchema.partial())),
  asyncHandler(async (req, res) => {
    const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!question) {
      throw new AppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    }
    res.json(question);
  }),
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate(idSchema),
  asyncHandler(async (req, res) => {
    await Question.findByIdAndDelete(req.params.id);
    res.status(204).send();
  }),
);

// ── Audio file upload → Cloudinary ────────────────────────────────
router.post(
  '/upload-audio',
  authenticate,
  authorize('admin'),
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('No audio file provided', 400, 'NO_FILE');
    const stored = await uploadBuffer(req.file, 'recordings');
    res.json({ audioUrl: stored.url });
  }),
);

// ── Bulk JSON insert ──────────────────────────────────────────────
router.post(
  '/bulk',
  authenticate,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const rows: unknown[] = Array.isArray(req.body.questions) ? req.body.questions : [];
    if (!rows.length) throw new AppError('No questions provided', 400, 'NO_QUESTIONS');

    const inserted: unknown[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const q = await Question.create(rows[i]);
        inserted.push(q);
      } catch (err: unknown) {
        errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
      }
    }

    res.json({ inserted: inserted.length, errors });
  }),
);

export default router;
