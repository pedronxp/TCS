## ADDED Requirements

### Requirement: Training new inspection entry is stable on Android
The system SHALL open a new inspection from the Modo Treinamento dashboard on Android without white-screen flicker, stale map artifacts, route-line artifacts, automatic return, or navigation lock.

#### Scenario: Participant starts a new training inspection
- **WHEN** a participant with a valid active training session taps "Nova Vistoria" on Android
- **THEN** the system navigates to the initial inspection data screen and renders a stable screen immediately

#### Scenario: Participant starts from a recently used map flow
- **WHEN** a participant starts "Nova Vistoria" after previously viewing map, route, or coordinate-based content
- **THEN** the system does not display a stale map line or blank native map surface during the transition

### Requirement: Training route guard allows inspection routes
The system SHALL allow an active non-expired training session to access the permitted inspection routes without bouncing between auth, training dashboard, and inspection screens.

#### Scenario: Allowed inspection route during active training
- **WHEN** an active training participant is on `dados-iniciais`, `selecao-formulario`, `wizard`, `resultado`, or `relatorio`
- **THEN** the global route guard keeps the participant on that route unless the training session is expired or invalid

#### Scenario: Training session expires during navigation
- **WHEN** the training session expires or is invalidated while the participant is navigating to a new inspection
- **THEN** the system exits training mode and redirects to the training auth screen without leaving a blank or partially rendered inspection screen

### Requirement: GPS and reverse geocode are non-blocking
The system SHALL render the initial inspection data screen before waiting for GPS permission, current position, last known position, or reverse geocode network responses.

#### Scenario: GPS permission dialog is slow
- **WHEN** Android delays, denies, or waits on the location permission request
- **THEN** the address form remains visible and usable while GPS status is shown as a localized loading state

#### Scenario: Reverse geocode is slow or unavailable
- **WHEN** reverse geocode is slow, offline, or fails
- **THEN** the screen remains usable and the user can manually fill address fields

### Requirement: Training inspections remain local-only
The system SHALL preserve the existing training mode isolation while fixing Android navigation stability.

#### Scenario: Training inspection is created online
- **WHEN** a training participant completes a new inspection while the device is online
- **THEN** the inspection is saved locally for training history and is not synced to production Supabase records, storage, audit logs, or operational dashboards
