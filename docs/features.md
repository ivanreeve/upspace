# Feature Guide

> This document describes the current product behavior across the major UpSpace domains. It is intended for engineering, QA, and product work, not just marketing-level summaries.

---

## 📚 Table of Contents

- [Customer Experience](#customer-experience)
- [Partner Experience](#partner-experience)
- [Admin Experience](#admin-experience)
- [AI Features](#ai-features)
- [Chat and Notification Features](#chat-and-notification-features)
- [Review and Complaint Features](#review-and-complaint-features)
- [Account Lifecycle Features](#account-lifecycle-features)
- [Search and Discovery Behavior](#search-and-discovery-behavior)
- [Operational Notes](#operational-notes)

---

<a name="customer-experience"></a>
## 👤 Customer Experience

### Marketplace discovery

Customers can:

- browse published coworking spaces;
- inspect details, addresses, amenities, photos, and reviews;
- use search suggestions and AI-assisted search;
- narrow choices by geography and text-based discovery;
- bookmark listings for later comparison.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/spaces` | List public spaces |
| `/api/v1/spaces/suggest` | Search suggestions |
| `/api/v1/spaces/{space_id}` | Get a single space |
| `/api/v1/spaces/{space_id}/amenities` | List space amenities |
| `/api/v1/spaces/{space_id}/reviews` | List space reviews |
| `/api/v1/bookmarks` | Saved listings management |
| `/api/v1/ai-assistant` | AI-assisted marketplace search |

### Booking

The booking flow includes more than selecting a space:

- customer selects a space and area;
- duration and guest count are validated;
- availability and occupancy rules are checked;
- pricing rules can modify the total dynamically;
- booking records are created and move through lifecycle states;
- receipts, reschedules, and cancellations are supported.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/bookings` | Create and list bookings |
| `/api/v1/bookings/{booking_id}` | Get booking detail |
| `/api/v1/bookings/{booking_id}/cancel` | Cancel a booking |
| `/api/v1/bookings/{booking_id}/reschedule` | Reschedule a booking |
| `/api/v1/bookings/{booking_id}/receipt` | Get booking receipt |
| `/api/v1/financial/checkout` | Create a checkout session |

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

| Route | Purpose |
| --- | --- |
| `/api/v1/auth/profile` | Get and update profile |
| `/api/v1/customer/transactions` | List customer transactions |
| `/api/v1/chat/rooms` | List chat rooms |
| `/api/v1/chat/messages` | Send and list chat messages |
| `/api/v1/notifications` | List and manage notifications |
| `/api/v1/complaints` | Create and list complaints |
| `/api/v1/spaces/{space_id}/reviews` | Create a review |

---

<a name="partner-experience"></a>
## 👥 Partner Experience

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

| Route | Purpose |
| --- | --- |
| `/api/v1/spaces` | Create a space |
| `/api/v1/partner/spaces` | List partner-owned spaces |
| `/api/v1/partner/spaces/{space_id}` | Get and update a partner space |
| `/api/v1/spaces/{space_id}/areas` | Create an area |
| `/api/v1/partner/spaces/{space_id}/areas` | Manage partner areas |

### Inventory and booking operations

Partners can inspect and act on:

- incoming bookings;
- booking status changes;
- stuck bookings;
- messaging;
- dashboard feed items;
- complaint escalations.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/bookings` | List and update bookings |
| `/api/v1/partner/stuck-bookings` | List stuck bookings |
| `/api/v1/partner/dashboard-feed` | Get dashboard feed |
| `/api/v1/chat/*` | Chat rooms, messages, and reports |
| `/api/v1/partner/complaints*` | List and resolve partner complaints |

### Verification workflow

Partner verification is an explicit operational workflow, not a passive profile flag.

Partners can:

- submit verification materials during creation;
- review the latest verification package for a space;
- resubmit after feedback;
- withdraw a submission if needed;
- request unpublishing for a moderated listing.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/partner/spaces/{space_id}/verification` | Review verification status and documents |
| `/api/v1/partner/spaces/{space_id}/verification/resubmit` | Resubmit verification |
| `/api/v1/partner/spaces/{space_id}/verification/withdraw` | Withdraw verification |
| `/api/v1/partner/spaces/{space_id}/unpublish-request` | Request unpublishing |

### Pricing rules

Partner pricing is now rule-driven.

Partners can:

- define pricing variables;
- create condition groups;
- compose formulas;
- preview rule output against sample booking scenarios;
- attach rules to areas.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/partner/spaces/{space_id}/pricing-rules` | Create and list pricing rules |
| `/api/v1/partner/spaces/{space_id}/pricing-rules/{price_rule_id}` | Update or delete a pricing rule |
| `/api/v1/partner/spaces/{space_id}/pricing-rules/evaluate` | Preview pricing rule output |

> **Important product rule:** Legacy base-rate endpoints still exist only as `410 Gone` compatibility surfaces and should not be used for new pricing work.

### Wallet and payouts

Partners have a wallet-backed operational finance view with:

- current balance;
- transaction ledger;
- payout requests;
- refund actions where supported;
- provider-backed payout-account status and setup;
- admin-reviewed payout completion.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/wallet` | Get wallet data |
| `/api/v1/wallet/stats` | Get wallet statistics |
| `/api/v1/wallet/payout` | Create a payout request |
| `/api/v1/wallet/refund` | Issue a wallet-backed refund |
| `/api/v1/financial/provider-account` | Create or sync provider payout account |
| `/api/v1/financial/provider-account/status` | Get provider account status |
| `/api/v1/financial/payout-channels` | List supported payout channels |

---

<a name="admin-experience"></a>
## 🛡️ Admin Experience

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

| Route | Purpose |
| --- | --- |
| `/api/v1/admin/dashboard` | Get admin dashboard |
| `/api/v1/admin/reports` | Get report aggregates |

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

| Route | Purpose |
| --- | --- |
| `/api/v1/admin/verifications*` | Review verification queue |
| `/api/v1/admin/complaints*` | Resolve or dismiss complaints |
| `/api/v1/admin/chat-reports*` | Moderate chat reports |
| `/api/v1/admin/users*` | Enable or disable users |
| `/api/v1/admin/deactivation-requests*` | Resolve deactivation requests |
| `/api/v1/admin/unpublish-requests*` | Resolve unpublish requests |
| `/api/v1/admin/payout-requests*` | Review payout requests |
| `/api/v1/admin/reconciliation` | Run reconciliation |
| `/api/v1/admin/spaces/{space_id}/visibility` | Change space visibility |

---

<a name="ai-features"></a>
## 🤖 AI Features

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

| Route | Purpose |
| --- | --- |
| `/api/v1/ai-assistant` | Run the AI assistant |
| `/api/v1/ai/conversations` | List and create AI conversations |
| `/api/v1/ai/conversations/{id}` | Get, rename, or delete an AI conversation |

---

<a name="chat-and-notification-features"></a>
## 💬 Chat and Notification Features

### Chat

Customers and partners can exchange messages in space-scoped rooms. The system supports:

- room discovery;
- message history;
- new-message creation;
- moderation reporting for abusive conversations.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/chat/rooms` | List chat rooms |
| `/api/v1/chat/messages` | Send and list chat messages |
| `/api/v1/chat/reports` | Report a chat conversation |

### Notifications

The in-app notification feed supports:

- cursor-paginated reads;
- unread filtering;
- single notification mark-as-read or unread;
- delete;
- mark-all-as-read.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/notifications` | List and manage notifications |
| `/api/v1/notifications/mark-all` | Mark all notifications as read |

---

<a name="review-and-complaint-features"></a>
## ⭐ Review and Complaint Features

### Reviews

Reviews include:

- star ratings;
- free-form descriptions;
- quick tags from a shared catalog;
- aggregate ratings and rating distribution;
- viewer-specific state for whether the current user already reviewed a space.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/spaces/{space_id}/reviews` | List and create space reviews |
| `/api/v1/reviews/tags` | List review quick tags |

### Complaints

Complaints are booking-scoped and can move through customer, partner, and admin workflows:

- customer creates complaint;
- partner resolves or escalates;
- admin resolves or dismisses escalated issues.

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/complaints` | Create and list customer complaints |
| `/api/v1/partner/complaints*` | Partner complaint resolution |
| `/api/v1/admin/complaints*` | Admin complaint moderation |

---

<a name="account-lifecycle-features"></a>
## 🔐 Account Lifecycle Features

UpSpace supports more than sign-in and sign-up.

### Supported flows

| Flow | Description |
| --- | --- |
| Sign-up email availability check | Verify email before registration |
| Sign-up OTP delivery | One-time password via email |
| Account creation | Register a new account |
| Profile sync | Sync profile from auth session |
| Profile edits | Update user profile |
| Account deactivation requests | Request account deactivation |
| Reactivation | Reactivate a deactivated account |
| Permanent deletion requests | Request account deletion |
| Account export | Export all account data |

Relevant route families:

| Route | Purpose |
| --- | --- |
| `/api/v1/auth/signup/check-email` | Check email availability |
| `/api/v1/auth/signup/send-otp` | Send OTP |
| `/api/v1/auth/signup` | Create account |
| `/api/v1/auth/profile` | Get and update profile |
| `/api/v1/auth/sync-profile` | Sync profile from auth |
| `/api/v1/auth/deactivate` | Deactivate account |
| `/api/v1/auth/reactivate` | Reactivate account |
| `/api/v1/auth/delete` | Delete account |
| `/api/v1/account/export` | Export account data |

---

<a name="search-and-discovery-behavior"></a>
## 🔍 Search and Discovery Behavior

Search is spread across several feature surfaces:

| Surface | Technology |
| --- | --- |
| Public listing search | `/api/v1/spaces` |
| Autocomplete and query suggestion | `/api/v1/spaces/suggest` |
| Fuzzy and normalized matching | PostgreSQL trigram (`pg_trgm`) |
| Geospatial ranking | PostGIS |
| AI-assisted conversational search | `/api/v1/ai-assistant` |

---

<a name="operational-notes"></a>
## ⚙️ Operational Notes

### Rate limiting

Public listing, suggestion, partner inventory, and dashboard-feed flows are rate-limited. This is part of the product behavior, not just an infrastructure concern.

### Documentation behavior

The live API inventory is now generated. Route work should always be paired with:

```bash
pnpm docs:api
```

### Compatibility surfaces

Some endpoints remain available only for compatibility or transition reasons:

| Endpoint | Status |
| --- | --- |
| `/api/v1/ai-search` | Deprecated alias for `/api/v1/ai-assistant` |
| `/api/v1/spaces/{space_id}/areas/{area_id}/rates*` | Returns `410 Gone` |

When changing the product, preserve those behaviors unless the compatibility contract is intentionally being removed.
