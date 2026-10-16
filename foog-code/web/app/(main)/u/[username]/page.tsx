'use client';
import { useParams } from 'next/navigation';
import { ProfileView } from '@/components/ProfileView';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  return <ProfileView username={decodeURIComponent(username)} />;
}
