## ADDED Requirements

### Requirement: Internal functions have least-privilege workspaces
The console SHALL separate owner, commercial, finance, support, developer and privacy permissions. A user SHALL see only the routes, actions and data justified by the assigned permissions.

#### Scenario: Developer opens commercial customer data
- **WHEN** a developer without commercial or support escalation permission opens the console
- **THEN** the console SHALL provide technical health information without exposing customer contact, payment or inspection content

### Requirement: Commercial and proposal workflow is traceable
The console SHALL manage standardized sales and requests under proposal with requester, scope, estimate, approval, payment condition, delivery status and audit trail.

#### Scenario: Customer requests a new custom feature
- **WHEN** the request is not a published add-on
- **THEN** it SHALL enter a proposal workflow and SHALL NOT automatically grant product access

### Requirement: Pricing simulation separates projection from actuals
The console SHALL calculate setup and recurring projected margin from configured price, discounts, payment fee, tax/provision, implementation cost and operating cost; confirmed payments SHALL display actual settled values separately.

#### Scenario: Owner simulates a coupon
- **WHEN** the owner applies a discount in the simulator
- **THEN** the console SHALL show its impact on setup margin, monthly margin and cumulative margin without changing a live plan

### Requirement: Sensitive operations require evidence
The console SHALL require MFA, justification and immutable audit event for high-risk operations including price publication, manual access change, coupon override, data export and break-glass access.

#### Scenario: Support requests protected inspection access
- **WHEN** support needs access beyond normal permissions
- **THEN** the system SHALL require a time-limited approved escalation and record actor, reason, scope and expiry

