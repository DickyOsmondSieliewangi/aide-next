#!/bin/bash

# Firestore Migration Script
# This script updates all files to use Firestore instead of RTDB

echo "Starting Firestore migration..."

# 1. Update config.ts
echo "1. Updating lib/firebase/config.ts..."
sed -i "/import { getDatabase } from 'firebase\/database';/a import { getFirestore } from 'firebase/firestore';" lib/firebase/config.ts
sed -i "/export const db = getDatabase(app);/a export const firestore = getFirestore(app);" lib/firebase/config.ts

# 2. Update auth.ts
echo "2. Updating lib/firebase/auth.ts..."
sed -i "s/import { ref, set, get } from 'firebase\/database';/import { doc, setDoc, getDoc } from 'firebase\/firestore';/" lib/firebase/auth.ts
sed -i "s/import { auth, db } from '.\/config';/import { auth, firestore } from '.\/config';/" lib/firebase/auth.ts
sed -i "s/ref(db, \`users\/\${user.uid}\`)/doc(firestore, \`user-data\/\${user.uid}\`)/" lib/firebase/auth.ts
sed -i "s/await set(userRef,/await setDoc(userRef,/" lib/firebase/auth.ts
sed -i "s/await get(userRef)/await getDoc(userRef)/" lib/firebase/auth.ts
sed -i "s/userSnapshot.val()/userSnapshot.data()/" lib/firebase/auth.ts

# 3. Update user-context.tsx
echo "3. Updating contexts/user-context.tsx..."
sed -i "s/import { ref, get } from 'firebase\/database';/import { doc, getDoc } from 'firebase\/firestore';/" contexts/user-context.tsx
sed -i "s/import { auth, db } from '@\/lib\/firebase\/config';/import { auth, firestore } from '@\/lib\/firebase\/config';/" contexts/user-context.tsx
sed -i "s/ref(db, \`users\/\${firebaseUser.uid}\`)/doc(firestore, \`user-data\/\${firebaseUser.uid}\`)/" contexts/user-context.tsx
sed -i "s/await get(userRef)/await getDoc(userRef)/" contexts/user-context.tsx
sed -i "s/userSnapshot.val()/userSnapshot.data()/" contexts/user-context.tsx

# 4. Update use-devices.ts
echo "4. Updating lib/hooks/use-devices.ts..."
sed -i "s/from '@\/lib\/firebase\/rtdb';/from '@\/lib\/firebase\/firestore';/" lib/hooks/use-devices.ts

echo "Migration script completed!"
echo "Please review the changes and test thoroughly."
echo ""
echo "Still TODO manually:"
echo "- Update lib/firebase/telegram-chats.ts"
echo "- Update lib/hooks/use-chart-data.ts"
echo "- Update app/api/cron/energy-alerts/route.ts"
echo "- Run the data migration script"
echo "- Deploy Firestore indexes and security rules"
