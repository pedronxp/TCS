## ADDED Requirements

### Requirement: Payment confirmation is webhook authoritative
The system SHALL create an internal payment order before provider checkout and SHALL change financial state only after validating the provider's signed webhook and deduplicating the event.

#### Scenario: Customer returns from checkout before webhook delivery
- **WHEN** the customer opens the return page but the webhook is not yet processed
- **THEN** the page SHALL show pending verification and SHALL NOT activate the subscription solely from the browser return

#### Scenario: Provider retries an approved event
- **WHEN** the provider delivers the same approved event more than once
- **THEN** the system SHALL record the delivery safely and SHALL apply payment, entitlement and notification effects exactly once

### Requirement: Coupon redemption is atomic and auditable
The system SHALL validate coupon applicability, status, period, limit, identity/organization restrictions and combination rules server-side. A coupon redemption SHALL be confirmed only with approved payment.

#### Scenario: Final coupon redemption is contested concurrently
- **WHEN** two eligible checkouts attempt to use the final available coupon redemption
- **THEN** no more than one approved order SHALL consume it

### Requirement: Payment outcomes are reconciled
The system SHALL store provider reference, requested amount, settled amount, effective fee, payment status, refund/chargeback events and reconciliation timestamp.

#### Scenario: Payment is refunded after activation
- **WHEN** a confirmed payment is later refunded or disputed
- **THEN** the system SHALL record the event, notify authorized internal roles, and transition access only according to the configured commercial rule

