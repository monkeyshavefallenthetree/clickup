# TaskUp - ClickUp Clone

A feature-rich task management application inspired by ClickUp, built with HTML, Tailwind CSS, Firebase, and JavaScript.

## Features

### ✅ Core Features
- **Home Dashboard** - Overview with statistics, today's tasks, and high priority items
- **Notification System** - Get notified when new tasks are created with inbox notifications
- **User Authentication** - Sign up, login, and logout with Firebase Auth
- **Task Management** - Create, edit, delete, and complete tasks
- **Task Assignment** - Assign tasks to other users and receive assignment notifications
- **Task Details** - Add descriptions, due dates, priorities, and tags
- **Checklist System** - Add sub-items to tasks with completion tracking
- **Project Organization** - Create projects with custom colors and quick task creation
- **Service Boards** - Organize projects into services with customizable workflow columns
- **Quick Add to Project** - Hover over any project to reveal "+" icon for instant task creation
- **Multiple Views** - Switch between Home, Inbox, List, Kanban, and Service board views
- **Drag & Drop** - Drag tasks between columns in Kanban view
- **Search & Filter** - Search tasks and filter by date, status, or project
- **Sorting** - Sort tasks by date, priority, or title
- **Dark Mode** - Toggle between light and dark themes
- **Real-time Sync** - All changes sync in real-time with Firebase

### 📱 User Interface
- Modern and clean design with Tailwind CSS
- Responsive layout for desktop and mobile
- Smooth animations and transitions
- Priority color coding (High/Medium/Low)
- Overdue task indicators
- Task completion progress tracking

## Setup Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password authentication
4. Enable **Firestore Database**:
   - Go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)
5. Get your Firebase configuration:
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps" and click the web icon (</>)
   - Copy the configuration object

### 2. Configure Firebase

Open `firebase-config.js` and replace the placeholder values with your Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Firestore Security Rules

In your Firebase Console, go to Firestore Database > Rules and add these security rules (also available in `firestore.rules` file):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tasks collection - users can only access their own tasks
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Projects collection - users can only access their own projects
    match /projects/{projectId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Services collection - users can only access their own services
    match /services/{serviceId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Users collection - any authenticated user can read all users (for assignment dropdown)
    // but can only create their own user document
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
```

### 4. Run the Application

Simply open `index.html` in your web browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then open http://localhost:8000 in your browser.

## Usage Guide

### Getting Started
1. **Sign Up** - Create an account with your email and password
2. **Home Dashboard** - View your task overview, statistics, and important tasks
3. **My Work Section** - Organize your tasks by To Do (Today, Overdue, Next, Unscheduled) or Done
4. **Create a Task** - Click "New Task" button
5. **Fill in Details** - Add title, description, due date, priority, and tags
6. **Assign to User** - Select a user from the "Assign To" dropdown to assign tasks to team members
7. **Add Checklist Items** - Create sub-tasks within a task
8. **Organize with Projects** - Create projects to categorize your tasks
9. **Create Services** - Click on a project to create services with custom workflow boards
10. **Quick Add to Project** - Hover over a project name and click the "+" icon to navigate to services
11. **Check Notifications** - Click the bell icon to see your notification inbox

### Task Management
- **Complete Tasks** - Click the checkbox to mark as complete
- **Edit Tasks** - Click on a task to edit its details
- **Assign Tasks** - Use the "Assign To" dropdown to assign tasks to specific users or everyone
- **Assign to All** - Select "👥 Assign to All" to assign tasks to all team members at once
- **View Assignments** - See who is assigned to each task with color-coded badges (purple for everyone, blue for specific users)
- **Assignment Notifications** - Users receive inbox notifications when tasks are assigned to them
- **Delete Tasks** - Open task details and click the delete button
- **Drag & Drop** - In Kanban view and service boards, drag tasks between columns

### Filtering & Sorting
- **All Tasks** - View all your tasks
- **Today** - View tasks due today
- **Upcoming** - View tasks due in the future
- **Completed** - View completed tasks
- **By Project** - Filter tasks by project
- **Search** - Search tasks by title, description, or tags
- **Sort** - Sort by created date, due date, priority, or title

### Views
- **Home Dashboard** - Overview with statistics cards, My Work section, Assigned to Me, and progress tracking
- **Inbox** - View all notifications including task assignments and upcoming deadlines
- **List View** - Traditional list layout with all task details
- **Kanban Board** - Organize tasks in To Do, In Progress, and Completed columns
- **Project Detail** - View all services within a project
- **Service Board** - Kanban-style board with custom columns: To Assign, To Do, In Progress, Completed

### My Work Section
Powerful task organization with nested tabs:
- **To Do Tab** - View incomplete tasks with sub-filters:
  - **Today** - Tasks due today
  - **Overdue** - Tasks past their due date
  - **Next** - Tasks due tomorrow or later
  - **Unscheduled** - Tasks without a due date
- **Done Tab** - View all completed tasks

### Assigned to Me
- View all tasks assigned to you (currently shows all incomplete tasks)
- Quick access to see what needs your attention
- Priority and due date indicators

### Project Quick Actions
- **Hover to Reveal** - Move your mouse over any project in the sidebar
- **Plus Icon** - A "+" icon appears on the right side
- **Quick Task Creation** - Click the "+" to open the task modal with that project pre-selected
- **Instant Assignment** - New tasks are automatically assigned to the project

### Notifications & Inbox
- **Notification Panel** - Click the bell icon in the header for quick notifications
- **Inbox Tab** - Dedicated inbox view for all notifications with filters
- **Assignment Alerts** - Get notified when tasks are assigned to you
- **Deadline Reminders** - Receive notifications for tasks due within 48 hours
- **Badge Counters** - See unread notification count at a glance
- **Filter Options** - Filter inbox by All, Upcoming Deadlines, Assigned to You, or Unread
- **Click to View** - Click on notifications to open related tasks
- **Mark as Read** - Dismiss individual notifications or mark all as read

### Dark Mode
- Toggle dark mode using the moon/sun icon in the header
- Preference is saved in your browser

## Project Structure

```
click-up-clone/
│
├── index.html          # Main HTML file with UI structure
├── app.js              # Application logic and Firebase operations
├── firebase-config.js  # Firebase configuration
├── firestore.rules     # Firestore security rules
└── README.md           # This file
```

## Technologies Used

- **HTML5** - Semantic markup
- **Tailwind CSS** - Utility-first CSS framework (via CDN)
- **JavaScript (ES6+)** - Modern JavaScript with modules
- **Firebase Authentication** - User authentication
- **Firebase Firestore** - Real-time NoSQL database
- **Font Awesome** - Icons

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Modern browsers with ES6 module support required.

## Features You Can Remove/Customize

If you want to simplify the app, you can easily remove these features:

1. **Projects** - Remove project creation and filtering
2. **Tags** - Remove tag functionality
3. **Checklist** - Remove sub-task checklist feature
4. **Dark Mode** - Remove theme toggle
5. **Kanban View** - Keep only list view
6. **Drag & Drop** - Disable drag and drop functionality
7. **Search** - Remove search functionality

## Tips

- Use keyboard shortcuts: Enter to submit forms, Escape to close modals
- Set due dates to keep track of deadlines
- Use priority levels to focus on important tasks
- Create projects to organize related tasks
- Use tags for quick categorization
- Enable dark mode for comfortable night-time use

## Troubleshooting

### Tasks not loading?
- Check your Firebase configuration in `firebase-config.js`
- Ensure Firestore security rules are set correctly
- Check browser console for errors

### Authentication not working?
- Verify Email/Password authentication is enabled in Firebase Console
- Check Firebase configuration

### Real-time updates not working?
- Ensure you have a stable internet connection
- Check Firestore security rules

## License

This project is open source and available for personal and educational use.

## Credits

Inspired by [ClickUp](https://clickup.com/) - The everything app for work.

