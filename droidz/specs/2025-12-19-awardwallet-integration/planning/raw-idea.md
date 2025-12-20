# Raw Idea: AwardWallet Integration

## User's Description

> Ich würde gerne AwardWallet anbinden an meinen Chatbot.
> 
> Mir geht es hier primär um die Web Parsing API und die Account Access API.
>
> Mein Ziel ist es, dass die User sich mit ihrem Award Wallet Account verbinden können (aus MYLO heraus) und sie dann in den Einstellungen oder auch oben in der Leiste ihre aktuellen Punkte sehen (je nachdem was der Endnutzer alles hinterlegt hat in der Award Wallet).
>
> Endziel wäre es, dass MYLO immer weiß wie viele Punkte jemand hat und basierend darauf dann Vorschläge gibt, was die besten Flüge, Prämienflüge usw. sind die gebucht werden können.

## API Documentation Summary

### Account Access API
- **Purpose**: Access loyalty account data from AwardWallet users
- **Auth**: OAuth2 protocol
- **Cost**: Free
- **Flow**:
  1. Create auth URL via `POST /api/export/v1/create-auth-url`
  2. User redirects to AwardWallet consent screen
  3. User approves access, redirects back with code
  4. Exchange code for userId via `GET /api/export/v1/get-connection-info/{code}`
  5. Fetch user's accounts via `GET /api/export/v1/get-connected-user/{userId}`

### Web Parsing API
- **Purpose**: Retrieve loyalty info using user credentials directly
- **Base URL**: `https://loyalty.awardwallet.com/v2/`
- **Auth**: API Key via `X-Authentication: username:password` header
- **Cost**: Paid (contact AwardWallet for pricing)
- **Supports**: 600+ loyalty programs
- **Data returned**:
  - Account balance (points/miles)
  - Expiration dates
  - Elite status
  - Travel itineraries
  - Account history

### Key Endpoints

**Account Access API:**
- `POST /api/export/v1/create-auth-url` - Generate OAuth consent URL
- `GET /api/export/v1/get-connection-info/{code}` - Get userId after connection
- `GET /api/export/v1/get-connected-user/{userId}` - Get all loyalty accounts

**Web Parsing API:**
- `GET /v2/providers/list` - List all supported loyalty programs
- `GET /v2/providers/{code}` - Get provider details
- `POST /v2/connections` - Create connection to fetch account data
- `GET /v2/connections/{connectionId}` - Get connection status/results

## Initial Requirements

1. **User Authentication Flow**
   - Settings page with "Connect AwardWallet" button
   - OAuth2 popup/redirect flow
   - Store connection status in user profile

2. **Points Display**
   - Show aggregated points in header/navigation
   - Detailed view in settings with all programs
   - Refresh mechanism (manual + auto?)

3. **AI Context Integration**
   - Pass loyalty balances to AI during flight searches
   - AI suggests optimal award redemptions
   - Compare cash vs points pricing

4. **Data Storage**
   - Cache loyalty data locally?
   - Refresh frequency?
   - Handle expired/disconnected accounts

## Open Questions

- Which API to use primarily? (Account Access is free but requires user's AwardWallet account)
- How often to refresh loyalty data?
- What happens if user doesn't have AwardWallet account?
- UI for displaying multiple loyalty programs?
