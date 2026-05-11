# Sports Strategy Engine Summary

## Purpose And Vision

Sports Strategy Engine is a golf decision-support platform built to explore how probabilistic simulation, visual editing, and interactive product design can work together in a real application.

The vision is to turn golf strategy from a static judgment call into a system that can be modeled, edited, tested, and explained. A user should be able to define a player, define a hole, simulate realistic outcomes, and inspect why one strategic choice is better than another.

## The Problem It Solves

Golf strategy is difficult because:

- shot outcomes are uncertain
- hole design strongly affects decision quality
- player ability varies by club, shape, and consistency
- many recommendations are hard to justify without simulation

This project solves that by combining:

- editable player models
- editable hole geometry
- Monte Carlo outcome simulation
- risk-aware strategy ranking
- persistent recommendation history

## Application Architecture

The system is structured as a layered full-stack app.

### Frontend

- React + TypeScript application built with Vite
- Handles UI state, editor interactions, map rendering, forms, and API calls

### Backend

- FastAPI app exposing REST endpoints
- Service layer translates API payloads into persistence and simulation workflows

### Simulation Layer

- Python-based Monte Carlo engine
- Builds shot distributions from player, club, lie, wind, and aim data
- Simulates many outcomes and ranks strategies with expected strokes and risk adjustments

### Persistence

- SQLite stores players, holes, and recommendation history

## Main Systems Built

### Player Modeling System

- Stores player handedness, shape preference, miss tendency, risk tolerance, and club data
- Club-level configuration includes carry, total, lateral dispersion, distance dispersion, confidence, and bias

### Hole Modeling System

- Represents tee, green, pin, fairway, rough, and hazards
- Supports generated draft holes and user-edited geometry

### Recommendation Engine

- Generates shot options
- Simulates outcome distributions
- Computes expected strokes, variance, penalty probability, and surface probabilities
- Produces ranked alternatives and human-readable explanations

## How The Probability Simulation Works Technically

This is one of the most important parts of the project to understand well.

The recommendation engine does not guess a best shot from fixed rules. It evaluates many candidate strategies using probabilistic simulation.

### Step 1: Generate Candidate Shot Options

For each player club, the engine generates multiple shot options across:

- swing intensities
- shot shapes
- different aim targets

Examples include:

- center fairway
- left fairway
- right fairway
- center target
- front target
- layup targets for custom-shot scenarios

This means the system is not simulating just one shot. It is comparing a search space of possible decisions.

### Step 2: Build A Shot Distribution

For each candidate option, the engine builds a probability distribution that describes where the ball is likely to land.

This distribution is influenced by:

- club carry distance
- total distance
- lateral dispersion
- distance dispersion
- player confidence
- preferred shot shape
- miss tendency
- lie type such as tee, fairway, rough, bunker, or recovery
- wind speed and wind direction

Technically, the shot outcome is modeled as a 2D Gaussian distribution.

That means each shot has:

- a mean lateral position `mean_x`
- a mean downrange position `mean_y`
- lateral spread `sigma_x`
- distance spread `sigma_y`
- covariance between left-right and short-long miss patterns

The covariance matters because misses are not always independent. A draw or fade can create correlation between lateral and longitudinal outcomes.

### Step 3: Sample Many Outcomes

Once the distribution is built, the engine uses Monte Carlo simulation.

For one candidate shot:

1. Construct a covariance matrix
2. Validate that it is numerically safe
3. Draw many random samples from a multivariate normal distribution
4. Convert each sample into a landing point on the hole

The implementation uses NumPy’s random generator and multivariate normal sampling.

This is important because it gives:

- realistic spread around the intended aim
- repeatable seeded simulations for stable debugging and tests
- enough statistical depth to compare strategies under uncertainty

### Step 4: Classify Each Landing Point

Each sampled landing point is classified into a terrain type:

- fairway
- rough
- green
- bunker
- water
- out of bounds
- recovery

This is effectively the geometry-to-risk bridge in the system. The editor defines the course geometry, and the simulation engine converts that geometry into strategy consequences.

### Step 5: Estimate Strokes Remaining

After classifying the landing point, the engine estimates how many strokes remain from that position.

The estimate depends on:

- distance from the hole
- terrain surface
- hole par
- penalty situations such as water or OB

The total shot outcome becomes:

- `1 stroke for the shot`
- `+ penalty if applicable`
- `+ estimated strokes remaining`

This converts raw landing data into expected scoring impact.

### Step 6: Aggregate Statistics

After simulating many samples for a shot option, the engine computes:

- expected strokes
- variance
- standard deviation
- penalty probability
- fairway probability
- rough probability
- green probability
- bunker probability
- water probability
- OB probability
- recovery probability

These statistics are what the frontend eventually displays in cards, tables, and visual breakdowns.

### Step 7: Risk-Adjusted Ranking

The project does not rank options on expected strokes alone.

Instead it uses a risk-adjusted score:

`expected_strokes + variance_weight * variance + penalty_weight * penalty_probability`

Those weights depend on the selected risk tolerance:

- low risk tolerance penalizes variance and penalties more heavily
- high risk tolerance allows more aggressive options

This is a strong product and engineering decision because it lets the same simulation engine support different strategic personalities.

### Why Monte Carlo Was The Right Choice

Monte Carlo simulation is a good fit here because:

- shot outcomes are inherently uncertain
- simple deterministic equations would hide important risk
- different surfaces and penalties create non-linear consequences
- strategy comparison needs distributions, not just averages

It also makes the project more interesting to discuss technically, because it combines statistics, modeling, geometry, and software engineering in one pipeline.

## Engineering Skills Demonstrated By The Simulation System

This part of the project showcases several important engineering skills:

- probabilistic modeling
- numerical reasoning
- data modeling
- algorithm design
- simulation system design
- API-to-engine integration
- testability and reproducibility
- product-oriented tradeoff thinking

More concretely, you can say you worked on:

- designing a domain model for players, clubs, holes, hazards, and outcomes
- building a multi-stage pipeline from candidate generation to ranking
- using seeded randomness for deterministic debugging
- validating covariance safety and finite numerical outputs
- translating geometric course data into simulation constraints
- balancing realism with computational speed
- exposing simulation outputs in a way that is useful to end users

### Visual Hole Editor

- Renders the hole as SVG
- Supports selection, movement, resizing, and hazard creation
- Keeps object geometry normalized during edits

## How Object Editing Works Internally

The editor is built around a normalized `HolePayload` model.

Each edit works like this:

1. The user selects an entity.
2. The frontend stores selected-editor state separately from persistent hole geometry.
3. A drag begins from a frozen snapshot of the object’s starting geometry.
4. Pointer movement is converted from screen coordinates into hole coordinates.
5. The object is transformed according to the handle being dragged.
6. The updated hole model is normalized before re-rendering.

This separation is important. It prevents cumulative drift and reduces the chance of invalid geometry entering the saved model.

## Dragging, Resizing, Selection, And Rendering

### Selection

- Clicking an object marks it as the active editable entity
- Selection is visualized with a red outline and contextual handles

### Dragging

- A center handle is shown for movement
- Drag state stores the starting cursor point and the starting object geometry
- Movement is computed as a delta from the initial drag snapshot, not from repeatedly mutated live geometry

### Resizing

- Resize handles are rendered explicitly on the selected outline
- Different shapes expose different handles:
  - circles use radius-style resizing
  - rectangles use side handles
  - corridors use width and vertical-span handles

### Rendering

- The editor uses SVG for predictable geometry rendering
- A projection layer converts domain coordinates into SVG coordinates
- During active drags, the projection is frozen so the object does not visually “jump” under the cursor

## State Management Concepts Used

The app uses local React state with clear separation between:

- server-backed entity state
- temporary form draft state
- editor selection state
- drag state
- undo history
- asynchronous loading/saving status

Examples:

- `holeForm` stores the editable hole draft
- `holeUndoStack` stores rollback snapshots
- `selectedHazardIndex` tracks inspector focus
- `dragState` represents an active interaction in the editor

This design keeps the product lightweight without introducing a global state library before it is needed.

## Performance Optimizations

- `useMemo` is used where derived geometry or selected records are recalculated frequently
- The hole projection is frozen during drag operations to reduce instability and repeated coordinate remapping artifacts
- SVG rendering keeps editor visuals declarative and relatively cheap
- Simulation samples are capped in the API response to avoid returning excessive payload size
- Monte Carlo sampling uses vectorized NumPy operations instead of per-sample Python loops for raw distribution generation
- Strategy ranking uses deterministic seeds so bugs can be reproduced consistently during development

## Debugging And Stability Improvements

Key hardening work included:

- removing tracked runtime artifacts from the repository
- stabilizing editor drag math using start-of-drag snapshots
- freezing projection during active object movement
- normalizing hazard geometry after shape/kind changes
- clearing invalid selected entities after delete or undo
- resetting stale strategy results when player or hole context changes
- adding tests for recommendation edge cases and custom-shot behavior

## Important Technical Decisions And Tradeoffs

### Why SVG Instead Of Canvas

SVG gives:

- easier per-object selection
- simpler hit targets
- direct styling of selected outlines and handles
- easier debugging because each element exists in the DOM

Tradeoff:

- canvas can outperform SVG at very high object counts, but this editor does not need that scale yet

### Why Local React State Instead Of Redux/Zustand

Local state keeps the codebase smaller and easier to reason about at this stage.

Tradeoff:

- as workflows become more collaborative or multi-screen, state orchestration may justify a dedicated store

### Why SQLite

SQLite keeps local development simple and fast.

Tradeoff:

- a hosted or multi-user version would likely move to PostgreSQL or another production DB

### Why A Heuristic Strokes-Remaining Model

The project estimates strokes remaining with a lie-aware heuristic rather than a full strokes-gained dataset.

Benefits:

- much simpler to implement and explain
- fast enough for large simulation batches
- good for prototyping and product validation

Tradeoff:

- it is not yet calibrated against real strokes-gained tour or amateur data
- a future version could replace this with learned or empirical models

### Why Deterministic Seeds In Simulation

Using deterministic seeds gives stable recommendation comparisons during testing and debugging.

Benefits:

- reproducible failures
- stable test assertions
- easier regression analysis

Tradeoff:

- a production analytics environment may also want truly random runs or confidence interval reporting

## Challenges Encountered And How They Were Solved

### Challenge: Objects Jumping During Drag

Cause:

- projection and object geometry were changing at the same time during pointer movement

Fix:

- freeze the projection during active drags
- compute movement from the original geometry snapshot

### Challenge: Geometry Becoming Invalid After Shape Changes

Cause:

- hazards could retain stale properties from a previous shape

Fix:

- normalize hazard geometry after every important edit
- rebuild defaults when hazard kind changes

### Challenge: Editor Intent Was Unclear

Cause:

- moving and resizing were overloaded onto the same interaction surface

Fix:

- explicit selection
- explicit center move handle
- explicit outline resize handles

## UX/UI Decisions And Why They Matter

- Red selection outlines make editing state obvious
- Center move handles make repositioning discoverable
- Dedicated resize handles reduce accidental transformations
- Local-first save flow keeps iteration fast
- History and explanation output make recommendations easier to trust and discuss

These choices matter because strategy tools fail quickly if users cannot understand what is editable, what is selected, or why a recommendation was made.

## Scalability Considerations

This project can scale in several directions:

- larger simulation catalogs and scenario libraries
- more advanced shot planning across multiple sequential shots
- more robust editor tools and terrain semantics
- collaborative or hosted usage
- analytics, exports, and coaching workflows

Areas that would need evolution for larger scale:

- move from SQLite to a multi-user database
- introduce end-to-end UI testing
- potentially add state management infrastructure for more complex workflows
- add API auth, permissions, and deployment automation

## Future Expansion Possibilities

- multi-shot hole planning
- smarter hazard-aware layup generation
- shot-shape heatmaps and uncertainty cones
- import/export of player profiles and custom holes
- scenario comparison dashboards
- hosted demo or SaaS deployment
- multiplayer or coach/player collaboration modes

## Concepts To Master

### Component Architecture

Understand how the UI is divided into reusable units such as selectors, cards, maps, and editors. Good component architecture keeps rendering, interaction logic, and data flow understandable.

### Rendering Systems

Learn why SVG is a strong choice for an editor. Each object is addressable, stylable, and interactive, which makes selection and resizing easier than a raw pixel canvas.

### Event Handling

Study pointer events carefully. The editor depends on `pointerdown`, `pointermove`, and `pointerup` to manage dragging in a stable way.

### Coordinate Systems

The app has at least two coordinate spaces:

- domain coordinates representing hole geometry
- screen/SVG coordinates representing what the user sees

Understanding projection between them is critical.

### Object Transformation

Movement and resizing are both transformations of source geometry. The safest approach is to start from a known snapshot and apply deltas deterministically.

### Collision Or Boundary Logic

This project uses simple boundary rules rather than full collision detection. Examples include:

- clamping pin position to the green
- enforcing minimum corridor height
- preventing invalid fairway path ordering

### State Synchronization

Understand the difference between:

- persistent state from the backend
- temporary form state
- derived display state
- interaction state during drags

Many UI bugs come from mixing these concerns.

### Drag-And-Drop Systems

A robust drag system needs:

- drag start snapshot
- pointer-to-domain conversion
- deterministic delta math
- cleanup on pointer release or cancellation

### Resizable UI Systems

Good resize systems expose explicit handles and avoid ambiguity. A user should always know whether they are moving or resizing.

### Frontend Optimization

You should be able to explain:

- when to memoize derived values
- how to reduce unnecessary rerenders
- how to avoid unstable calculations during interactions

### Simulation Engineering

You should be able to explain:

- how Monte Carlo simulation works
- why a multivariate normal distribution was used
- what mean, variance, standard deviation, and covariance represent
- why random sampling can model uncertainty better than deterministic rules
- how seeded randomness helps reproducibility
- how to validate numerical stability in simulation systems

### Data And Domain Modeling

You should be able to explain:

- how player, club, hole, hazard, and recommendation data were modeled
- why normalized schemas matter between frontend and backend
- how geometry data and simulation data connect

### API And Service Layer Design

You should be able to explain:

- why the backend uses a route layer plus service layer
- how API payloads are translated into domain models
- how persistence is separated from simulation logic

### Testing Strategy

You should be able to explain:

- unit testing vs integration testing
- why edge-case tests are important for simulation systems
- how frontend build validation and backend tests work together
- how to test stochastic systems safely using deterministic seeds

### Numerical And Statistical Thinking

You should be able to explain:

- expected value
- variance
- risk-adjusted scoring
- probability mass across terrain outcomes
- why penalties and uncertainty matter in decision ranking

### Debugging Strategies

Useful strategies include:

- reproducing the bug with exact steps
- isolating state mutations
- checking coordinate transforms
- comparing initial drag snapshot vs live geometry
- validating normalized outputs after each edit

### Clean Code Practices

Important habits:

- separate rendering logic from mutation logic
- normalize state at boundaries
- keep helper functions focused
- delete dead code and runtime artifacts
- test edge cases, not only happy paths

### GitHub And Project Organization

A public repository should have:

- a strong README
- clean ignores
- no generated artifacts committed
- meaningful folder structure
- supporting docs for architecture and usage

### Professional Software Development Workflow

Be ready to discuss:

- incremental debugging
- test-before-and-after validation
- stability hardening
- code review mindset
- release readiness and repository hygiene

## How To Present This Project

When discussing this project publicly, frame it as:

- a simulation-backed decision-support application
- a product that combines backend modeling with interactive frontend tooling
- a project where UX clarity and mathematical modeling both matter
- a strong example of debugging real interactive systems, not just building static UI

The most compelling angle is that this is not just a CRUD app. It is a system where geometry, interaction design, stochastic modeling, and product thinking all meet in one codebase.

If you want a concise technical pitch, say:

"I built a full-stack golf strategy platform that combines a React SVG editor, a FastAPI service layer, and a Monte Carlo simulation engine in Python. The core challenge was turning editable course geometry and player shot profiles into stable probabilistic recommendations, then making that system explainable and interactive for users."
