# Marshapp - AI Music Generation Platform

[![GitHub](https://img.shields.io/github/license/shaqdeff/marshapp)](https://github.com/shaqdeff/marshapp)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red.svg)](https://nestjs.com/)

An AI-powered music generation web platform that enables users to upload songs or instrumentals and generate similar beats using artificial intelligence. Features real-time audio analysis, tempo detection, and intelligent beat generation with natural language refinement capabilities.

## 🚀 Features

- 🎵 **Audio Upload**: Support for MP3, WAV, and M4A files up to 50MB
- 🔍 **Audio Analysis**: Real-time tempo, key, genre, and mood detection using Spotify Web API and Node.js audio processing
- 🤖 **AI Beat Generation**: Powered by advanced AI models with natural language refinement
- 🎨 **Waveform Visualization**: Interactive audio playback with WaveSurfer.js
- 👤 **User Authentication**: Secure JWT-based authentication with NextAuth
- 📱 **Responsive Design**: Optimized for desktop and mobile devices
- ⚡ **Real-time Processing**: Asynchronous job processing with Bull queues

## 🛠️ Tech Stack

### Frontend

- **Next.js 15** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe JavaScript development
- **TailwindCSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **WaveSurfer.js** - Audio waveform visualization
- **Framer Motion** - Smooth animations and transitions
- **NextAuth** - Authentication for Next.js

### Backend

- **NestJS 11** - Progressive Node.js framework
- **PostgreSQL 15** - Relational database
- **Redis 7** - In-memory data store for caching and job queues
- **TypeORM** - Object-relational mapping
- **Bull/BullMQ** - Job queue management
- **JWT** - JSON Web Token authentication
- **Multer** - File upload handling

### AI & Audio Processing

- **Spotify Web API** - Audio features and track information
- **music-metadata** - Audio file metadata extraction
- **music-tempo** - BPM detection
- **@tonaljs/tonal** - Music theory and key detection
- **FFmpeg** - Audio processing and format conversion

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js 18+** and **npm** - [Download here](https://nodejs.org/)
- **PostgreSQL 15+** - [Installation guide](https://www.postgresql.org/download/)
- **Redis 7+** - [Installation guide](https://redis.io/download/)
- **Docker & Docker Compose** (optional but recommended) - [Install Docker](https://docs.docker.com/get-docker/)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/shaqdeff/marshapp.git
cd marshapp
```

### 2. Install Dependencies

```bash
# Install root dependencies and setup workspaces
npm run setup
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Edit the `.env` file with your configuration:

```bash
# Database Configuration
DATABASE_URL=postgresql://marshapp_user:marshapp_password@localhost:5432/marshapp
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=marshapp_user
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=marshapp

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=30d

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-change-this-in-production

# Supabase Configuration (for file storage)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Spotify API (for audio analysis)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret

# AI Service Configuration (optional)
OPENAI_API_KEY=your-openai-api-key
HUGGINGFACE_API_KEY=your-huggingface-api-key
REPLICATE_API_TOKEN=your-replicate-api-token
```

### 4. Start Services

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Wait for services to be healthy
docker compose ps
```

#### Option B: Local Installation

If you prefer to run PostgreSQL and Redis locally:

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Start Redis (macOS with Homebrew)
brew services start redis

# Or use your system's service manager
```

### 5. Database Setup

The database schema will be automatically initialized when using Docker. For manual setup:

```bash
# Connect to PostgreSQL and run the schema
psql -h localhost -U marshapp_user -d marshapp -f database/schema.sql
psql -h localhost -U marshapp_user -d marshapp -f database/permissions.sql
```

### 6. Start Development Servers

```bash
# Start both frontend and backend concurrently
npm run dev
```

This will start:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8800

## 🏗️ Development

### Project Structure

```
marshapp/
├── frontend/              # Next.js frontend application
│   ├── src/
│   │   ├── app/          # App Router pages and layouts
│   │   ├── components/   # Reusable React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions and API clients
│   │   └── store/        # Zustand state management
│   ├── public/           # Static assets
│   └── package.json
├── backend/               # NestJS backend API
│   ├── src/
│   │   ├── analysis/     # Audio analysis module
│   │   ├── auth/         # Authentication module
│   │   ├── entities/     # TypeORM database entities
│   │   └── main.ts       # Application entry point
│   └── package.json
├── database/              # Database schemas and SQL files
│   ├── schema.sql        # Main database schema
│   └── permissions.sql   # User permissions setup
├── docker-compose.yml     # Development services
└── package.json          # Root workspace configuration
```

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend concurrently
npm run dev:frontend     # Start frontend only (localhost:3000)
npm run dev:backend      # Start backend only (localhost:8800)

# Building
npm run build            # Build both applications for production
npm run build:frontend   # Build frontend with Turbopack
npm run build:backend    # Build backend with Nest CLI

# Testing
npm run test             # Run all tests across workspaces
npm run test:frontend    # Run frontend tests with Jest
npm run test:backend     # Run backend tests with Jest

# Linting & Formatting
npm run lint             # Lint all code with ESLint
npm run lint:frontend    # Lint frontend code only
npm run lint:backend     # Lint backend code only
npm run format           # Format code with Prettier

# Setup & Installation
npm run setup            # Install all dependencies for workspaces
npm run setup:frontend   # Install frontend dependencies only
npm run setup:backend    # Install backend dependencies only
```

### Individual Workspace Scripts

**Frontend** (`cd frontend && npm run <script>`):

```bash
npm run dev          # Start with Turbopack (faster builds)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run test         # Jest tests
npm run test:watch   # Jest in watch mode
```

**Backend** (`cd backend && npm run <script>`):

```bash
npm run start:dev    # Development with hot reload
npm run start:debug  # Debug mode with inspector
npm run start:prod   # Production mode
npm run build        # Compile TypeScript
npm run test         # Jest tests
npm run test:watch   # Jest in watch mode
npm run test:cov     # Test coverage report
npm run test:e2e     # End-to-end tests
```

## 🔧 Configuration Guide

### Required API Keys

1. **Spotify API** (for audio analysis):
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app and get Client ID and Client Secret
   - Add to `.env`: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`

2. **Supabase** (for file storage):
   - Create account at [Supabase](https://supabase.com)
   - Create a new project and get URL and keys
   - Add to `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

3. **AI Services** (optional for advanced features):
   - OpenAI API key from [OpenAI Platform](https://platform.openai.com)
   - Hugging Face API key from [Hugging Face](https://huggingface.co/settings/tokens)
   - Replicate API token from [Replicate](https://replicate.com/account/api-tokens)

### Port Configuration

- **Frontend**: `3000` (Next.js default)
- **Backend**: `8800` (configured in backend/src/main.ts)
- **PostgreSQL**: `5432`
- **Redis**: `6379`

### Common Issues & Solutions

#### Port Already in Use

```bash
# Kill process on port 3000 (frontend)
npx kill-port 3000

# Kill process on port 8800 (backend)
npx kill-port 8800

# Or find and kill manually
lsof -ti:3000 | xargs kill -9
lsof -ti:8800 | xargs kill -9
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Reset database (with Docker)
docker compose down postgres
docker compose up -d postgres

# Manual database reset
dropdb marshapp && createdb marshapp
psql -d marshapp -f database/schema.sql
```

#### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Restart Redis (with Docker)
docker compose restart redis
```

## 📡 API Documentation

The backend API provides RESTful endpoints for audio processing and analysis:

### Upload Endpoints

- `POST /uploads` - Upload audio files (MP3, WAV, M4A)
- `GET /uploads/:id` - Get upload details
- `GET /uploads/:id/analysis` - Get audio analysis results

### Analysis Endpoints

- `POST /analysis/:uploadId` - Trigger audio analysis
- `GET /analysis/:uploadId` - Get analysis status and results
- `POST /analysis/:uploadId/retry` - Retry failed analysis

### Audio Processing

- `GET /audio/:id/stream` - Stream audio with range support
- `GET /audio/:id/download` - Download processed audio
- `GET /audio/:id/waveform` - Get waveform data for visualization

### Authentication

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile (JWT required)

**Base URL**: `http://localhost:8800` (development)

**Authentication**: Include JWT token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests across workspaces
npm test

# Frontend tests with coverage
cd frontend && npm run test
cd frontend && npm run test -- --coverage

# Backend tests with coverage
cd backend && npm run test
cd backend && npm run test:cov

# Watch mode for development
cd frontend && npm run test:watch
cd backend && npm run test:watch

# End-to-end tests (backend)
cd backend && npm run test:e2e
```

### Test Structure

- **Frontend**: Jest + React Testing Library + Testing Library User Event
- **Backend**: Jest + Supertest for API testing
- **Database**: In-memory SQLite for testing
- **E2E**: Supertest for full API integration tests

### Writing Tests

**Frontend Component Test Example**:

```typescript
import { render, screen } from '@testing-library/react'
import { LoginForm } from './LoginForm'

test('renders login form', () => {
  render(<LoginForm />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
})
```

**Backend API Test Example**:

```typescript
import request from 'supertest';
import { app } from '../src/main';

describe('/uploads', () => {
  it('should upload file', async () => {
    await request(app).post('/uploads').attach('audio', 'test/fixtures/sample.mp3').expect(201);
  });
});
```

## 🚀 Deployment

### Production Build

```bash
# Build both applications
npm run build

# Test production builds locally
cd frontend && npm run start  # http://localhost:3000
cd backend && npm run start:prod  # http://localhost:8800
```

### Docker Deployment

```bash
# Build and start all services
docker compose up --build

# Production deployment
docker compose -f docker-compose.prod.yml up -d
```

### Environment Setup for Production

1. **Database**: Set up managed PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
2. **Redis**: Set up managed Redis (AWS ElastiCache, Redis Cloud, etc.)
3. **File Storage**: Configure Supabase Storage buckets
4. **Environment Variables**: Set all production secrets
5. **Domain & SSL**: Configure domains and SSL certificates

### Deployment Platforms

**Frontend (Vercel)**:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd frontend && vercel --prod
```

**Backend (Railway/Render/Heroku)**:

```bash
# Example for Railway
railway login
railway init
railway up
```

**Full-Stack (Docker + VPS)**:

```bash
# On your server
git clone https://github.com/shaqdeff/marshapp.git
cd marshapp
cp .env.example .env
# Edit .env for production
docker compose -f docker-compose.prod.yml up -d
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**

   ```bash
   gh repo fork shaqdeff/marshapp
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

4. **Run tests and linting**

   ```bash
   npm run lint
   npm test
   ```

5. **Commit your changes**

   ```bash
   git commit -m "feat: add amazing feature"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   # Create PR on GitHub
   ```

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing folder structure
- Write tests for new features
- Use conventional commit messages
- Keep PRs focused and atomic

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

### Common Issues

1. **Module not found errors**: Run `npm run setup` to reinstall dependencies
2. **Database connection failed**: Check PostgreSQL is running and credentials are correct
3. **Redis connection failed**: Ensure Redis is running on port 6379
4. **Port already in use**: Use `npx kill-port <port-number>` to free up ports
5. **Build failures**: Clear `node_modules` and reinstall: `rm -rf node_modules && npm run setup`

### Getting Help

- 📖 Check the [documentation](https://github.com/shaqdeff/marshapp/wiki) (coming soon)
- 🐛 Report bugs via [GitHub Issues](https://github.com/shaqdeff/marshapp/issues)
- 💬 Join discussions in [GitHub Discussions](https://github.com/shaqdeff/marshapp/discussions)
- 📧 Contact: [shaquillendunda@gmail.com](mailto:your-email@domain.com)

### Performance Tips

- Use Turbopack for faster frontend builds (`npm run dev` already configured)
- Enable Redis caching for production
- Optimize audio file sizes before upload
- Use CDN for static assets in production

---

Made with ❤️ by [Shaquille Ndunda](https://github.com/shaqdeff)
