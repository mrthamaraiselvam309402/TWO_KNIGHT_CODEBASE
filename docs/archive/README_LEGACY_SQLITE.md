# Chesskidoo AI Admin Panel

A comprehensive chess academy management system with AI assistant, payment processing, and local database with GitHub backup capabilities.

## ⚠️ Important: Current Setup

**This system uses a local SQLite database.** 
- ✅ Full functionality on your computer
- ✅ All features work locally
- ❌ GitHub Pages hosting is static only (backend won't work)
- ❌ Parents cannot access from other devices currently

**See `ARCHITECTURE.md` for detailed explanation and multi-device solutions.**

## Features

- 🎓 Student and Coach Management
- 💰 Integrated Razorpay Payment Gateway (with simulation mode)
- 🤖 AI Assistant for instant analytics
- 🔄 GitHub Backup System for data protection
- 📊 Dashboard with Revenue/Profit Tracking
- 📝 Student Enrollment & Editing
- 🏆 Wall of Fame for Achievements
- 📅 Event Management
- 📈 Dark/Light Theme Toggle
- 📱 Responsive Design

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Vercel Serverless Functions
- **Database**: SQLite (local) with GitHub backup
- **Payment**: Razorpay
- **Backup**: GitHub API
- **Charts**: Chart.js

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- GitHub account (for backup functionality)
- Razorpay account (for live payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/THAMARAISELVAM-A/chesskidoo-ai-admin.git
cd chesskidoo-ai-admin

# Install dependencies
npm install

# Set up backup system (IMPORTANT!)
npm run backup:setup

# Start development server
npm run dev
```

Access at: `http://localhost:3000`

### Environment Variables

Create a `.env` file in the root directory:

```env
# Local Database (auto-created at data/chesskidoo.db)
# No configuration needed for SQLite

# JWT Secret for authentication
JWT_SECRET=chesskidoo-secret-2024

# Port for local development
PORT=5000

# GitHub Backup Configuration (REQUIRED for data safety!)
# Get your token from: https://github.com/settings/tokens
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=THAMARAISELVAM-A
GITHUB_REPO=chesskidoo-ai-admin

# Razorpay Configuration (for payment processing)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## 🚨 Critical: Backup Your Data!

**Your database is stored locally. If you lose your computer, ALL DATA IS LOST unless you have backups!**

### Setup Backup System (One-Time)

```bash
npm run backup:setup
```

This will guide you through:
1. Creating a GitHub Personal Access Token
2. Configuring backup settings
3. Testing the backup system

### Daily Backup Routine

**After making any changes:**
```bash
npm run backup
```

**View all backups:**
```bash
npm run backup:list
```

**Restore from backup:**
```bash
npm run backup:restore chesskidoo-backup-2024-04-09T10-30-00.json
```

**See `BACKUP_GUIDE.md` for complete backup instructions.**

## Usage

### Admin Login

- **Username**: `admin`
- **Password**: `admin123`

### Parent Login

- **Username**: Child's full name (e.g., "John Smith")
- **Password**: Parent's phone number (set during enrollment)

### Features

1. **Dashboard**: Overview of students, revenue, and recent activity
2. **Students**: Add, edit, view, and manage students
3. **Coaches**: Manage coaching staff and assignments
4. **Events**: Create and manage academy events
5. **Payments**: Track fees and payments
6. **Achievements**: Celebrate student accomplishments
7. **AI Assistant**: Get instant analytics and insights
8. **Parent View**: Parents can view their child's progress

## Project Structure

```
chesskidoo-ai-admin/
├── public/
│   └── index.html          # Main frontend application
├── src/
│   └── api/
│       ├── db.js           # Database connection and schema
│       ├── students.js     # Student management API
│       ├── coaches.js      # Coach management API
│       ├── events.js       # Event management API
│       ├── payments.js     # Payment processing API
│       ├── achievements.js # Achievement tracking API
│       ├── games.js        # Game records API
│       └── ai.js           # AI assistant API
├── scripts/
│   ├── backup-database.js  # Backup to GitHub
│   ├── restore-database.js # Restore from GitHub
│   └── setup-backup.js     # Interactive backup setup
├── data/
│   └── chesskidoo.db       # Local SQLite database (auto-created)
├── backups/                # Local backup copies
├── docs/                   # Documentation
├── .env                    # Environment variables (not in git)
├── package.json
└── vercel.json            # Vercel deployment config
```

## Database Schema

### Students
- id, name, email, phone, age, grade
- parent_name, parent_phone, address
- enrollment_date, status, coach_id
- rating, notes, timestamps

### Coaches
- id, name, email, phone
- specialization, experience, rating
- bio, status, hourly_rate, availability
- timestamps

### Events
- id, title, description, event_date, event_time
- location, type, status
- max_participants, current_participants
- timestamps

### Achievements
- id, student_id, title, description
- date_achieved, category, level
- timestamps

### Games
- id, white_player, black_player, result
- date_played, moves, opening, tournament, notes
- timestamps

### Payments
- id, student_id, amount, currency, status
- payment_method, transaction_id, description
- payment_date, timestamps

## Deployment

### Local Development

```bash
npm run dev
```

### Production Deployment

**Important:** This system uses a local database. For production deployment with multi-device access, you need to:

1. **Migrate to cloud database** (Supabase, Vercel Postgres, etc.)
2. **Deploy backend** to cloud hosting (Vercel, Railway, etc.)
3. **Update API endpoints** to use cloud database

**See `ARCHITECTURE.md` for detailed deployment options.**

### GitHub Pages (Current)

The frontend is currently hosted on GitHub Pages:
https://thamaraiselvam-a.github.io/chesskidoo-ai-admin/

**Note:** GitHub Pages is static hosting only. The backend and database won't work on GitHub Pages. Use local development for full functionality.

## Scripts

```bash
npm run dev              # Start development server
npm run start            # Start production server
npm run backup           # Backup database to GitHub
npm run backup:list      # List all backups
npm run backup:restore   # Restore from backup
npm run backup:setup     # Interactive backup setup
```

## Troubleshooting

### Database Issues

**Error: "Cannot open database because the directory does not exist"**
```bash
mkdir -p data
```

**Error: "Database file not found"**
- Use the system at least once to create the database
- Check that `data/chesskidoo.db` exists

### Backup Issues

**Error: "GITHUB_TOKEN environment variable is required"**
- Run `npm run backup:setup` to configure
- Add `GITHUB_TOKEN` to `.env` file

**Error: "Failed to upload to GitHub"**
- Check internet connection
- Verify GitHub token has `repo` permissions
- Check GITHUB_OWNER and GITHUB_REPO are correct

### API Issues

**API endpoints not working**
- Ensure you're running `npm run dev` (not just opening HTML file)
- Check that server is running on port 3000
- Verify API files exist in `src/api/`

## Security Notes

- Never commit `.env` file to git
- Keep GitHub token secure
- Change default admin password in production
- Use HTTPS in production
- Implement proper authentication for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/THAMARAISELVAM-A/chesskidoo-ai-admin/issues
- Documentation: See `docs/` folder
- Backup Guide: `BACKUP_GUIDE.md`
- Architecture: `ARCHITECTURE.md`

## 🚨 Important Reminders

1. **Backup daily** - Run `npm run backup` after making changes
2. **Test backups** - Verify restore process works
3. **Keep token secure** - Don't share GitHub token
4. **Monitor database size** - Archive old data if needed
5. **Plan for cloud** - Consider cloud hosting for multi-device access

---

**Remember: No backup = No data recovery!**
**Run `npm run backup:setup` now to protect your data!**
