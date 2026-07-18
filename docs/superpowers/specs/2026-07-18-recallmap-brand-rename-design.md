# RecallMap Brand Rename Design

**Date:** 2026-07-18

## Goal

Rename the public-facing product brand from **Recall** to **RecallMap** so the
name reflects the product's reasoning-map experience and matches the public
GitHub repository.

## Scope

Update only surfaces that judges and users encounter as product branding:

- the browser metadata title;
- the navigation brand and user-facing sentences that name the product;
- the package name and package description;
- the README;
- the three-minute demo script; and
- the Devpost submission checklist.

The preferred public tagline is:

> Teach it back. RecallMap finds the hidden gap.

## Preserved Terms and Identifiers

This is a brand-only rename. Preserve existing internal and domain identifiers,
including:

- `RecallApp` and the `src/components/recall` directory;
- `recall.session.v1`, so saved browser progress remains compatible;
- API schema names such as `recall_diagnosis`;
- domain fields such as `recallCard`;
- the user-facing feature term **Recall card**; and
- historical design and implementation documents, which should continue to
  describe the name used when those decisions were made.

The deployment hostname and systemd service name also remain unchanged.

## Verification

Adjust focused UI and repository-hygiene assertions to require the RecallMap
brand on current public surfaces. Run the complete automated test suite and a
production build. The rename must not change API behavior, stored session data,
or the learning flow.

## Delivery

Commit the implementation separately from this design document, then push the
result to the public `Linshi7766/recallmap` repository. Updating the Azure
deployment is outside this change and requires a separate deployment step.
