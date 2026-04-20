const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CANONICAL_REVIEW_STATES,
  normalizeReviewStatus,
  toLegacyReviewStatus,
  normalizeProvenanceRecord,
  alignReviewWorkflowMetadata,
} = require('../apps-script/review-schema-contract.js');

test('maps legacy review states to canonical ReviewStatus.state', () => {
  assert.equal(normalizeReviewStatus('pending').state, CANONICAL_REVIEW_STATES.IN_REVIEW);
  assert.equal(normalizeReviewStatus({ status: 'accepted' }).state, CANONICAL_REVIEW_STATES.APPROVED);
  assert.equal(normalizeReviewStatus({ state: 'needs_revision' }).state, CANONICAL_REVIEW_STATES.CHANGES_REQUESTED);
});

test('retains reviewer metadata while normalizing ReviewStatus', () => {
  assert.deepEqual(
    normalizeReviewStatus({
      status: 'under_review',
      reviewedBy: 'person:12',
      timestamp: '2026-01-05T12:00:00Z',
      reason: 'waiting on source check',
    }),
    {
      state: 'in_review',
      reviewerId: 'person:12',
      reviewedAt: '2026-01-05T12:00:00Z',
      notes: 'waiting on source check',
      legacyState: 'under_review',
    }
  );
});

test('supports canonical to legacy status adapter for backwards compatibility', () => {
  assert.deepEqual(
    toLegacyReviewStatus({
      state: 'changes_requested',
      reviewerId: 'person:42',
      reviewedAt: '2026-01-06T12:00:00Z',
      notes: 'clarify provenance source',
    }),
    {
      status: 'needs_revision',
      reviewedBy: 'person:42',
      timestamp: '2026-01-06T12:00:00Z',
      reason: 'clarify provenance source',
    }
  );
});

test('aligns legacy provenance fields to canonical ProvenanceRecord', () => {
  assert.deepEqual(
    normalizeProvenanceRecord({
      type: 'review_decision',
      sourceRef: 'review:123',
      url: 'https://example.com/review/123',
      createdAt: '2026-01-03T10:00:00Z',
      createdBy: 'person:7',
      score: 0.88,
      comment: 'review panel approved source reliability',
      provider: 'legacy-review-service',
    }),
    {
      sourceType: 'review_decision',
      sourceId: 'review:123',
      sourceUrl: 'https://example.com/review/123',
      capturedAt: '2026-01-03T10:00:00Z',
      capturedBy: 'person:7',
      confidence: 0.88,
      notes: 'review panel approved source reliability',
      legacy: {
        origin: '',
        provider: 'legacy-review-service',
      },
    }
  );
});

test('normalizes workflow references for TextAnchor Work Person and glossary terms', () => {
  assert.deepEqual(
    alignReviewWorkflowMetadata({
      textAnchor: { ref: 'Genesis 1:1' },
      work: { id: 'work:tanakh' },
      reviewers: ['person:2', 'person:3'],
      tags: ['Creation', 'Opening Verse'],
    }),
    {
      textAnchors: [{ ref: 'Genesis 1:1' }],
      works: [{ id: 'work:tanakh' }],
      persons: ['person:2', 'person:3'],
      glossaryTerms: ['Creation', 'Opening Verse'],
      transitional: {
        hasLegacyTextAnchor: true,
        hasLegacyWork: true,
        hasLegacyPerson: true,
        hasLegacyGlossaryTag: true,
      },
    }
  );
});
