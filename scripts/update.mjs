import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) throw new Error('FOOTBALL_DATA_TOKEN secret is required');

// The all-matches endpoint allows a maximum 10-day date window. Fetch the
// current season through each competition endpoint instead. The free plan
// permits 10 calls/minute, so space requests by at least 6 seconds.
const headers = { 'X-Auth-Token': token };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let requestCount = 0;
async function getJson(url) {
  if (requestCount > 0) await pause(6200);
  requestCount++;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`football-data.org returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

const catalog = await getJson('https://api.football-data.org/v4/competitions');
const competitions = (catalog.competitions ?? []).filter(c => c.code && c.currentSeason);
if (!competitions.length) throw new Error('No competitions with a current season were returned for this token');

const allMatches = [];
for (const competition of competitions) {
  const season = competition.currentSeason.startDate?.slice(0, 4);
  const suffix = season ? `?season=${encodeURIComponent(season)}` : '';
  const payload = await getJson(`https://api.football-data.org/v4/competitions/${encodeURIComponent(competition.code)}/matches${suffix}`);
  for (const m of payload.matches ?? []) {
    allMatches.push({
      id: m.id,
      utcDate: m.utcDate,
      status: m.status,
      matchday: m.matchday,
      competition: {
        id: m.competition?.id ?? competition.id,
        name: m.competition?.name ?? competition.name,
        code: m.competition?.code ?? competition.code
      },
      homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName },
      awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName },
      score: { fullTime: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null } }
    });
  }
}

const uniqueMatches = [...new Map(allMatches.map(m => [m.id, m])).values()]
  .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
const coverage = competitions.map(c => c.name).join(', ');
await mkdir('site', { recursive: true });
await writeFile('site/data.json', JSON.stringify({
  updatedAt: new Date().toISOString(),
  coverage,
  matches: uniqueMatches
}, null, 2) + '\n');
console.log(`Wrote ${uniqueMatches.length} matches across ${competitions.length} competitions using ${requestCount} API calls`);
