import TopBar from '@/components/TopBar';
import { OwnerProvider } from '@/components/owner';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerProvider>
      <TopBar mode="owner" />
      <div className="page col" style={{ gap: 24, maxWidth: 1224 }}>{children}</div>
    </OwnerProvider>
  );
}
