const Anthropic = require('@anthropic-ai/sdk');
const { getDayActivities, getSettings, saveAiSummary, getDailyStats, getWeeklyStats, saveBriefing, getBriefing } = require('./db');

// --- Journal summary (existing, sonnet) ---

async function generateDailySummary(date) {
  const settings = getSettings();
  const apiKey = settings.api_key;

  if (!apiKey) {
    throw new Error('Claude API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const activities = getDayActivities(date);
  if (activities.length === 0) {
    throw new Error('해당 날짜에 기록된 활동이 없습니다.');
  }

  const activityList = activities.map(a => {
    const minutes = Math.round(a.totalSec / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
    return `- ${a.process_name} (${a.window_title}): ${timeStr}`;
  }).join('\n');

  const totalMinutes = activities.reduce((sum, a) => sum + a.totalSec, 0) / 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = Math.round(totalMinutes % 60);

  const prompt = `오늘(${date}) 하루 동안의 컴퓨터 사용 기록입니다. 총 사용 시간: ${totalHours}시간 ${totalMins}분

${activityList}

위 데이터를 바탕으로 다음을 한국어로 작성해주세요:
1. 오늘 하루 업무 요약 (3-5문장)
2. 주요 활동 카테고리별 시간 분석
3. 업무 패턴에 대한 간단한 인사이트 1가지

간결하고 실용적으로 작성해주세요.`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const summary = response.content[0].text;
  saveAiSummary(date, summary);
  return summary;
}

// --- Morning briefing (v2, haiku) ---

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

async function generateMorningBriefing(date) {
  // Check cache first
  const cached = getBriefing(date);
  if (cached) return cached;

  const settings = getSettings();
  const apiKey = settings.api_key;

  if (!apiKey) {
    throw new Error('Claude API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  // Get yesterday's stats
  const yesterday = new Date(date + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const stats = getDailyStats(yesterdayStr);
  if (stats.totalSec === 0) {
    const briefing = {
      summary: '어제 기록된 활동이 없습니다.',
      pattern: null,
      suggestion: null
    };
    saveBriefing(date, briefing);
    return briefing;
  }

  // Get weekly context
  const weekly = getWeeklyStats(yesterdayStr);

  // Build breakdown string
  const breakdownStr = Object.entries(stats.breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, sec]) => `- ${cat}: ${formatTime(sec)}`)
    .join('\n');

  const weeklyScores = weekly.days
    .map(d => d.focusScore !== null ? `${d.date}: ${d.focusScore}점` : `${d.date}: 데이터 부족`)
    .join(', ');

  const prompt = `오늘은 ${date}입니다. 어제(${yesterdayStr})의 컴퓨터 사용 데이터:

카테고리별 시간:
${breakdownStr}

집중 점수: ${stats.focusScore !== null ? `${stats.focusScore}/100` : '데이터 부족 (활동 2시간 미만)'}
딥워크 시간: ${formatTime(stats.deepWorkSec)}
총 활동 시간: ${formatTime(stats.totalSec)}

이번 주 집중 점수 추이: ${weeklyScores}

다음 JSON 형식으로 한국어 응답해주세요. JSON만 출력하고 다른 텍스트는 넣지 마세요:
{
  "summary": "어제 하루 요약 (1-2문장, 구체적 숫자 포함)",
  "pattern": "발견한 패턴 또는 변화 (1문장)",
  "suggestion": "오늘을 위한 구체적 제안 (1문장)"
}`;

  const client = new Anthropic({ apiKey });

  // Try up to 2 times for valid JSON
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text.trim();
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const briefing = JSON.parse(jsonMatch[0]);
      if (!briefing.summary) throw new Error('Missing summary field');

      saveBriefing(date, briefing);
      return briefing;
    } catch (parseErr) {
      if (attempt === 1) {
        // Final fallback: use raw text
        const fallback = {
          summary: `어제 총 ${formatTime(stats.totalSec)} 활동, 집중 점수 ${stats.focusScore ?? '측정 불가'}.`,
          pattern: null,
          suggestion: null
        };
        saveBriefing(date, fallback);
        return fallback;
      }
    }
  }
}

// --- Weekly report (v2, haiku) ---

async function generateWeeklyReport(weekEndDate) {
  const settings = getSettings();
  const apiKey = settings.api_key;

  if (!apiKey) {
    throw new Error('Claude API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  const weekly = getWeeklyStats(weekEndDate);
  if (weekly.totalSec === 0) {
    throw new Error('해당 주에 기록된 활동이 없습니다.');
  }

  const dayByDay = weekly.days.map(d => {
    const bk = Object.entries(d.breakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, sec]) => `${cat}: ${formatTime(sec)}`)
      .join(', ');
    return `${d.date}: 집중 ${d.focusScore ?? '?'}점, 딥워크 ${formatTime(d.deepWorkSec)}, 총 ${formatTime(d.totalSec)} (${bk})`;
  }).join('\n');

  const prompt = `이번 주(${weekly.days[0].date} ~ ${weekEndDate}) 7일간의 데이터입니다:

${dayByDay}

주간 평균 집중 점수: ${weekly.avgScore ?? '측정 불가'}
주간 총 활동 시간: ${formatTime(weekly.totalSec)}

다음 JSON 형식으로 한국어 응답해주세요. JSON만 출력하고 다른 텍스트는 넣지 마세요:
{
  "weekly_summary": "이번 주 종합 요약 (2-3문장)",
  "best_day": "가장 집중했던 날과 이유 (1문장)",
  "trend": "주중 패턴 또는 변화 (1문장)",
  "next_week_suggestion": "다음 주를 위한 구체적 제안 (1문장)"
}`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { weekly_summary: text, best_day: null, trend: null, next_week_suggestion: null };
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { weekly_summary: text, best_day: null, trend: null, next_week_suggestion: null };
  }
}

module.exports = { generateDailySummary, generateMorningBriefing, generateWeeklyReport };
