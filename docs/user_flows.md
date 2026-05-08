# User Flows

This document describes the complete local workflows supported by the Sports Strategy Engine MVP.

## Start The App

1. From the repository root, start the backend:
   `./scripts/run_backend.sh`
2. In another terminal, start the frontend:
   `./scripts/run_frontend.sh`
3. Open `http://localhost:5173`

## Strategy Flow

1. Open the `Strategy` tab.
2. Confirm the backend status indicator shows that the API is reachable.
3. Choose a scenario, or pick a player and hole manually.
4. Choose `Tee shot` or `Approach / custom shot`.
5. If using `Approach / custom shot`, click directly on the hole map to place the ball position.
6. Adjust:
   - current lie
   - target X/Y if you want something other than the default pin position
   - wind speed and direction
7. Set the iteration count.
8. Optionally set a risk tolerance override.
9. Click `Run Recommendation`.
10. Review:
   - best strategy card
   - top alternatives table
   - probability breakdown
   - explanation
   - shot cloud summary metrics
   - hole map with target line, recommended aim line, and landing cloud

Successful behavior:
- the run button disables while the request is in flight
- clicking the map switches the workflow into custom-shot positioning
- a recommendation appears without page reload
- the result is added to the `History` tab after the request succeeds

## Player Management Flow

1. Open the `Players` tab.
2. Select an existing player from the list to edit, or click `New Player`.
3. Update:
   - player name
   - handedness
   - confidence
   - preferred shot shape
   - miss tendency
   - risk tolerance
   - club carry, total distance, and dispersion values
   - `Distance dispersion`: how much shot distance usually varies
   - `Left/right dispersion`: how much the shot misses left or right
4. Click `Save Player`.
5. To remove a player, open it and click `Delete Player`.

Successful behavior:
- saved changes remain after refreshing the browser
- updated players are immediately available in the `Strategy` tab
- deleted players disappear from the list and scenario picker options

## Hole Management Flow

1. Open the `Holes` tab.
2. Select an existing hole or click `New Hole`.
3. For a new hole, choose:
   - hole id and display name
   - par
   - yardage
4. Click `Generate Layout`.
5. Use the interactive course editor to drag and resize:
   - green and pin
   - fairway path
   - fairway width and rough width
   - hazards
6. Use the toolbar to add:
   - bunker
   - water
   - OB
   - recovery
7. Adjust wind direction and speed if needed.
8. Click `Save Hole`.
9. To remove a hole, open it and click `Delete Hole`.

Successful behavior:
- saved holes remain after refresh
- updated holes are available immediately in `Strategy`
- deleted holes are removed from the list and no longer appear in scenarios
- the live SVG hole preview updates immediately while features are dragged or resized

## Recommendation History Flow

1. Run one or more recommendations from the `Strategy` tab.
2. Open the `History` tab.
3. Review recent entries by player, hole, expected strokes, risk-adjusted score, and explanation.
4. Refresh the page and reopen `History`.

Successful behavior:
- history entries persist because they are stored in SQLite
- the history list reloads from the backend after a refresh

## Reset Workflow

If you want to reset the local database back to seeded data:

1. Stop the backend.
2. Run `./scripts/reset_db.sh`
3. Start the backend again.

Successful behavior:
- the SQLite file is recreated
- seeded players, holes, and scenarios are restored
- custom players, holes, and history entries are removed
