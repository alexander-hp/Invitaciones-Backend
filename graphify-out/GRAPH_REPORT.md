# Graph Report - Invitaciones-BackendExpress  (2026-06-08)

## Corpus Check
- 57 files · ~15,039 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 443 nodes · 633 edges · 23 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `469dc7cc`
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

## God Nodes (most connected - your core abstractions)
1. `{ z }` - 11 edges
2. `validate()` - 11 edges
3. `protect` - 10 edges
4. `sendMessage()` - 9 edges
5. `sendMail()` - 8 edges
6. `getPlanLimits()` - 7 edges
7. `processInvitation()` - 5 edges
8. `buildText()` - 5 edges
9. `main()` - 4 edges
10. `getPlanDefinition()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `assertInvitationPlanLimits()` --calls--> `getPlanLimits()`  [EXTRACTED]
  src/controllers/invitationController.js → src/config/plans.js
- `bootstrap()` --calls--> `connectDatabase()`  [EXTRACTED]
  src/server.js → src/config/database.js

## Import Cycles
- None detected.

## Communities (23 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (30): AlbumAsset, asyncHandler, buildPublicUrl(), env, Event, Guest, IMAGE_TYPES, Invitation (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (25): assert, event, guest, invitation, payload, text, whatsappService, activeProvider() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (20): connectDatabase(), env, mongoose, errorHandler(), notFound(), emailService, env, app (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (16): asyncHandler, env, jwt, protect, requireRole(), User, controller, express (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (17): { assertPlanFeature }, asyncHandler, buildRsvpData(), createRsvpActivity(), emailService, Event, findExistingRsvp(), Guest (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (9): asyncHandler, crypto, emailService, env, jwt, User, bcrypt, mongoose (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (29): assertPlanFeature(), getPlanDefinition(), getPlanLimits(), LEGACY_PLAN_ALIASES, normalizePlan(), PLAN_DEFINITIONS, assertInvitationPlanLimits(), asyncHandler (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (23): asyncHandler, buildDuplicateError(), buildDuplicateKeyError(), buildDuplicateQuery(), companionRows(), emailService, env, Event (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (30): asyncHandler, Event, Guest, Invitation, Rsvp, asyncHandler, emailService, env (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (18): asyncHandler, emailService, asyncHandler, Event, EventTable, Guest, asyncHandler, env (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (16): assertMediaAllowed(), asyncHandler, AUDIO_TYPES, DOCUMENT_TYPES, env, Event, { getPlanLimits }, { getSignedUrl } (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (14): assets, auth, checkIn, contact, dashboard, events, express, guests (+6 more)

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
Cohesion: 0.07
Nodes (23): asyncHandler, crypto, env, Event, Guest, StaffAccessToken, mongoose, staffAccessTokenSchema (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (8): controller, express, mediaTypes, { protect }, router, uploadUrlBody, { validate, z }, whatsappMediaBody

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (12): controller, express, router, { validate, z }, contactBody, controller, express, router (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): checkoutBody, controller, express, { protect }, router, { validate, z }

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): controller, express, { protect }, publicRsvpBody, publicRsvpLimiter, rateLimit, router, { validate, z }

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (8): asyncHandler, Template, mongoose, templateSchema, env, mongoose, Template, templates

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): controller, express, { protect }, router, { validate, z }

## Knowledge Gaps
- **278 isolated node(s):** `mongoose`, `env`, `Template`, `templates`, `mongoose` (+273 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `{ z }` connect `Community 17` to `Community 0`, `Community 3`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 20`, `Community 22`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `validate()` connect `Community 17` to `Community 0`, `Community 3`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 20`, `Community 22`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `protect` connect `Community 3` to `Community 0`, `Community 13`, `Community 15`, `Community 16`, `Community 18`, `Community 20`, `Community 22`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `mongoose`, `env`, `Template` to the rest of the system?**
  _278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10591133004926108 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._