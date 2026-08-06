## ADDED Requirements

### Requirement: Homologation is isolated from production
The system SHALL use a non-production environment with separate database, storage, identities, payment credentials, email configuration and fictitious data for acceptance testing.

#### Scenario: Payment integration is tested
- **WHEN** a tester executes checkout in homologation
- **THEN** only provider test credentials and test payment outcomes SHALL be used and no production customer access SHALL change

### Requirement: Sensitive capabilities are progressively released
The system SHALL support feature flags by environment and organization for new identity, payment, protocol and commercial features.

#### Scenario: Protocol allocation defect is detected in pilot
- **WHEN** the pilot identifies a defect in the new protocol flow
- **THEN** operators SHALL be able to disable new allocations for the affected cohort without deleting history or renumbering protocols

### Requirement: Pilot validates real isolation and lifecycle scenarios
The pilot SHALL include at least one Individual Profissional and one municipal organization operating in the same municipality, covering web/mobile, offline synchronization, payments, limits, cancellation and notifications.

#### Scenario: Pilot acceptance review occurs
- **WHEN** pilot data and acceptance tests are complete
- **THEN** owner, technical and commercial approvers SHALL review defined success metrics before authorizing public sale

