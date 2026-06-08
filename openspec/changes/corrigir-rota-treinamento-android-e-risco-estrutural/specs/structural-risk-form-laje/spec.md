## ADDED Requirements

### Requirement: Structural form separates slab from pillars and beams
The system SHALL update `risco_estrutural_novo_v2` so the old structure question no longer includes slabs and a separate required slab question appears immediately after it.

#### Scenario: Structure question label is updated
- **WHEN** the user reaches the structure question in the structural risk form
- **THEN** the question label is `Estrutura (pilares e vigas)` and does not mention `lajes`

#### Scenario: Slab question follows structure
- **WHEN** the user advances past `Estrutura (pilares e vigas)`
- **THEN** the system shows a required `Laje` question with the options `Bom`, `Ruim`, and `Pessimo`

### Requirement: Inexistente is restricted to critical structural elements
The system SHALL show the `Inexistente` option only for `Fundacao` and `Estrutura (pilares e vigas)` in the structural risk form.

#### Scenario: Fundacao and structure keep Inexistente
- **WHEN** the user answers `Fundacao` or `Estrutura (pilares e vigas)`
- **THEN** the option `Inexistente` is available

#### Scenario: Other structural questions do not show Inexistente
- **WHEN** the user answers `Laje` or any other structural risk question after pillars/beams
- **THEN** the option `Inexistente` is not available

### Requirement: Inexistente requires technical justification
The system SHALL require a technical justification before allowing the user to advance when `Inexistente` is selected for `Fundacao` or `Estrutura (pilares e vigas)`.

#### Scenario: Justification missing
- **WHEN** the user selects `Inexistente` for `Fundacao` or `Estrutura (pilares e vigas)` and the justification field is empty
- **THEN** the system prevents advancing and asks the agent to justify the condition observed in field

#### Scenario: Justification provided
- **WHEN** the user selects `Inexistente` for `Fundacao` or `Estrutura (pilares e vigas)` and fills the justification field
- **THEN** the system allows advancing and stores the justification with the inspection responses

#### Scenario: Justification appears in outputs
- **WHEN** an inspection has a stored justification for `Inexistente`
- **THEN** the response review, report, laudo, and saved risk snapshot include the justification tied to the corresponding question

### Requirement: Inexistente affects structural risk conservatively
The system SHALL NOT treat `Inexistente` for `Fundacao` or `Estrutura (pilares e vigas)` as zero risk or as merely not applicable.

#### Scenario: Fundacao inexistente affects risk
- **WHEN** the user selects `Inexistente` for `Fundacao`
- **THEN** the risk calculation applies a non-zero conservative impact or minimum risk rule for that response

#### Scenario: Pilares e vigas inexistentes affect risk
- **WHEN** the user selects `Inexistente` for `Estrutura (pilares e vigas)`
- **THEN** the risk calculation applies a non-zero conservative impact or minimum risk rule for that response

### Requirement: Structural form remains on the 0-10 scale
The system SHALL preserve the structural form maximum score of 10 and the existing R1-R4 thresholds after adding the `Laje` question.

#### Scenario: Maximum score remains ten
- **WHEN** all highest-risk structural options are selected in `risco_estrutural_novo_v2`
- **THEN** the maximum calculated score remains 10

#### Scenario: Standard thresholds remain unchanged
- **WHEN** the system classifies structural risk scores
- **THEN** R1, R2, R3, and R4 continue using the existing 0-10 threshold bands
