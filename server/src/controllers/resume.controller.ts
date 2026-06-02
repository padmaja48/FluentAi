import { z } from 'zod';
import { Resume } from '../models/Resume';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { analyzeResume } from '../services/ai.service';
import { uploadBuffer } from '../services/storage.service';

export const resumeParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const extractResumeText = (file: Express.Multer.File, fallbackText?: string) => {
  if (fallbackText?.trim()) {
    return fallbackText.trim();
  }

  if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt')) {
    return file.buffer.toString('utf8').trim();
  }

  return `Uploaded file: ${file.originalname}. Binary parsing is unavailable in this local runtime; use pasted resumeText for deeper analysis.`;
};

export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Resume file is required', 400, 'FILE_REQUIRED');
  }

  const storedFile = await uploadBuffer(req.file, 'resumes');
  const rawText = extractResumeText(req.file, req.body.resumeText);
  const analysis = await analyzeResume(rawText);

  const resume = await Resume.create({
    userId: req.userId,
    fileUrl: storedFile.url,
    filePublicId: storedFile.publicId,
    fileName: req.file.originalname,
    rawText,
    analysis,
  });

  res.status(201).json(resume);
});

export const getResumeHistory = asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(resumes);
});

export const getResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.userId });
  if (!resume) {
    throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
  }

  res.json(resume);
});
