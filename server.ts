import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import path from 'node:path';
import {GoogleGenAI, Type} from '@google/genai';

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatDeviceContext(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') {
    return 'بيانات الجهاز غير متوفرة.';
  }
  return JSON.stringify(snapshot, null, 2);
}

function parseGeminiError(err: unknown): {status: number; message: string} {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 503,
      message: 'مفتاح الذكاء الاصطناعي في الخادم يحتاج تحقق من إعدادات البيئة (Secrets).',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'تم تجاوز حد الطلبات المؤقت، جرّب بعد شوي.',
    };
  }
  return {
    status: 500,
    message: 'صار خطأ أثناء تحليل البيانات في الخادم، تأكد من الاتصال وجرب مرة ثانية.',
  };
}

async function startServer() {
  const app = express();
  app.use((req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({limit: '1mb'}));

  app.get('/api/ping', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ok: true, serverTime: Date.now()});
  });

  app.post('/api/ai/diagnose', async (req: Request, res: Response) => {
    const {problem, game, deviceSnapshot, ping} = req.body ?? {};

    if (typeof problem !== 'string' || problem.trim().length < 3) {
      res.status(400).json({error: 'اكتب وصف واضح للمشكلة اللي تواجهها (مثلاً: ببجي يقطع وقت الفايت).'});
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'خدمة الذكاء الاصطناعي غير مهيأة على الخادم حالياً (GEMINI_API_KEY غير مضبوط).',
      });
      return;
    }

    const systemInstruction = [
      'أنت GameMind، مساعد ألعاب خبير تتكلم بلهجة خليجية بسيطة، واضحة، ومحترمة.',
      'مهمتك تحلل مشكلة اللاعب بناءً على بيانات جهازه الحقيقية المرفقة فقط، بدون أي وعود وهمية أو كذب تقني (ممنوع تقول له زر يفرغ الرام أو يزيد الفريمات 50%).',
      'إذا كان بعض بيانات الجهاز غير متاح لأن التطبيق شغال على المتصفح، نبّه بشكل لطيف بدون اختراع أرقام.',
      'ارجع الإجابة بصيغة JSON مطابقة تماماً للـ schema المطلوب.',
    ].join(' ');

    const userPrompt = [
      `اللعبة: ${typeof game === 'string' && game.trim() ? game.trim() : 'غير محددة'}`,
      `وصف المشكلة من اللاعب: ${problem.trim()}`,
      `بيانات الجهاز الحقيقية:\n${formatDeviceContext(deviceSnapshot)}`,
      ping ? `قياس البنق الحقيقي:\n${formatDeviceContext(ping)}` : 'قياس البنق: لم يُقَس بعد',
    ].join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              probableCause: {type: Type.STRING},
              steps: {type: Type.ARRAY, items: {type: Type.STRING}},
              suggestedGraphics: {
                type: Type.OBJECT,
                properties: {
                  quality: {type: Type.STRING},
                  fpsTarget: {type: Type.STRING},
                  style: {type: Type.STRING},
                  antiAliasing: {type: Type.STRING},
                  shadows: {type: Type.STRING},
                  extraTip: {type: Type.STRING},
                },
                required: ['quality', 'fpsTarget', 'style', 'antiAliasing', 'shadows', 'extraTip'],
              },
              honestHardwareNote: {type: Type.STRING},
            },
            required: ['probableCause', 'steps', 'suggestedGraphics', 'honestHardwareNote'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const {status, message} = parseGeminiError(err);
      res.status(status).json({error: message});
    }
  });

  app.post('/api/ai/graphics-config', async (req: Request, res: Response) => {
    const {game, priority, deviceSnapshot} = req.body ?? {};
    if (typeof game !== 'string' || !game.trim()) {
      res.status(400).json({error: 'اختر اللعبة أول عشان نولّد لك الإعدادات المناسبة.'});
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'خدمة الذكاء الاصطناعي غير مهيأة على الخادم حالياً (GEMINI_API_KEY غير مضبوط).',
      });
      return;
    }

    const systemInstruction = [
      'أنت مهندس تحسين أداء ألعاب في GameMind تتكلم بلهجة خليجية بسيطة.',
      'تولّد أفضل إعدادات رسومات وفريمات واقعية تناسب قدرات جهاز المستخدم الحقيقية بدون مبالغة.',
    ].join(' ');

    const userPrompt = [
      `اللعبة المطلوبة: ${game.trim()}`,
      `أولوية اللاعب: ${typeof priority === 'string' ? priority : 'توازن فريمات وحرارة'}`,
      `بيانات الجهاز الحقيقية:\n${formatDeviceContext(deviceSnapshot)}`,
    ].join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gameName: {type: Type.STRING},
              presetTitle: {type: Type.STRING},
              expectedStableFps: {type: Type.STRING},
              graphicsQuality: {type: Type.STRING},
              frameRateSetting: {type: Type.STRING},
              resolutionScale: {type: Type.STRING},
              shadows: {type: Type.STRING},
              antiAliasing: {type: Type.STRING},
              autoAdjustGraphics: {type: Type.STRING},
              thermalWarning: {type: Type.STRING},
              reasoning: {type: Type.STRING},
            },
            required: [
              'gameName',
              'presetTitle',
              'expectedStableFps',
              'graphicsQuality',
              'frameRateSetting',
              'resolutionScale',
              'shadows',
              'antiAliasing',
              'autoAdjustGraphics',
              'thermalWarning',
              'reasoning',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const {status, message} = parseGeminiError(err);
      res.status(status).json({error: message});
    }
  });

  app.post('/api/ai/sensitivity-coach', async (req: Request, res: Response) => {
    const {game, playstyle, gyroMode, aimIssue, deviceSnapshot} = req.body ?? {};
    if (typeof game !== 'string' || !game.trim()) {
      res.status(400).json({error: 'اختر اللعبة عشان مدرب الحساسية يضبط لك الأرقام.'});
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'خدمة الذكاء الاصطناعي غير مهيأة على الخادم حالياً (GEMINI_API_KEY غير مضبوط).',
      });
      return;
    }

    const systemInstruction = [
      'أنت مدرب حساسية وإيم محترف في GameMind تتكلم بلهجة خليجية بسيطة وواضحة.',
      'اقترح أرقام حساسية متدرجة ومنطقية مع تمرين عملي مدته 10 دقائق في ساحة التدريب.',
    ].join(' ');

    const userPrompt = [
      `اللعبة: ${game.trim()}`,
      `أسلوب اللعب: ${typeof playstyle === 'string' ? playstyle : 'متوازن'}`,
      `الجيروسكوب: ${typeof gyroMode === 'string' ? gyroMode : 'منظار فقط'}`,
      `مشكلة الأيم الحالية: ${typeof aimIssue === 'string' ? aimIssue : 'تحسين الثبات العام'}`,
      `بيانات الجهاز:\n${formatDeviceContext(deviceSnapshot)}`,
    ].join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              coachSummary: {type: Type.STRING},
              cameraSensitivity: {
                type: Type.OBJECT,
                properties: {
                  freeLook: {type: Type.INTEGER},
                  noScope: {type: Type.INTEGER},
                  redDot: {type: Type.INTEGER},
                  scope2x: {type: Type.INTEGER},
                  scope4x: {type: Type.INTEGER},
                  scope6x: {type: Type.INTEGER},
                },
                required: ['freeLook', 'noScope', 'redDot', 'scope2x', 'scope4x', 'scope6x'],
              },
              adsSensitivity: {
                type: Type.OBJECT,
                properties: {
                  noScope: {type: Type.INTEGER},
                  redDot: {type: Type.INTEGER},
                  scope2x: {type: Type.INTEGER},
                  scope4x: {type: Type.INTEGER},
                  scope6x: {type: Type.INTEGER},
                },
                required: ['noScope', 'redDot', 'scope2x', 'scope4x', 'scope6x'],
              },
              gyroSensitivity: {
                type: Type.OBJECT,
                properties: {
                  enabledNote: {type: Type.STRING},
                  noScope: {type: Type.INTEGER},
                  redDot: {type: Type.INTEGER},
                  scope4x: {type: Type.INTEGER},
                  scope6x: {type: Type.INTEGER},
                },
                required: ['enabledNote', 'noScope', 'redDot', 'scope4x', 'scope6x'],
              },
              trainingDrill: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
            required: ['coachSummary', 'cameraSensitivity', 'adsSensitivity', 'gyroSensitivity', 'trainingDrill'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const {status, message} = parseGeminiError(err);
      res.status(status).json({error: message});
    }
  });

  app.post('/api/ai/analyze-session', async (req: Request, res: Response) => {
    const {session, profile, deviceSnapshot} = req.body ?? {};
    if (!session || typeof session !== 'object') {
      res.status(400).json({error: 'بيانات الجلسة مطلوبة للتحليل.'});
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'خدمة الذكاء الاصطناعي غير مهيأة على الخادم حالياً (GEMINI_API_KEY غير مضبوط).',
      });
      return;
    }

    const systemInstruction = [
      'أنت محلل أداء ألعاب في GameMind تتكلم بلهجة خليجية بسيطة ومباشرة.',
      'تحلل تقرير جلسة لعب حقيقية (الحرارة، استهلاك البطارية، البنق، الاختناق الحراري) مع ملف إعدادات اللعبة.',
      'لا تخترع أرقاماً غير موجودة في التقرير؛ إذا كانت الحرارة غير مقروءة على المتصفح اذكر ذلك بوضوح.',
    ].join(' ');

    const userPrompt = [
      `تقرير الجلسة الحقيقية:\n${formatDeviceContext(session)}`,
      profile ? `ملف اللعبة الحالي:\n${formatDeviceContext(profile)}` : 'ملف اللعبة: غير محدد',
      `مواصفات الجهاز:\n${formatDeviceContext(deviceSnapshot)}`,
    ].join('\n\n');

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: {type: Type.STRING},
              thermalAndBatteryInsight: {type: Type.STRING},
              networkInsight: {type: Type.STRING},
              nextSessionRecommendations: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              suggestedProfileUpdates: {
                type: Type.OBJECT,
                properties: {
                  graphicsQuality: {type: Type.STRING},
                  targetFps: {type: Type.STRING},
                  reason: {type: Type.STRING},
                },
                required: ['graphicsQuality', 'targetFps', 'reason'],
              },
            },
            required: [
              'verdict',
              'thermalAndBatteryInsight',
              'networkInsight',
              'nextSessionRecommendations',
              'suggestedProfileUpdates',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const {status, message} = parseGeminiError(err);
      res.status(status).json({error: message});
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GameMind server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start GameMind server:', err);
  process.exit(1);
});
