# Graph Report - Invitaciones-BackendExpress  (2026-06-08)

## Corpus Check
- 50 files · ~11,119 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 358 nodes · 511 edges · 20 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8067ff7e`
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

## God Nodes (most connected - your core abstractions)
1. `{ z }` - 11 edges
2. `validate()` - 11 edges
3. `protect` - 10 edges
4. `getPlanLimits()` - 7 edges
5. `sendMail()` - 7 edges
6. `processInvitation()` - 4 edges
7. `main()` - 4 edges
8. `getPlanDefinition()` - 4 edges
9. `assertPlanFeature()` - 4 edges
10. `normalizeGuestPayload()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `assertInvitationPlanLimits()` --calls--> `getPlanLimits()`  [EXTRACTED]
  src/controllers/invitationController.js → src/config/plans.js
- `bootstrap()` --calls--> `connectDatabase()`  [EXTRACTED]
  src/server.js → src/config/database.js

## Import Cycles
- None detected.

## Communities (20 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (16): albumController, albumUploadLimiter, controller, express, guestAccessLimiter, invitationContentBody, invitationCreateBody, invitationUpdateBody (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (13): AlbumAsset, asyncHandler, buildPublicUrl(), env, Event, Guest, IMAGE_TYPES, Invitation (+5 more)

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
Nodes (24): assertPlanFeature(), getPlanDefinition(), getPlanLimits(), LEGACY_PLAN_ALIASES, normalizePlan(), PLAN_DEFINITIONS, asyncHandler, AUDIO_TYPES (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (16): asyncHandler, buildDuplicateError(), buildDuplicateKeyError(), buildDuplicateQuery(), companionRows(), Event, findDuplicateGuest(), { getPlanLimits, assertPlanFeature } (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (22): asyncHandler, Event, Guest, Invitation, Rsvp, crypto, guestSchema, mongoose (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (14): albumController, albumStatusBody, checkInController, checkInLinkBody, controller, eventBody, eventUpdateBody, express (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (19): asyncHandler, buildUniqueSlug(), emailService, env, Event, { getPlanLimits }, Guest, Invitation (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (13): assets, auth, checkIn, contact, dashboard, events, express, guests (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.32
Nodes (11): createTransporter(), env, escapeHtml(), isEmailConfigured(), nodemailer, sendContactMessage(), sendInvitationPublishedEmail(), sendMail() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (11): communicationBody, controller, express, guestBody, guestUpdateBody, importBody, multer, { protect } (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (6): apiUrl, assertPublicInvitationPayload(), idOf(), main(), request(), runId

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (22): asyncHandler, crypto, env, Event, Guest, StaffAccessToken, asyncHandler, emailService (+14 more)

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (6): controller, express, { protect }, router, uploadUrlBody, { validate, z }

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (17): controller, express, { protect }, router, { validate, z }, controller, express, router (+9 more)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): checkoutBody, controller, express, { protect }, router, { validate, z }

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): controller, express, { protect }, publicRsvpBody, publicRsvpLimiter, rateLimit, router, { validate, z }

## Knowledge Gaps
- **232 isolated node(s):** `mongoose`, `env`, `Template`, `templates`, `mongoose` (+227 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `{ z }` connect `Community 17` to `Community 0`, `Community 3`, `Community 9`, `Community 13`, `Community 16`, `Community 18`, `Community 20`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `validate()` connect `Community 17` to `Community 0`, `Community 3`, `Community 9`, `Community 13`, `Community 16`, `Community 18`, `Community 20`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `protect` connect `Community 3` to `Community 0`, `Community 9`, `Community 13`, `Community 16`, `Community 17`, `Community 18`, `Community 20`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `mongoose`, `env`, `Template` to the rest of the system?**
  _232 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._