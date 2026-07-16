## ADDED Requirements

### Requirement: Plan catalog is configurable
The system SHALL store individual and municipal plans with configurable features, limits, status, and version without requiring a mobile app release to change a plan value.

#### Scenario: Owner updates a plan limit
- **WHEN** an authorized owner changes a plan limit in the internal console
- **THEN** new entitlement evaluations SHALL use the new value while preserving an audit record

### Requirement: Subscription status controls access
The system SHALL associate an account or organization with a subscription status that controls creation of new operations.

#### Scenario: Expired subscription attempts a new inspection
- **WHEN** a user with an expired subscription starts a new inspection
- **THEN** the system SHALL deny creation and show the subscription action available to that customer

### Requirement: Plan features are explicit
The system SHALL represent models and modules as explicit feature entitlements, including inspection models, ARV, training, and reports.

#### Scenario: Feature is not included
- **WHEN** a user opens a feature absent from the active plan
- **THEN** the system SHALL prevent access and identify the plan or upgrade needed
