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
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start services with Docker**
   ```bash
   # Development environment
   npm run docker:dev
   
   # Or start individual services
   docker-compose -f docker-compose.dev.yml up postgres redis -d
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
   ```

### Production Deployment

```bash
# Build and start production environment
npm run docker:prod
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JUPITER_API_URL` | Jupiter API endpoint | `https://quote-api.jup.ag/v6` |
| `OKX_API_URL` | OKX DEX API endpoint | `https://www.okx.com/api/v5/dex/aggregator` |
| `OKX_PROJECT_ID` | OKX project ID | - |
| `CACHE_TTL` | Cache TTL in milliseconds | `30000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `RATE_LIMIT_TTL` | Rate limit window in ms | `60000` |

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

## 📚 API Documentation

### Base URL
- Development: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/docs`

### Core Endpoints

#### Health Check
```http
GET /healthz
```

#### Get Tokens
```http
GET /tokens?search=SOL&limit=50&offset=0
```

#### Get Quote
```http
GET /quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50
```

#### Execute Swap
```http
POST /swap/execute
Content-Type: application/json

{
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "userPublicKey": "8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ",
  "wrapAndUnwrapSol": true,
  "useSharedAccounts": true
}
```

#### Simulate Swap
```http
POST /swap/simulate
Content-Type: application/json

{
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "userPublicKey": "8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ"
}
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
    }
  },
  "alternatives": [...],
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
- Application metrics: `http://localhost:3000/metrics`
- Health status: `http://localhost:3000/api/v1/healthz/detailed`
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