import { redirect } from 'next/navigation';

export default function AdminRoute() {
  redirect('/admin/verification-queue');
}
