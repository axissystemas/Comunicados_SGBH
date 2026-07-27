import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Helper for formatting date strings to en-US (e.g., 2026-01-02 -> January 2, 2026)
function formatDateEnUS(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [year, month, day] = parts;
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch {}
  return dateStr;
}

// Helper for formatting date strings to zh-CN (e.g., 2026-01-02 -> 2026年1月2日)
function formatDateZhCN(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [year, month, day] = parts;
      return `${year}年${month}月${day}日`;
    }
  } catch {}
  return dateStr;
}

// Helper for 24h -> 12h AM/PM for en-US (e.g., 23:00 -> 11:00 PM)
function formatTimeEnUS(timeStr?: string): string {
  if (!timeStr || !timeStr.trim()) return "";
  try {
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.padStart(2, '0')} ${ampm}`;
  } catch {}
  return timeStr;
}

// Free Google Translate fetcher for custom text strings
async function translateStringFree(text: string, targetLang: 'en-US' | 'zh-CN'): Promise<string> {
  if (!text || !text.trim()) return text;
  const target = targetLang === 'en-US' ? 'en' : 'zh-CN';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((item: any) => item[0]).join('');
      }
    }
  } catch (e) {
    console.warn("Free Google Translate failed:", e);
  }

  // Fallback to MyMemory
  try {
    const pair = targetLang === 'en-US' ? 'pt|en' : 'pt|zh-CN';
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        return data.responseData.translatedText;
      }
    }
  } catch (e) {
    console.warn("MyMemory fallback failed:", e);
  }

  return text;
}

// High-quality structured fallback for American English (en-US) and Simplified Chinese (zh-CN)
async function generateStructuredTranslations(currentData: any) {
  const windows = currentData?.windows || [];

  const rawTitle = currentData?.customTitlePt || currentData?.title || "Comunicado de Manutenção de TI";
  const rawIntro = currentData?.customIntro || "Prezados,\nComunicamos que será realizada uma manutenção programada nos ambientes de TI.";
  const rawWarning = "Durante este período, os serviços listados poderão apresentar instabilidade. Recomendamos salvar todos os trabalhos antes do início.";

  const [enTitle, zhTitle] = await Promise.all([
    translateStringFree(rawTitle, 'en-US'),
    translateStringFree(rawTitle, 'zh-CN')
  ]);

  const [enIntro, zhIntro] = await Promise.all([
    translateStringFree(rawIntro, 'en-US'),
    translateStringFree(rawIntro, 'zh-CN')
  ]);

  const [enWarning, zhWarning] = await Promise.all([
    translateStringFree(rawWarning, 'en-US'),
    translateStringFree(rawWarning, 'zh-CN')
  ]);

  const enWindows = await Promise.all(windows.map(async (w: any) => {
    const sysJoined = (w.systems || []).join(' / ');
    const translatedSys = await translateStringFree(sysJoined, 'en-US');
    const userAddText = w.additionalText ? await translateStringFree(w.additionalText, 'en-US') : '';

    if (w.showStandardText === false) {
      return {
        systems: translatedSys || sysJoined,
        text: userAddText
      };
    }

    const startDate = formatDateEnUS(w.startDate);
    const endDate = formatDateEnUS(w.endDate);
    const startTime = formatTimeEnUS(w.startTime);
    const endTime = formatTimeEnUS(w.endTime);

    let timingSentence = '';
    if (w.startDate && w.endDate && w.startDate === w.endDate) {
      timingSentence = `On ${startDate}, from ${startTime} to ${endTime}.`;
    } else if (w.startDate && w.endDate) {
      timingSentence = `Starting on ${startDate} at ${startTime} until ${endDate} at ${endTime}.`;
    } else {
      timingSentence = `Scheduled IT maintenance window.`;
    }

    const fullText = userAddText ? `${timingSentence} ${userAddText}` : timingSentence;

    return {
      systems: translatedSys || sysJoined,
      text: fullText
    };
  }));

  const zhWindows = await Promise.all(windows.map(async (w: any) => {
    const sysJoined = (w.systems || []).join(' / ');
    const translatedSys = await translateStringFree(sysJoined, 'zh-CN');
    const userAddText = w.additionalText ? await translateStringFree(w.additionalText, 'zh-CN') : '';

    if (w.showStandardText === false) {
      return {
        systems: translatedSys || sysJoined,
        text: userAddText
      };
    }

    const startDate = formatDateZhCN(w.startDate);
    const endDate = formatDateZhCN(w.endDate);
    const startTime = w.startTime || '';
    const endTime = w.endTime || '';

    let timingSentence = '';
    if (w.startDate && w.endDate && w.startDate === w.endDate) {
      timingSentence = `维护时间：${startDate} ${startTime} 至 ${endTime}。`;
    } else if (w.startDate && w.endDate) {
      timingSentence = `维护时间：${startDate} ${startTime} 至 ${endDate} ${endTime}。`;
    } else {
      timingSentence = `IT 系统计划维护。`;
    }

    const fullText = userAddText ? `${timingSentence} ${userAddText}` : timingSentence;

    return {
      systems: translatedSys || sysJoined,
      text: fullText
    };
  }));

  return {
    en: {
      title: enTitle || "IT System Maintenance Notification",
      intro: enIntro || "Please be advised that scheduled IT maintenance will take place as detailed below.",
      warning: enWarning || "During this period, the listed services may experience instability. We recommend saving all work prior to the start time.",
      windows: enWindows
    },
    zh: {
      title: zhTitle || "IT 系统计划维护通知",
      intro: zhIntro || "敬请注意，IT 系统计划维护将按以下详细安排进行。",
      warning: zhWarning || "在此期间，相关服务可能会出现暂时的不稳定。建议在维护开始前保存所有工作。",
      windows: zhWindows
    }
  };
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { currentData, prompt } = body;

    const customGoogleKey = currentData?.settings?.googleApiKey?.trim();
    const serverGoogleKey = process.env.GEMINI_API_KEY?.trim();
    const openaiKey = currentData?.settings?.openaiApiKey?.trim();

    const effectiveGoogleKey = customGoogleKey || serverGoogleKey;

    let responseText = "";

    if (effectiveGoogleKey) {
      const ai = new GoogleGenAI({ apiKey: effectiveGoogleKey });
      const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
      let lastError: any = null;

      const schemaConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                intro: { type: Type.STRING },
                warning: { type: Type.STRING },
                windows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      systems: { type: Type.STRING },
                      text: { type: Type.STRING }
                    }
                  }
                }
              }
            },
            zh: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                intro: { type: Type.STRING },
                warning: { type: Type.STRING },
                windows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      systems: { type: Type.STRING },
                      text: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      };

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: schemaConfig
          });
          if (response.text) {
            responseText = response.text;
            lastError = null;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Model ${modelName} failed:`, err?.message || err);
        }
      }

      if (!responseText && lastError) {
        console.warn("Gemini API quota/error hit. Executing structured translation fallback for en-US & zh-CN.");
        const fallbackResult = await generateStructuredTranslations(currentData);
        return NextResponse.json(fallbackResult);
      }
    } else if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional IT translator. Translate maintenance memos into American English (en-US) and Simplified Chinese (zh-CN)." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });
      responseText = completion.choices[0].message.content || "";
    }

    if (!responseText) {
      const fallbackResult = await generateStructuredTranslations(currentData);
      return NextResponse.json(fallbackResult);
    }

    const jsonResult = JSON.parse(responseText);
    return NextResponse.json(jsonResult);
  } catch (error: any) {
    console.error("Translation error in API route:", error);
    const fallbackResult = await generateStructuredTranslations(body?.currentData);
    return NextResponse.json(fallbackResult);
  }
}
