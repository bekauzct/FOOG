'use client';
// «online.obyektivka» – alohida ilova (nginx: /obyektivka/). Kirmagan bo‘lsa avval Telegram orqali kirish.
import { Icon } from './ui';

export const OBV_URL = '/obyektivka/uzb/obyektivka/';
// Yorqin qizil – boshqa tugmalardan ajralib turadi
const STYLE = { background: '#FF2D2D', color: '#FFFFFF', fontWeight: 700, boxShadow: 'none' } as const;

/** bar – ichki sahifalar menyusi: to‘liq yozuv faqat keng ekranda (menyuni siqmasin), torroqda qizil ikonka */
export default function ObyektivkaLink({ signedIn, bar }: { signedIn: boolean; bar?: boolean }) {
  const href = signedIn ? OBV_URL : `/login?next=${encodeURIComponent(OBV_URL)}`;
  return (
    <>
      <a href={href} className={`btn btn-sm ${bar ? 'obv-full' : 'hide-mobile'}`} style={STYLE}>online.obyektivka</a>
      <span className={bar ? 'obv-icon' : 'only-mobile'}><a href={href} className="icon-btn" style={STYLE} aria-label="online.obyektivka" title="online.obyektivka"><Icon n="description" size={22} /></a></span>
    </>
  );
}
