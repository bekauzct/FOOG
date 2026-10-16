import TopBar from '@/components/TopBar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar mode="admin" />
      <div className="page col" style={{ gap: 24, maxWidth: 1264 }}>{children}</div>
    </>
  );
}
