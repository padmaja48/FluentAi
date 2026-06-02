import OpenAI, { toFile } from 'openai';
import { env } from '../config/env';

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })
  : null;
const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL })
  : null;

type InterviewContext = {
  roleLevel: string;
  roleDomain: string;
  interviewStyle: string;
  duration: number;
  resumeText?: string;
  personaId?: string;
  personaPersonality?: string;
  interviewType?: string;
  complexity?: string;
  resumeSkills?: string[];
  resumeExperienceLevel?: string;
  resumeSuggestedQuestions?: string[];
  resumeSummary?: string;
};

export type GeneratedQuestion = {
  question: string;
  expectedSignals: string[];
  questionType?: 'behavioural' | 'technical' | 'situational';
  resumeReference?: string;
};

export type AnswerEvaluation = {
  score: number;
  feedback: string;
  communicationScore: number;
  technicalScore: number;
  behavioralScore: number;
};

export type QuestionAnalysisItem = {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  whatWorked: string;
  whatToImprove: string;
  questionType: string;
  resumeReference: string;
};

export type InterviewReport = {
  communicationScore: number;
  technicalScore: number;
  behavioralScore: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  transcriptSummary: string;
  questionAnalysis?: QuestionAnalysisItem[];
};

export type ResumeAnalysis = {
  summary: string;
  skills: string[];
  experienceLevel: string;
  yearsOfExperience: number;
  score: number;
  strengths: string[];
  gaps: string[];
  suggestedQuestions: string[];
};

const extractJson = <T>(text: string): T => {
  const cleaned = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as T;
};

const generateJson = async <T>(prompt: string, fallback: T): Promise<T> => {
  if (env.AI_PROVIDER === 'openai' && openai) {
    const client = openai as unknown as {
      responses: {
        create(input: {
          model: string;
          input: string;
          text: { format: { type: 'json_object' } };
        }): Promise<{ output_text: string }>;
      };
    };

    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      input: prompt,
      text: { format: { type: 'json_object' } },
    });

    return extractJson<T>(response.output_text);
  }

  if (env.AI_PROVIDER === 'groq' && groq) {
    const response = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: 'Return strict JSON only. Do not include markdown.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    return extractJson<T>(response.choices[0]?.message?.content ?? '{}');
  }

  return fallback;
};

export const transcribeAudio = async (file: Express.Multer.File) => {
  const client = env.AI_PROVIDER === 'groq' ? groq : openai;
  const model = env.AI_PROVIDER === 'groq' ? env.GROQ_WHISPER_MODEL : env.WHISPER_MODEL;

  if (!client) {
    return {
      text: `Transcription unavailable locally for ${file.originalname}. Configure ${env.AI_PROVIDER.toUpperCase()}_API_KEY to enable speech recognition.`,
      model,
    };
  }

  const uploadedFile = await toFile(file.buffer, file.originalname, { type: file.mimetype });
  const response = await client.audio.transcriptions.create({
    file: uploadedFile,
    model,
  });

  return {
    text: response.text,
    model,
  };
};

const PERSONA_PERSONALITIES: Record<string, string> = {
  'us-american': 'You are Ryan Carter, a Senior Tech Lead from Silicon Valley. You are direct, value concrete examples, and use STAR method prompts. You expect candidates to be specific and results-driven.',
  'us-indian': 'You are Priya Sharma, an Engineering Manager at a Fortune 500 Tech company. You are analytical, probe technical depth, and ask thorough follow-up questions. You value structured thinking.',
  'us-australian': 'You are James Callahan, a Product Director at a Global Tech Co. You are conversational, test cultural fit, and are relaxed but sharp. You value adaptability and big-picture thinking.',
  'ru-russian': 'You are Alexei Volkov, a Principal Engineer at a Global Systems company. You are precise and methodical. You focus on algorithmic thinking, system design, and rigorous problem-solving. You expect well-structured, logically sound answers and will probe deeply into technical reasoning.',
};

export const generateInterviewQuestions = (context: InterviewContext) => {
  const questionCount = Math.max(4, Math.ceil(context.duration / 5));

  const personaBlock = context.personaPersonality
    ? `\nYOU ARE: A ${context.personaId ?? 'professional'} interviewer.\nPersonality: ${context.personaPersonality}\nAsk questions in your persona's natural tone and style.\n`
    : context.personaId
    ? `\nInterviewer persona: ${PERSONA_PERSONALITIES[context.personaId] ?? 'Professional interviewer'}\n`
    : '';

  const resumeBlock = context.resumeSummary
    ? `
CANDIDATE RESUME SUMMARY:
${context.resumeSummary}

CANDIDATE SKILLS (from resume): ${(context.resumeSkills ?? []).join(', ')}
EXPERIENCE LEVEL (from resume): ${context.resumeExperienceLevel ?? context.roleLevel}
PRE-SUGGESTED QUESTIONS (use as inspiration, rephrase/adapt them):
${(context.resumeSuggestedQuestions ?? []).map((q, i) => `${i + 1}. ${q}`).join('\n')}
`
    : context.resumeText
    ? `\nResume context: ${context.resumeText}\n`
    : `\nRole domain: ${context.roleDomain}\nRole level: ${context.roleLevel}\n`;

  const styleInstruction = context.interviewType === 'Behavioural'
    ? 'All questions must be STAR-method behavioural (Situation/Task/Action/Result). Start with "Tell me about a time when..."'
    : context.interviewType === 'Technical'
    ? 'All questions must probe technical depth — architecture decisions, specific technologies from the resume, trade-offs, debugging approaches.'
    : 'Mix behavioural STAR questions and technical depth questions equally.';

  const complexityNote = context.complexity === 'Beginner'
    ? 'Keep questions at entry-level, avoid deep system design.'
    : context.complexity === 'Advanced'
    ? 'Ask senior-level questions including system design, leadership, and strategic trade-offs.'
    : 'Intermediate complexity — blend theory with practical examples.';

  return generateJson<{ questions: GeneratedQuestion[] }>(
    `Generate exactly ${questionCount} unique interview questions as a JSON object with a "questions" array.
${personaBlock}
${resumeBlock}
INTERVIEW STYLE: ${styleInstruction}
${complexityNote}

STRICT RULES:
- Every question MUST reference something specific from the resume (a skill, project, role, or technology)
- NO generic questions unless adapted to a resume skill
- NO two questions may be semantically similar
- Questions ordered: warm-up → core depth → challenging follow-up
- Scale complexity to: ${context.roleLevel}

Each question object MUST have:
- question: string (the exact question to ask)
- expectedSignals: string[] (2-4 things a strong answer would include)
- questionType: "behavioural" | "technical" | "situational"
- resumeReference: string (which resume element this question targets, or "general" if no resume)

Return ONLY valid JSON. No markdown, no preamble.`,
    {
      questions: [
        {
          question: `Walk me through the most impactful project on your resume and the specific technical decisions you made.`,
          expectedSignals: ['ownership', 'technical tradeoffs', 'measurable outcome'],
          questionType: 'technical',
          resumeReference: 'most recent role',
        },
        {
          question: 'Describe a difficult technical problem you solved and how you validated the solution.',
          expectedSignals: ['problem decomposition', 'testing', 'communication'],
          questionType: 'technical',
          resumeReference: 'general',
        },
        {
          question: 'Tell me about a time you received feedback and changed your approach.',
          expectedSignals: ['self-awareness', 'behavioral growth', 'collaboration'],
          questionType: 'behavioural',
          resumeReference: 'general',
        },
      ],
    },
  );
};

export const evaluateAnswer = (question: string, answer: string) => {
  // Detect empty / skipped answers immediately — no AI call needed
  const trimmed = answer.trim();
  const isSkipped =
    !trimmed ||
    trimmed === '(no answer)' ||
    trimmed.length < 10 ||
    /^\(?(no answer|skipped?|n\/a|nothing|none)\)?$/i.test(trimmed);

  if (isSkipped) {
    return Promise.resolve<AnswerEvaluation>({
      score: 0,
      feedback: 'No answer was provided for this question. Skipped or empty answers score zero.',
      communicationScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
    });
  }

  return generateJson<AnswerEvaluation>(
    `You are a strict, professional interview evaluator. Evaluate the candidate's answer to the interview question below.

QUESTION: ${question}

CANDIDATE ANSWER: ${answer}

SCORING RULES (be strict and honest — do NOT inflate scores):
- Score 0–20  → No meaningful answer, completely off-topic, or just a few words
- Score 21–40 → Very vague, generic, no specific examples or evidence
- Score 41–60 → Partially addresses the question but lacks depth, specifics, or structure
- Score 61–80 → Good answer with relevant examples, clear structure, some depth
- Score 81–100 → Excellent: specific, structured (STAR/situation-action-result), insightful, with measurable outcomes

IMPORTANT:
- If the answer is very short (under 2 sentences), the maximum score is 30
- If the answer contains no specific examples or evidence, cap at 50
- If the answer is a filler phrase, meaningless text, or off-topic, score it 0–15
- Do NOT give high scores to vague answers — be honest even if it means scoring 10 or 20
- The communicationScore reflects clarity and structure of expression
- The technicalScore reflects relevance of technical knowledge shown (0 if non-technical question)
- The behavioralScore reflects self-awareness, teamwork, and professional maturity shown

Return ONLY a JSON object:
{
  "score": number (0-100, strict),
  "feedback": string (2-3 sentences, reference the actual answer content — what was good or missing),
  "communicationScore": number (0-100),
  "technicalScore": number (0-100),
  "behavioralScore": number (0-100)
}`,
    {
      score: 0,
      feedback: 'Unable to evaluate this answer. No meaningful content was detected.',
      communicationScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
    },
  );
};

export type WritingEvaluation = {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  grammarScore: number;
  vocabularyScore: number;
  coherenceScore: number;
  taskAchievementScore: number;
};

export const evaluateWriting = (prompt: string, level: string, criteria: string, userText: string) =>
  generateJson<WritingEvaluation>(
    `You are an English language writing examiner. Evaluate the following student writing response.

CEFR Level: ${level}
Task prompt: ${prompt}
Evaluation criteria: ${criteria}
Student response: ${userText}

Return a JSON object with:
- score (0-100 overall)
- feedback (2-3 sentences of actionable feedback)
- strengths (array of 2 specific strengths)
- improvements (array of 2 specific improvements)
- grammarScore (0-100)
- vocabularyScore (0-100)
- coherenceScore (0-100)
- taskAchievementScore (0-100)

Be fair but honest. A short or off-topic response should score low. A well-structured, appropriate response should score high.`,
    {
      score: Math.min(80, Math.max(30, Math.round(userText.split(/\s+/).length * 1.5))),
      feedback: 'Your response shows effort. Focus on organising your ideas clearly and using vocabulary appropriate for your level.',
      strengths: ['Shows an attempt to address the prompt', 'Uses basic sentence structures'],
      improvements: ['Develop your ideas with more specific details', 'Check grammar and punctuation carefully'],
      grammarScore: 60,
      vocabularyScore: 60,
      coherenceScore: 55,
      taskAchievementScore: 60,
    },
  );

export const generateReport = (
  transcript: Array<{ question: string; answer?: string; feedback?: string; score?: number; questionType?: string; resumeReference?: string }>
) => {
  // Pre-compute honest per-question scores for skipped/empty answers
  const answeredCount = transcript.filter(t => {
    const a = (t.answer ?? '').trim();
    return a && a !== '(no answer)' && a.length >= 10 && !/^\(?(no answer|skipped?|n\/a|nothing|none)\)?$/i.test(a);
  }).length;
  const totalCount = transcript.length;
  const participationRatio = totalCount > 0 ? answeredCount / totalCount : 0;

  // If participation is zero or near-zero, return a real zero-score report immediately
  if (participationRatio === 0) {
    return Promise.resolve<InterviewReport>({
      communicationScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
      overallScore: 0,
      strengths: [],
      improvements: [
        'No answers were provided during the interview.',
        'The candidate did not respond to any of the questions.',
        'A complete re-attempt of the interview is recommended.',
      ],
      recommendations: [
        'Attempt the interview again and answer each question.',
        'Prepare for each question type before starting.',
        'Use the STAR method for behavioral questions.',
      ],
      transcriptSummary: 'The candidate did not answer any interview questions. No performance could be evaluated.',
      questionAnalysis: transcript.map(t => ({
        question: t.question,
        answer: t.answer ?? '(no answer)',
        score: 0,
        feedback: 'No answer was provided for this question.',
        whatWorked: 'Nothing — no answer was given.',
        whatToImprove: 'Provide a substantive answer addressing the question directly.',
        questionType: t.questionType ?? 'general',
        resumeReference: t.resumeReference ?? 'general',
      })),
    });
  }

  // For the per-question scores already computed by evaluateAnswer, use them as ground truth
  const precomputedAvg = transcript.reduce((sum, t) => sum + (t.score ?? 0), 0) / Math.max(1, totalCount);

  return generateJson<InterviewReport>(
    `You are a strict, professional interview panel evaluator. Generate an honest performance report from this Q&A transcript.

TRANSCRIPT:
${JSON.stringify(transcript, null, 2)}

STRICT EVALUATION RULES:
1. Answers that are empty, "(no answer)", very short (under 2 sentences), or completely vague must be scored 0–20
2. Do NOT inflate scores — if the candidate gave weak answers, the overall score must reflect that honestly
3. The overallScore must be the weighted average of the per-question scores — do NOT invent a higher number
4. ${answeredCount} out of ${totalCount} questions were answered. This participation rate (${Math.round(participationRatio * 100)}%) must factor into all scores
5. If fewer than half the questions were answered, no score category should exceed 50
6. Pre-computed average per-question score: ${Math.round(precomputedAvg)} — your overallScore should be close to this
7. Strengths array must be EMPTY [] if the candidate gave no meaningful answers
8. Reference actual answer content in all feedback — do NOT fabricate content the candidate did not say

Return ONLY this exact JSON structure (no markdown):
{
  "communicationScore": number (0-100, strict),
  "technicalScore": number (0-100, strict),
  "behavioralScore": number (0-100, strict),
  "overallScore": number (0-100, strict — must reflect actual answer quality),
  "strengths": string[] (only include real strengths evidenced in the answers — empty array if none),
  "improvements": string[] (3-5 specific, honest improvement areas based on what was missing),
  "recommendations": string[] (3-5 concrete, actionable next steps),
  "transcriptSummary": string (honest 2-3 sentence summary of actual performance),
  "questionAnalysis": [
    {
      "question": string,
      "answer": string (exact answer given, or "(no answer)"),
      "score": number (0-100, strict),
      "feedback": string (honest 2-3 sentences referencing actual answer content),
      "whatWorked": string (what specifically was good, or "Nothing — no answer was provided"),
      "whatToImprove": string (specific gap or "Provide a substantive answer"),
      "questionType": string,
      "resumeReference": string
    }
  ]
}`,
    {
      communicationScore: Math.round(precomputedAvg * 0.9),
      technicalScore: Math.round(precomputedAvg * 0.9),
      behavioralScore: Math.round(precomputedAvg * 0.9),
      overallScore: Math.round(precomputedAvg),
      strengths: answeredCount > 0 ? ['Some questions were attempted'] : [],
      improvements: ['Provide specific, structured answers to each question', 'Use the STAR method for behavioral questions'],
      recommendations: ['Practice answering interview questions aloud', 'Prepare concrete examples from past experience'],
      transcriptSummary: `The candidate answered ${answeredCount} of ${totalCount} questions with an average score of ${Math.round(precomputedAvg)}.`,
      questionAnalysis: transcript.map(t => ({
        question: t.question,
        answer: t.answer ?? '(no answer)',
        score: t.score ?? 0,
        feedback: t.feedback ?? 'No answer was provided.',
        whatWorked: t.score && t.score > 40 ? 'Some relevant content was provided' : 'Nothing — no meaningful answer was given.',
        whatToImprove: 'Provide a complete, structured answer with specific examples.',
        questionType: t.questionType ?? 'general',
        resumeReference: t.resumeReference ?? 'general',
      })),
    },
  );
};

export const analyzeResume = (resumeText: string) =>
  generateJson<ResumeAnalysis>(
    `Analyze this resume as JSON:
${resumeText}
Return summary, skills, experienceLevel, yearsOfExperience, score, strengths, gaps, suggestedQuestions.`,
    {
      summary: 'Resume uploaded successfully. Add API credentials for a full AI analysis.',
      skills: ['Communication', 'Problem Solving'],
      experienceLevel: 'Unknown',
      yearsOfExperience: 0,
      score: 60,
      strengths: ['Readable resume structure'],
      gaps: ['AI provider is not configured, so deep extraction is unavailable'],
      suggestedQuestions: ['Which project best represents your current skill level?'],
    },
  );
