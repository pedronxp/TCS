## ADDED Requirements

### Requirement: Unified product identity
The application SHALL present TCS as the parent brand, Relatório e Risco as the product name, and Defesa Civil as the specialized audience throughout the unauthenticated opening experience.

#### Scenario: User opens the public entry screen
- **WHEN** an unauthenticated user reaches the public entry screen
- **THEN** TCS SHALL be the dominant brand, Relatório e Risco SHALL identify the product, and the interface SHALL describe the product as intended for Defesa Civil

#### Scenario: Organization is not resolved
- **WHEN** the application has not resolved an authenticated organization
- **THEN** the interface SHALL NOT present a specific municipality, prefeitura, órgão, or municipal crest as the global product identity

### Requirement: Consistent platform assets
The application SHALL use approved TCS Relatório e Risco assets for the installed icon, native splash, adaptive icon, favicon, and other platform surfaces included in the release.

#### Scenario: Application is installed or launched
- **WHEN** the operating system displays an application icon or native splash
- **THEN** it SHALL NOT display the legacy TCS Cursos e Serviços identity or provisional template artwork

#### Scenario: Asset requires transparency
- **WHEN** a brand asset is rendered over a themed or native background
- **THEN** the asset SHALL use an approved transparent composition without an unintended white rectangle

### Requirement: Continuous opening sequence
The application SHALL provide visual continuity from the native splash through the React Native boot state to the first navigable destination.

#### Scenario: Cold start while application contexts load
- **WHEN** the native splash ends and authentication, training, theme, or onboarding state is still loading
- **THEN** the React Native boot state SHALL preserve the approved background and brand composition without displaying an unrelated spinner-only screen

#### Scenario: Destination becomes available
- **WHEN** the application has enough state to resolve the destination
- **THEN** it SHALL transition without an artificial delay to the route selected by the existing routing rules

### Requirement: Existing routing behavior is preserved
The opening redesign SHALL preserve the current routing outcomes for onboarding, unauthenticated access, authenticated sessions, training sessions, expired training sessions, and password recovery flows.

#### Scenario: First installation
- **WHEN** onboarding has not been completed
- **THEN** the application SHALL route the user to onboarding

#### Scenario: Returning unauthenticated user
- **WHEN** onboarding is complete and no valid application or training session exists
- **THEN** the application SHALL route the user to the public authentication entry

#### Scenario: Authenticated user
- **WHEN** a valid authenticated user profile is available
- **THEN** the application SHALL continue to route the user to the appropriate panel destination

#### Scenario: Training or recovery flow
- **WHEN** a valid training state or password recovery route is active
- **THEN** the redesign SHALL NOT redirect the user away from the route allowed by the current resolver

### Requirement: Public action hierarchy
The public entry screen SHALL expose one primary system-access action, secondary activation and product-information actions, and a visually separate training action.

#### Scenario: User selects the primary action
- **WHEN** the user activates "Acessar sistema"
- **THEN** the application SHALL navigate to the existing login flow

#### Scenario: User selects activation or information
- **WHEN** the user activates "Ativar acesso" or "Conhecer o TCS"
- **THEN** the application SHALL navigate to the corresponding existing activation or product-presentation flow

#### Scenario: User selects training
- **WHEN** the user activates "Modo treinamento"
- **THEN** the application SHALL navigate to the existing training entry flow without presenting it as the primary authentication action

### Requirement: Authenticated institutional context
The application SHALL present municipality, prefeitura, órgão, crest, or organization logo only after a trusted authenticated context has resolved the applicable organization.

#### Scenario: Municipal member signs in
- **WHEN** an authenticated municipal member has a resolved organization
- **THEN** the application MAY present the organization name and approved institutional identity as contextual information subordinate to the TCS product identity

#### Scenario: Individual account signs in
- **WHEN** an authenticated individual account has no municipal organization
- **THEN** the application SHALL remain fully branded as TCS Relatório e Risco without requiring municipal identity

### Requirement: Truthful connectivity status
The public opening experience SHALL derive connectivity messaging from the available connectivity state and SHALL NOT present a constant claim that the complete service is online.

#### Scenario: Device is offline
- **WHEN** the connectivity context reports no connection
- **THEN** the interface SHALL communicate offline state without claiming the system is online

#### Scenario: Device has network connectivity
- **WHEN** the connectivity context reports a usable connection
- **THEN** the interface SHALL use connectivity wording that does not imply verified health of every backend service unless such health was actually checked

### Requirement: Responsive and accessible opening
The opening, onboarding, and authentication entry surfaces SHALL remain usable with safe areas, supported small screens, enlarged text, light and dark themes, and reduced-motion preferences.

#### Scenario: Content does not fit vertically
- **WHEN** device height or enlarged text prevents all content from fitting at once
- **THEN** the user SHALL be able to reach every action through a layout fallback such as scrolling without overlap with system safe areas

#### Scenario: User interacts with an action
- **WHEN** an actionable control is rendered
- **THEN** it SHALL provide an effective touch target of at least 44 by 44 logical points and readable contrast in the active theme

#### Scenario: Reduced motion is enabled
- **WHEN** the operating system indicates that reduced motion is preferred
- **THEN** the opening experience SHALL avoid continuous decorative animation and SHALL preserve all information and actions without animation
