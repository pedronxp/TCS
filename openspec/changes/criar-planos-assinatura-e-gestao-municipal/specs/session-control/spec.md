## ADDED Requirements

### Requirement: One active session per person
The system SHALL allow at most one active mobile session for each user unless an explicitly configured plan policy allows otherwise.

#### Scenario: Same user logs in on a second device
- **WHEN** the user has an active session and successfully authenticates on another device
- **THEN** the system SHALL apply the configured policy atomically and SHALL show the resulting session state to the user

### Requirement: Session liveness is tracked
The system SHALL record last activity or heartbeat and SHALL expire abandoned sessions after a configurable inactivity window.

#### Scenario: Device disappears without logout
- **WHEN** a session has no heartbeat for the configured timeout
- **THEN** the system SHALL mark it inactive and allow a new login

### Requirement: Remote session termination is auditable
The system SHALL allow an authorized coordinator or owner to terminate an active session and SHALL record who performed the action and when.

#### Scenario: Owner terminates lost-device session
- **WHEN** an authorized owner terminates a session
- **THEN** the session SHALL become inactive and an audit event SHALL be created
