## ADDED Requirements

### Requirement: Domain events create persistent notifications
The system SHALL persist a notification and outbox item in the same authoritative transaction as eligible business events. Delivery to email, web inbox and push SHALL be retried and auditable.

#### Scenario: Setup payment is approved
- **WHEN** the validated payment event activates a subscription
- **THEN** the customer SHALL receive account/access confirmation and authorized owner/finance users SHALL receive a sale notification

### Requirement: Notification audience minimizes personal data
The system SHALL send only the minimum necessary content to each audience. Technical recipients SHALL receive technical identifiers and sanitized failure context by default.

#### Scenario: Payment webhook fails
- **WHEN** processing a payment webhook fails
- **THEN** the developer notification SHALL not contain the customer's name, email, document number, inspection content or payment credentials

### Requirement: Customer notices cover commercial lifecycle
The system SHALL notify the customer of trial start/end, setup payment outcome, recurring payment outcome, usage thresholds, cancellation and eligible privacy request updates.

#### Scenario: Trial is near end
- **WHEN** a trial reaches the configured reminder window
- **THEN** the customer SHALL receive the end date, expected next action and support path

