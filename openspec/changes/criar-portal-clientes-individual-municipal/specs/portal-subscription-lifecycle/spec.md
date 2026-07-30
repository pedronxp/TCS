## ADDED Requirements

### Requirement: Checkout sessions are created server-side
The system SHALL create checkout sessions on the server from an approved plan version, billing subject, periodicity, price, and idempotency key; the browser SHALL NOT define authoritative price or entitlement data.

#### Scenario: Client modifies the checkout price
- **WHEN** a customer submits a price different from the approved server catalog
- **THEN** the server SHALL ignore or reject the client value and SHALL NOT create a mismatched checkout

### Requirement: Payment webhooks are authenticated and idempotent
The system SHALL verify webhook signatures and timestamps, persist each provider event under a unique identifier, and process subscription changes transactionally.

#### Scenario: Provider retries the same event
- **WHEN** the same valid provider event is delivered more than once
- **THEN** exactly one logical subscription transition and audit event SHALL occur

#### Scenario: Webhook signature is invalid
- **WHEN** a webhook has an invalid signature or stale timestamp
- **THEN** the system SHALL reject it without modifying the subscription or entitlements

### Requirement: Browser return does not activate entitlements
The checkout return page SHALL display server-confirmed processing or subscription state and SHALL NOT activate modules based on URL parameters or browser claims.

#### Scenario: Customer forges a successful return URL
- **WHEN** a customer opens the success return URL without a confirmed provider event
- **THEN** the portal SHALL keep the subscription pending and SHALL NOT release paid modules

### Requirement: Subscription states have deterministic access policy
The system SHALL represent trial, active, grace, past due, cancel-at-period-end, canceled, and expired experiences with explicit creation, read, billing, and recovery rules.

#### Scenario: Subscription becomes past due
- **WHEN** the provider reports a payment failure
- **THEN** the portal SHALL show payment recovery, apply the approved creation policy, and preserve authorized historical reads

#### Scenario: Cancellation is scheduled
- **WHEN** cancellation is effective at the current period end
- **THEN** access SHALL continue through the effective date and the portal SHALL show the date and reactivation action

### Requirement: Entitlements refresh automatically after authoritative events
The system SHALL update the effective portal context after a confirmed activation, renewal, plan change, grace transition, payment recovery, or cancellation.

#### Scenario: Trial converts to active
- **WHEN** a verified event activates the paid subscription
- **THEN** the portal SHALL expose the active plan modules without an internal manual grant

### Requirement: Out-of-order events do not regress current state
Webhook processing SHALL compare provider event and subscription version information before applying a transition.

#### Scenario: Older past-due event arrives after payment recovery
- **WHEN** an older past-due event is delivered after a newer active event
- **THEN** the system SHALL retain the newer active state and record the ignored event outcome
