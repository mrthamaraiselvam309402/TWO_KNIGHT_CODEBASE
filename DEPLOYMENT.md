./DEPLOYMENT.md
# 🚀 Deployment Guide

## Prerequisites

- [ ] Supabase project created
- [ ] Vercel account (or other hosting platform)
- [ ] Git repository
- [ ] Node.js installed (v18+)

## Step 1: Set Up Supabase

### 1.1 Create Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Fill in project details
4. Wait for database to be ready

### 1.2 Get API Keys
1. Go to **Settings → API**
2. Copy **Anon Key** (for frontend)
3. Copy **Service Role Key** (for backend - keep secret!)
4. Copy **Project URL**

### 1.3 Run Database Migration
```bash
# Deploy database schema
supabase db push
```

Or manually run:
```sql
-- Execute supabase/migrations/20260421_unified_master_schema_fix.sql
-- in Supabase SQL Editor
```

## Step 2: Configure Environment Variables

### 2.1 Local Development

Create `.env` file in project root:
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2.2 Production (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings → Environment Variables**
4. Add:
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key-here
   ```

## Step 3: Deploy Edge Functions

### 3.1 Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop install supabase

# Linux
curl -fsSL https://supabase.com/cli/install.sh | sh
```

### 3.2 Link Project
```bash
supabase link --project-ref your-project-ref
```

### 3.3 Deploy Functions
```bash
# Deploy all functions
supabase functions deploy auth students payments rate_limit

# Or deploy individually
supabase functions deploy auth
supabase functions deploy students
supabase functions deploy payments
supabase functions deploy rate_limit
```

## Step 4: Deploy Frontend

### 4.1 Install Dependencies
```bash
npm install
```

### 4.2 Build for Production
```bash
npm run build
```

### 4.3 Deploy to Vercel
```bash
# If using Vercel CLI
vercel --prod

# Or connect GitHub repo in Vercel dashboard
# and enable automatic deployments
```

## Step 5: Verify Deployment

### 5.1 Check Application
```bash
# Open your deployed app
open https://your-app.vercel.app
```

### 5.2 Test Features
- [ ] Login works
- [ ] Students list loads
- [ ] Payments display correctly
- [ ] Realtime updates work
- [ ] No console errors

### 5.3 Check Security
```bash
# Verify no keys in console
# Check Network tab for API calls
# Verify RLS policies are enforced
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase Anon Key (public) |

## Troubleshooting

### Issue: "Supabase configuration missing"
**Solution:** Check that environment variables are set correctly in Vercel dashboard

### Issue: "Authentication failed"
**Solution:** Verify Anon Key is correct and not expired

### Issue: "Database connection error"
**Solution:** Check Supabase project URL and ensure database is running

### Issue: "Rate limit exceeded"
**Solution:** Wait 15 minutes or increase rate limits in `supabase/functions/rate_limit.js`

### Issue: "RLS policy violation"
**Solution:** Check Supabase RLS policies are correctly configured

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] No hardcoded keys in source code
- [ ] Supabase Anon Key is rotated
- [ ] RLS policies are enabled
- [ ] Environment variables set in production
- [ ] HTTPS is enforced
- [ ] CSP headers are configured
- [ ] Rate limiting is active

## Rollback Plan

If deployment fails:

```bash
# Revert to previous version in Vercel
vercel --prod --force

# Or rollback database
supabase db reset
supabase db push previous_schema.sql
```

## Monitoring

### Vercel Analytics
- Response times
- Error rates
- Function invocations

### Supabase Analytics
- Database queries
- API requests
- Storage usage

### Application Logs
- Browser console errors
- Network failures
- User actions

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Vite Documentation](https://vitejs.dev/guide/)

## 🎉 You're Ready!

Your Chesskidoo Academy dashboard is now deployed and secure! 🚀
