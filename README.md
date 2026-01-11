# Hand Tracking Game

A modular browser-based hand-tracking game system with separate logic and UI agents.

## Architecture

- **Logic Agent** (`src/agents/logicAgent.js`): Processes hand coordinates and outputs action JSON
- **UI Renderer** (`src/components/GameCanvas.jsx`): Renders hand nodes and virtual objects using React-Konva
- **Game Loop** (`src/App.jsx`): Integrates both agents with real-time updates

## Commands

```bash
yarn install
yarn dev
```

## How It Works

1. Hand positions (currently mouse) are tracked as {x, y} coordinates
2. Logic agent interprets positions and outputs JSON actions:
   - `move_left`: Hand in left zone
   - `move_right`: Hand in right zone
   - `jump`: Hand raised high
   - `stop`: Hand in center/neutral
3. UI renders hand nodes as glowing circles and virtual object responds to actions

## Future Enhancements

- Replace mouse input with MediaPipe hand tracking
- Replace 2D Konva shapes with 3D Blender models (Three.js/React-Three-Fiber)
- Add more gestures (pinch, grab, swipe)
