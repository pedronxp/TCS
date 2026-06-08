## ADDED Requirements

### Requirement: Coordinate validation for route and map actions
The system SHALL validate coordinates before opening routes, rendering markers, fitting map bounds, or animating map regions. Valid coordinates MUST be finite numbers, latitude MUST be between -90 and 90, longitude MUST be between -180 and 180, and the pair MUST NOT be `0,0`.

#### Scenario: Invalid route coordinates are blocked
- **WHEN** a user attempts to open "Como Chegar" for an inspection with missing, invalid, out-of-range, or `0,0` coordinates
- **THEN** the system does not open the native map app and informs the user that the route cannot be traced without valid coordinates

#### Scenario: Invalid map points are not rendered
- **WHEN** inspection or scheduling data contains invalid coordinates
- **THEN** the map excludes those points from markers, heatmap points, bounds fitting, and initial animation

### Requirement: Android map lifecycle does not leave residual drawings
The system SHALL prevent native Android map surfaces from leaving route, line, marker, or blank-surface artifacts when the user navigates away from map-related screens.

#### Scenario: Leaving map screen before opening a new inspection
- **WHEN** the user leaves a map or route-related screen and starts a new inspection on Android
- **THEN** no stale map surface, black line, route trace, or blank overlay remains visible during the transition

#### Scenario: Map timers do not update after unmount
- **WHEN** a map screen loses focus or unmounts while timers, marker rendering, or region animations are pending
- **THEN** those pending operations are cancelled or ignored and no state update is attempted after unmount

### Requirement: Route launch uses only validated destination data
The system SHALL launch external route navigation only from a verified destination coordinate and SHALL keep the app stable if the external route app cannot be opened.

#### Scenario: Valid route opens native navigation
- **WHEN** the user taps "Como Chegar" for an inspection with valid latitude and longitude
- **THEN** the system opens the platform route/navigation URL for that destination

#### Scenario: Route app launch fails
- **WHEN** the platform cannot open the route/navigation URL
- **THEN** the system remains on the current app screen and shows a recoverable error message
