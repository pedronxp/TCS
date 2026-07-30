## ADDED Requirements

### Requirement: Web surfaces have independent route boundaries
The system SHALL expose the public site, customer portals, and TCS internal console through distinct route trees with independent layouts, providers, navigation, and authorization guards.

#### Scenario: Customer opens the internal console
- **WHEN** an authenticated customer without an active `internal_staff` profile requests `/app/*`
- **THEN** the system SHALL deny access without mounting internal data providers or returning internal navigation

#### Scenario: Internal staff opens the customer portal
- **WHEN** internal staff requests a customer portal route without a customer or organization context
- **THEN** the system SHALL require an explicit customer identity and SHALL NOT infer portal access from the internal role

### Requirement: Public routes do not query privileged contracts
The public site SHALL use only anonymous-safe Auth and sanitized commercial endpoints and SHALL NOT call `internal_*` or customer-private RPCs.

#### Scenario: Anonymous visitor opens the plan catalog
- **WHEN** an anonymous visitor requests `/planos`
- **THEN** the system SHALL return only the published commercial catalog without mounting internal or portal sessions

### Requirement: Customer redirects remain inside customer routes
The system SHALL validate post-login destinations against the authenticated audience and SHALL reject destinations from another Web surface.

#### Scenario: Customer login contains an internal return URL
- **WHEN** a customer login request contains `returnTo=/app/clientes`
- **THEN** the system SHALL redirect to the customer's portal home instead of the internal route

### Requirement: Customer APIs are audience-scoped
Customer portal operations SHALL use server contracts that derive the subject from `auth.uid()` and SHALL NOT accept internal role, organization, or plan identifiers as authorization claims from the client.

#### Scenario: Client changes organization in a request
- **WHEN** a municipal customer submits an organization identifier different from the persisted membership
- **THEN** the server SHALL reject the operation and SHALL NOT return or mutate data from the requested organization
