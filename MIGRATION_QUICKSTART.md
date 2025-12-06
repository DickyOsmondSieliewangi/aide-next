# Firestore Migration - Quick Start

## TL;DR - What to do after reboot

### 1. Enable Firestore (5 min)
- Go to [Firebase Console](https://console.firebase.google.com)
- Select your project
- Click "Firestore Database" → "Create Database"
- Choose "Production mode" → Select region → Create

### 2. Download Service Account (2 min)
- Firebase Console → Project Settings (⚙️) → Service Accounts
- Click "Generate New Private Key"
- Save as `firebase-service-account.json` in project root
- Add to `.gitignore`: `echo "firebase-service-account.json" >> .gitignore`

### 3. Install Dependencies (1 min)
```bash
npm install firebase@latest firebase-admin tsx
```

### 4. Update Code Files (2 min)
```bash
chmod +x migrate-to-firestore.sh
./migrate-to-firestore.sh
```

### 5. Deploy Firestore Config (1 min)
```bash
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

### 6. Migrate Data (5-10 min)
```bash
npx tsx scripts/migrate-rtdb-to-firestore.ts
```

### 7. Test (10 min)
```bash
npm run dev
```
- Test login, devices, charts
- Check console for errors

### 8. Deploy
```bash
npm run build
# Deploy to your hosting
```

## Files Created

All files are ready in your project:

1. **lib/firebase/firestore.ts** - New Firestore service ✓
2. **scripts/migrate-rtdb-to-firestore.ts** - Data migration script ✓
3. **firestore.indexes.json** - Firestore indexes ✓
4. **firestore.rules** - Security rules ✓
5. **migrate-to-firestore.sh** - Code update script ✓
6. **FIRESTORE_MIGRATION.md** - Full documentation ✓

## What the Migration Does

**Before (RTDB):**
```
users/{userId}/devices/{deviceId}
devices/{deviceId}/user_ids/{userId}: true
readings_daily/{deviceId}/{timestamp}
```

**After (Firestore):**
```
user-data/{userId}/devices: {deviceId: name}
item-data/{deviceId}/user_ids: [userId1, userId2]
item-data/{deviceId}/daily/{timestamp}
```

## Need Help?

Read the full guide: **FIRESTORE_MIGRATION.md**

## Rollback if Needed

```bash
git revert HEAD
# Redeploy previous version
```

---

**That's it! The migration is designed to be safe and reversible.**
