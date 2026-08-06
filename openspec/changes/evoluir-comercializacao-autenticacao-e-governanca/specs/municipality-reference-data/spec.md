## ADDED Requirements

### Requirement: Municipalities use canonical IBGE identity
The system SHALL maintain a local canonical municipality reference containing a seven-digit IBGE code, name, UF, state, active status and source update timestamp.

#### Scenario: Standard onboarding selects a municipality
- **WHEN** a customer selects a state and searches for a municipality
- **THEN** the system SHALL save the selected IBGE code rather than free text as the canonical municipality reference

### Requirement: Client applications use the local reference
The mobile app and web portal SHALL query the TCS municipality reference and SHALL NOT call the external source directly for each registration.

#### Scenario: External source is temporarily unavailable
- **WHEN** the IBGE source cannot be reached during a registration
- **THEN** the customer SHALL still be able to select a municipality from the last successful local synchronization

### Requirement: Municipality updates preserve historical references
The synchronization process SHALL preserve known codes and historical labels, mark deactivated items appropriately, and route ambiguous legacy text matches for review.

#### Scenario: Legacy city name is ambiguous
- **WHEN** a legacy city name matches more than one possible municipality without sufficient UF evidence
- **THEN** the record SHALL remain traceable and SHALL be placed in a review queue instead of being silently assigned

