import { mkdir, writeFile } from 'node:fs/promises';

const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) throw new Error('FOOTBALL_DATA_TOKEN secret is required');
const response = await fetch('https://api.football-data.org/v4/competitions/PL/matches', {
  headers: { 'X-Auth-Token': token }
});
if (!response.ok) throw new Error(`football-data.org returned ${response.status}: ${await response.text()}`);
const payload = await response.json();
const matches = (payload.matches ?? []).map(m => ({
  id: m.id, utcDate: m.utcDate, status: m.status, matchday: m.matchday,
  homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName },
  awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName },
  score: { fullTime: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null } }
}));
const standingResponse = await fetch('https://api.football-data.org/v4/competitions/PL/standings', {
  headers: { 'X-Auth-Token': token }
});
if (!standingResponse.ok) throw new Error(`Standings request returned ${standingResponse.status}: ${await standingResponse.text()}`);
const standingPayload = await standingResponse.json();
const total = standingPayload.standings?.find(s => s.type === 'TOTAL')?.table ?? [];
const standings = total.map(t => ({
  position: t.position, team: { id: t.team.id, name: t.team.name, shortName: t.team.shortName },
  playedGames: t.playedGames, goalDifference: t.goalDifference, points: t.points
}));
await mkdir('site', { recursive: true });
await writeFile('site/data.json', JSON.stringify({
  updatedAt: new Date().toISOString(), season: payload.filters?.season ?? standingPayload.season?.startDate?.slice(0, 4),
  matches, standings
}, null, 2) + '\n');
console.log(`Wrote ${matches.length} matches and ${standings.length} table rows`);
