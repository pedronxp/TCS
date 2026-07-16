## ADDED Requirements

### Requirement: App displays subscription context
The mobile app SHALL display the active plan, subscription status, organization when applicable, users/seats, relevant usage, and available features.

#### Scenario: Municipal coordinator opens subscription screen
- **WHEN** the coordinator opens the subscription area
- **THEN** the app SHALL show the organization's plan, agent usage, limits, and enabled modules

### Requirement: Locked feature explains next action
The app SHALL show a localized explanation and a support or upgrade action when a feature is not available.

#### Scenario: Agent selects ARV without entitlement
- **WHEN** an agent selects ARV without the feature entitlement
- **THEN** the app SHALL not open the workflow and SHALL explain how to request access

### Requirement: Existing data remains readable
The app SHALL allow authorized users to view their existing records when a creation limit is reached or a subscription enters a defined grace state.

#### Scenario: Customer reaches inspection quota
- **WHEN** the inspection quota is exhausted
- **THEN** the user SHALL retain access to permitted history and exports
