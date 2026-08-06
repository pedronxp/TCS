## ADDED Requirements

### Requirement: Usage is enforced atomically by entitlement
The system SHALL resolve the active organization/subject, subscription version, add-ons and current usage before allowing a billable or limited operation. Interface visibility SHALL NOT be the sole enforcement mechanism.

#### Scenario: Inspection quota is exhausted
- **WHEN** an authorized user attempts to finalize an inspection after the organization's quota is exhausted
- **THEN** the system SHALL reject the finalization with an actionable quota result while preserving permitted history and draft access

### Requirement: Monthly quotas renew only with confirmed recurring payment
The system SHALL create a new usage period only after the applicable monthly payment is confirmed, except for an explicitly configured initial active period after approved setup.

#### Scenario: Monthly due date passes without approval
- **WHEN** the due date passes and no payment is confirmed
- **THEN** the system SHALL not reset the monthly inspection quota

### Requirement: Storage measures actual active occupancy
The system SHALL calculate storage from active object bytes and maintain a server-side ledger/reservation process for upload, finalization, deletion and reconciliation. Storage SHALL NOT reset on a monthly cycle.

#### Scenario: Customer has used 3.2 GiB of 5 GiB
- **WHEN** a new billing cycle begins
- **THEN** the customer SHALL retain 3.2 GiB as occupied capacity until eligible objects are removed

#### Scenario: Concurrent uploads exceed the remaining capacity
- **WHEN** concurrent uploads would exceed the organization storage limit
- **THEN** reservations SHALL prevent more than the available capacity from becoming active

### Requirement: Capacity alerts and blocks are specific
The system SHALL notify at configurable 80%, 95% and 100% thresholds and SHALL block only the exceeded capability.

#### Scenario: Storage is full but reports remain accessible
- **WHEN** an organization reaches its storage cap
- **THEN** new uploads SHALL be blocked while authorized report viewing and support access remain available

