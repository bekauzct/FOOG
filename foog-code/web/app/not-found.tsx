import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page col" style={{ minHeight: '70vh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/foogi/not_found_goal.webp" alt="" width={220} height={220} style={{ width: 220, height: 220, objectFit: 'contain' }} />
      <span className="label">404</span>
      <h1 className="t-page">Bu sahifa darvozadan o‘tib ketdi</h1>
      <p className="c2" style={{ maxWidth: 420, lineHeight: 1.5 }}>Havola eskirgan yoki noto‘g‘ri. Bosh sahifaga qayting – FOOGI yo‘lni ko‘rsatadi.</p>
      <Link href="/" className="btn btn-primary">Bosh sahifa</Link>
    </div>
  );
}
