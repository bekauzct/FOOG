'use client';
import { ProfileView } from '@/components/ProfileView';
import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function MyProfile() {
  const { me, loading } = useSession();
  if (loading || !me) return <div className="page"><Loading rows={2} /></div>;
  return <ProfileView username={me.username ?? me.id} />;
}
