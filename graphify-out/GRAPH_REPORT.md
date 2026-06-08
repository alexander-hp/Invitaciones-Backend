# Graph Report - Invitaciones-BackendExpress  (2026-06-07)

## Corpus Check
- 42 files · ~6,917 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 264 nodes · 373 edges · 15 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `779160c7`
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

## God Nodes (most connected - your core abstractions)
1. `protect` - 10 edges
2. `{ z }` - 10 edges
3. `validate()` - 10 edges
4. `sendMail()` - 7 edges
5. `processInvitation()` - 4 edges
6. `normalizeGuestPayload()` - 4 edges
7. `escapeHtml()` - 4 edges
8. `main()` - 3 edges
9. `connectDatabase()` - 3 edges
10. `buildRsvpData()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `connectDatabase()`  [EXTRACTED]
  src/server.js → src/config/database.js

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (29): controller, express, { protect }, router, { validate, z }, contactBody, controller, express (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (23): asyncHandler, emailService, asyncHandler, Event, Guest, Invitation, Rsvp, asyncHandler (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (20): connectDatabase(), env, mongoose, errorHandler(), notFound(), emailService, env, app (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (22): asyncHandler, env, jwt, protect, requireRole(), User, controller, express (+14 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (12): asyncHandler, buildRsvpData(), emailService, Event, Guest, Invitation, normalizeEmail(), normalizePhone() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (9): asyncHandler, crypto, emailService, env, jwt, User, bcrypt, mongoose (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (15): asyncHandler, env, Invitation, packages, Payment, Stripe, User, mongoose (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (11): asyncHandler, buildDuplicateQuery(), Event, findDuplicateGuest(), Guest, normalizeEmail(), normalizeGuestPayload(), normalizeGuestRow() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (12): mongoose, rsvpSchema, emailService, env, Guest, Invitation, main(), mongoose (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (11): asyncHandler, env, { getSignedUrl }, { PutObjectCommand, S3Client }, s3, controller, express, { protect } (+3 more)

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
Cohesion: 0.47
Nodes (5): apiUrl, idOf(), main(), request(), runId

## Knowledge Gaps
- **175 isolated node(s):** `mongoose`, `env`, `Template`, `templates`, `mongoose` (+170 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `protect` connect `Community 3` to `Community 0`, `Community 9`, `Community 13`, `Community 6`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `{ z }` connect `Community 0` to `Community 9`, `Community 3`, `Community 13`, `Community 6`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `validate()` connect `Community 0` to `Community 9`, `Community 3`, `Community 13`, `Community 6`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `mongoose`, `env`, `Template` to the rest of the system?**
  _175 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07308377896613191 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07526881720430108 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09116809116809117 - nodes in this community are weakly interconnected._