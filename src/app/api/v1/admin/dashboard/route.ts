import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';

import { prisma } from '@/lib/prisma';
import { AdminSessionError, requireAdminSession } from '@/lib/auth/require-admin-session';

const AUDIT_TABLES = ['booking', 'space', 'user', 'verification'];

export async function GET(_req: NextRequest) {
  try {
    await requireAdminSession(_req);

    const sevenDaysAgo = subDays(new Date(), 7);

    const [
      totalBookings,
      bookingStatusCounts,
      totalSpaces,
      publishedSpaces,
      totalClients,
      activeClients,
      deactivatedClients,
      pendingDeletionClients,
      deletedClients,
      newClientRegistrations,
      verificationStatusCounts,
      recentBookings,
      recentSpaces,
      recentClients,
      recentVerifications,
      auditEvents
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true, },
      }),
      prisma.space.count(),
      prisma.space.count({ where: { is_published: true, }, }),
      prisma.user.count({ where: { role: 'customer', }, }),
      prisma.user.count({
 where: {
 role: 'customer',
status: 'active', 
}, 
}),
      prisma.user.count({
 where: {
 role: 'customer',
status: 'deactivated', 
}, 
}),
      prisma.user.count({
 where: {
 role: 'customer',
status: 'pending_deletion', 
}, 
}),
      prisma.user.count({
 where: {
 role: 'customer',
status: 'deleted', 
}, 
}),
      prisma.user.count({
        where: {
          role: 'customer',
          created_at: { gte: sevenDaysAgo, },
        },
      }),
      prisma.verification.groupBy({
        by: ['status'],
        _count: { status: true, },
      }),
      prisma.booking.findMany({
        orderBy: { created_at: 'desc', },
        take: 5,
        select: {
          id: true,
          space_id: true,
          area_id: true,
          booking_hours: true,
          price_minor: true,
          currency: true,
          status: true,
          created_at: true,
          expires_at: true,
          user_auth_id: true,
          partner_auth_id: true,
        },
      }),
      prisma.space.findMany({
        orderBy: { updated_at: 'desc', },
        take: 5,
        select: {
          id: true,
          name: true,
          city: true,
          region: true,
          user_id: true,
          is_published: true,
          unpublished_at: true,
          unpublished_reason: true,
          unpublished_by_admin: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.user.findMany({
        where: { role: 'customer', },
        orderBy: { created_at: 'desc', },
        take: 5,
        select: {
          user_id: true,
          role: true,
          status: true,
          first_name: true,
          last_name: true,
          handle: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.verification.findMany({
        orderBy: { submitted_at: 'desc', },
        take: 5,
        select: {
          id: true,
          space_id: true,
          partner_id: true,
          subject_type: true,
          status: true,
          submitted_at: true,
          approved_at: true,
          rejected_at: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.audit_event.findMany({
        where: { object_table: { in: AUDIT_TABLES, }, },
        orderBy: { occured_at: 'desc', },
        take: 12,
        select: {
          audit_id: true,
          occured_at: true,
          created_at: true,
          actor_label: true,
          actor_user_id: true,
          session_id: true,
          request_id: true,
          action: true,
          object_table: true,
          object_pk: true,
          outcome: true,
          reason: true,
          extra: true,
          old_value: true,
          new_value: true,
        },
      })
    ]);

    const totalVerifications = verificationStatusCounts.reduce(
      (sum, status) => sum + status._count.status,
      0
    );

    const payload = {
      metrics: {
        bookings: {
          total: totalBookings,
          statusCounts: bookingStatusCounts.map((entry) => ({
            status: entry.status,
            count: entry._count.status,
          })),
        },
        spaces: {
          total: totalSpaces,
          published: publishedSpaces,
          unpublished: Math.max(0, totalSpaces - publishedSpaces),
        },
        clients: {
          total: totalClients,
          active: activeClients,
          deactivated: deactivatedClients,
          pendingDeletion: pendingDeletionClients,
          deleted: deletedClients,
          newLast7Days: newClientRegistrations,
        },
        verifications: {
          total: totalVerifications,
          statusCounts: verificationStatusCounts.map((entry) => ({
            status: entry.status,
            count: entry._count.status,
          })),
        },
      },
      recent: {
        bookings: recentBookings.map((booking) => ({
          id: booking.id,
          space_id: booking.space_id,
          area_id: booking.area_id,
          booking_hours: booking.booking_hours.toString(),
          price_minor: booking.price_minor?.toString() ?? null,
          currency: booking.currency,
          status: booking.status,
          created_at: booking.created_at.toISOString(),
          expires_at: booking.expires_at?.toISOString() ?? null,
          user_auth_id: booking.user_auth_id,
          partner_auth_id: booking.partner_auth_id,
        })),
        spaces: recentSpaces.map((space) => ({
          id: space.id,
          name: space.name,
          city: space.city,
          region: space.region,
          user_id: space.user_id,
          is_published: space.is_published,
          unpublished_at: space.unpublished_at?.toISOString() ?? null,
          unpublished_reason: space.unpublished_reason,
          unpublished_by_admin: space.unpublished_by_admin,
          created_at: space.created_at.toISOString(),
          updated_at: space.updated_at.toISOString(),
        })),
        clients: recentClients.map((client) => ({
          user_id: client.user_id.toString(),
          role: client.role,
          status: client.status,
          first_name: client.first_name,
          last_name: client.last_name,
          handle: client.handle,
          created_at: client.created_at.toISOString(),
          updated_at: client.updated_at.toISOString(),
        })),
        verifications: recentVerifications.map((verification) => ({
          id: verification.id,
          space_id: verification.space_id,
          partner_id: verification.partner_id?.toString() ?? null,
          subject_type: verification.subject_type,
          status: verification.status,
          submitted_at: verification.submitted_at.toISOString(),
          approved_at: verification.approved_at?.toISOString() ?? null,
          rejected_at: verification.rejected_at?.toISOString() ?? null,
          created_at: verification.created_at.toISOString(),
          updated_at: verification.updated_at.toISOString(),
        })),
      },
      auditLog: auditEvents.map((event) => ({
        audit_id: event.audit_id.toString(),
        occured_at: event.occured_at.toISOString(),
        action: event.action,
        object_table: event.object_table,
        object_pk: event.object_pk,
        actor_label: event.actor_label,
        actor_user_id: event.actor_user_id?.toString() ?? null,
        session_id: event.session_id,
        request_id: event.request_id,
        outcome: event.outcome,
        reason: event.reason,
        extra: event.extra ?? null,
        old_value: event.old_value ?? null,
        new_value: event.new_value ?? null,
      })),
    };

    return NextResponse.json({ data: payload, });
  } catch (error) {
    if (error instanceof AdminSessionError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to load admin dashboard data', error);
    return NextResponse.json(
      { error: 'Unable to load admin dashboard data.', },
      { status: 500, }
    );
  }
}
