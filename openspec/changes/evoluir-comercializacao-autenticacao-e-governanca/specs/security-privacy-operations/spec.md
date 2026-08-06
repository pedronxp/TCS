## ADDED Requirements

### Requirement: Public and sensitive endpoints resist abuse
The system SHALL apply server-enforced rate limits by route, IP, identity and organization as applicable; authentication and recovery responses SHALL avoid account enumeration and SHALL use progressive challenge controls for suspicious activity.

#### Scenario: Repeated password attempts target one email
- **WHEN** attempts exceed the configured threshold across one or more IPs
- **THEN** the system SHALL throttle or challenge the attempts without disclosing whether the account exists

### Requirement: Customer data and files are private by default
The system SHALL enforce organization-scoped RLS, validate upload type/size, issue time-limited signed file access, protect secrets, and record critical authorization decisions.

#### Scenario: User guesses another organization's file path
- **WHEN** a user requests a file not authorized to their organization and membership
- **THEN** the system SHALL deny access and record the relevant security event without disclosing object existence

### Requirement: Privacy requests are managed and evidenced
The system SHALL provide authenticated requests for confirmation, access, correction, export, deletion/blocking/anonimization when applicable, consent withdrawal and information about sharing. Each request SHALL have owner, deadline, evidence and outcome.

#### Scenario: Customer requests deletion
- **WHEN** a verified customer requests deletion
- **THEN** the system SHALL evaluate retention obligations, execute eligible deletion/anonymous actions, and explain retained categories and reason in the outcome

### Requirement: Incident response is operationalized
The system SHALL maintain an incident runbook that records detection, containment, assessment, controller coordination, communications, remediation and post-incident review.

#### Scenario: A relevant personal-data incident is confirmed
- **WHEN** incident assessment concludes that notification may be required
- **THEN** authorized privacy personnel SHALL have the evidence and workflow necessary to meet the applicable controller and regulatory communication obligations

