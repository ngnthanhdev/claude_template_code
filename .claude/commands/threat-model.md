---
description: Run the security-threat-model skill on a named feature before implementation — STRIDE + trust boundaries, output a threat list mapped to ASVS/MASVS mitigations.
argument-hint: <feature name/description>
allowed-tools: Read, Grep, Glob
---

Feature to threat-model: $ARGUMENTS

Run the `security-threat-model` skill against this feature **before** any
code for it is written:

1. Identify every element the feature touches (new endpoint, new mobile
   screen, new external integration) and which trust boundary it crosses —
   mobile (untrusted) ↔ API ↔ database ↔ external services.
2. Walk all six STRIDE categories per element — spoofing, tampering,
   repudiation, information disclosure, denial of service, elevation of
   privilege. Don't skip a category because it "obviously doesn't apply."
3. Trace the data flow through every layer the feature touches (controller →
   service → Prisma, or mobile screen → API client), noting at each hop what
   validates the input and what authorizes the action.
4. Produce a threat list, one row per identified threat: element, STRIDE
   category, threat, mitigation, and the ASVS (backend) or MASVS (mobile)
   category it maps to.

Add this table to the feature's design doc section (`docs/specs/…`) or the
`/refine` entry it's part of, rather than as a standalone document.

Run this during Phase 0/brainstorming or `/refine`, for any feature large
enough to introduce a new trust boundary, data flow, or privilege level —
not for a small same-trust-boundary change (that's what `/security-review`
catches on the resulting diff instead).
