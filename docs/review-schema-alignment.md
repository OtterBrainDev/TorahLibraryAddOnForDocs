# Review Schema alignment to canonical knowledge contract

This pass makes Review Schema a real consumer of the shared knowledge contract (after Living Library tooltip payloads and Commentary Builder glossary hints).

## What is aligned now

## 1) ReviewStatus

Review workflow states are normalized onto canonical `ReviewStatus.state` values:

- `draft`
- `in_review`
- `changes_requested`
- `approved`
- `rejected`
- `published`
- `archived`

Legacy values are still accepted through adapter mapping, including:

- `pending`, `under_review` -> `in_review`
- `needs_revision` -> `changes_requested`
- `accepted` -> `approved`
- `denied` -> `rejected`

## 2) ProvenanceRecord

Review provenance/source metadata now normalizes to canonical `ProvenanceRecord` shape:

- `sourceType`
- `sourceId`
- `sourceUrl`
- `capturedAt`
- `capturedBy`
- `confidence`
- `notes`

Legacy fields (`type`, `sourceRef`, `url`, `createdAt`, `createdBy`, `score`, `comment`) are preserved through mapping adapters.

## 3) Workflow metadata references

Review workflow metadata can now be normalized for contract-adjacent references:

- `TextAnchor`
- `Work`
- `Person`
- glossary terms

This pass supports both singular legacy fields and canonical list-oriented fields.

## Transitional / legacy notes

Still transitional in this pass:

- downstream storage schemas are untouched,
- no runtime/GOLEM flow changes,
- no end-user UI changes,
- legacy metadata keys are retained via adapter outputs where needed.

## Next migration steps

1. Move persisted review records to canonical `ReviewStatus` and `ProvenanceRecord` fields at write-time.
2. Update existing read paths to consume canonical shapes first, legacy fallback second.
3. Gradually remove legacy status/source keys once old records are migrated.

## Contract weakness exposed by review workflows

Review workflows need stronger guidance for:

- canonical actor identity (`Person`) semantics for `reviewerId`/`capturedBy`,
- confidence scoring policy (`confidence` scale and interpretation),
- allowed provenance `sourceType` taxonomy governance.

Those should be clarified in the central contract docs before broadening to additional workflow consumers.
