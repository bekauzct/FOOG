import TopBar from '@/components/TopBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
