# Feature Guide

This document describes the current product behavior across the major UpSpace domains. It is intended for engineering, QA, and product work, not just marketing-level summaries.

## Customer Experience

### Marketplace discovery

Customers can:

- browse published coworking spaces;
- inspect details, addresses, amenities, photos, and reviews;
- use search suggestions and AI-assisted search;
- narrow choices by geography and text-based discovery;
- bookmark listings for later comparison.

Relevant route families:

- `/api/v1/spaces`
- `/api/v1/spaces/suggest`
- `/api/v1/spaces/{space_id}`
- `/api/v1/spaces/{space_id}/amenities`
- `/api/v1/spaces/{space_id}/reviews`
- `/api/v1/bookmarks`
- `/api/v1/ai-assistant`

### Booking

The booking flow includes more than selecting a space:

- customer selects a space and area;
- duration and guest count are validated;
- availability and occupancy rules are checked;
- pricing rules can modify the total dynamically;
- booking records are created and move through lifecycle states;
- receipts, reschedules, and cancellations are supported.

Relevant route families:

- `/api/v1/bookings`
- `/api/v1/bookings/{booking_id}`
- `/api/v1/bookings/{booking_id}/cancel`
- `/api/v1/bookings/{booking_id}/reschedule`
- `/api/v1/bookings/{booking_id}/receipt`
- `/api/v1/financial/checkout`

### Customer account and communication

Customers also have:

- profile management;
- booking history;
- transaction history;
- message threads with partners;
- notification feeds;
- complaint filing;
- review submission after eligible bookings.

Relevant route families:

- `/api/v1/auth/profile`
- `/api/v1/customer/transactions`
- `/api/v1/chat/rooms`
- `/api/v1/chat/messages`
- `/api/v1/notifications`
- `/api/v1/complaints`
- `/api/v1/spaces/{space_id}/reviews`

## Partner Experience

### Space creation and editing

Partners can create and manage spaces with:

- title and description;
- structured address fields;
- latitude and longitude;
- amenities;
- weekly availability;
- uploaded images;
- verification documents;
- area inventory and configuration.

Relevant route families:

- `/api/v1/spaces`
- `/api/v1/partner/spaces`
- `/api/v1/partner/spaces/{space_id}`
- `/api/v1/spaces/{space_id}/areas`
- `/api/v1/partner/spaces/{space_id}/areas`

### Inventory and booking operations

Partners can inspect and act on:

- incoming bookings;
- booking status changes;
- stuck bookings;
- messaging;
- dashboard feed items;
- complaint escalations.

Relevant route families:

- `/api/v1/bookings`
- `/api/v1/partner/stuck-bookings`
- `/api/v1/partner/dashboard-feed`
- `/api/v1/chat/*`
- `/api/v1/partner/complaints*`

### Verification workflow

Partner verification is an explicit operational workflow, not a passive profile flag.

Partners can:

- submit verification materials during creation;
- review the latest verification package for a space;
- resubmit after feedback;
- withdraw a submission if needed;
- request unpublishing for a moderated listing.

Relevant route families:

- `/api/v1/partner/spaces/{space_id}/verification`
- `/api/v1/partner/spaces/{space_id}/verification/resubmit`
- `/api/v1/partner/spaces/{space_id}/verification/withdraw`
- `/api/v1/partner/spaces/{space_id}/unpublish-request`

### Pricing rules

Partner pricing is now rule-driven.

Partners can:

- define pricing variables;
- create condition groups;
- compose formulas;
- preview rule output against sample booking scenarios;
- attach rules to areas.

Relevant route families:

- `/api/v1/partner/spaces/{space_id}/pricing-rules`
- `/api/v1/partner/spaces/{space_id}/pricing-rules/{price_rule_id}`
- `/api/v1/partner/spaces/{space_id}/pricing-rules/evaluate`

Important product rule:

- legacy base-rate endpoints still exist only as `410 Gone` compatibility surfaces and should not be used for new pricing work.

### Wallet and payouts

Partners have a wallet-backed operational finance view with:

- current balance;
- transaction ledger;
- payout requests;
- refund actions where supported;
- provider-backed payout-account status and setup;
- admin-reviewed payout completion.

Relevant route families:

- `/api/v1/wallet`
- `/api/v1/wallet/stats`
- `/api/v1/wallet/payout`
- `/api/v1/wallet/refund`
- `/api/v1/financial/provider-account`
- `/api/v1/financial/provider-account/status`
- `/api/v1/financial/payout-channels`

## Admin Experience

### Dashboard and reporting

Admins can monitor:

- booking totals and status counts;
- revenue summaries;
- client and space counts;
- verification volume;
- recent activity feeds;
- audit-log slices;
- reporting windows for operational review.

Relevant route families:

- `/api/v1/admin/dashboard`
- `/api/v1/admin/reports`

### Moderation and review queues

Admin workflows cover:

- verification review;
- complaint resolution;
- chat report moderation;
- user enabling and disabling;
- deactivation and deletion requests;
- unpublish requests;
- payout review and reconciliation;
- visibility changes for spaces.

Relevant route families:

- `/api/v1/admin/verifications*`
- `/api/v1/admin/complaints*`
- `/api/v1/admin/chat-reports*`
- `/api/v1/admin/users*`
- `/api/v1/admin/deactivation-requests*`
- `/api/v1/admin/unpublish-requests*`
- `/api/v1/admin/payout-requests*`
- `/api/v1/admin/reconciliation`
- `/api/v1/admin/spaces/{space_id}/visibility`

## AI Features

UpSpace includes a marketplace assistant rather than a standalone chatbot toy.

### What the assistant can do

The assistant can help users:

- search for spaces conversationally;
- narrow options by location, amenities, rating, and price;
- compare multiple spaces;
- reason about budgets;
- inspect booking availability;
- prepare booking-related actions;
- continue multi-turn conversations with persistence.

### Storage and continuity

Persisted AI conversations allow:

- a sidebar conversation list;
- rename and delete actions;
- continuity between sessions;
- follow-up questions that build on prior context.

Relevant route families:

- `/api/v1/ai-assistant`
- `/api/v1/ai/conversations`
- `/api/v1/ai/conversations/{id}`

## Chat and Notification Features

### Chat

Customers and partners can exchange messages in space-scoped rooms. The system supports:

- room discovery;
- message history;
- new-message creation;
- moderation reporting for abusive conversations.

Relevant route families:

- `/api/v1/chat/rooms`
- `/api/v1/chat/messages`
- `/api/v1/chat/reports`

### Notifications

The in-app notification feed supports:

- cursor-paginated reads;
- unread filtering;
- single notification mark-as-read or unread;
- delete;
- mark-all-as-read.

Relevant route families:

- `/api/v1/notifications`
- `/api/v1/notifications/mark-all`

## Review and Complaint Features

### Reviews

Reviews include:

- star ratings;
- free-form descriptions;
- quick tags from a shared catalog;
- aggregate ratings and rating distribution;
- viewer-specific state for whether the current user already reviewed a space.

Relevant route families:

- `/api/v1/spaces/{space_id}/reviews`
- `/api/v1/reviews/tags`

### Complaints

Complaints are booking-scoped and can move through customer, partner, and admin workflows:

- customer creates complaint;
- partner resolves or escalates;
- admin resolves or dismisses escalated issues.

Relevant route families:

- `/api/v1/complaints`
- `/api/v1/partner/complaints*`
- `/api/v1/admin/complaints*`

## Account Lifecycle Features

UpSpace supports more than sign-in and sign-up.

### Supported flows

- sign-up email availability check;
- sign-up OTP delivery;
- account creation;
- profile sync;
- profile edits;
- account deactivation requests;
- reactivation;
- permanent deletion requests;
- account export.

Relevant route families:

- `/api/v1/auth/signup/check-email`
- `/api/v1/auth/signup/send-otp`
- `/api/v1/auth/signup`
- `/api/v1/auth/profile`
- `/api/v1/auth/sync-profile`
- `/api/v1/auth/deactivate`
- `/api/v1/auth/reactivate`
- `/api/v1/auth/delete`
- `/api/v1/account/export`

## Search and Discovery Behavior

Search is spread across several feature surfaces:

- public listing search on `/api/v1/spaces`;
- autocomplete and query suggestion on `/api/v1/spaces/suggest`;
- fuzzy and normalized matching backed by PostgreSQL search extensions;
- geospatial ranking supported by PostGIS;
- AI-assisted conversational search on `/api/v1/ai-assistant`.

## Operational Notes

### Rate limiting

Public listing, suggestion, partner inventory, and dashboard-feed flows are rate-limited. This is part of the product behavior, not just an infrastructure concern.

### Documentation behavior

The live API inventory is now generated. Route work should always be paired with:

```bash
pnpm docs:api
```

### Compatibility surfaces

Some endpoints remain available only for compatibility or transition reasons:

- `/api/v1/ai-search` is a deprecated alias for `/api/v1/ai-assistant`;
- `/api/v1/spaces/{space_id}/areas/{area_id}/rates*` exists only to return `410 Gone`.

When changing the product, preserve those behaviors unless the compatibility contract is intentionally being removed.
