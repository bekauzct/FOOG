import { prisma } from '../db';
import { notify } from '../notify';

export const ACHIEVEMENTS = [
  { id: 'first_match', title: 'Birinchi o‘yin', description: 'FOOG orqali birinchi o‘yiningizni o‘ynang', icon: 'sports_soccer', rarity: 'Oddiy', goal: 1 },
  { id: 'hat_trick', title: 'Hat-trick qahramoni', description: 'Bitta o‘yinda 3 ta gol uring', icon: 'sports_soccer', rarity: 'Kam uchraydi', goal: 1 },
  { id: 'mvp10', title: 'MVP ×10', description: '10 marta o‘yin MVP si bo‘ling', icon: 'star', rarity: 'Epik', goal: 10 },
  { id: 'iron_keeper', title: 'Temir darvozabon', description: 'Darvozabon sifatida 10 ta quruq o‘yin', icon: 'lock', rarity: 'Epik', goal: 10 },
  { id: 'playmaker', title: 'Pleymeyker', description: '25 ta golli uzatma bering', icon: 'route', rarity: 'Kam uchraydi', goal: 25 },
  { id: 'regular', title: 'Doimiy o‘yinchi', description: '50 ta o‘yinda qatnashing', icon: 'calendar_month', rarity: 'Oddiy', goal: 50 },
] as const;

export async function ensureAchievements() {
  for (const a of ACHIEVEMENTS) await prisma.achievement.upsert({ where: { id: a.id }, update: { ...a }, create: { ...a } });
}

/** O‘yin natijasidan keyin XP, daraja va yutuqlarni yangilaydi */
export async function awardAfterMatch(matchId: string) {
  const m = await prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: { players: { include: { user: true } } } });
  for (const p of m.players) {
    const xpGain = 50 + p.goals * 20 + p.assists * 10 + (m.mvpId === p.userId ? 100 : 0);
    const xp = p.user.xp + xpGain;
    await prisma.user.update({ where: { id: p.userId }, data: { xp, level: Math.floor(xp / 500) + 1 } });
    const done = await prisma.matchPlayer.findMany({ where: { userId: p.userId, match: { status: 'done' } }, include: { match: true } });
    const conceded = (x: (typeof done)[0]) => (x.side === 'home' ? x.match.awayScore : x.match.homeScore) ?? 1;
    const progress: Record<string, number> = {
      first_match: done.length,
      hat_trick: done.some((x) => x.goals >= 3) ? 1 : 0,
      mvp10: await prisma.match.count({ where: { mvpId: p.userId, status: 'done' } }),
      iron_keeper: p.user.position === 'GK' ? done.filter((x) => conceded(x) === 0).length : 0,
      playmaker: done.reduce((a, x) => a + x.assists, 0),
      regular: done.length,
    };
    for (const a of ACHIEVEMENTS) {
      const prev = await prisma.userAchievement.findUnique({ where: { userId_achievementId: { userId: p.userId, achievementId: a.id } } });
      const val = Math.min(progress[a.id], a.goal);
      const earned = val >= a.goal;
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: p.userId, achievementId: a.id } },
        update: { progress: val, earnedAt: prev?.earnedAt ?? (earned ? new Date() : null) },
        create: { userId: p.userId, achievementId: a.id, progress: val, earnedAt: earned ? new Date() : null },
      });
      if (earned && !prev?.earnedAt) await notify(p.userId, { type: 'social', kind: 'achievement', title: `Yutuq ochildi: ${a.title}`, body: a.rarity, refType: 'achievement', refId: null, data: { achievement: a.id } });
    }
  }
}
