import { redirect } from 'next/navigation';

// Eski manzil: jamoalar va to‘lovlar endi /admin/teams da
export default function OldPayments() {
  redirect('/admin/teams');
}
