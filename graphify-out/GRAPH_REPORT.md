# Graph Report - Invitaciones-BackendExpress  (2026-06-07)

## Corpus Check
- 42 files · ~7,578 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 279 nodes · 395 edges · 22 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `543b0b36`
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
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `protect` - 10 edges
2. `{ z }` - 10 edges
3. `validate()` - 10 edges
4. `sendMail()` - 7 edges
5. `processInvitation()` - 4 edges
6. `main()` - 4 edges
7. `normalizeGuestPayload()` - 4 edges
8. `saveRsvp()` - 4 edges
9. `escapeHtml()` - 4 edges
10. `connectDatabase()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `connectDatabase()`  [EXTRACTED]
  src/server.js → src/config/database.js

## Import Cycles
- None detected.

## Communities (22 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (12): controller, express, guestAccessLimiter, invitationContentBody, invitationCreateBody, invitationUpdateBody, { protect }, publicInvitationLimiter (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.21
Nodes (11): asyncHandler, buildUniqueSlug(), emailService, env, Event, Guest, Invitation, publicEvent() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (20): connectDatabase(), env, mongoose, errorHandler(), notFound(), emailService, env, app (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (10): asyncHandler, env, jwt, protect, requireRole(), User, controller, express (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (16): asyncHandler, buildRsvpData(), createRsvpActivity(), emailService, Event, findExistingRsvp(), Guest, Invitation (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (9): asyncHandler, crypto, emailService, env, jwt, User, bcrypt, mongoose (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (9): asyncHandler, env, Invitation, packages, Payment, Stripe, User, mongoose (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (13): asyncHandler, buildDuplicateError(), buildDuplicateKeyError(), buildDuplicateQuery(), Event, findDuplicateGuest(), Guest, normalizeEmail() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (21): asyncHandler, Event, Guest, Invitation, Rsvp, guestSchema, mongoose, invitationSchema (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (6): controller, express, { protect }, router, uploadUrlBody, { validate, z }

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (8): asyncHandler, Template, mongoose, templateSchema, env, mongoose, Template, templates

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (12): assets, auth, contact, dashboard, events, express, guests, invitations (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.32
Nodes (11): createTransporter(), env, escapeHtml(), isEmailConfigured(), nodemailer, sendContactMessage(), sendInvitationPublishedEmail(), sendMail() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (10): controller, express, guestBody, guestUpdateBody, importBody, multer, { protect }, router (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (6): apiUrl, assertPublicInvitationPayload(), idOf(), main(), request(), runId

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (11): asyncHandler, Event, eventSchema, mongoose, controller, eventBody, eventUpdateBody, express (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (8): contactBody, controller, express, router, { validate, z }, idParam, validate(), { z }

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (8): controller, express, { protect }, publicRsvpBody, publicRsvpLimiter, rateLimit, router, { validate, z }

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): checkoutBody, controller, express, { protect }, router, { validate, z }

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): controller, express, { protect, requireRole }, router, templateBody, { validate, z }

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (5): controller, express, { protect }, router, { validate, z }

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (9): asyncHandler, AUDIO_TYPES, env, { getSignedUrl }, IMAGE_TYPES, { PutObjectCommand, S3Client }, s3, asyncHandler (+1 more)

## Knowledge Gaps
- **182 isolated node(s):** `mongoose`, `env`, `Template`, `templates`, `mongoose` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `protect` connect `Community 3` to `Community 0`, `Community 9`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `{ z }` connect `Community 16` to `Community 0`, `Community 9`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `validate()` connect `Community 16` to `Community 0`, `Community 9`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `mongoose`, `env`, `Template` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.11904761904761904 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._