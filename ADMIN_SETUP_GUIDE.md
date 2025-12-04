# Admin System Setup Guide

## 🔐 Admin Accounts

Two admin accounts have been configured:

1. **Email:** `mftadmin@mft.com`
2. **Email:** `mftaccountmanager@mft.com`

## ✨ Admin Privileges

### What Admins Can Do:

✅ **See ALL Tasks** - Even tasks not assigned to them
✅ **View Task Ownership** - See who created each task
✅ **See Task Assignments** - View who assigned tasks to whom
✅ **Access All Projects** - View and edit any project
✅ **Manage All Services** - Full access to all services
✅ **Edit Any Task** - Modify or delete tasks from any user
✅ **Visual Admin Badge** - Red "ADMIN" badge next to email

### What Regular Users Can Do:

❌ Only see their own tasks
❌ Only see their own projects
❌ Cannot see task ownership details
✅ Can be assigned tasks by others
✅ Can assign tasks to others

---

## 🎨 Visual Indicators

### For Admins:
When viewing tasks created by other users, admins will see:

```
Task Title
Due: Today | Project: Website | 📤 Assigned to: John Doe | 👤 jane@example.com
                                                              ↑
                                                        Task Creator Badge
```

### Admin Badge:
In the header, admins see:
```
mftadmin@mft.com [ADMIN]
```
(Red badge with white text)

---

## 📋 How to Create Admin Accounts

### Step 1: Sign Up
1. Go to your app
2. Click "Sign Up"
3. Use one of the admin emails:
   - `mftadmin@mft.com`
   - `mftaccountmanager@mft.com`
4. Enter any password (minimum 6 characters)
5. Click "Create Account"

### Step 2: System Recognizes Admin
- System automatically detects the email
- Creates user with `role: 'admin'` in Firestore
- Shows "Admin account created successfully!"

### Step 3: Login as Admin
- Login with admin credentials
- Red "ADMIN" badge appears next to email
- Can now see all tasks, projects, and services

---

## 🔒 Firestore Security Rules

The following security rules have been implemented:

```javascript
// Helper function to check if user is admin
function isAdmin() {
  return request.auth != null && (
    request.auth.token.email == 'mftadmin@mft.com' ||
    request.auth.token.email == 'mftaccountmanager@mft.com'
  );
}

// Tasks: Admins see all, users see only their own
allow read: if isAdmin() || request.auth.uid == resource.data.userId;
allow write: if isAdmin() || request.auth.uid == resource.data.userId;

// Same rules apply for Projects and Services
```

---

## 📊 Task Ownership Display

### For Admins Viewing Tasks:

**Own Task:**
```
Fix homepage bug
Due: Today | 🏷️ High Priority
```

**Someone Else's Task:**
```
Update database schema
Due: Tomorrow | 👤 john@example.com | 📤 Assigned to: Sarah
                    ↑                      ↑
              Task Creator            Task Assignee
```

### Information Shown:
- **Creator Badge** (👤): Who created/owns the task
- **Assignment Badge** (📤): Who the task is assigned to
- Only visible to admins

---

## 🚀 Quick Start Commands

### Deploy Firestore Rules:
```bash
firebase deploy --only firestore:rules
```

### Test Admin Access:
1. Create account with `mftadmin@mft.com`
2. Login
3. Navigate to "Everything" view
4. You should see ALL tasks from all users
5. Tasks not created by you show creator badge

---

## 🔍 Verification Checklist

After creating admin accounts, verify:

- [ ] Admin badge appears in header
- [ ] Can see all tasks in "Everything" view
- [ ] Creator badge shows on other users' tasks
- [ ] Can edit/delete any task
- [ ] Can view all projects
- [ ] Can access all service boards
- [ ] Regular users still only see their own tasks

---

## 🛠️ Technical Implementation

### App.js Changes:

1. **Added Admin Detection:**
   ```javascript
   const ADMIN_EMAILS = ['mftadmin@mft.com', 'mftaccountmanager@mft.com'];
   let isAdmin = false;
   ```

2. **Modified Task Loading:**
   ```javascript
   // Admins load ALL tasks
   if (isAdmin) {
       q = query(tasksRef, orderBy('createdAt', 'desc'));
   } else {
       // Regular users load only their tasks
       q = query(tasksRef, where('userId', '==', currentUser.uid));
   }
   ```

3. **Added Task Creator Info:**
   ```javascript
   function getTaskOwnerName(userId) {
       const user = users.find(u => u.uid === userId);
       return user ? (user.displayName || user.email) : 'Unknown User';
   }
   ```

### Firestore.rules Changes:

Added `isAdmin()` helper function and applied to all collections:
- Tasks
- Projects  
- Services
- Users

---

## 🎯 Use Cases

### Use Case 1: Project Manager Overview
**Scenario:** Manager needs to see all team tasks
- Login as `mftadmin@mft.com`
- Go to "Everything" view
- Filter by project/assignee
- See complete team workload

### Use Case 2: Task Assignment Tracking
**Scenario:** Need to know who assigned a task
- Admin views task
- Creator badge shows: "john@example.com"
- Assignment badge shows: "Assigned to: Sarah"
- Full transparency of task flow

### Use Case 3: Project Cleanup
**Scenario:** Delete old/test projects
- Admin can see all projects
- Delete any project regardless of owner
- Cascade deletes services and tasks

---

## ⚠️ Important Notes

1. **Admin emails are hardcoded** in both app.js and firestore.rules
2. **To add more admins:** Update both files
3. **Case-insensitive:** Email check uses `.toLowerCase()`
4. **No password restrictions:** Admins use same signup as regular users
5. **Badge is visual only:** Security is enforced server-side in Firestore

---

## 🔐 Security Best Practices

✅ Admin check is done server-side in Firestore rules
✅ Client-side check is only for UI (showing badges)
✅ Cannot fake admin access by modifying JavaScript
✅ Email must match exactly in Firebase Authentication
✅ Rules are deployed separately to Firebase

---

## 📱 Screenshots Expected

### Regular User View:
```
╔═══════════════════════════════╗
║ jane@example.com              ║
╟───────────────────────────────╢
║ My Tasks (5)                  ║
║ • Fix bug                     ║
║ • Update docs                 ║
╚═══════════════════════════════╝
```

### Admin View:
```
╔═══════════════════════════════╗
║ mftadmin@mft.com [ADMIN]      ║
╟───────────────────────────────╢
║ All Tasks (23)                ║
║ • Fix bug (jane@example.com)  ║
║ • Update docs (john@mft.com)  ║
║ • Deploy (sarah@mft.com)      ║
╚═══════════════════════════════╝
```

---

## ✅ Summary

Your admin system is now fully configured with:
- Two admin accounts ready to use
- Full task visibility for admins
- Task ownership tracking
- Secure Firestore rules
- Visual admin indicators
- No breaking changes for regular users

**Next Steps:**
1. Deploy Firestore rules: `firebase deploy --only firestore:rules`
2. Create admin accounts using signup
3. Login and verify admin access
4. Test with regular user account to confirm isolation

---

**Created:** November 2024
**Version:** 1.0
**Status:** Ready to Deploy ✅


