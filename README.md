<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ArchitectAI - System Design Studio

An interactive visual design tool for system design interview preparation, powered by Google Gemini AI.

View your app in AI Studio: https://ai.studio/apps/drive/1iYpyjJWfwrknbXcqSIgjbMtv7mnAzvX1

## Features

### Visual Design Canvas
- **Drag-and-drop interface** with 16 architectural layers (Clients, Traffic Management, Compute, Storage, Caching, Messaging, CDN, Security, Observability, and more)
- **300+ component subtypes** with specific tool recommendations (e.g., PostgreSQL, Redis, Kafka, Kubernetes)
- **Pan and zoom** for large-scale diagrams
- **Multiple drawing tools**: Arrows, lines, annotations, text labels, and freehand drawing
- **Undo/redo** with 30-state history
- **Color customization** for visual grouping

### AI-Powered Learning
- **Challenge Generation**: AI creates realistic system design interview questions with requirements, constraints, and **cost considerations**
- **Design Evaluation**: Get scored feedback (0-100) with pros, cons, recommendations, security concerns, and **cost efficiency analysis**
- **Smart Hints**: Receive starter suggestions and architecture strategies when stuck, including **cost optimization opportunities**
- **AI Tutor**: Real-time chat assistant that understands your challenge and available components

### Component Architecture
- **16-Layer System Classification**: From client entry to governance & compliance
- **Hierarchical Selection**: Choose layer → subtype → specific tool (e.g., Storage → Document DB → MongoDB)
- **Cost Indicators**: Components include cost awareness (low/medium/high/variable) to help with budget-conscious design decisions
- **Flow Components**: Start/End, Process, Decision, Loop, Timer, Event for logic flows
- **Annotations**: Text, rectangles, circles, and freehand drawing for documentation

## Quick Start

### Prerequisites
- **Node.js** (v16 or higher)
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Interview_Design
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**

   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm run preview
```

## Docker Deployment

### Prerequisites
- **Docker** and **Docker Compose** installed
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/apikey))

### Production Deployment

1. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

   **Security Note**: The API key is injected at runtime, NOT baked into the Docker image. This means:
   - The Docker image contains NO secrets and is safe to share
   - You can use the same image across environments with different API keys
   - Keys can be rotated without rebuilding the image

2. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   The application will be available at **http://localhost:2350**

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the application**
   ```bash
   docker-compose down
   ```

For detailed deployment instructions and troubleshooting, see [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

### Development with Docker

For development with hot reload:

```bash
docker-compose -f docker-dev.yml up
```

Access at **http://localhost:2351**

### Manual Docker Build

```bash
# Build the image
docker build -t architectai:latest .

# Run the container
docker run -d \
  -p 2350:2350 \
  -e GEMINI_API_KEY=your_key_here \
  --name architectai \
  architectai:latest
```

## How to Use

1. **Generate a Challenge**: Click "New Challenge" to get an AI-generated system design problem
2. **Design Your Solution**: Drag components from the sidebar onto the canvas
3. **Connect Components**: Use arrow/line tools to show data flow and relationships
4. **Get Feedback**: Click "Evaluate" to receive AI-powered critique and scoring
5. **Ask for Help**: Use "Get Hints" or open the AI Tutor for guidance

### Keyboard Shortcuts
- `Delete` or `Backspace` - Delete selected component
- `Scroll` or `Trackpad` - Pan canvas
- `Ctrl/Cmd + Scroll` - Zoom in/out

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling (via inline classes)
- **Lucide React** for icons
- **Google Gemini AI** for challenge generation, evaluation, and tutoring
- **SVG** for vector graphics and freehand drawing

## Project Structure

```
/
├── App.tsx                 # Main application & state management
├── components/             # React components
│   ├── Canvas.tsx          # Drawing canvas with pan/zoom
│   ├── Sidebar.tsx         # Component library
│   ├── TopBar.tsx          # Challenge controls
│   ├── BottomToolbar.tsx   # Drawing tools
│   ├── AITutor.tsx         # Chat interface
│   └── ...
├── services/
│   └── gemini.ts           # AI integration
├── types.ts                # TypeScript definitions
├── constants.tsx           # 16-layer component specs
└── vite.config.ts          # Vite configuration
```

## AI Tutor Setup

The AI Tutor requires a separate Gemini API key for privacy:

1. Click the AI Tutor icon (bottom right)
2. Click the settings gear icon
3. Enter your personal Gemini API key
4. Start chatting for real-time guidance

Your key is stored locally in your browser and never sent to any server except Google's Gemini API.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Detailed architecture and development guidelines
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment guide with verification
- **[SECURITY.md](./SECURITY.md)** - Security architecture and API key management

## Security

API keys are managed securely:
- **Local Development**: Keys loaded from `.env.local` at build time
- **Docker Production**: Keys injected at runtime via `docker-entrypoint.sh`
- **No secrets in images**: Docker images are safe to share publicly

See [SECURITY.md](./SECURITY.md) for complete security documentation.

## License

This project was created for educational purposes.
