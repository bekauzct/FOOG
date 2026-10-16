import type { Booking, Pitch, Stadium, StadiumPhoto, User } from '@prisma/client';
import { dateStr, timeStr } from './time';

export function publicUser(u: User) {
  return {
    id: u.id, name: u.name, username: u.username, role: u.role, position: u.position, foot: u.foot,
    district: u.district, level: u.level, xp: u.xp, skill: u.skill, bio: u.bio, jersey: u.jersey,
    available: u.available, avatarUrl: u.avatarUrl, coverUrl: u.coverUrl, verified: u.verified,
    status: u.status, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

export const mini = (u: Pick<User, 'id' | 'name' | 'username' | 'avatarUrl' | 'verified'> & { position?: string | null; district?: string | null }) => ({
  id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl, verified: u.verified, position: u.position ?? null, district: u.district ?? null,
});
export const miniSelect = { id: true, name: true, username: true, avatarUrl: true, verified: true, position: true, district: true } as const;

export function bookingOut(b: Booking & { pitch?: Pitch & { stadium?: Stadium & { photos?: StadiumPhoto[] } }; user?: User }) {
  return {
    id: b.id, code: b.code, date: dateStr(b.date), start: timeStr(b.startTime), end: timeStr(b.endTime),
    price: b.price, status: b.status, rejectReason: b.rejectReason, createdAt: b.createdAt, decidedAt: b.decidedAt,
    pitch: b.pitch ? { id: b.pitch.id, name: b.pitch.name, size: sizeOut(b.pitch.size) } : undefined,
    stadium: b.pitch?.stadium ? { id: b.pitch.stadium.id, name: b.pitch.stadium.name, address: b.pitch.stadium.address, district: b.pitch.stadium.district, lat: Number(b.pitch.stadium.lat), lng: Number(b.pitch.stadium.lng), phone: b.pitch.stadium.phone, photo: b.pitch.stadium.photos?.[0]?.url ?? null } : undefined,
    user: b.user ? { id: b.user.id, name: b.user.name, username: b.user.username, avatarUrl: b.user.avatarUrl, phone: b.user.phone, noShows: b.user.noShows } : undefined,
  };
}

export const sizeOut = (s: string) => s.replace(/^s/, '');
export const sizeIn = (s: string) => ('s' + s.replace('×', 'x')) as 's5x5' | 's7x7' | 's11x11';
