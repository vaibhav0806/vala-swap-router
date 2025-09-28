# VALA Swap Router

A high-performance NestJS backend for DEX aggregation on Solana, providing optimal swap routes by comparing Jupiter and OKX DEX quotes with advanced caching, resilience, and monitoring.

## 🚀 Features

### Core Functionality
- **Multi-DEX Integration**: Jupiter and OKX DEX adapters with unified interface
- **Intelligent Route Engine**: Advanced scoring algorithm considering output, fees, gas, latency, and reliability
- **Real-time Quote Comparison**: Parallel quote fetching with sub-350ms p95 latency targets
- **Transaction Simulation**: Risk-free transaction testing before execution

### Performance & Reliability
- **Redis Caching**: Intelligent caching with request coalescing for optimal performance
- **Circuit Breakers**: Automatic failover and retry mechanisms
- **Rate Limiting**: Configurable rate limits with burst protection
- **Health Monitoring**: Comprehensive health checks for all services

### Observability
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Prometheus Metrics**: Latency, error rates, cache hit ratios, and business metrics
- **Request Tracing**: End-to-end request tracking with performance breakdown

### Security
- **Input Validation**: Comprehensive validation with bigint math safety
- **Rate Limiting**: Per-user and global rate limits
- **Secure Headers**: Helmet.js security middleware
- **Environment Isolation**: Secure configuration management

## 📋 Requirements

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (for containerized deployment)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vala-swap-router
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file from template
   cp .env.example .env
   # Edit .env with your configuration
   ```

   **Example .env file:**
   ```bash
   # Core Application
   NODE_ENV=development
   PORT=3000
   API_VERSION=v1
   LOG_LEVEL=info

   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=password
   DB_DATABASE=vala_swap

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_URL=redis://localhost:6379
   CACHE_TTL=30000

   # DEX Configuration
   JUPITER_API_URL=https://quote-api.jup.ag/v6
   OKX_API_URL=https://web3.okx.com/api/v6/dex/aggregator
   OKX_API_KEY=your_okx_api_key
   OKX_SECRET_KEY=your_okx_secret_key
   OKX_PASSPHRASE=your_okx_passphrase

   # Rate Limiting & Circuit Breaker
   RATE_LIMIT_MAX=100
   RATE_LIMIT_TTL=60000
   CIRCUIT_BREAKER_THRESHOLD=5
   CIRCUIT_BREAKER_TIMEOUT=60000

   # Security
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   API_KEY=optional_api_key

   # Monitoring
   METRICS_PORT=9090
   ```

4. **Start services with Docker**
   ```bash
   # Development environment with all services
   npm run docker:dev
   
   # Or start individual services
   docker-compose -f docker-compose.dev.yml up postgres redis -d
   
   # Production environment
   npm run docker:prod
   ```

5. **Run database migrations**
   ```bash
   npm run migration:run
   ```

6. **Start the application**
   ```bash
   # Development with hot reload
   npm run start:dev
   
   # Debug mode
   npm run start:debug
   
   # Production mode
   npm run start:prod
   ```

### Production Deployment

```bash
# Build and start production environment
npm run docker:prod
```

## 🔧 Configuration

### Environment Variables

#### Core Application
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Application port | `3000` | No |
| `API_VERSION` | API version prefix | `v1` | No |
| `REQUEST_TIMEOUT` | Request timeout in ms | `5000` | No |
| `LOG_LEVEL` | Logging level | `info` | No |

#### Database Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | No |
| `DB_PORT` | PostgreSQL port | `5432` | No |
| `DB_USERNAME` | PostgreSQL username | `postgres` | No |
| `DB_PASSWORD` | PostgreSQL password | `password` | No |
| `DB_DATABASE` | PostgreSQL database name | `vala_swap` | No |

#### Redis Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_HOST` | Redis host | `localhost` | No |
| `REDIS_PORT` | Redis port | `6379` | No |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | No |
| `CACHE_TTL` | Cache TTL in milliseconds | `30000` | No |

#### DEX Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JUPITER_API_URL` | Jupiter API endpoint | `https://quote-api.jup.ag/v6` | No |
| `OKX_API_URL` | OKX DEX API endpoint | `https://web3.okx.com/api/v6/dex/aggregator` | No |
| `OKX_API_KEY` | OKX API access key | - | Yes (for OKX) |
| `OKX_SECRET_KEY` | OKX API secret key | - | Yes (for OKX) |
| `OKX_PASSPHRASE` | OKX API passphrase | - | Yes (for OKX) |

#### Rate Limiting & Circuit Breaker
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RATE_LIMIT_MAX` | Max requests per window | `100` | No |
| `RATE_LIMIT_TTL` | Rate limit window in ms | `60000` | No |
| `CIRCUIT_BREAKER_THRESHOLD` | Circuit breaker failure threshold | `5` | No |
| `CIRCUIT_BREAKER_TIMEOUT` | Circuit breaker timeout in ms | `60000` | No |

#### Security & Monitoring
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | `default-secret-change-this` | Yes (production) |
| `API_KEY` | API authentication key | - | No |
| `METRICS_PORT` | Metrics server port | `9090` | No |

### Performance Tuning

The route engine uses configurable weights for route scoring:

```typescript
performanceWeights: {
  outputAmount: 0.4,    // 40% weight on output amount
  fees: 0.25,           // 25% weight on fees
  gasEstimate: 0.15,    // 15% weight on gas costs
  latency: 0.15,        // 15% weight on response time
  reliability: 0.05,    // 5% weight on provider reliability
}
```

### Route Configuration
- **Route Expiration**: 30 seconds (configurable)
- **Default Slippage**: 0.5% (50 basis points)
- **Request Timeout**: 5 seconds per DEX
- **Circuit Breaker**: 5 failures trigger open state
- **Cache TTL**: 30 seconds for quotes

### DEX Provider Configuration
- **Jupiter**: Primary DEX aggregator with 3s timeout, 2 retries
- **OKX**: Secondary DEX with API key authentication, 3s timeout, 2 retries

## 📚 API Documentation

### Base URL
- Development: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/docs`

### Core Endpoints

#### Health Endpoints
```http
# Simple health check
GET /api/v1/healthz

# Detailed health check with service status
GET /api/v1/healthz/detailed

# Kubernetes liveness probe
GET /api/v1/healthz/live

# Kubernetes readiness probe
GET /api/v1/healthz/ready

# Circuit breaker status
GET /api/v1/healthz/circuit-breakers

# Reset circuit breaker
POST /api/v1/healthz/circuit-breakers/{serviceName}/reset
```

#### Token Endpoints
```http
# Get all tokens with pagination
GET /api/v1/tokens?limit=50&offset=0&search=SOL&isActive=true

# Get popular tokens
GET /api/v1/tokens/popular

# Search tokens by name/symbol
GET /api/v1/tokens/search/{query}

# Get token by contract address
GET /api/v1/tokens/{address}

# Seed default tokens (SOL, USDC, USDT)
POST /api/v1/tokens/seed
```

#### Quote Endpoints
```http
# Get best swap quote
GET /api/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50&userPublicKey={userKey}&favorLowLatency=false&maxRoutes=3

# Simulate quote (dry run)
GET /api/v1/quote/simulate?inputMint={inputMint}&outputMint={outputMint}&amount={amount}&slippageBps={slippage}
```

#### Swap Endpoints
```http
# Execute swap transaction
POST /api/v1/swap/execute
Content-Type: application/json

{
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "userPublicKey": "8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ",
  "wrapAndUnwrapSol": true,
  "useSharedAccounts": true,
  "computeUnitPriceMicroLamports": 1000
}

# Simulate swap transaction
POST /api/v1/swap/simulate
Content-Type: application/json

{
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "userPublicKey": "8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ"
}

# Get swap transaction status
GET /api/v1/swap/{transactionId}

# Get swap statistics
GET /api/v1/swap

# Cancel pending swap
POST /api/v1/swap/{transactionId}/cancel
```

#### Cache & Monitoring Endpoints
```http
# Get cache coalescing statistics
GET /api/v1/cache/coalescing/stats

# Get metrics summary (internal)
GET /api/v1/metrics/summary

# Get cache hit ratios
GET /api/v1/metrics/cache-stats

# Prometheus metrics endpoint
GET /api/v1/metrics/prometheus
```

### Response Examples

#### Quote Response
```json
{
  "bestRoute": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inAmount": "1000000000",
    "outAmount": "145670000",
    "provider": "Jupiter",
    "score": {
      "totalScore": 0.78,
      "outputAmount": 0.85,
      "fees": 0.15,
      "latency": 0.12
    },
    "routeId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-01T00:01:00.000Z"
  },
  "alternatives": [
    {
      "provider": "OKX",
      "inAmount": "1000000000",
      "outAmount": "145500000",
      "score": { "totalScore": 0.75 }
    }
  ],
  "requestId": "req_1704067200000_abc123def",
  "totalResponseTime": 285,
  "cacheHitRatio": 0.0,
  "feeBreakdown": {
    "platformFee": "1000000",
    "gasFee": "5000",
    "totalFee": "1005000",
    "feePercentage": "0.1005"
  }
}
```

#### Health Check Response
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "0.0.1",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 12,
      "lastCheck": "2024-01-01T00:00:00.000Z"
    },
    "cache": {
      "status": "healthy",
      "responseTime": 3,
      "lastCheck": "2024-01-01T00:00:00.000Z"
    },
    "jupiter": {
      "status": "healthy",
      "responseTime": 245,
      "lastCheck": "2024-01-01T00:00:00.000Z"
    },
    "okx": {
      "status": "healthy",
      "responseTime": 189,
      "lastCheck": "2024-01-01T00:00:00.000Z"
    }
  },
  "performance": {
    "memoryUsage": {
      "rss": 123456789,
      "heapTotal": 98765432,
      "heapUsed": 87654321
    },
    "cpuUsage": {
      "user": 123456,
      "system": 78910
    }
  }
}
```

#### Error Response
```json
{
  "statusCode": 400,
  "errorCode": "INVALID_INPUT",
  "message": "Invalid input mint address",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/quote",
  "requestId": "req_1704067200000_abc123def"
}
```

## 📜 Available Scripts

### Development Scripts
```bash
# Start development server with hot reload
npm run start:dev

# Start in debug mode
npm run start:debug

# Build the application
npm run build

# Start production server
npm run start:prod
```

### Testing Scripts
```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run integration/E2E tests
npm run test:e2e

# Run load tests with Artillery
npm run test:load

# Generate test coverage report
npm run test:cov

# Debug tests
npm run test:debug
```

### Database Scripts
```bash
# Generate new migration
npm run migration:generate -- src/database/migrations/MigrationName

# Create empty migration
npm run migration:create -- src/database/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# TypeORM CLI access
npm run typeorm
```

### Docker Scripts
```bash
# Start development environment with Docker
npm run docker:dev

# Start production environment with Docker
npm run docker:prod
```

### Code Quality Scripts
```bash
# Run ESLint
npm run lint

# Format code with Prettier
npm run format
```

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:e2e
```

### Load Testing
```bash
npm run test:load
```

### Test Coverage
```bash
npm run test:cov
```

## 📊 Monitoring

### Metrics Endpoints
- Prometheus metrics: `http://localhost:3000/api/v1/metrics/prometheus`
- Metrics summary: `http://localhost:3000/api/v1/metrics/summary`
- Cache statistics: `http://localhost:3000/api/v1/metrics/cache-stats`
- Health status: `http://localhost:3000/api/v1/healthz/detailed`
- Circuit breakers: `http://localhost:3000/api/v1/healthz/circuit-breakers`
- Cache coalescing: `http://localhost:3000/api/v1/cache/coalescing/stats`
- Prometheus UI: `http://localhost:9091` (when using Docker)

### Key Metrics
- `vala_swap_request_duration_seconds`: Request latency histogram
- `vala_swap_cache_hit_ratio`: Cache hit ratio gauge
- `vala_swap_errors_total`: Error count by type
- `vala_swap_provider_availability`: DEX provider availability

### Logging
Structured logs include:
- Request correlation IDs
- Performance timings
- Error stack traces
- Business metrics

## 🏗️ Architecture

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Rate Limiter  │    │  API Gateway    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  NestJS App     │
                    │  - Health       │
                    │  - Tokens       │
                    │  - Quote        │
                    │  - Swap         │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Route Engine   │
                    │  - Scoring      │
                    │  - Caching      │
                    │  - Coalescing   │
                    └─────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ Jupiter Adapter │ │  OKX Adapter    │ │ Future Adapters │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Database Schema
- **tokens**: Supported token metadata
- **quotes**: Quote history and analytics
- **swap_transactions**: Swap execution tracking

## 🚨 Error Handling

### Error Codes
- `ROUTE_EXPIRED`: Quote/route has expired
- `SLIPPAGE_EXCEEDED`: Transaction exceeds slippage tolerance
- `INSUFFICIENT_LIQUIDITY`: Not enough liquidity for trade size
- `DEX_UNAVAILABLE`: External DEX service unavailable
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded

### Failure Scenarios
The system handles various failure modes:
- DEX API timeouts with exponential backoff
- Database connection failures with retries
- Redis cache unavailability (graceful degradation)
- Network partitions with circuit breakers

## 🔄 Development Workflow

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format

# Type checking
npx tsc --noEmit
```

### Database Migrations
```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 📈 Performance Benchmarks

### Target Metrics
- **p95 Latency**: ≤ 350ms (cache hits ≤ 50ms)
- **Cache Hit Ratio**: ≥ 80%
- **Error Rate**: ≤ 0.1%
- **Availability**: ≥ 99.9%

### Load Test Results
```bash
# Burst test: 100 quotes in 10 seconds
npm run test:load

# Expected results:
# - p95 latency: <350ms
# - Cache hit ratio: >80%
# - Zero errors
```

## 🔐 Security

### Security Measures
- Input validation with class-validator
- BigInt math for precision-sensitive calculations
- Rate limiting per user and endpoint
- Secure headers with Helmet.js
- Environment variable validation
- SQL injection prevention with TypeORM

### Security Checklist
- [ ] All user inputs validated
- [ ] Rate limits configured
- [ ] Secrets properly managed
- [ ] Error messages don't leak sensitive data
- [ ] HTTPS enforced in production
- [ ] Database connections encrypted

## 🚀 Deployment

### Docker Production Build
```bash
# Build optimized image
docker build -t vala-swap-router .

# Run with production environment
docker-compose up -d
```

### Kubernetes Deployment
```yaml
# Example deployment configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vala-swap-router
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vala-swap-router
  template:
    metadata:
      labels:
        app: vala-swap-router
    spec:
      containers:
      - name: app
        image: vala-swap-router:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        readinessProbe:
          httpGet:
            path: /api/v1/healthz/ready
            port: 3000
        livenessProbe:
          httpGet:
            path: /api/v1/healthz/live
            port: 3000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Standards
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Ensure CI/CD passes

## 📄 License

This project is proprietary software for VALA.

## 🆘 Support

For technical support or questions:
- Create an issue in the repository
- Check the API documentation at `/api/docs`
- Review logs for debugging information

## 🎯 Acceptance Scenarios

### ✅ SOL → USDC Trade (slippageBps=50)
- Shows best route with fee breakdown
- Displays alternatives sorted by score
- Demonstrates caching behavior

### ✅ BONK → SOL (favorLowLatency=true)
- Tests low-latency vs high-output tradeoff
- Validates policy-based route selection
- Measures performance impact

### ✅ Route Expiration Handling
- Route expires mid-execution returns `ROUTE_EXPIRED`
- Proper error handling and user messaging
- Graceful degradation

### ✅ Burst Performance Test
- 100 quotes in 10s for same pair
- Demonstrates caching effectiveness
- Achieves p95 < 350ms performance target