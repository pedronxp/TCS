## ADDED Requirements

### Requirement: Usage is scoped by period and owner
The system SHALL count billable usage by organization or individual account and by a defined billing period.

#### Scenario: Organization creates an inspection
- **WHEN** an authorized agent creates a new inspection
- **THEN** the system SHALL atomically evaluate and increment the organization's inspection usage

### Requirement: Limits prevent new operations
The system SHALL deny a new operation when its configured limit is reached while preserving access to existing records and exports.

#### Scenario: Inspection limit is reached
- **WHEN** the next inspection would exceed the plan limit
- **THEN** the system SHALL not create it and SHALL return a clear limit or upgrade message

### Requirement: Usage warnings are visible
The system SHALL expose warning states at configurable thresholds, initially 80 percent and 100 percent.

#### Scenario: Usage reaches warning threshold
- **WHEN** an account reaches the warning threshold
- **THEN** the app SHALL display the consumed and allowed values with the relevant action

### Requirement: Concurrent limit checks are atomic
The system SHALL prevent two simultaneous requests from both bypassing the same remaining quota.

#### Scenario: Two agents consume the last unit
- **WHEN** two requests compete for one remaining unit
- **THEN** exactly one request SHALL succeed and the other SHALL receive a limit response
