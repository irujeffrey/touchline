import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) throw new Error('FOOTBALL_DATA_TOKEN secret is required');
const today = new Date();
const date = offset => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
// Omit the competition filter so football-data.org returns all competitions
// available to this token (12 on the free tier).
const params = new URLSearchParams({ dateFrom: date(-180), dateTo: date(270) });
const response = await fetch(`https://api.football-data.org/v4/matches?${params}`, {
  headers: { 'X-Auth-Token': token }
});
if (!response.ok) throw new Error(`football-data.org returned ${response.status}: ${await response.text()}`);
const payload = await response.json();
const matches = (payload.matches ?? []).map(m => ({
  id: m.id, utcDate: m.utcDate, status: m.status, matchday: m.matchday,
  competition: { id: m.competition.id, name: m.competition.name, code: m.competition.code },
  homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName },
  awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName },
  score: { fullTime: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null } }
}));
await mkdir('site', { recursive: true });
await writeFile('site/data.json', JSON.stringify({
  updatedAt: new Date().toISOString(),
  coverage: payload.resultSet?.competitions ?? '',
  matches
}, null, 2) + '\n');
console.log(`Wrote ${matches.length} matches across ${new Set(matches.map(m => m.competition.code)).size} available competitions`);
