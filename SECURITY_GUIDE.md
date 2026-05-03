# 🔒 SECURITY GUIDE - Protecting Your Supabase Keys

## ⚠️ CRITICAL: Your Keys Were Exposed!

The Supabase Anon Key was hardcoded in `public/scripts.js` (line 12). Since your GitHub repo is public, **anyone could see and use your keys!**

## 🚨 Immediate Actions Required

### 1. Rotate Your Supabase Keys NOW

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings → API**
4. Click **Regenerate** next to:
   - **Anon key** (public)
   - **Service Role key** (secret - never use in frontend)
5. **This invalidates old keys immediately!**

### 2. Update Environment Variables

#### For Vercel Deployment:
1. Go to your Vercel dashboard
2. Select your project
3. Navigate to **Settings → Environment Variables**
4. Add:
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-new-anon-key-here
   ```

#### For Local Development:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your keys
3. **Make sure `.env` is in `.gitignore`!**

### 3. Verify .gitignore

Ensure these lines exist in your `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.development
.env.production

# Sensitive files
*.key
*.pem
*.p12
secrets/
```

## 🔐 How Environment Variables Work

### Before (INSECURE):
```javascript
// public/scripts.js - ANYONE CAN SEE THIS!
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### After (SECURE):
```javascript
// public/scripts.js - Keys loaded from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Supabase configuration missing!');
  // Show error to user
}
```

## 📁 Project Structure

```
.
├── .env.example          # Template for environment variables
├── .env                  # Your actual keys (NOT in git!)
├── .gitignore           # Ensures .env is not committed
├── public/
│   ├── scripts.js       # Loads keys from environment variables
│   └── index.html       # Loads Supabase from CDN
└── vercel.json          # Vercel configuration
```

## 🛡️ Additional Security Measures

### 1. Enable Row Level Security (RLS)

In Supabase, enable RLS on all tables:
```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
```

### 2. Create RLS Policies

```sql
-- Students can only see their own data
CREATE POLICY "Students view own data"
ON students FOR SELECT
USING (auth.uid() = user_id);

-- Admins can see all data
CREATE POLICY "Admins can manage all"
ON students FOR ALL
USING (auth.role() = 'admin');
```

### 3. Use Supabase Auth (Recommended)

Instead of custom authentication, use Supabase's built-in auth:
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});
```

### 4. Enable Email Confirmations

In Supabase Dashboard → Authentication → Settings:
- ✅ Enable Email Confirmations
- ✅ Enable Auto Confirm

### 5. Add CAPTCHA to Auth

Protect against bots:
```javascript
// Add to login form
import { hcaptcha } from 'hcaptcha';

const token = await hcaptcha.execute();
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
  options: { captchaToken: token }
});
```

## 🔍 Verify Your Setup

### Check 1: No Keys in Git
```bash
git log -p | grep -i "SUPABASE_ANON_KEY" | head -5
# Should return nothing!
```

### Check 2: .env is Ignored
```bash
cat .gitignore | grep "\.env"
# Should show: .env
```

### Check 3: Environment Variables Work
```bash
# In your app console
console.log(import.meta.env.VITE_SUPABASE_URL);
# Should show your URL (not undefined)
```

### Check 4: RLS is Enabled
```sql
-- In Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'students';
-- Should show active policies
```

## 🚀 Deployment Checklist

- [ ] Rotated Supabase keys in dashboard
- [ ] Created `.env` file with new keys
- [ ] Updated Vercel environment variables
- [ ] Verified `.env` is in `.gitignore`
- [ ] Tested app locally with `.env`
- [ ] Deployed to Vercel
- [ ] Verified production app works
- [ ] Checked no keys in git history
- [ ] Enabled RLS policies
- [ ] Tested RLS policies work

## 📚 Resources

- [Supabase Environment Variables Guide](https://supabase.com/docs/guides/deployment/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## ❓ FAQ

**Q: Can someone steal my data if they have my Anon Key?**
A: Yes, if RLS is not enabled. The Anon Key allows public access to your database. Always enable RLS!

**Q: What's the difference between Anon and Service Role keys?**
A: 
- **Anon Key**: For client-side, restricted by RLS
- **Service Role Key**: Full database access, NEVER use in frontend

**Q: How do I check if my keys were compromised?**
A: Check Supabase logs for unusual activity, rotate keys immediately if suspicious.

**Q: Can I use different keys for dev/prod?**
A: Yes! Use `.env.development` and `.env.production`.

## 🆘 Need Help?

If you need assistance:
1. Check Supabase documentation
2. Review Vercel deployment logs
3. Check browser console for errors
4. Verify environment variables are set correctly

**Remember: Never commit `.env` files to git!** 🔒
