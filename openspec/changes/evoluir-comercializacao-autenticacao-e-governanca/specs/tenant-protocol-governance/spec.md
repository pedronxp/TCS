## ADDED Requirements

### Requirement: Organization is the authorization and commercial scope
The system SHALL resolve every customer operation from an immutable individual subject or organization membership. A municipality reference SHALL NOT grant access, define usage, billing, or protocol ownership.

#### Scenario: Two customers operate in the same municipality
- **WHEN** an individual and a municipal organization select the same IBGE municipality
- **THEN** their inspections, members, subscription usage, billing records, and protocols SHALL remain isolated

### Requirement: Official protocol is server allocated
The system SHALL allocate an official protocol only through an authorized server-side transaction when an inspection reaches the configured finalization transition. A client-provided protocol SHALL NOT be accepted as official.

#### Scenario: Offline inspection is finalized later
- **WHEN** a mobile user finalizes an inspection while offline
- **THEN** the client SHALL display a pending/local identifier and the server SHALL assign exactly one official protocol when synchronization succeeds

### Requirement: Protocol sequences are organization scoped and immutable
The system SHALL maintain protocol series and counters by organization, series and year with atomic allocation and uniqueness constraints. A voided or deleted business record SHALL NOT cause a protocol to be reused.

#### Scenario: Concurrent finalizations share a municipal series
- **WHEN** two authorized members of one municipality organization finalize inspections concurrently
- **THEN** each SHALL receive a distinct sequential protocol in that organization's configured series

#### Scenario: Legacy protocol exists
- **WHEN** a historical inspection already has a persisted protocol
- **THEN** migration and normal operation SHALL preserve that value without renumbering it

