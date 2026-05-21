# PHASE 5: Production Deployment & Launch

**Timeline**: 2-3 hours  
**Status**: ✅ Ready for Implementation  
**Goal**: Deploy to production with monitoring, CI/CD, and operational dashboards  

---

## 📋 Pre-Deployment Checklist

### Code & Tests
- [ ] All tests passing: `npm test` (51+ tests)
- [ ] No ESLint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Code coverage > 80%: `npm run test:coverage`

### Backend
- [ ] Environment variables in `.env.production`
- [ ] Database migrations tested on staging
- [ ] SEFAZ API credentials configured
- [ ] Redis connection validated
- [ ] Secrets not committed to git

### Frontend
- [ ] `npm run build` succeeds (Vite production build)
- [ ] No console errors in production build
- [ ] Environment API URL points to production backend
- [ ] Build artifact < 500KB (gzipped)

---

## 🚀 1. Backend Deployment (Heroku/Railway)

### Option A: Heroku

**Prerequisites**:
```bash
# 1. Install Heroku CLI
# macOS: brew tap heroku/brew && brew install heroku
# Ubuntu: curl https://cli-assets.heroku.com/install-ubuntu.sh | sh

# 2. Login
heroku login

# 3. Create app
heroku create validador-sefaz-prod
heroku addons:create heroku-postgresql:standard-0 --app validador-sefaz-prod
heroku addons:create heroku-redis:premium-0 --app validador-sefaz-prod
```

**Deployment**:
```bash
# 1. Add Heroku remote
heroku git:remote -a validador-sefaz-prod

# 2. Set environment variables
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET=$(openssl rand -base64 32) \
  DB_HOST=$(heroku config:get DATABASE_URL | cut -d'@' -f2 | cut -d':' -f1) \
  REDIS_URL=$(heroku config:get REDIS_URL) \
  SEFAZ_API_URL=https://sefaz.sefazrs.example.com/api \
  LOG_LEVEL=info \
  --app validador-sefaz-prod

# 3. Deploy
git push heroku main

# 4. Monitor
heroku logs -t --app validador-sefaz-prod
heroku open --app validador-sefaz-prod
```

**Dockerfile** (already created in Phase 1):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

---

### Option B: Railway.app

**Prerequisites**:
```bash
# 1. Create account: https://railway.app
# 2. Install Railway CLI
npm i -g @railway/cli

# 3. Login
railway login
```

**Deployment**:
```bash
# 1. Initialize Railway project
railway init

# 2. Add PostgreSQL plugin
railway add

# 3. Add Redis plugin
railway add

# 4. Set environment
railway variables

# 5. Deploy
railway up

# 6. Get deployment URL
railway logs
```

---

## 🎨 2. Frontend Deployment (Vercel)

**Prerequisites**:
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Link project (if first time)
cd frontend
vercel --prod
```

**Configuration** (`frontend/vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://api.validador-sefaz.com/api/$1"
    }
  ],
  "env": {
    "VITE_API_URL": "https://api.validador-sefaz.com"
  }
}
```

**Deployment**:
```bash
# Option 1: From Vercel Dashboard
# 1. Connect GitHub repo
# 2. Import project
# 3. Configure Build Settings:
#    - Framework: Vite
#    - Build Command: npm run build
#    - Output Directory: dist
# 4. Add Environment Variable:
#    - VITE_API_URL = https://api.validador-sefaz.com

# Option 2: CLI
cd frontend
vercel --prod \
  --env VITE_API_URL=https://api.validador-sefaz.com
```

**Auto-Deployment** (GitHub Integration):
```bash
# Configure in Vercel Dashboard:
# 1. Project Settings → Git
# 2. Auto-deploy: main branch
# 3. Preview deployments: all branches
```

---

## 💾 3. Database Setup (Supabase)

**Create Supabase Project**:
```bash
# 1. Visit https://app.supabase.com
# 2. Create new project
# 3. Choose region closest to your users
# 4. Wait for provisioning (2-5 minutes)
```

**Initialize Database**:
```bash
# 1. Copy connection string from Supabase dashboard
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# 2. Run migrations
npx typeorm migration:run -d src/dataSource.ts

# 3. Seed production data
npm run db:seed

# 4. Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM usuarios;"
```

**Backup Strategy**:
```bash
# Daily automated backups via Supabase dashboard
# Manual backup:
pg_dump $DATABASE_URL > backup-$(date +%Y-%m-%d).sql

# Restore from backup:
psql $DATABASE_URL < backup-2024-05-21.sql
```

---

## 📊 4. Monitoring & Observability

### Sentry Error Tracking

**Setup**:
```bash
# 1. Create account: https://sentry.io
# 2. Create project (select Node.js)
# 3. Copy DSN from project settings
```

**Integration** (`src/index.ts`):
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

// Attach error middleware
app.use(Sentry.Handlers.errorHandler());
```

**Configure Alerts**:
```bash
# Sentry Dashboard:
# Alerts → New Alert Rule
# Condition: Error Rate > 5% in 10 minutes
# Action: Send to Slack/PagerDuty
```

### CloudWatch Logs

**For Heroku/AWS**:
```typescript
// Winston transports to CloudWatch
import WinstonCloudWatch from 'winston-cloudwatch';

logger.add(
  new WinstonCloudWatch({
    logGroupName: '/validador-sefaz/production',
    logStreamName: new Date().toISOString().split('T')[0],
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: 'us-east-1',
  })
);
```

### Health Dashboard

**Endpoint** (`GET /api/health`):
```json
{
  "status": "ok",
  "uptime": 86400000,
  "version": "1.0.0",
  "database": { "connected": true, "latency": 5 },
  "cache": { "connected": true, "keys": 1234 },
  "sefaz": { "state": "CLOSED", "lastFailure": null }
}
```

---

## 🔐 5. Security Hardening

### Environment Variables Template

**`.env.production`**:
```
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

# Database (from Supabase)
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# JWT
JWT_SECRET=<random 32-byte key>
JWT_EXPIRY=86400

# SEFAZ API
SEFAZ_API_URL=https://sefaz.sefazrs.example.com/api
SEFAZ_API_KEY=<from SEFAZ>

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# CORS
CORS_ORIGIN=https://app.validador-sefaz.com
```

### Production Headers

**Helmet Configuration** (`src/index.ts`):
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Rate Limiting

**Production-Strength**:
```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per IP
  keyGenerator: (req) => req.user?.id || req.ip, // Per-user limits
  handler: (req, res) => res.status(429).json({
    status: 'error',
    message: 'Too many requests. Please try again later.',
  }),
});
```

---

## 🚀 6. CI/CD Pipeline (GitHub Actions)

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install --legacy-peer-deps
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: validador-sefaz-prod
          heroku_email: ${{secrets.HEROKU_EMAIL}}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - run: npm install --legacy-peer-deps
      - run: npm run build --prefix frontend
      - uses: vercel/action@main
        with:
          vercel-token: ${{secrets.VERCEL_TOKEN}}
          vercel-org-id: ${{secrets.VERCEL_ORG_ID}}
          vercel-project-id: ${{secrets.VERCEL_PROJECT_ID}}
```

---

## 📈 7. Performance Validation

### Production Load Test

```bash
# 1. Deploy to staging first
heroku create validador-sefaz-staging
git push staging main

# 2. Run load test on staging
npm run load-test

# 3. Check metrics
# P95 < 500ms? ✅
# Error rate < 1%? ✅
# Memory stable? ✅

# 4. Promote to production
heroku pipelines:promote validador-sefaz

# 5. Monitor first 24 hours
heroku logs -t --app validador-sefaz-prod
```

---

## ✅ 8. Post-Deployment Checklist

### First Hour
- [ ] Frontend loads without errors
- [ ] Login works end-to-end
- [ ] Validation endpoint returns results in < 500ms
- [ ] No JavaScript errors in browser console
- [ ] API health check passing

### First Day
- [ ] Monitor Sentry for errors (target: 0)
- [ ] Check database performance (no slow queries)
- [ ] Verify cache is working (Redis stats show hits)
- [ ] Test SEFAZ API integration
- [ ] Confirm backups are running

### First Week
- [ ] Run load test on production (non-peak hours)
- [ ] Review logs for any warnings
- [ ] Monitor cost (database, storage, bandwidth)
- [ ] Gather user feedback
- [ ] Document any issues

---

## 📊 Expected Production Metrics

```
Frontend:
✅ Page Load Time (FCP): < 2 seconds
✅ First Input Delay (FID): < 100ms
✅ Cumulative Layout Shift (CLS): < 0.1
✅ Lighthouse Score: > 90

Backend:
✅ API Response Time (p95): < 500ms
✅ Cache Hit Rate: 70%+
✅ Error Rate: < 0.5%
✅ Uptime: > 99.9%

Database:
✅ Query Time (p95): < 100ms
✅ Connection Pool Utilization: 20-60%
✅ Backup Status: Daily ✅

Infrastructure:
✅ CPU Usage: 20-40%
✅ Memory Usage: 60-80% reserved
✅ Disk Usage: < 80%
```

---

## 🎯 Launch Readiness

When all items complete:

```
System Status:
✅ Code Quality: 100% (tests + lint)
✅ Performance: 100% (load test passed)
✅ Security: 100% (headers + rate limit)
✅ Monitoring: 100% (Sentry + logs)
✅ Backups: 100% (daily automated)

🚀 READY FOR PRODUCTION LAUNCH
```

---

## 🔗 Deployment URLs

After deployment:
- **Frontend**: https://app.validador-sefaz.com
- **API**: https://api.validador-sefaz.com
- **Admin Dashboard**: https://app.validador-sefaz.com/admin (if implemented)
- **Health Check**: https://api.validador-sefaz.com/health

---

## 📞 Support & Operations

### Rollback Plan
```bash
# If production fails:
heroku releases:rollback --app validador-sefaz-prod

# Or for frontend:
vercel rollback
```

### Incident Response
```bash
# Critical bug discovered:
1. Disable via feature flag (if implemented)
2. Hotfix and merge to main
3. GitHub Actions auto-deploys
4. Monitor metrics in Sentry
5. Alert team via Slack
```

### Database Maintenance
```bash
# Weekly vacuum
heroku pg:maintenance:window validador-sefaz-prod --window="Sunday 02:00"

# Monthly analyze
heroku pg:diagnose validador-sefaz-prod
```

---

**Phase 5 Status**: ✅ Ready  
**Total Project**: 30-35 hours implementation  
**Launch Target**: Week 1-2 of June 2026  

🎉 **PRE_VALIDADOR_SEFAZ V2.0 — Production Ready!**
