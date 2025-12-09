# Feature Overview

This document details the core features of the UpSpace platform.

## 1. Spaces & Areas

*   **Spaces**: Partners can list coworking spaces.
    *   **Details**: Name, description, location (address + coordinates), and photos.
    *   **Amenities**: Spaces list available amenities (Wi-Fi, Coffee, Parking, etc.).
    *   **Management**: Admin/Partner can publish or unpublish spaces.
*   **Areas**: A Space is divided into Areas (e.g., "Open Desk", "Private Office").
    *   **Capacity**: Each area has a maximum capacity.
    *   **Pricing**: Pricing rules are linked to areas.

## 2. Booking System

*   **Process**: Users browse spaces, select an area, and book it for a specific duration.
*   **Types**: 
    *   **Instant**: Confirmed immediately.
    *   **Request**: Requires partner approval.
*   **Status Workflow**: `Pending` -> `Confirmed` -> `Checked In` -> `Completed`.
*   **Expiration**: Bookings can expire if not confirmed/paid within a timeframe.

## 3. Wallet & Payments

*   **Wallet**: Each user has an internal wallet (`PHP` currency).
*   **Transactions**:
    *   **Cash In**: Users load money into their wallet via PayMongo.
    *   **Payment**: Booking fees are deducted from the wallet.
    *   **Refunds**: Returned to the wallet upon cancellation.
    *   **Payouts**: Partners can withdraw earnings.

## 4. Search & Discovery

*   **Geospatial Search**: Users can find spaces near them using coordinate-based search (PostGIS).
*   **Filters**: Filter by amenities, price, and availability.
*   **Fuzzy Search**: Find spaces by name or address even with typos (`pg_trgm`).

## 5. User Roles

*   **Customer**: Browses and books spaces.
*   **Partner**: Lists and manages spaces. Requires verification.
*   **Admin**: Oversees the platform, approves verification requests, and manages content.

## 6. Verification

*   **Partner Verification**: Partners must submit documents (DTI/SEC registration, Business Permit) to list spaces.
*   **Space Verification**: Spaces undergo review before being publicly listed.
*   **Admin Review**: Admins review submitted documents and approve/reject them.

## 7. Social Features

*   **Chat**: Real-time messaging between Customers and Partners regarding bookings or inquiries.
*   **Reviews**: Customers can rate (1-5 stars) and review spaces they have visited.
