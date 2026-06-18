# Graph Report - Invitaciones-BackendExpress  (2026-06-14)

## Corpus Check
- 67 files · ~24,096 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 592 nodes · 898 edges · 29 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `94c23357`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]

## God Nodes (most connected - your core abstractions)
1. `{ z }` - 13 edges
2. `validate()` - 13 edges
3. `sendMessage()` - 11 edges
4. `protect` - 10 edges
5. `main()` - 9 edges
6. `assertPlanFeature()` - 8 edges
7. `assertEffectivePlanFeature()` - 8 edges
8. `sendMail()` - 8 edges
9. `normalizePlan()` - 7 edges
10. `getPlanDefinition()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `planExpiresAt()`  [EXTRACTED]
  scripts/migrateCommercialPlans.js → src/config/plans.js
- `main()` --calls--> `connectDatabase()`  [EXTRACTED]
  scripts/migrateCommercialPlans.js → src/config/database.js
- `bootstrap()` --calls--> `connectDatabase()`  [EXTRACTED]
  src/server.js → src/config/database.js
- `resolveRequestedPlan()` --calls--> `normalizePlan()`  [EXTRACTED]
  src/controllers/paymentController.js → src/config/plans.js
- `applySubscriptionObject()` --calls--> `normalizePlan()`  [EXTRACTED]
  src/controllers/paymentController.js → src/config/plans.js

## Import Cycles
- None detected.

## Communities (29 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (30): AlbumAsset, { assertEffectivePlanFeature }, asyncHandler, buildPublicUrl(), env, Event, Guest, IMAGE_TYPES (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (26): activeProvider(), buildMetaTemplatePayload(), buildText(), crypto, env, eventDateText(), eventLocationText(), fallbackProvider() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (23): connectDatabase(), env, mongoose, asyncHandler, crypto, emailService, env, jwt (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (16): asyncHandler, env, jwt, protect, requireRole(), User, controller, express (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (19): { assertEffectivePlanFeature }, asyncHandler, buildRsvpData(), createRsvpActivity(), emailService, Event, findExistingEventRsvp(), findExistingRsvp() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (13): asyncHandler, buildUniquePortalSlug(), crypto, emailService, ensureExternalPortalPayload(), env, Event, EventAccessToken (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (17): assertMediaAllowed(), asyncHandler, AUDIO_TYPES, DOCUMENT_TYPES, env, Event, { getPlanLimits, getEffectivePlanLimits, assertEffectivePlanFeature }, { getSignedUrl } (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (21): asyncHandler, buildDuplicateError(), buildDuplicateKeyError(), buildDuplicateQuery(), companionRows(), emailService, env, Event (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (25): asyncHandler, Event, Guest, Invitation, Rsvp, WhatsAppMessageLog, invitationSchema, mongoose (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (10): asyncHandler, env, Guest, whatsappService, crypto, guestSchema, mongoose, controller (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (14): AlbumAsset, asyncHandler, Event, EventAccessToken, EventTable, Guest, ROLE_PERMISSIONS, Rsvp (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): assets, auth, checkIn, contact, dashboard, eventAccess, events, express (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.23
Nodes (16): buildGuestMessage(), createTransporter(), env, escapeHtml(), eventDateText(), eventLocationText(), isEmailConfigured(), messageSubject() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (15): communicationBody, controller, emailSendBody, express, guestBody, guestUpdateBody, importBody, multer (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (6): apiUrl, assertPublicInvitationPayload(), idOf(), main(), request(), runId

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (30): { assertEffectivePlanFeature }, asyncHandler, crypto, env, Event, Guest, StaffAccessToken, mongoose (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (9): controller, express, inspectUrlBody, mediaTypes, { protect }, router, uploadUrlBody, { validate, z } (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (17): controller, express, { protect }, router, { validate, z }, controller, express, router (+9 more)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): checkoutBody, controller, express, { protect }, router, { validate, z }

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): controller, express, { protect }, publicRsvpBody, publicRsvpLimiter, rateLimit, router, { validate, z }

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (19): activateDemoPlan(), apiUrl, clientUrl, crc32(), ensureDemoUser(), ensureEvent(), ensureGuest(), env (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (39): assertEffectivePlanFeature(), assertPlanFeature(), effectivePlanKey(), getEffectivePlanDefinition(), getEffectivePlanLimits(), getPlanDefinition(), getPlanLimits(), isEventPlanActive() (+31 more)

### Community 23 - "Community 23"
Cohesion: 0.07
Nodes (23): asyncHandler, emailService, asyncHandler, buildUniqueSlug(), emailService, env, Event, { getEffectivePlanLimits } (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (26): albumController, assetPayload(), asyncHandler, env, Event, Guest, publicEvent(), Rsvp (+18 more)

### Community 25 - "Community 25"
Cohesion: 0.31
Nodes (9): api(), apiUrl, assertEnv(), idOf(), main(), postSignedWebhook(), request(), runId (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (12): errorHandler(), notFound(), app, cors, env, express, helmet, morgan (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (7): assert, event, guest, invitation, payload, text, whatsappService

### Community 28 - "Community 28"
Cohesion: 0.40
Nodes (4): controller, express, router, { validate, z }

## Knowledge Gaps
- **347 isolated node(s):** `zlib`, `mongoose`, `env`, `User`, `Event` (+342 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `{ z }` connect `Community 17` to `Community 0`, `Community 3`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 20`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `validate()` connect `Community 17` to `Community 0`, `Community 3`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 20`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `protect` connect `Community 3` to `Community 0`, `Community 13`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 20`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `zlib`, `mongoose`, `env` to the rest of the system?**
  _347 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14532019704433496 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06951871657754011 - nodes in this community are weakly interconnected._