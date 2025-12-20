# AwardWallet Integration

**Spec Status**: Shaping  
**Created**: 2025-12-19  
**Author**: Pascal  

## Overview

Integration of AwardWallet APIs into MYLO Travel Concierge to track user loyalty points/miles and provide intelligent award flight recommendations.

## Key APIs

- **Account Access API** (OAuth2, free) - Connect users' existing AwardWallet accounts
- **Web Parsing API** (paid) - Retrieve loyalty account data on demand

## Goals

1. Users can connect their AwardWallet account from MYLO settings
2. Display current loyalty balances in the UI (header/settings)
3. MYLO AI knows user's points balances for personalized recommendations
