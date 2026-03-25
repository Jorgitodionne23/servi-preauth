# SERVI Implementation Roadmap

This document dynamically tracks our progress on the structural audit findings to ensure we don't lose context.

## 1. Admin Dashboard (Orders) - ✅ COMPLETED
- [x] Wire Capture button to `POST /capture-order`
- [x] Wire Cancel button to `POST /cancel-order`
- [x] Wire Refund button to `POST /refund-order`
- [x] Added Nueva Orden form (with WA link builder)
- [x] Added Ajuste form (with WA link builder)
- [x] Setup auto-preauth GitHub Actions cron

## 2. Admin Dashboard (Inbox) - ✅ COMPLETED
- [x] Add status update actions for Service Requests (`PATCH /api/service-requests/:id`)
- [x] Add status update actions for Reports (`PATCH /api/reports/:id`)
- [x] Add status update actions for Partner Applications (`PATCH /api/partner-applications/:id`)

## 3. Auth Integration - ✅ COMPLETED
- [x] Replace `handleAuth()` stub
- [x] Implement `POST /api/auth/login` and `signup`
- [x] Google Sign-In backend & frontend implementation
- [x] Apple Sign-In backend & frontend implementation

## 4. Booking Flow Polish - ✅ COMPLETED
- [x] Enforce address validation in `submitBooking()`
