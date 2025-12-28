# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Systems Architect - System Design Studio** is a React-based visual design tool for system design interview preparation. It provides a drag-and-drop canvas for creating system architecture diagrams with AI-powered challenge generation, evaluation, and tutoring via Google Gemini.

## Development Commands

### Setup
```bash
npm install
```

**Styling:** The project uses Tailwind CSS with PostCSS. Configuration files:
- `tailwind.config.js` - Tailwind configuration with custom colors and fonts
- `postcss.config.js` - PostCSS configuration
- `index.css` - Main stylesheet with Tailwind directives and custom styles

### Run Development Server
```bash
npm run dev
```
Runs on `http://localhost:3000` (configured in vite.config.ts)

### Build
```bash
npm run build
```
Produces optimized production build in `dist/`

### Preview Production Build
```bash
npm run preview
```

### Docker Deployment
```bash
# Production (port 2350)
docker-compose up -d
docker-compose logs -f
docker-compose down

# Development with hot reload (port 2351)
docker-compose -f docker-dev.yml up

# Manual build
docker build -t systems-architect:latest .
docker run -d -p 2350:2350 --name systems-architect systems-architect:latest
```

The Docker setup uses:
- **Multi-stage build**: Builder stage (Node.js) + Production stage (Nginx Alpine)
- **Nginx** serves the static build on port 2350
- **Health checks** ensure container availability
- **Gzip compression** and security headers configured in nginx.conf
- **Development mode**: Mounts source code for hot reload on port 2351

**Security Note**: No server-side API keys are used. Users must provide their own API keys through the Settings UI. Keys are encrypted using AES-GCM via the Web Crypto API before storage in localStorage.

## Architecture & Key Concepts

### Application State Management

The app uses React state management (no external state library). The main state is in `App.tsx`:

- **Design State**: `components` (SystemComponent[]) and `connections` (Connection[]) represent the visual diagram
- **View State**: Pan/zoom state (`viewState`) for canvas navigation
- **History**: Undo functionality via a 30-state history stack
- **Challenge State**: Current AI-generated challenge, evaluation results, and hints
- **Tool State**: Active drawing tool and selected color

### 16-Layer Component System

Components are organized into 16 architectural layers defined in `constants.tsx` (COMPONENT_SPECS):

1. Clients & Entry
2. Traffic Management
3. Compute & App
4. Data Storage
5. Caching
6. Messaging & Streaming
7. File & Blob Storage
8. Content Delivery
9. Observability
10. Security
11. Reliability & Fault Tolerance
12. Scalability
13. Data Governance
14. DevOps & Ops
15. Config & State
16. Governance & Risk

Each layer contains **subtypes** (e.g., Data Storage includes: Relational DB, Document DB, Key-Value, Graph DB, etc.) with specific **tool suggestions** (e.g., PostgreSQL, MongoDB, Redis).

Additional component types include:
- **Flow components**: Start, End, Process, Decision, Loop, Timer, Event
- **Structure components**: Layer (for grouping)
- **Annotations**: Text, Rectangle, Circle, Freehand drawing

### Component Configuration Flow

1. User drags component from Sidebar
2. If component has subtypes and no predefined label → `ComponentConfigDialog` opens
3. User selects subtype and specific tool
4. Component is added to canvas with configuration

This two-level hierarchy (Layer → SubType → Tool) allows both generic and specific designs.

### Canvas Coordinate System

The canvas uses world coordinates with pan/zoom support:
- Screen coordinates are transformed via `viewState` (x, y, zoom)
- Conversion: `worldX = (screenX - sidebarWidth - viewState.x) / viewState.zoom`
- Sidebar width: 288px, TopBar height: ~64px

### Multi-Provider AI Integration

Located in `services/ai-service.ts` with provider implementations in `services/providers/`:

**Supported Providers:**
- Google Gemini (gemini.provider.ts)
- OpenAI (openai.provider.ts)
- Anthropic Claude (claude.provider.ts)

**Core AI Functions:**
1. `generateChallenge()` - Creates system design interview challenges with requirements and constraints
2. `evaluateDesign()` - Scores user's design (0-100) with pros/cons/recommendations
3. `generateHints()` - Provides starter suggestions and architecture strategy
4. `generateSolution()` - Creates a model solution for the challenge
5. `improveSolution()` - Suggests improvements to the current design

**AI Tutor (AITutor.tsx):**
- Real-time chat assistant
- Uses user's own API key (stored encrypted in localStorage)
- System prompt includes challenge context, available components, and hints
- Chat session persists across messages

**API Key Security:**
- No server-side or environment API keys are used
- Users must provide their own API keys via the Settings UI
- Keys are encrypted using AES-GCM (Web Crypto API) before localStorage storage
- Encryption keys are device-specific and auto-generated on first use
- Legacy keys are automatically migrated to the new encryption format

### History/Undo System

Before any mutating operation (add component, delete, clear board):
1. Call `handleSnapshot()` to save current state
2. Perform the mutation
3. User can undo via toolbar (calls `handleUndo()`)

Maintains last 30 states to balance memory and usability.

### Drawing Tools (BottomToolbar)

Tool types defined in `BottomToolbar.tsx`:
- `select` - Default mode for moving/selecting
- `arrow` - Create directed connections
- `line` - Create undirected connections
- `loop` - Create self-referential connections
- `text` - Add text annotations
- `rectangle` - Draw grouping boxes
- `circle` - Draw circular zones
- `pen` - Freehand drawing with SVG paths

Color picker applies colors to selected components or new connections.

## File Structure

```
/
├── App.tsx                 # Main application component & state
├── types.ts                # TypeScript interfaces
├── constants.tsx           # 16-layer component definitions + icons
├── index.tsx              # React entry point (initializes crypto)
├── vite.config.ts         # Vite config (aliases)
├── tsconfig.json          # TypeScript config
│
├── components/
│   ├── Canvas.tsx              # Main drawing canvas (pan, zoom, drag, resize)
│   ├── Sidebar.tsx             # Component library (collapsible layers)
│   ├── TopBar.tsx              # Challenge controls & actions
│   ├── BottomToolbar.tsx       # Drawing tools & zoom controls
│   ├── RequirementsPanel.tsx   # Display challenge requirements
│   ├── EvaluationModal.tsx     # Show AI evaluation results
│   ├── HintModal.tsx           # Show AI hints
│   ├── ComponentConfigDialog.tsx # Subtype & tool selection
│   ├── AITutor.tsx             # Chat interface with AI
│   └── AISettings.tsx          # AI provider & API key configuration
│
├── services/
│   ├── ai-service.ts           # Multi-provider AI service (main entry)
│   ├── gemini.ts               # Legacy wrapper (delegates to ai-service)
│   ├── provider-config.ts      # Provider & model configurations
│   └── providers/
│       ├── ai-provider.interface.ts  # Provider interface definition
│       ├── gemini.provider.ts        # Google Gemini implementation
│       ├── openai.provider.ts        # OpenAI implementation
│       └── claude.provider.ts        # Anthropic Claude implementation
│
└── utils/
    ├── crypto.ts               # AES-GCM encryption for API keys
    └── migration.ts            # Data migration utilities
```

## Common Patterns

### Adding a New Component Type

1. Add enum value in `types.ts` (ComponentType)
2. Add definition in `constants.tsx` (COMPONENT_SPECS)
3. Include icon, label, description, and optional subtypes
4. If rendering requires special logic, update `Canvas.tsx` rendering

### Modifying AI Behavior

All AI prompts use structured JSON schemas with Gemini:
- `challengeSchema` - Structure for generated challenges
- `evaluationSchema` - Structure for design evaluations
- `hintSchema` - Structure for hints

Modify system instructions in the respective functions to tune AI behavior.

### Canvas Interactions

Canvas handles multiple interaction modes simultaneously:
- Dragging components (when `draggedComponent` state is set)
- Panning (when `isPanning` and middle mouse or space+drag)
- Connecting (when `connectingSourceId` is set)
- Resizing (when `resizing` state is set for Layer/Annotation components)
- Drawing (when `currentDrawingId` is set for freehand pen tool)

Use appropriate mouse event handlers and state flags to add new interactions.

## Important Technical Notes

### Color Customization
- Components have a `color` property (hex string)
- Default color: `#1e3a8a` (Navy)
- Color can be set during drag from sidebar or via color picker
- Color picker in BottomToolbar applies to currently selected component

### Preventing Empty Operations
- `handleClearBoard()` checks if there's content before clearing (prevents empty undo states)
- Similar pattern should be followed for other destructive operations

### Component Selection & Deletion
- Delete/Backspace deletes selected component and associated connections
- Deletion is prevented when typing in input/textarea elements
- Always call `onSnapshot()` before deletion for undo

### Freehand Drawing
- Uses SVG `<path>` with points array
- Points are in world coordinates
- Path is computed dynamically from points during render

## Testing Notes

This project does not currently have automated tests. When testing manually:
- Test with and without user API key configured
- Test all three providers (Gemini, OpenAI, Claude) if possible
- Verify API key encryption works (check localStorage for encrypted values)
- Verify undo/redo after each operation type
- Test pan/zoom at different scales
- Verify component config dialog for components with subtypes
- Test AI Tutor chat functionality
