# Spec Delta

## MODIFIED Requirements

### Requirement: Exercise muscles
`muscles` SHALL be a mapping with `primary`, a list of at least one key of the muscle dictionary for
the muscles that do the work, the exercise's primary force generators, and optionally `secondary`, a
list of such keys for other muscles that the exercise is likely to train meaningfully, what
`pelland2026` calls synergists.
A muscle that only steadies a joint while others do the work, or that the exercise loads too little to
train, SHALL NOT be in `secondary`. Review of each catalog entry checks this.

#### Scenario: Primary and secondary muscles
- **WHEN** an entry has `muscles: {primary: [quads, glute_max], secondary: [adductors]}`
- **THEN** the muscles are accepted

#### Scenario: No primary muscles
- **WHEN** an entry has `muscles: {secondary: [biceps]}`
- **THEN** the entry is invalid

#### Scenario: Synergists of a press
- **WHEN** a contributor proposes a bench press with `primary: [pecs]` and
  `secondary: [delt_front, triceps]`
- **THEN** review accepts the muscles: the press trains the front delts and the triceps, while the
  chest drives it

#### Scenario: Stabilizer as a secondary muscle
- **WHEN** a contributor lists `rotator_cuff` in `secondary` of a pull-up
- **THEN** review rejects it: the rotator cuff steadies the shoulder, and a pull-up does not train it
  meaningfully

#### Scenario: Muscle loaded too little
- **WHEN** a contributor lists `soleus` in `secondary` of a squat
- **THEN** review rejects it: the soleus keeps the ankle steady, and a squat loads it too little to
  train it

#### Scenario: Loaded carry
- **WHEN** a contributor lists `traps` and `glute_med` in `secondary` of a suitcase carry
- **THEN** review accepts them: holding the load is the exercise, and both muscles hold against it
