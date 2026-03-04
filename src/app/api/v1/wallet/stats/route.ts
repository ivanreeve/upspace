import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { ensureWalletRow, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

export async function GET() {
  try {
    const auth = await resolveAuthenticatedUserForWallet({ requirePartner: true, });
    if (auth.response) {
      return auth.response;
    }

    const walletRow = await ensureWalletRow(auth.dbUser!.user_id);

    const [chargeAgg, refundAgg, payoutAgg, totalCount, succeededCount, monthlyRaw] = await Promise.all([
      prisma.wallet_transaction.aggregate({
        where: {
 wallet_id: walletRow.id,
type: 'charge',
status: 'succeeded', 
},
        _sum: { amount_minor: true, },
        _count: true,
      }),
      prisma.wallet_transaction.aggregate({
        where: {
 wallet_id: walletRow.id,
type: 'refund',
status: 'succeeded', 
},
        _sum: { amount_minor: true, },
        _count: true,
      }),
      prisma.wallet_transaction.aggregate({
        where: {
 wallet_id: walletRow.id,
type: 'payout',
status: 'succeeded', 
},
        _sum: { amount_minor: true, },
        _count: true,
      }),
      prisma.wallet_transaction.count({ where: { wallet_id: walletRow.id, }, }),
      prisma.wallet_transaction.count({
 where: {
 wallet_id: walletRow.id,
status: 'succeeded', 
}, 
}),
      prisma.$queryRaw<{ month: string; earned: bigint; refunded: bigint }[]>`
        SELECT
          to_char(wt.created_at, 'YYYY-MM') AS month,
          COALESCE(SUM(CASE WHEN wt.type = 'charge' AND wt.status = 'succeeded' THEN wt.amount_minor ELSE 0 END), 0) AS earned,
          COALESCE(SUM(CASE WHEN wt.type = 'refund' AND wt.status = 'succeeded' THEN wt.amount_minor ELSE 0 END), 0) AS refunded
        FROM wallet_transaction wt
        WHERE wt.wallet_id = ${walletRow.id}
          AND wt.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY to_char(wt.created_at, 'YYYY-MM')
        ORDER BY month ASC
      `
    ]);

    const totalEarned = chargeAgg._sum.amount_minor ?? BigInt(0);
    const totalRefunded = refundAgg._sum.amount_minor ?? BigInt(0);
    const totalPaidOut = payoutAgg._sum.amount_minor ?? BigInt(0);
    const successRate = totalCount > 0 ? Math.round((succeededCount / totalCount) * 100) : 0;

    const avgBookingCharge =
      chargeAgg._count > 0
        ? (totalEarned / BigInt(chargeAgg._count)).toString()
        : '0';

    const monthly = monthlyRaw.map((row) => ({
      month: row.month,
      earnedMinor: row.earned.toString(),
      refundedMinor: row.refunded.toString(),
    }));

    return NextResponse.json({
      data: {
        balanceMinor: walletRow.balance_minor.toString(),
        currency: walletRow.currency,
        totalEarnedMinor: totalEarned.toString(),
        totalRefundedMinor: totalRefunded.toString(),
        totalPaidOutMinor: totalPaidOut.toString(),
        transactionCount: totalCount,
        succeededCount,
        successRate,
        chargeCount: chargeAgg._count,
        refundCount: refundAgg._count,
        payoutCount: payoutAgg._count,
        avgBookingChargeMinor: avgBookingCharge,
        monthly,
      },
    });
  } catch (error) {
    console.error('Failed to load wallet stats', error);
    return NextResponse.json(
      { error: 'Unable to load wallet statistics.', },
      { status: 500, }
    );
  }
}
