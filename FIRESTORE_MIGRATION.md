# Firebase RTDB to Firestore Migration Guide

## Overview

This document provides step-by-step instructions for migrating from Firebase Realtime Database (RTDB) to Firestore.

## What's Changed

### Schema Transformations

1. **Collection Renaming:**
   - `users` → `user-data`
   - `devices` → `item-data`

2. **Data Structure Changes:**
   - `user_ids`: Converted from map (`{userId: true}`) to array (`[userId1, userId2]`)
   - Daily readings: Moved from top-level collection to subcollections (`item-data/{id}/daily/{timestamp}`)
   - Removed `readings_weekly` and `readings_yearly` collections (now handled with client-side aggregation)

3. **Telegram Data:**
   - Consolidated all chats into single document: `telegram/active_chats`

## Files Created

### 1. New Firestore Service
**File:** `lib/firebase/firestore.ts`
- Complete replacement for `rtdb.ts`
- All functions migrated to Firestore equivalents
- Real-time listeners using `onSnapshot()`
- Array operations using `arrayUnion()` and `arrayRemove()`

### 2. Migration Tools
- **`migrate-to-firestore.sh`** - Bash script to update existing files
- **`scripts/migrate-rtdb-to-firestore.ts`** - Data migration script

### 3. Firestore Configuration
- **`firestore.indexes.json`** - Required indexes for queries
- **`firestore.rules`** - Security rules for Firestore

## Migration Steps

### Prerequisites

1. **Backup your RTDB data:**
   ```bash
   # From Firebase Console: Database > Realtime Database > Export JSON
   ```

2. **Enable Firestore in Firebase Console:**
   - Go to Firebase Console > Firestore Database
   - Click "Create Database"
   - Choose production mode
   - Select your region

3. **Install dependencies:**
   ```bash
   npm install firebase@latest
   npm install -D firebase-admin tsx
   ```

4. **Download Firebase Service Account:**
   - Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save as `firebase-service-account.json` in project root
   - **Important:** Add this file to `.gitignore`

### Step 1: Update Code Files

Option A: **Using the migration script (recommended):**
```bash
chmod +x migrate-to-firestore.sh
./migrate-to-firestore.sh
```

Option B: **Manual updates:**

1. **lib/firebase/config.ts:**
   ```typescript
   import { getFirestore } from 'firebase/firestore';
   export const firestore = getFirestore(app);
   ```

2. **lib/firebase/auth.ts:**
   - Replace: `import { ref, set, get } from 'firebase/database'`
   - With: `import { doc, setDoc, getDoc } from 'firebase/firestore'`
   - Replace: `ref(db, 'users/${userId}')` → `doc(firestore, 'user-data/${userId}')`
   - Replace: `set(userRef, data)` → `setDoc(userRef, data)`
   - Replace: `get(userRef)` → `getDoc(userRef)`
   - Replace: `snapshot.val()` → `snapshot.data()`

3. **lib/firebase/telegram-chats.ts:**
   - See `lib/firebase/firestore.ts` for reference implementation
   - Update to use single document structure

4. **lib/hooks/use-devices.ts:**
   ```typescript
   // Change import
   from '@/lib/firebase/rtdb' → from '@/lib/firebase/firestore'
   ```

5. **lib/hooks/use-chart-data.ts:**
   - Remove `subscribeToWeeklyReadings()` and `subscribeToYearlyReadings()`
   - Use only `subscribeToDailyReadings()` for all time ranges
   - Implement client-side aggregation

6. **contexts/user-context.tsx:**
   - Update imports and function calls similar to auth.ts

7. **app/api/cron/energy-alerts/route.ts:**
   - Replace RTDB with Firestore queries
   - Use `collection()`, `getDocs()`, `query()`, `orderBy()`, `limit()`

### Step 2: Deploy Firestore Configuration

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy security rules
firebase deploy --only firestore:rules
```

### Step 3: Migrate Data

```bash
# Run the migration script
npx tsx scripts/migrate-rtdb-to-firestore.ts
```

The script will:
1. Migrate all users to `user-data` collection
2. Migrate all devices to `item-data` collection (converting user_ids)
3. Migrate daily readings to subcollections
4. Migrate Telegram data
5. Validate the migration
6. Display a summary report

### Step 4: Test the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test all functionality:**
   - [ ] Sign up / Sign in
   - [ ] View devices list
   - [ ] Add new device
   - [ ] Update device name
   - [ ] Delete device
   - [ ] Toggle device on/off
   - [ ] Set energy limit
   - [ ] View charts (24h, 7d, 1m, 1y)
   - [ ] Real-time updates work
   - [ ] Energy alerts cron job
   - [ ] Telegram bot integration

3. **Check browser console for errors**

4. **Monitor Firestore usage in Firebase Console**

### Step 5: Deploy to Production

```bash
# Deploy your application
npm run build
vercel --prod  # or your deployment method
```

### Step 6: Monitor and Cleanup

1. **Monitor for 24-48 hours:**
   - Check error logs
   - Monitor Firestore usage and costs
   - Verify all features work correctly

2. **Keep RTDB as backup for 7 days**

3. **After confidence, disable RTDB writes:**
   - Update RTDB rules to read-only
   - Or completely disable RTDB

## Key Firestore Differences

### Real-time Listeners

**RTDB:**
```typescript
const unsubscribe = onValue(ref(db, path), callback);
return () => off(ref(db, path));
```

**Firestore:**
```typescript
const unsubscribe = onSnapshot(doc(firestore, path), callback);
return unsubscribe; // onSnapshot returns its own cleanup
```

### Queries with Limits

**RTDB:**
```typescript
query(ref(), orderByKey(), limitToLast(100))
```

**Firestore:**
```typescript
query(collection(), orderBy('__name__', 'desc'), limit(100))
// Note: Need to reverse results for chronological order
```

### Array Operations

**RTDB:**
```typescript
// Used maps instead
await set(ref(db, `path/${userId}`), true);
await remove(ref(db, `path/${userId}`));
```

**Firestore:**
```typescript
await updateDoc(doc(), { array: arrayUnion(value) });
await updateDoc(doc(), { array: arrayRemove(value) });
```

### Nested Updates

**RTDB:**
```typescript
await set(ref(db, `devices/${id}/field`), value);
```

**Firestore:**
```typescript
await updateDoc(doc(firestore, `item-data/${id}`), { field: value });
// Or for nested fields:
await updateDoc(doc(), { 'nested.field': value });
```

## Troubleshooting

### Issue: "Missing or insufficient permissions"
**Solution:** Deploy security rules with `firebase deploy --only firestore:rules`

### Issue: "The query requires an index"
**Solution:**
1. Click the link in the error message to create the index automatically
2. Or deploy indexes with `firebase deploy --only firestore:indexes`

### Issue: "Cannot read property 'data' of undefined"
**Solution:** Check if document exists before calling `.data()`:
```typescript
if (!snapshot.exists()) {
  // Handle missing document
}
const data = snapshot.data();
```

### Issue: "Firestore costs are high"
**Solution:**
1. Implement client-side caching (already done in hooks)
2. Use `limit()` in queries
3. Avoid unnecessary real-time listeners
4. Review query patterns

### Issue: "Real-time updates not working"
**Solution:**
1. Ensure `onSnapshot()` cleanup function is called
2. Check browser console for permission errors
3. Verify security rules allow reads

## Rollback Plan

If critical issues occur:

1. **Revert code changes:**
   ```bash
   git revert HEAD  # or checkout previous commit
   ```

2. **Redeploy previous version**

3. **Clear Firestore data (optional):**
   ```bash
   # Use Firebase Console or run a cleanup script
   ```

4. **Re-enable RTDB**

## Cost Comparison

### RTDB Pricing
- $5/GB stored
- $1/GB downloaded
- Charged per GB

### Firestore Pricing
- $0.18/GB stored
- $0.02/100k reads
- $0.06/100k writes
- Charged per operation

**Recommendation:** Monitor usage in Firebase Console for first month.

## Support

For issues or questions:
1. Check Firebase documentation: https://firebase.google.com/docs/firestore
2. Review migration plan: `C:\Users\h4f1z\.claude\plans\sleepy-sniffing-dove.md`
3. Check error logs in browser console and server logs

## Summary

You now have:
- ✓ `lib/firebase/firestore.ts` - New Firestore service
- ✓ `firestore.indexes.json` - Required indexes
- ✓ `firestore.rules` - Security rules
- ✓ `scripts/migrate-rtdb-to-firestore.ts` - Data migration script
- ✓ `migrate-to-firestore.sh` - Code update script
- ✓ Migration plan and documentation

**Next Action:** Follow the migration steps above in order!
