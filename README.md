# Marshapp - AI Music Generation Platform

An AI-powered music generation web platform that enables users to upload songs or instrumentals and generate similar beats using artificial intelligence.

## Features

- 🎵 Upload audio files (MP3/WAV) up to 50MB
- 🤖 AI-powered beat generation using advanced models
- 🎛️ Natural language refinement of generated beats
- 📊 Audio analysis with tempo, key, and genre detection
- 🎨 Waveform visualization and audio playback
- 👤 User authentication and content management
- 📱 Responsive design for desktop and mobile

## Tech Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **TailwindCSS** - Utility-first CSS framework
- **Zustand** - State management
- **WaveSurfer.js** - Audio waveform visualization
- **Framer Motion** - Animations

### Backend

- **NestJS** - Node.js framework
- **PostgreSQL** - Primary database
- **Redis** - Job queue and caching
- **TypeORM** - Database ORM
- **BullMQ** - Job queue management
- **JWT** - Authentication

### AI Services

- **MusicGen** - Beat generation
- **OpenAI API** - Natural language processing
- **Demucs** - Stem separation

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd marshapp
   ```

2. **Install dependencies**

   ```bash
   npm run setup
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start services with Docker**

   ```bash
   docker-compose up -d postgres redis
   ```

5. **Set up database**

   ```bash
   # Connect to PostgreSQL and run the schema
   psql -h localhost -U marshapp_user -d marshapp -f database/schema.sql
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Development

### Project Structure

```
marshapp/
├── frontend/          # Next.js frontend application
├── backend/           # NestJS backend API
├── database/          # Database schemas and migrations
├── .github/           # GitHub Actions workflows
└── docker-compose.yml # Development services
```

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only

# Building
npm run build            # Build both applications
npm run build:frontend   # Build frontend
npm run build:backend    # Build backend

# Testing
npm run test             # Run all tests
npm run test:frontend    # Run frontend tests
npm run test:backend     # Run backend tests

# Linting
npm run lint             # Lint all code
npm run format           # Format code with Prettier
```

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL=postgresql://marshapp_user:marshapp_password@localhost:5432/marshapp

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=your-nextauth-secret

# AI Services
OPENAI_API_KEY=your-openai-key
HUGGINGFACE_API_KEY=your-huggingface-key
REPLICATE_API_TOKEN=your-replicate-token

# File Storage
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

## API Documentation

The backend API provides the following endpoints:

- `POST /uploads` - Upload audio files
- `GET /uploads/:id/analysis` - Get audio analysis
- `POST /generations` - Generate beats
- `GET /generations/:id/status` - Check generation status
- `POST /generations/:id/refine` - Refine beats with prompts
- `GET /audio/:id/stream` - Stream audio
- `GET /audio/:id/download` - Download audio

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:frontend -- --coverage
npm run test:backend -- --coverage

# Run in watch mode
npm run test:frontend -- --watch
npm run test:backend -- --watch
```

### Test Structure

- **Frontend**: React Testing Library + Jest
- **Backend**: Jest + Supertest for API testing
- **E2E**: Playwright (to be added)

## Deployment

### Production Build

```bash
npm run build
```

### Docker Deployment

```bash
docker-compose up --build
```

### Environment Setup

1. Set up PostgreSQL and Redis instances
2. Configure environment variables for production
3. Set up AI service API keys
4. Configure file storage (Supabase)
5. Deploy frontend to Vercel
6. Deploy backend to Railway/Heroku

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run linting and tests
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue on GitHub.
