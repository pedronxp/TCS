## ADDED Requirements

### Requirement: Effective access is the intersection of independent controls
The system SHALL grant a portal action only when session, membership status, role permission, plan feature, subscription policy, and resource scope all allow it.

#### Scenario: Role allows a module absent from the plan
- **WHEN** a coordinator requests ARV but the municipal plan does not include ARV
- **THEN** the system SHALL deny the action as a plan restriction even though the role could otherwise perform it

#### Scenario: Plan includes a module but role lacks permission
- **WHEN** an agent requests organization billing on a plan that includes billing management
- **THEN** the system SHALL deny the action as a permission restriction

### Requirement: Access decisions are enforced by the server
Every protected read and mutation SHALL repeat the effective-access evaluation on the server; hiding navigation or controls in the client SHALL NOT be treated as authorization.

#### Scenario: Hidden action is called directly
- **WHEN** a user calls a protected portal operation directly without the required effective permission
- **THEN** the server SHALL reject it and record a sanitized denied-access event

### Requirement: Restriction causes are explicit and non-sensitive
The portal context SHALL distinguish plan restriction, missing permission, inactive membership, subscription restriction, exhausted limit, and out-of-scope resource without exposing sensitive policy details.

#### Scenario: Feature is locked by plan
- **WHEN** a permitted user opens a route for a feature absent from the plan
- **THEN** the portal SHALL show the plan-lock state and applicable upgrade/request action instead of a generic empty state

### Requirement: The commercial matrix is versioned
Plan features and limits used for checkout SHALL reference an approved immutable plan version, and later catalog edits SHALL NOT silently change historical subscription entitlements.

#### Scenario: Plan matrix changes after checkout
- **WHEN** a plan is published with a new module matrix
- **THEN** existing subscriptions SHALL keep the prior version until an explicit migration, renewal, or plan-change rule applies

### Requirement: Matrix publication requires reconciliation
The system SHALL prevent automated checkout publication while the approved documentation, active Supabase catalog, and approved portal design matrix disagree.

#### Scenario: Live ARV entitlement conflicts with approved catalog
- **WHEN** the live plan enables ARV for a plan where the approved matrix disables it
- **THEN** the release gate SHALL fail and identify the conflicting plan and feature
