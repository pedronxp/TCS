## ADDED Requirements

### Requirement: Owner can manage commercial configuration
The internal console SHALL allow authorized owners to manage plans, features, limits, organizations, subscriptions, and support settings.

#### Scenario: Owner configures a municipal plan
- **WHEN** an owner assigns a plan and feature set to a municipality
- **THEN** the organization SHALL receive the configured entitlements and the change SHALL be audited

### Requirement: Owner can inspect customer health
The console SHALL show subscription status, seat usage, usage warnings, active sessions, recent errors, and support status per customer.

#### Scenario: Owner opens municipality details
- **WHEN** an owner opens a municipality
- **THEN** the console SHALL show organization-scoped operational and commercial information without merging another municipality's data

### Requirement: Administrative actions are protected
The console SHALL require an internal administrative identity and SHALL audit sensitive actions.

#### Scenario: Non-owner opens owner route
- **WHEN** a mobile customer or non-owner requests an owner route
- **THEN** the system SHALL deny access and record the denied administrative attempt when appropriate
