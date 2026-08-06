## ADDED Requirements

### Requirement: Plans are versioned commercial contracts
The system SHALL publish plans as immutable versions that define setup price, recurring price, currency, trial, entitlements, limits, add-ons, visibility and status. Existing subscriptions SHALL retain their contracted version.

#### Scenario: Catalog price changes
- **WHEN** the owner publishes a new price for a plan
- **THEN** a new version SHALL be used for future sales and existing subscriptions SHALL keep their prior version until an approved migration

### Requirement: Individual Basic is retired from new sale
The system SHALL prevent new checkout and onboarding selection of Individual Basic while preserving legacy contract, history and authorized access behavior.

#### Scenario: Legacy Individual Basic customer signs in
- **WHEN** an existing customer on Individual Basic accesses the portal
- **THEN** the system SHALL resolve that customer's historical entitlement without exposing the plan as a new public offer

### Requirement: Trial, setup and monthly cycle follow approved timing
The system SHALL start a two-day trial, create only the setup charge at trial end, and schedule the first recurring monthly charge 30 days after setup approval. The schedule SHALL use server time.

#### Scenario: Customer does not cancel trial
- **WHEN** the two-day trial ends without cancellation
- **THEN** the system SHALL move the subscription to awaiting setup payment and SHALL NOT charge the monthly fee at that time

#### Scenario: Setup is approved
- **WHEN** setup payment is confirmed by the payment provider
- **THEN** the subscription SHALL become active and the first monthly due date SHALL be 30 days after that approval according to the configured timezone policy

### Requirement: Subscription state controls capabilities
The system SHALL enforce the defined subscription states and display a clear next action. Read-only access and data export SHALL remain available where contract and retention policy permit.

#### Scenario: Monthly payment becomes pending
- **WHEN** a recurring payment is not confirmed
- **THEN** the system SHALL enter payment pending, notify the customer, and apply only the configured creation restrictions

