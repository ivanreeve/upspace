# API Reference

This document is generated from the live `src/app/api/v1/**/route.ts` inventory.
It is the markdown companion to the Scalar UI at `/docs` and the machine-readable spec at `/openapi.json`.

## Conventions

- Authentication: most non-public endpoints expect the Supabase session established by the web app. Role-restricted routes are called out in the access column below.
- Pagination: list endpoints generally use cursor pagination with `limit`, `cursor`, `hasMore`, and `nextCursor` fields.
- Validation: route handlers use Zod at the boundary. Invalid payloads usually return `400` with either `error`, `message`, or `errors` details.
- Rate limiting: public catalog routes, partner inventory views, and some suggestion feeds return `429` when throttled.
- Regeneration: run `pnpm docs:api` after adding, renaming, or removing route handlers.

## Account

Data export and account-adjacent utility endpoints.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/account/export` | Authenticated user | Export the current account data |

## Admin

Administration dashboards, moderation queues, payout operations, and verification review flows.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/chat-reports` | Authenticated admin | List chat reports |
| `PATCH` | `/api/v1/admin/chat-reports/{report_id}` | Authenticated admin | Resolve a chat report |
| `GET` | `/api/v1/admin/complaints` | Authenticated admin | List escalated complaints |
| `PATCH` | `/api/v1/admin/complaints/{complaint_id}` | Authenticated admin | Resolve or dismiss a complaint |
| `GET` | `/api/v1/admin/dashboard` | Authenticated admin | Get the admin dashboard |
| `GET` | `/api/v1/admin/deactivation-requests` | Authenticated admin | List deactivation requests |
| `PATCH` | `/api/v1/admin/deactivation-requests/{request_id}` | Authenticated admin | Resolve a deactivation request |
| `GET` | `/api/v1/admin/payout-requests` | Authenticated admin | List payout requests |
| `PATCH` | `/api/v1/admin/payout-requests/{request_id}` | Authenticated admin | Resolve a payout request |
| `GET` | `/api/v1/admin/reconciliation` | Authenticated admin | Get reconciliation data |
| `POST` | `/api/v1/admin/reconciliation` | Authenticated admin | Run reconciliation |
| `GET` | `/api/v1/admin/reports` | Authenticated admin | Get admin report aggregates |
| `GET` | `/api/v1/admin/spaces` | Authenticated admin | List spaces for moderation |
| `PATCH` | `/api/v1/admin/spaces/{space_id}/visibility` | Authenticated admin | Change space visibility |
| `GET` | `/api/v1/admin/unpublish-requests` | Authenticated admin | List unpublish requests |
| `PATCH` | `/api/v1/admin/unpublish-requests/{request_id}` | Authenticated admin | Resolve an unpublish request |
| `GET` | `/api/v1/admin/users` | Authenticated admin | List users |
| `PATCH` | `/api/v1/admin/users/{user_id}/disable` | Authenticated admin | Disable a user |
| `PATCH` | `/api/v1/admin/users/{user_id}/enable` | Authenticated admin | Enable a user |
| `GET` | `/api/v1/admin/verifications` | Authenticated admin | List verification queue entries |
| `GET` | `/api/v1/admin/verifications/{verification_id}` | Authenticated admin | Get verification detail |
| `PATCH` | `/api/v1/admin/verifications/{verification_id}` | Authenticated admin | Review a verification submission |

## AI

Conversational assistant endpoints and persisted AI conversation state.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `POST` | `/api/v1/ai-assistant` | Public or authenticated user | Run the marketplace AI assistant |
| `POST` | `/api/v1/ai-search` | Public or authenticated user | Deprecated AI search alias |
| `GET` | `/api/v1/ai/conversations` | Authenticated user | List persisted AI conversations |
| `POST` | `/api/v1/ai/conversations` | Authenticated user | Create a persisted AI conversation |
| `GET` | `/api/v1/ai/conversations/{id}` | Authenticated user | Get a persisted AI conversation |
| `PATCH` | `/api/v1/ai/conversations/{id}` | Authenticated user | Rename an AI conversation |
| `DELETE` | `/api/v1/ai/conversations/{id}` | Authenticated user | Soft-delete an AI conversation |

## Amenities

Static amenity and review-tag lookup endpoints used by forms and filters.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/amenities/choices` | Public | List amenity choices |
| `GET` | `/api/v1/reviews/tags` | Public | List review quick tags |

## Auth

Profile sync, sign-up, deactivation, reactivation, and account removal flows.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/deactivate` | Authenticated user | Request account deactivation |
| `POST` | `/api/v1/auth/delete` | Authenticated user | Request permanent account deletion |
| `GET` | `/api/v1/auth/profile` | Authenticated user | Get the current profile |
| `PATCH` | `/api/v1/auth/profile` | Authenticated user | Update the current profile |
| `POST` | `/api/v1/auth/reactivate` | Authenticated user or approved email holder | Reactivate an account |
| `POST` | `/api/v1/auth/signup` | Public | Create a user account |
| `POST` | `/api/v1/auth/signup/check-email` | Public | Check sign-up email availability |
| `POST` | `/api/v1/auth/signup/send-otp` | Public | Send sign-up email OTP |
| `POST` | `/api/v1/auth/sync-profile` | Authenticated user | Sync profile from auth session |

## Bookings

Customer, partner, and admin booking operations including creation, updates, cancellation, and receipts.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/bookings` | Authenticated customer, partner, or admin | List bookings |
| `POST` | `/api/v1/bookings` | Authenticated customer | Create a booking |
| `PATCH` | `/api/v1/bookings` | Authenticated partner or admin | Bulk update booking statuses |
| `GET` | `/api/v1/bookings/{booking_id}` | Authenticated customer | Get booking detail |
| `POST` | `/api/v1/bookings/{booking_id}/cancel` | Authenticated customer, partner, or admin | Cancel a booking |
| `GET` | `/api/v1/bookings/{booking_id}/receipt` | Authenticated customer or partner | Get a booking receipt |
| `PATCH` | `/api/v1/bookings/{booking_id}/reschedule` | Authenticated customer or partner | Reschedule a booking |

## Bookmarks

Customer bookmark mutations.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `POST` | `/api/v1/bookmarks` | Authenticated customer | Bookmark a space |
| `DELETE` | `/api/v1/bookmarks` | Authenticated customer | Remove a bookmark |

## Chat

Marketplace chat rooms, message history, and moderation reporting.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/chat/messages` | Authenticated user | List messages in a room |
| `POST` | `/api/v1/chat/messages` | Authenticated user | Send a chat message |
| `POST` | `/api/v1/chat/reports` | Authenticated user | Report a chat conversation |
| `GET` | `/api/v1/chat/rooms` | Authenticated user | List chat rooms |

## Complaints

Customer complaints and the partner/admin workflows used to resolve them.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/complaints` | Authenticated customer | List customer complaints |
| `POST` | `/api/v1/complaints` | Authenticated customer | Create a complaint |
| `GET` | `/api/v1/partner/complaints` | Authenticated partner | List partner complaints |
| `PATCH` | `/api/v1/partner/complaints/{complaint_id}` | Authenticated partner | Resolve or escalate a complaint |

## Financial

Checkout creation plus provider-backed payout-account setup and synchronization.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `POST` | `/api/v1/financial/checkout` | Authenticated customer | Create a checkout session |
| `GET` | `/api/v1/financial/payout-channels` | Authenticated partner | List supported payout channels |
| `POST` | `/api/v1/financial/provider-account` | Authenticated partner | Create or sync a provider payout account |
| `GET` | `/api/v1/financial/provider-account/status` | Authenticated partner | Get provider payout-account status |

## Notifications

In-app notification listing and read/delete mutations.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/notifications` | Authenticated user | List notifications |
| `PATCH` | `/api/v1/notifications` | Authenticated user | Mark one notification read or unread |
| `DELETE` | `/api/v1/notifications` | Authenticated user | Delete a notification |
| `PATCH` | `/api/v1/notifications/mark-all` | Authenticated user | Mark all notifications as read |

## Partner

Partner dashboard, inventory, verification, and custom pricing-rule management endpoints.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/partner/dashboard-feed` | Authenticated partner | Get the partner dashboard feed |
| `GET` | `/api/v1/partner/spaces` | Authenticated partner | List partner-owned spaces |
| `GET` | `/api/v1/partner/spaces/{space_id}` | Authenticated partner | Get a partner space |
| `PUT` | `/api/v1/partner/spaces/{space_id}` | Authenticated partner | Update a partner space |
| `POST` | `/api/v1/partner/spaces/{space_id}/areas` | Authenticated partner | Create a partner area |
| `PUT` | `/api/v1/partner/spaces/{space_id}/areas/{area_id}` | Authenticated partner | Replace a partner area |
| `DELETE` | `/api/v1/partner/spaces/{space_id}/areas/{area_id}` | Authenticated partner | Delete a partner area |
| `GET` | `/api/v1/partner/spaces/{space_id}/pricing-rules` | Authenticated partner | List pricing rules for a space |
| `POST` | `/api/v1/partner/spaces/{space_id}/pricing-rules` | Authenticated partner | Create a pricing rule |
| `PUT` | `/api/v1/partner/spaces/{space_id}/pricing-rules/{price_rule_id}` | Authenticated partner | Replace a pricing rule |
| `PATCH` | `/api/v1/partner/spaces/{space_id}/pricing-rules/{price_rule_id}` | Authenticated partner | Patch a pricing rule |
| `DELETE` | `/api/v1/partner/spaces/{space_id}/pricing-rules/{price_rule_id}` | Authenticated partner | Delete a pricing rule |
| `POST` | `/api/v1/partner/spaces/{space_id}/pricing-rules/evaluate` | Authenticated partner | Preview a pricing rule |
| `POST` | `/api/v1/partner/spaces/{space_id}/unpublish-request` | Authenticated partner | Request space unpublishing |
| `GET` | `/api/v1/partner/spaces/{space_id}/verification` | Authenticated partner | Get verification documents for a space |
| `POST` | `/api/v1/partner/spaces/{space_id}/verification/resubmit` | Authenticated partner | Resubmit verification |
| `POST` | `/api/v1/partner/spaces/{space_id}/verification/withdraw` | Authenticated partner | Withdraw verification submission |
| `GET` | `/api/v1/partner/stuck-bookings` | Authenticated partner | List stuck bookings |

## Public Spaces

Public marketplace listing, detail, availability, reviews, and inventory discovery endpoints.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/spaces` | Public | List public spaces |
| `POST` | `/api/v1/spaces` | Authenticated user | Create a space |
| `GET` | `/api/v1/spaces/{space_id}` | Public | Get a single space |
| `PUT` | `/api/v1/spaces/{space_id}` | Authenticated user | Update a basic space record |
| `DELETE` | `/api/v1/spaces/{space_id}` | Authenticated user | Delete a space |
| `GET` | `/api/v1/spaces/{space_id}/amenities` | Public | List space amenities |
| `POST` | `/api/v1/spaces/{space_id}/amenities` | Authenticated user | Attach an amenity to a space |
| `DELETE` | `/api/v1/spaces/{space_id}/amenities/{amenity_id}` | Authenticated user | Detach an amenity from a space |
| `GET` | `/api/v1/spaces/{space_id}/areas` | Public | List areas for a space |
| `POST` | `/api/v1/spaces/{space_id}/areas` | Authenticated user | Create an area |
| `PUT` | `/api/v1/spaces/{space_id}/areas/{area_id}` | Authenticated user | Update an area |
| `DELETE` | `/api/v1/spaces/{space_id}/areas/{area_id}` | Authenticated user | Delete an area |
| `GET` | `/api/v1/spaces/{space_id}/areas/{area_id}/rates` | Public | Base rates have been removed |
| `POST` | `/api/v1/spaces/{space_id}/areas/{area_id}/rates` | Authenticated user | Base rates have been removed |
| `PUT` | `/api/v1/spaces/{space_id}/areas/{area_id}/rates/{rate_id}` | Authenticated user | Base rates have been removed |
| `DELETE` | `/api/v1/spaces/{space_id}/areas/{area_id}/rates/{rate_id}` | Authenticated user | Base rates have been removed |
| `GET` | `/api/v1/spaces/{space_id}/availability` | Public | List space availability rows |
| `POST` | `/api/v1/spaces/{space_id}/availability` | Authenticated user | Create an availability row |
| `PUT` | `/api/v1/spaces/{space_id}/availability/{availability_id}` | Authenticated user | Update an availability row |
| `DELETE` | `/api/v1/spaces/{space_id}/availability/{availability_id}` | Authenticated user | Delete an availability row |
| `GET` | `/api/v1/spaces/{space_id}/reviews` | Public | List reviews for a space |
| `POST` | `/api/v1/spaces/{space_id}/reviews` | Authenticated customer | Create a review |
| `GET` | `/api/v1/spaces/suggest` | Public | Suggest search terms |

## Transactions

Customer-facing transaction history endpoints.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/customer/transactions` | Authenticated customer | List customer transactions |

## Wallet

Partner wallet balances, payouts, refunds, and transaction history.

| Method | Path | Access | Summary |
| --- | --- | --- | --- |
| `GET` | `/api/v1/wallet` | Authenticated partner | Get wallet dashboard data |
| `POST` | `/api/v1/wallet` | Authenticated partner | Wallet top-up placeholder |
| `POST` | `/api/v1/wallet/payout` | Authenticated partner | Create a payout request |
| `POST` | `/api/v1/wallet/refund` | Authenticated partner or admin | Issue a wallet-backed refund |
| `GET` | `/api/v1/wallet/stats` | Authenticated partner | Get wallet statistics |

