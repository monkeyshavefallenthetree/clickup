// Main Application Logic
import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    setDoc,
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs,
    query, 
    where, 
    orderBy,
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Global State
let currentUser = null;
let tasks = [];
let projects = [];
let services = []; // Services within projects
let users = []; // All users for assignment
let currentFilter = 'all';
let currentView = 'home';
let currentMainView = 'home'; // home, list, kanban, service-board, project-detail, everything
let editingTaskId = null;
let everythingViewType = 'list'; // list or board
let everythingFilters = {
    project: '',
    client: '',
    assignee: '',
    status: ''
};
let isAdmin = false; // Track if current user is admin
let currentUserData = null; // Store full user data including role

// Admin emails
const ADMIN_EMAILS = ['mftadmin@mft.com', 'HaydiMikhail@mft.com', 'ranonaaccountmanger@mft.com'];
let unsubscribeTasks = null;
let unsubscribeProjects = null;
let unsubscribeServices = null;
let unsubscribeUsers = null;
let unsubscribeNotifications = null;
let notifications = [];
let lastTaskCount = 0;
let currentWorkTab = 'todo'; // todo or done
let currentWorkSubFilter = 'today'; // today, overdue, next, unscheduled
let inboxItems = []; // Inbox notifications
let currentInboxFilter = 'all'; // all, deadlines, assigned, unread
let currentProjectId = null; // Currently viewing project
let currentServiceId = null; // Currently viewing service

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    initializeEventListeners();
});

// ============================================
// Authentication Functions
// ============================================

function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            
            // Check if user is admin
            isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
            
            // Load current user data
            await loadCurrentUserData();
            
            showApp();
            document.getElementById('userEmail').textContent = user.email;
            
            // Show admin badge if admin
            if (isAdmin) {
                document.getElementById('userEmail').innerHTML = `${user.email} <span class="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded-full">ADMIN</span>`;
            }
            
            loadUsers();
            loadProjects();
            loadServices();
            loadTasks();
            loadNotifications();
        } else {
            currentUser = null;
            isAdmin = false;
            currentUserData = null;
            showAuth();
            cleanup();
        }
    });
}

async function loadCurrentUserData() {
    try {
        // Try to get user document using UID as document ID
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        
        if (!userDoc.empty) {
            currentUserData = { id: userDoc.docs[0].id, ...userDoc.docs[0].data() };
            console.log('✅ User data loaded:', currentUserData.email);
        } else {
            // User document doesn't exist - create it now (for existing accounts)
            console.log('⚠️ User document not found, creating...');
            const userIsAdmin = ADMIN_EMAILS.includes(currentUser.email.toLowerCase());
            
            await setDoc(doc(db, 'users', currentUser.uid), {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.email.split('@')[0],
                role: userIsAdmin ? 'admin' : 'user',
                createdAt: serverTimestamp()
            });
            
            console.log('✅ User document created for existing account:', currentUser.email);
            
            // Load again
            const newUserDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            if (!newUserDoc.empty) {
                currentUserData = { id: newUserDoc.docs[0].id, ...newUserDoc.docs[0].data() };
            }
        }
    } catch (error) {
        console.error('Error loading/creating current user data:', error);
    }
}

function showAuth() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}

function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
}

function cleanup() {
    if (unsubscribeTasks) unsubscribeTasks();
    if (unsubscribeProjects) unsubscribeProjects();
    if (unsubscribeServices) unsubscribeServices();
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeNotifications) unsubscribeNotifications();
    tasks = [];
    projects = [];
    services = [];
    users = [];
    inboxItems = [];
    notifications = [];
}

// ============================================
// Event Listeners
// ============================================

function initializeEventListeners() {
    // Auth Events
    document.getElementById('showSignup').addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
    });

    document.getElementById('showLogin').addEventListener('click', () => {
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    });

    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('signupFormElement').addEventListener('submit', handleSignup);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // User Menu Toggle
    document.getElementById('userMenuBtn').addEventListener('click', () => {
        document.getElementById('userMenu').classList.toggle('hidden');
    });

    // Close user menu when clicking outside
    document.addEventListener('click', (e) => {
        const userMenu = document.getElementById('userMenu');
        const userMenuBtn = document.getElementById('userMenuBtn');
        const notificationPanel = document.getElementById('notificationPanel');
        const notificationBtn = document.getElementById('notificationBtn');
        
        if (!userMenuBtn.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
        
        if (notificationPanel && !notificationBtn.contains(e.target) && !notificationPanel.contains(e.target)) {
            notificationPanel.classList.add('hidden');
        }
    });

    // Notification Events
    document.getElementById('notificationBtn').addEventListener('click', toggleNotificationPanel);
    document.getElementById('clearAllNotifications').addEventListener('click', clearAllNotifications);
    
    // Home Button
    document.getElementById('homeBtn').addEventListener('click', () => switchToView('home'));
    
    // Inbox Button
    document.getElementById('inboxBtn').addEventListener('click', () => switchToView('inbox'));
    
    // Inbox Tab Events
    document.querySelectorAll('.inbox-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.inboxFilter;
            switchInboxFilter(filter);
        });
    });
    
    // Mark All Read Button
    document.getElementById('markAllReadBtn').addEventListener('click', markAllInboxRead);
    
    // My Work Tab Events
    document.getElementById('todoMainTab').addEventListener('click', () => switchWorkMainTab('todo'));
    document.getElementById('doneMainTab').addEventListener('click', () => switchWorkMainTab('done'));
    
    // My Work Sub-Tab Events
    document.querySelectorAll('.work-sub-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            switchWorkSubFilter(filter);
        });
    });

    // Task Modal Events
    document.getElementById('newTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('closeModal').addEventListener('click', closeTaskModal);
    document.getElementById('cancelModal').addEventListener('click', closeTaskModal);
    document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);
    document.getElementById('deleteTaskBtn').addEventListener('click', handleDeleteTask);
    document.getElementById('addChecklistItem').addEventListener('click', addChecklistItem);
    document.getElementById('taskProject').addEventListener('change', handleProjectChange);

    // Project Modal Events
    document.getElementById('newProjectBtn').addEventListener('click', openProjectModal);
    document.getElementById('closeProjectModal').addEventListener('click', closeProjectModal);
    document.getElementById('cancelProjectModal').addEventListener('click', closeProjectModal);
    document.getElementById('projectForm').addEventListener('submit', handleProjectSubmit);
    
    // Service Modal Events
    document.getElementById('newServiceBtn').addEventListener('click', openServiceModal);
    document.getElementById('closeServiceModal').addEventListener('click', closeServiceModal);
    document.getElementById('cancelServiceModal').addEventListener('click', closeServiceModal);
    document.getElementById('serviceForm').addEventListener('submit', handleServiceSubmit);
    
    // Navigation Events
    document.getElementById('everythingBtn').addEventListener('click', () => openEverythingView());
    document.getElementById('backFromProject').addEventListener('click', () => switchToView('list'));
    document.getElementById('backFromService').addEventListener('click', backToProjectView);
    document.getElementById('newServiceTaskBtn').addEventListener('click', () => openTaskModalForService());
    
    // Everything View Events
    document.getElementById('everythingListViewBtn').addEventListener('click', () => toggleEverythingView('list'));
    document.getElementById('everythingBoardViewBtn').addEventListener('click', () => toggleEverythingView('board'));
    document.getElementById('filterByProject').addEventListener('change', applyEverythingFilters);
    document.getElementById('filterByClient').addEventListener('input', applyEverythingFilters);
    document.getElementById('filterByAssignee').addEventListener('change', applyEverythingFilters);
    document.getElementById('filterByStatus').addEventListener('change', applyEverythingFilters);
    document.getElementById('clearFiltersBtn').addEventListener('click', clearEverythingFilters);
    document.getElementById('clearFiltersBtn2').addEventListener('click', clearEverythingFilters);

    // Color selection for projects
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('ring-4'));
            e.target.classList.add('ring-4');
            document.getElementById('projectColor').value = e.target.dataset.color;
        });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            setFilter(filter);
            // Only switch to list view if we're not already in list or kanban view
            if (currentMainView !== 'list' && currentMainView !== 'kanban') {
                switchToView('list');
            }
        });
    });

    // Close modals on outside click
    document.getElementById('taskModal').addEventListener('click', (e) => {
        if (e.target.id === 'taskModal') closeTaskModal();
    });

    document.getElementById('projectModal').addEventListener('click', (e) => {
        if (e.target.id === 'projectModal') closeProjectModal();
    });
}

// ============================================
// Auth Handlers
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Welcome back!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check if user is admin
        const userIsAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
        
        // Create user document in Firestore using user.uid as document ID
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: email.split('@')[0], // Use email prefix as display name
            role: userIsAdmin ? 'admin' : 'user',
            createdAt: serverTimestamp()
        });
        
        console.log('✅ User document created for:', user.email);
        showNotification(userIsAdmin ? 'Admin account created successfully!' : 'Account created successfully!', 'success');
    } catch (error) {
        console.error('Signup error:', error);
        showNotification(error.message, 'error');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showNotification('Logged out successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ============================================
// Notifications Management
// ============================================

function loadNotifications() {
    if (!currentUser) return;
    
    const notificationsRef = collection(db, 'notifications');
    const q = query(
        notificationsRef, 
        where('recipientUid', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
    );
    
    unsubscribeNotifications = onSnapshot(q,
        (snapshot) => {
            console.log('=== Notifications Loading ===');
            console.log('Notifications found for', currentUser.email, ':', snapshot.size);
            
            inboxItems = [];
            snapshot.forEach((doc) => {
                const notifData = { id: doc.id, ...doc.data() };
                console.log('  - Notification:', notifData.title);
                inboxItems.push(notifData);
            });
            
            console.log('✅ Total notifications loaded:', inboxItems.length);
            updateInboxBadge();
            
            // Render inbox if currently viewing it
            if (currentMainView === 'inbox') {
                renderInbox();
            }
        },
        (error) => {
            // If index doesn't exist, try without orderBy
            if (error.code === 'failed-precondition' || error.message.includes('index')) {
                console.log('⚠️ Retrying notifications without orderBy...');
                const simpleQuery = query(
                    notificationsRef,
                    where('recipientUid', '==', currentUser.uid)
                );
                
                unsubscribeNotifications = onSnapshot(simpleQuery, (snapshot) => {
                    console.log('Notifications loaded (simple query):', snapshot.size);
                    inboxItems = [];
                    
                    snapshot.forEach((doc) => {
                        inboxItems.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Sort manually by timestamp
                    inboxItems.sort((a, b) => {
                        if (!a.timestamp) return 1;
                        if (!b.timestamp) return -1;
                        const aTime = a.timestamp.seconds || a.timestamp.getTime() / 1000;
                        const bTime = b.timestamp.seconds || b.timestamp.getTime() / 1000;
                        return bTime - aTime;
                    });
                    
                    console.log('✅ Notifications sorted and loaded:', inboxItems.length);
                    updateInboxBadge();
                    
                    if (currentMainView === 'inbox') {
                        renderInbox();
                    }
                });
            } else {
                console.error('Error loading notifications:', error);
            }
        }
    );
}

// ============================================
// User Functions
// ============================================

function loadUsers() {
    if (!currentUser) return;

    const usersRef = collection(db, 'users');
    
    unsubscribeUsers = onSnapshot(usersRef, 
        (snapshot) => {
            console.log('=== Users Loading ===');
            console.log('Users found in Firestore:', snapshot.size);
            
            users = [];
            snapshot.forEach((doc) => {
                const userData = { id: doc.id, ...doc.data() };
                console.log('  - User:', userData.email, '(uid:', userData.uid, ')');
                users.push(userData);
            });
            
            // Remove any duplicates based on uid
            const uniqueUsers = Array.from(new Map(users.map(u => [u.uid, u])).values());
            users = uniqueUsers;
            
            console.log('✅ Total unique users loaded:', users.length);
            
            // Only populate dropdowns if we have users
            if (users.length > 0) {
                populateUserDropdowns();
            } else {
                console.warn('⚠️ No users in database! Users will be auto-created on login.');
            }
        },
        (error) => {
            console.error('Error loading users:', error);
            alert('Error loading users: ' + error.message);
        }
    );
}

function populateUserDropdowns() {
    // Populate both assigned and watchers lists
    populateAssignedToList();
    populateWatchersList();
}

function populateAssignedToList(selectedAssignees = []) {
    const assignedContainer = document.getElementById('assignedToCheckboxList');
    if (!assignedContainer) return;
    
    // Clear container completely to prevent duplicates
    assignedContainer.innerHTML = '';
    
    if (users.length === 0) {
        assignedContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 italic">No users available</p>';
        return;
    }
    
    console.log('Populating assigned list with', users.length, 'users');
    console.log('Pre-selected assignees:', selectedAssignees);
    
    // Create unique list to prevent duplicates
    const uniqueUsers = Array.from(new Map(users.map(user => [user.uid, user])).values());
    
    // Add checkbox for each unique user
    uniqueUsers.forEach(user => {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `assigned-${user.uid}`;
        checkbox.value = user.uid;
        checkbox.className = 'w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500';
        checkbox.checked = selectedAssignees.includes(user.uid);
        
        const label = document.createElement('label');
        label.htmlFor = `assigned-${user.uid}`;
        label.className = 'flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer';
        label.textContent = user.displayName || user.email;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        assignedContainer.appendChild(div);
    });
    
    console.log('✅ Assigned list populated with', uniqueUsers.length, 'unique users');
}

function populateWatchersList(selectedWatchers = []) {
    const watchersContainer = document.getElementById('watchersCheckboxList');
    if (!watchersContainer) return;
    
    // Clear container completely to prevent duplicates
    watchersContainer.innerHTML = '';
    
    if (users.length === 0) {
        watchersContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 italic">No users available</p>';
        return;
    }
    
    console.log('Populating watchers list with', users.length, 'users');
    console.log('Pre-selected watchers:', selectedWatchers);
    
    // Create unique list to prevent duplicates
    const uniqueUsers = Array.from(new Map(users.map(user => [user.uid, user])).values());
    
    // Add checkbox for each unique user
    uniqueUsers.forEach(user => {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `watcher-${user.uid}`;
        checkbox.value = user.uid;
        checkbox.className = 'w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500';
        checkbox.checked = selectedWatchers.includes(user.uid);
        
        const label = document.createElement('label');
        label.htmlFor = `watcher-${user.uid}`;
        label.className = 'flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer';
        label.textContent = user.displayName || user.email;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        watchersContainer.appendChild(div);
    });
    
    console.log('✅ Watchers list populated with', uniqueUsers.length, 'unique users');
}

// ============================================
// Task Functions
// ============================================

function loadTasks() {
    if (!currentUser) return;

    const tasksRef = collection(db, 'tasks');
    
    // ALL authenticated users can see all tasks
    const q = query(tasksRef, orderBy('createdAt', 'desc'));

    unsubscribeTasks = onSnapshot(q, 
        (snapshot) => {
            console.log('=== Tasks Snapshot Received ===');
            console.log('Tasks loaded from Firestore:', snapshot.size);
            const previousTaskCount = tasks.length;
            tasks = [];
            
            snapshot.forEach((doc) => {
                const taskData = { id: doc.id, ...doc.data() };
                console.log('Task loaded:', {
                    title: taskData.title,
                    projectId: taskData.projectId,
                    serviceId: taskData.serviceId,
                    dueDate: taskData.dueDate,
                    status: taskData.status
                });
                tasks.push(taskData);
            });
            
            console.log('Total tasks in array:', tasks.length);
            console.log('Current view state:', {
                currentView: currentView,
                currentMainView: currentMainView,
                currentFilter: currentFilter
            });
            
            // Detect new tasks and create notifications
            if (previousTaskCount > 0 && tasks.length > previousTaskCount) {
                const newTask = tasks[0]; // Most recent task
                addNotification({
                    id: Date.now().toString(),
                    title: 'New Task Created',
                    message: `"${newTask.title}" has been added to your tasks`,
                    taskId: newTask.id,
                    timestamp: new Date(),
                    read: false
                });
            }
            
            renderTasks();
            updateCounts();
            updateHomeDashboard();
            checkAndGenerateInboxNotifications();
            
            // Update service task counts in sidebar without full re-render
            updateServiceTaskCounts();
            
            // Also update service board if viewing one
            if (currentMainView === 'service-board') {
                renderServiceBoard();
            }
            
            // Also update everything view if viewing it
            if (currentMainView === 'everything') {
                renderEverythingView();
            }
            
            // Also update project detail view if viewing one
            if (currentMainView === 'project-detail') {
                renderServicesForProject(currentProjectId);
            }
        },
        (error) => {
            console.error('Error loading tasks:', error);
            
                    // If orderBy fails (missing index), try without it
                    if (error.code === 'failed-precondition' || error.message.includes('index')) {
                        console.log('Retrying without orderBy due to missing index...');
                        // ALL users see all tasks
                        const simpleQuery = query(tasksRef);
                
                unsubscribeTasks = onSnapshot(simpleQuery, (snapshot) => {
                    console.log('Tasks loaded (simple query):', snapshot.size);
                    tasks = [];
                    
                    snapshot.forEach((doc) => {
                        tasks.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // Sort manually by createdAt
                    tasks.sort((a, b) => {
                        if (!a.createdAt) return 1;
                        if (!b.createdAt) return -1;
                        return b.createdAt.seconds - a.createdAt.seconds;
                    });
                    
                    console.log('Total tasks after manual sort:', tasks.length);
                    renderTasks();
                    updateCounts();
                    updateHomeDashboard();
                    checkAndGenerateInboxNotifications();
                    
                    // Update service task counts in sidebar without full re-render
                    updateServiceTaskCounts();
                    
                    // Also update service board if viewing one
                    if (currentMainView === 'service-board') {
                        renderServiceBoard();
                    }
                    
                    // Also update everything view if viewing it
                    if (currentMainView === 'everything') {
                        renderEverythingView();
                    }
                    
                    // Also update project detail view if viewing one
                    if (currentMainView === 'project-detail') {
                        renderServicesForProject(currentProjectId);
                    }
                });
            } else {
                alert('Error loading tasks: ' + error.message + '\n\nCheck browser console for details.');
            }
        }
    );
}

// ============================================
// NEW UNIFIED RENDERING SYSTEM
// ============================================

function renderTasks() {
    console.log('=== 🎨 RENDER TASKS START ===');
    console.log('📊 State:', {
        view: currentView,
        mainView: currentMainView,
        filter: currentFilter,
        totalTasks: tasks.length
    });
    
    // Check if we should render
    if (currentMainView !== 'list' && currentMainView !== 'kanban') {
        console.log('⚠️ Not rendering - current view is:', currentMainView);
        return;
    }
    
    // Get tasks to display
    let displayTasks = [...tasks];
    
    // Apply filter ONLY if not 'all'
    if (currentFilter !== 'all') {
        displayTasks = applyFilter(displayTasks, currentFilter);
        console.log(`🔍 Filter '${currentFilter}' applied: ${displayTasks.length} tasks`);
    } else {
        console.log('✅ Showing ALL tasks (no filter)');
    }
    
    console.log(`📋 Displaying ${displayTasks.length} tasks`);
    
    // Render in current view mode
    if (currentView === 'list') {
        renderAllTasksList(displayTasks);
    } else if (currentView === 'kanban') {
        renderAllTasksBoard(displayTasks);
    }
    
    console.log('=== ✅ RENDER COMPLETE ===');
}

function applyFilter(taskList, filter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filter) {
        case 'today':
            return taskList.filter(task => {
                if (!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === today.getTime();
            });
            
        case 'upcoming':
            return taskList.filter(task => {
                if (!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                return taskDate > today;
            });
            
        case 'completed':
            return taskList.filter(task => task.status === 'completed');
            
        default:
            return taskList;
    }
}

function renderAllTasksList(taskList) {
    console.log('📝 Rendering LIST view with', taskList.length, 'tasks');
    
    const container = document.getElementById('tasksList');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) {
        console.error('❌ tasksList container not found!');
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Show/hide empty state
    if (taskList.length === 0) {
        console.log('📭 No tasks to display - showing empty state');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            container.classList.add('hidden');
        }
        return;
    }
    
    if (emptyState) {
        emptyState.classList.add('hidden');
        container.classList.remove('hidden');
    }
    
    // Render each task
    let rendered = 0;
    taskList.forEach(task => {
        try {
            const taskElement = createTaskElement(task, 'list');
            container.appendChild(taskElement);
            rendered++;
        } catch (error) {
            console.error('❌ Error rendering task:', task.title, error);
        }
    });
    
    console.log(`✅ Successfully rendered ${rendered} tasks in list`);
}

function renderAllTasksBoard(taskList) {
    console.log('📊 Rendering BOARD view with', taskList.length, 'tasks');
    
    const columns = {
        todo: document.getElementById('todoColumn'),
        inProgress: document.getElementById('progressColumn'),
        clientChecking: document.getElementById('checkingColumn'),
        completed: document.getElementById('completedColumn')
    };
    
    // Verify columns exist
    const missingColumns = Object.entries(columns)
        .filter(([key, el]) => !el)
        .map(([key]) => key);
    
    if (missingColumns.length > 0) {
        console.error('❌ Missing columns:', missingColumns);
        return;
    }
    
    // Clear all columns
    Object.values(columns).forEach(col => col.innerHTML = '');
    
    const counts = { todo: 0, inProgress: 0, clientChecking: 0, completed: 0 };
    
    // Distribute tasks to columns
    taskList.forEach(task => {
        try {
            const taskElement = createTaskElement(task, 'kanban');
            const status = task.status || 'todo';
            
            // Place task in appropriate column
            if (status === 'completed') {
                columns.completed.appendChild(taskElement);
                counts.completed++;
            } else if (status === 'clientChecking') {
                columns.clientChecking.appendChild(taskElement);
                counts.clientChecking++;
            } else if (status === 'inProgress') {
                columns.inProgress.appendChild(taskElement);
                counts.inProgress++;
            } else {
                // Default to todo for any other status
                columns.todo.appendChild(taskElement);
                counts.todo++;
            }
        } catch (error) {
            console.error('❌ Error rendering task:', task.title, error);
        }
    });
    
    console.log('✅ Board distribution:', counts);
    
    // Update count badges
    document.getElementById('todoCount').textContent = counts.todo;
    document.getElementById('progressCount').textContent = counts.inProgress;
    document.getElementById('checkingCount').textContent = counts.clientChecking;
    document.getElementById('completedCount').textContent = counts.completed;
    
    // Setup drag and drop
    setupDragAndDrop();
}

function createTaskElement(task, viewType) {
    const div = document.createElement('div');
    div.className = viewType === 'list' 
        ? `task-item bg-white dark:bg-gray-700 rounded-lg p-4 border-l-4 priority-${task.priority} cursor-pointer`
        : `task-item bg-gray-50 dark:bg-gray-600 rounded-lg p-3 border-l-4 priority-${task.priority} cursor-move`;
    
    div.draggable = true;
    div.dataset.taskId = task.id;

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';
    const dueDateText = dueDate ? formatDate(dueDate) : '';

    const tags = task.tags ? task.tags.split(',').map(tag => 
        `<span class="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded-full">${tag.trim()}</span>`
    ).join('') : '';

    const checklistProgress = task.checklist ? 
        `${task.checklist.filter(item => item.completed).length}/${task.checklist.length}` : '';
    
    // Handle assignedTo - can be array (new) or string (legacy)
    let assignedToText = '';
    let assignedTooltip = '';
    let assignedBadgeClass = 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';
    let assignedIcon = 'fa-user';
    
    if (task.assignedTo) {
        if (Array.isArray(task.assignedTo)) {
            // New format: array of user IDs
            if (task.assignedTo.length > 0) {
                const assignedNames = task.assignedTo.map(uid => getAssignedUserName(uid)).filter(name => name && name !== 'Unknown User');
                if (assignedNames.length > 0) {
                    assignedToText = assignedNames.length === 1 
                        ? assignedNames[0]
                        : `${assignedNames.length} Assigned`;
                    assignedTooltip = assignedNames.join(', ');
                    assignedIcon = assignedNames.length > 1 ? 'fa-users' : 'fa-user';
                }
            }
        } else if (task.assignedTo) {
            // Legacy format: single user ID or __ALL__
            assignedToText = getAssignedUserName(task.assignedTo);
            assignedTooltip = assignedToText;
            const isAssignedToAll = task.assignedTo === '__ALL__';
            assignedIcon = isAssignedToAll ? 'fa-users' : 'fa-user';
        }
    }
    
    // Show task owner badge if admin is viewing and task belongs to someone else
    const taskOwnerBadge = (isAdmin && task.userId && task.userId !== currentUser.uid) 
        ? `<span class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"><i class="fas fa-user-circle mr-1"></i>Owner: ${getTaskOwnerName(task.userId)}</span>`
        : '';
    
    // Show watchers if any
    const watchersBadge = (task.watchers && task.watchers.length > 0)
        ? `<span class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full" title="${task.watchers.map(uid => getTaskOwnerName(uid)).join(', ')}">
             <i class="fas fa-eye mr-1"></i>${task.watchers.length} Watcher${task.watchers.length > 1 ? 's' : ''}
           </span>`
        : '';

    div.innerHTML = `
        <div class="flex items-start justify-between group">
            <div class="flex items-start space-x-3 flex-1">
                <button class="task-checkbox mt-1 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-500 flex items-center justify-center hover:border-purple-600 transition ${task.status === 'completed' ? 'bg-purple-600 border-purple-600' : ''}">
                    ${task.status === 'completed' ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
                </button>
                <div class="flex-1" onclick="window.editTask('${task.id}')">
                    <h4 class="font-semibold text-gray-800 dark:text-white ${task.status === 'completed' ? 'line-through opacity-50' : ''}">${escapeHtml(task.title)}</h4>
                    ${task.description ? `<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(task.description)}</p>` : ''}
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                        ${dueDateText ? `<span class="text-xs ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}"><i class="far fa-calendar mr-1"></i>${dueDateText}</span>` : ''}
                        ${checklistProgress ? `<span class="text-xs text-gray-500 dark:text-gray-400"><i class="far fa-check-square mr-1"></i>${checklistProgress}</span>` : ''}
                        ${task.projectId ? `<span class="text-xs text-gray-500 dark:text-gray-400"><i class="fas fa-folder mr-1"></i>${getProjectName(task.projectId)}</span>` : ''}
                        ${assignedToText ? `<span class="text-xs px-2 py-1 ${assignedBadgeClass} rounded-full" title="${assignedTooltip}"><i class="fas ${assignedIcon} mr-1"></i>${assignedToText}</span>` : ''}
                        ${watchersBadge}
                        ${taskOwnerBadge}
                    </div>
                    ${tags ? `<div class="flex gap-1 mt-2 flex-wrap">${tags}</div>` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-2">
                ${viewType === 'list' ? `
                    <select class="task-status-dropdown text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium ${getStatusBadgeClass(task.status || 'todo')}" data-task-id="${task.id}">
                        <option value="todo" ${task.status === 'todo' || !task.status ? 'selected' : ''}>📝 To Do</option>
                        <option value="inProgress" ${task.status === 'inProgress' ? 'selected' : ''}>🔄 In Progress</option>
                        <option value="clientChecking" ${task.status === 'clientChecking' ? 'selected' : ''}>👁️ Client Checking</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
                    </select>
                    <span class="text-xs px-2 py-1 rounded ${getPriorityBadgeClass(task.priority)}">${task.priority}</span>
                ` : ''}
                <button class="task-delete-btn opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900 transition" title="Delete task">
                    <i class="fas fa-trash text-xs text-red-600 dark:text-red-400"></i>
                </button>
            </div>
        </div>
    `;

    // Add checkbox event listener
    const checkbox = div.querySelector('.task-checkbox');
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskComplete(task.id);
    });
    
    // Add status dropdown event listener (only in list view)
    const statusDropdown = div.querySelector('.task-status-dropdown');
    if (statusDropdown) {
        statusDropdown.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening task modal
        });
        
        statusDropdown.addEventListener('change', async (e) => {
            e.stopPropagation();
            const newStatus = e.target.value;
            const taskId = e.target.dataset.taskId;
            
            console.log('Changing task status to:', newStatus);
            
            try {
                await updateDoc(doc(db, 'tasks', taskId), {
                    status: newStatus,
                    updatedAt: serverTimestamp()
                });
                
                // Update dropdown color
                e.target.className = e.target.className.replace(/bg-\w+-100|text-\w+-700|dark:bg-\w+-900|dark:text-\w+-300/g, '');
                e.target.className += ' ' + getStatusBadgeClass(newStatus);
                
                showNotification(`Task status updated to ${newStatus}`, 'success');
            } catch (error) {
                console.error('Error updating task status:', error);
                showNotification('Error updating status', 'error');
            }
        });
    }

    // Add delete button event listener
    const deleteBtn = div.querySelector('.task-delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskTitle = task.title;
        const confirmDelete = confirm(`Are you sure you want to delete "${taskTitle}"?`);
        
        if (confirmDelete) {
            try {
                await deleteDoc(doc(db, 'tasks', task.id));
                showNotification('Task deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting task:', error);
                showNotification('Error deleting task: ' + error.message, 'error');
            }
        }
    });

    // Add drag events
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);

    return div;
}

async function toggleTaskComplete(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    
    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { status: newStatus });
        showNotification(newStatus === 'completed' ? 'Task completed!' : 'Task reopened', 'success');
    } catch (error) {
        showNotification('Error updating task', 'error');
    }
}

// Old filterTasks and sortTasks functions removed - replaced by applyFilter in new rendering system

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const taskElements = document.querySelectorAll('.task-item');

    taskElements.forEach(element => {
        const task = tasks.find(t => t.id === element.dataset.taskId);
        if (!task) return;

        const matchesSearch = 
            task.title.toLowerCase().includes(searchTerm) ||
            (task.description && task.description.toLowerCase().includes(searchTerm)) ||
            (task.tags && task.tags.toLowerCase().includes(searchTerm));

        element.style.display = matchesSearch ? 'block' : 'none';
    });
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-purple-100', 'dark:bg-gray-700');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('bg-purple-100', 'dark:bg-gray-700');
    renderTasks();
}

function updateCounts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    document.getElementById('countAll').textContent = tasks.length;
    
    // Update Everything badge count
    const everythingCountBadge = document.getElementById('everythingTaskCount');
    if (everythingCountBadge) {
        everythingCountBadge.textContent = tasks.length;
    }
    document.getElementById('countToday').textContent = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime();
    }).length;
    document.getElementById('countUpcoming').textContent = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        return taskDate >= tomorrow;
    }).length;
    document.getElementById('countCompleted').textContent = tasks.filter(task => task.status === 'completed').length;
}

// ============================================
// Task Modal Functions
// ============================================

function openTaskModal(taskId = null) {
    editingTaskId = taskId;
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    const deleteBtn = document.getElementById('deleteTaskBtn');
    
    form.reset();
    document.getElementById('checklistItems').innerHTML = '';
    
    // Clear containers first to prevent duplicates
    document.getElementById('assignedToCheckboxList').innerHTML = '';
    document.getElementById('watchersCheckboxList').innerHTML = '';
    
    // Reset and hide service dropdown by default
    document.getElementById('serviceSelectContainer').classList.add('hidden');
    document.getElementById('taskService').innerHTML = '<option value="">No Service</option>';
    
    if (taskId) {
        // EDITING existing task
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById('modalTitle').textContent = 'Edit Task';
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskDueDate').value = task.dueDate || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskProject').value = task.projectId || '';
            document.getElementById('taskTags').value = task.tags || '';
            
            // Populate assigned users with pre-selected users
            const assignedUsers = task.assignedTo || [];
            // Handle legacy single assignedTo (string) or new assignedTo (array)
            const assignedArray = Array.isArray(assignedUsers) ? assignedUsers : (assignedUsers ? [assignedUsers] : []);
            populateAssignedToList(assignedArray);
            
            // Populate services if project is selected
            if (task.projectId) {
                populateServiceDropdown(task.projectId);
                if (task.serviceId) {
                    document.getElementById('taskService').value = task.serviceId;
                }
            }
            
            // Populate watchers with pre-selected users
            if (task.watchers && Array.isArray(task.watchers)) {
                populateWatchersList(task.watchers);
            } else {
                // No watchers selected, populate empty list
                populateWatchersList([]);
            }
            
            if (task.checklist) {
                task.checklist.forEach(item => {
                    addChecklistItem(item.text, item.completed);
                });
            }
            
            deleteBtn.classList.remove('hidden');
        }
    } else {
        // CREATING new task - populate empty lists
        document.getElementById('modalTitle').textContent = 'New Task';
        deleteBtn.classList.add('hidden');
        
        // Populate both lists with no selections
        populateAssignedToList([]);
        populateWatchersList([]);
    }
    
    modal.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    editingTaskId = null;
}

function addChecklistItem(text = '', completed = false) {
    const container = document.getElementById('checklistItems');
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2';
    div.innerHTML = `
        <input type="checkbox" ${completed ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600">
        <input type="text" value="${text}" placeholder="Checklist item..." 
            class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-600 outline-none">
        <button type="button" class="text-red-600 hover:text-red-700">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    div.querySelector('button').addEventListener('click', () => div.remove());
    container.appendChild(div);
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const priority = document.getElementById('taskPriority').value;
    const projectId = document.getElementById('taskProject').value;
    const serviceId = document.getElementById('taskService').value;
    const tags = document.getElementById('taskTags').value;
    
    console.log('Task form values - Project:', projectId, 'Service:', serviceId);
    
    // VALIDATION: Require Project and Service (unless creating from service board)
    if (currentMainView !== 'service-board') {
        if (!projectId) {
            showNotification('⚠️ Please select a Client (Project)', 'error');
            return;
        }
        
        if (!serviceId) {
            showNotification('⚠️ Please select a Service for this task', 'error');
            // Highlight the service container
            document.getElementById('serviceSelectContainer').classList.add('ring-2', 'ring-red-500');
            setTimeout(() => {
                document.getElementById('serviceSelectContainer').classList.remove('ring-2', 'ring-red-500');
            }, 2000);
            return;
        }
    }
    
    const checklistItems = Array.from(document.querySelectorAll('#checklistItems > div')).map(div => ({
        text: div.querySelector('input[type="text"]').value,
        completed: div.querySelector('input[type="checkbox"]').checked
    })).filter(item => item.text.trim() !== '');
    
    // Get selected assigned users and remove duplicates
    const assignedCheckboxes = document.querySelectorAll('#assignedToCheckboxList input[type="checkbox"]:checked');
    const assignedTo = [...new Set(Array.from(assignedCheckboxes).map(cb => cb.value))];
    
    // Get selected watchers and remove duplicates
    const watcherCheckboxes = document.querySelectorAll('#watchersCheckboxList input[type="checkbox"]:checked');
    const watchers = [...new Set(Array.from(watcherCheckboxes).map(cb => cb.value))];
    
    console.log('Selected assigned users (unique):', assignedTo);
    console.log('Selected watchers (unique):', watchers);
    console.log('✅ Validation passed - Project and Service selected');
    
    const taskData = {
        title,
        description,
        dueDate,
        priority,
        projectId,
        tags,
        checklist: checklistItems,
        assignedTo: assignedTo, // Array of assigned user IDs
        watchers: watchers, // Array of watcher user IDs
        userId: currentUser.uid
    };
    
    // Add serviceId from dropdown if selected
    if (serviceId) {
        taskData.serviceId = serviceId;
    }
    
    // Also add serviceId if creating task from service board (fallback)
    if (currentMainView === 'service-board' && currentServiceId && !serviceId) {
        taskData.serviceId = currentServiceId;
    }
    
    console.log('Creating task with data:', taskData);
    
    try {
        if (editingTaskId) {
            // Get the original task to check for newly assigned users
            const originalTask = tasks.find(t => t.id === editingTaskId);
            const originalAssignees = originalTask?.assignedTo || [];
            
            const taskRef = doc(db, 'tasks', editingTaskId);
            await updateDoc(taskRef, { ...taskData, updatedAt: serverTimestamp() });
            
            // Send notifications to newly assigned users
            if (assignedTo && assignedTo.length > 0) {
                // Find users who were newly assigned (not in the original list)
                const newlyAssignedUsers = assignedTo.filter(userId => {
                    if (Array.isArray(originalAssignees)) {
                        return !originalAssignees.includes(userId);
                    } else if (originalAssignees) {
                        return originalAssignees !== userId && originalAssignees !== '__ALL__';
                    }
                    return true; // If no original assignees, all are new
                });
                
                console.log('Newly assigned users:', newlyAssignedUsers);
                
                // Send notifications to newly assigned users
                newlyAssignedUsers.forEach(userId => {
                    if (userId !== currentUser.uid) {
                        const assignedUser = users.find(u => u.uid === userId);
                        if (assignedUser) {
                            addInboxItem({
                                id: `assign-${userId}-${editingTaskId}-${Date.now()}`,
                                recipientUid: userId,
                                type: 'assigned',
                                title: 'Task Assigned to You',
                                message: `${currentUser.email} assigned you: "${title}"`,
                                taskId: editingTaskId,
                                timestamp: new Date(),
                                read: false,
                                urgent: false
                            });
                            console.log('✅ Notification sent to newly assigned user:', assignedUser.email);
                        }
                    }
                });
            }
            
            showNotification('Task updated successfully!', 'success');
        } else {
            console.log('Attempting to create new task...');
            const newTask = await addDoc(collection(db, 'tasks'), {
                ...taskData,
                status: 'todo',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            console.log('Task created successfully with ID:', newTask.id);
            
            // Create inbox notification for assigned user(s)
            if (assignedTo) {
                // Handle array format (new) - multiple assigned users
                if (Array.isArray(assignedTo)) {
                    console.log('Sending notifications to assigned users:', assignedTo);
                    assignedTo.forEach(userId => {
                        // Don't notify the creator
                        if (userId !== currentUser.uid) {
                            const assignedUser = users.find(u => u.uid === userId);
                            if (assignedUser) {
                                addInboxItem({
                                    id: `assign-${userId}-${newTask.id}-${Date.now()}`,
                                    recipientUid: userId, // ← ADDED for Firestore
                                    type: 'assigned',
                                    title: 'New Task Assigned',
                                    message: `${currentUser.email} assigned you: "${title}"`,
                                    taskId: newTask.id,
                                    timestamp: new Date(),
                                    read: false,
                                    urgent: false
                                });
                                console.log('✅ Notification sent to:', assignedUser.email);
                            }
                        }
                    });
                }
                // Handle legacy string format
                else if (assignedTo === '__ALL__') {
                    // Notify all users except the creator
                    users.forEach(user => {
                        if (user.uid !== currentUser.uid) {
                            addInboxItem({
                                id: `assign-all-${user.uid}-${Date.now()}`,
                                recipientUid: user.uid, // ← ADDED
                                type: 'assigned',
                                title: 'New Task Assigned to All',
                                message: `${currentUser.email} assigned everyone: "${title}"`,
                                taskId: newTask.id,
                                timestamp: new Date(),
                                read: false,
                                urgent: false
                            });
                        }
                    });
                } else if (assignedTo !== currentUser.uid) {
                    // Notify specific user (legacy single string format)
                    const assignedUser = users.find(u => u.uid === assignedTo);
                    if (assignedUser) {
                        addInboxItem({
                            id: `assign-${Date.now()}`,
                            recipientUid: assignedUser.uid, // ← ADDED
                            type: 'assigned',
                            title: 'New Task Assigned',
                            message: `${currentUser.email} assigned you: "${title}"`,
                            taskId: newTask.id,
                            timestamp: new Date(),
                            read: false,
                            urgent: false
                        });
                    }
                }
            }
            
            showNotification('Task created successfully!', 'success');
        }
        closeTaskModal();
    } catch (error) {
        showNotification('Error saving task: ' + error.message, 'error');
        console.error('Task creation error:', error);
        alert('Task creation failed. Check console for details.\nError: ' + error.message);
    }
}

async function handleDeleteTask() {
    if (!editingTaskId) return;
    
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            await deleteDoc(doc(db, 'tasks', editingTaskId));
            showNotification('Task deleted successfully!', 'success');
            closeTaskModal();
        } catch (error) {
            showNotification('Error deleting task', 'error');
        }
    }
}

// Expose editTask globally for onclick handler
window.editTask = openTaskModal;

// ============================================
// Project Functions
// ============================================

function loadProjects() {
    if (!currentUser) return;

    const projectsRef = collection(db, 'projects');
    
    // ALL authenticated users can see all projects (clients)
    const q = query(projectsRef, orderBy('createdAt', 'desc'));

    unsubscribeProjects = onSnapshot(q, 
        (snapshot) => {
            console.log('Projects loaded:', snapshot.size);
            projects = [];
            snapshot.forEach((doc) => {
                projects.push({ id: doc.id, ...doc.data() });
            });
            renderProjects();
        },
        (error) => {
            console.error('Error loading projects:', error);
            alert('Error loading projects: ' + error.message);
        }
    );
}

function renderProjects() {
    const container = document.getElementById('projectsList');
    const select = document.getElementById('taskProject');
    
    container.innerHTML = '';
    select.innerHTML = '<option value="">No Project</option>';
    
    projects.forEach(project => {
        // Main project container
        const projectContainer = document.createElement('div');
        projectContainer.className = 'mb-1';
        
        // Sidebar project button container
        const projectDiv = document.createElement('div');
        projectDiv.className = 'group flex items-center justify-between w-full px-4 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition';
        
        // Expand/collapse button
        const expandBtn = document.createElement('button');
        expandBtn.className = 'flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition';
        expandBtn.innerHTML = '<i class="fas fa-chevron-right text-xs"></i>';
        expandBtn.dataset.projectId = project.id;
        
        // Project button (middle - clickable to view project details)
        const btn = document.createElement('button');
        btn.className = 'flex items-center flex-1 text-left mx-2';
        btn.innerHTML = `
            <i class="fas fa-circle text-xs mr-2" style="color: ${project.color}"></i>
            <span class="text-gray-700 dark:text-gray-300">${escapeHtml(project.name)}</span>
        `;
        btn.addEventListener('click', () => {
            console.log('Project clicked:', project.name, project.id);
            openProjectDetailView(project.id);
        });
        
        // Buttons container (right side - shows on hover)
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'opacity-0 group-hover:opacity-100 flex items-center space-x-1';
        
        // Add service button
        const addTaskBtn = document.createElement('button');
        addTaskBtn.className = 'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-purple-100 dark:hover:bg-gray-600 transition';
        addTaskBtn.innerHTML = '<i class="fas fa-plus text-xs text-purple-600 dark:text-purple-400"></i>';
        addTaskBtn.title = `Add service to ${project.name}`;
        addTaskBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTaskModalWithProject(project.id);
        });
        
        // Delete project button
        const deleteProjectBtn = document.createElement('button');
        deleteProjectBtn.className = 'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900 transition';
        deleteProjectBtn.innerHTML = '<i class="fas fa-trash text-xs text-red-600 dark:text-red-400"></i>';
        deleteProjectBtn.title = `Delete ${project.name}`;
        deleteProjectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProject(project.id, project.name);
        });
        
        buttonsContainer.appendChild(addTaskBtn);
        buttonsContainer.appendChild(deleteProjectBtn);
        
        projectDiv.appendChild(expandBtn);
        projectDiv.appendChild(btn);
        projectDiv.appendChild(buttonsContainer);
        
        // Services container (hidden by default)
        const servicesContainer = document.createElement('div');
        servicesContainer.className = 'hidden ml-4 mt-1 space-y-1';
        servicesContainer.dataset.projectId = project.id;
        
        // Render services for this project
        const projectServices = services.filter(s => s.projectId === project.id);
        if (projectServices.length > 0) {
            projectServices.forEach(service => {
                const serviceContainer = document.createElement('div');
                serviceContainer.className = 'group relative';
                
                const serviceBtn = document.createElement('button');
                serviceBtn.className = 'w-full flex items-center space-x-2 px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400 transition';
                serviceBtn.innerHTML = `
                    <i class="fas fa-layer-group text-xs"></i>
                    <span class="flex-1 text-left truncate">${escapeHtml(service.name)}</span>
                    <span class="text-xs text-gray-400">${getServiceTaskCount(service.id)}</span>
                `;
                serviceBtn.addEventListener('click', () => {
                    console.log('Service clicked from sidebar:', service.name);
                    openServiceBoard(service.id);
                });
                
                // Delete service button
                const deleteServiceBtn = document.createElement('button');
                deleteServiceBtn.className = 'absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900 transition z-10';
                deleteServiceBtn.innerHTML = '<i class="fas fa-trash text-xs text-red-600 dark:text-red-400"></i>';
                deleteServiceBtn.title = `Delete ${service.name}`;
                deleteServiceBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteService(service.id, service.name);
                });
                
                serviceContainer.appendChild(serviceBtn);
                serviceContainer.appendChild(deleteServiceBtn);
                servicesContainer.appendChild(serviceContainer);
            });
        } else {
            // Show "No services" message
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'px-4 py-2 text-xs text-gray-400 dark:text-gray-500 italic';
            emptyMsg.textContent = 'No services yet';
            servicesContainer.appendChild(emptyMsg);
        }
        
        // Toggle expand/collapse
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = !servicesContainer.classList.contains('hidden');
            
            if (isExpanded) {
                // Collapse
                servicesContainer.classList.add('hidden');
                expandBtn.querySelector('i').className = 'fas fa-chevron-right text-xs';
            } else {
                // Expand
                servicesContainer.classList.remove('hidden');
                expandBtn.querySelector('i').className = 'fas fa-chevron-down text-xs';
            }
        });
        
        projectContainer.appendChild(projectDiv);
        projectContainer.appendChild(servicesContainer);
        container.appendChild(projectContainer);
        
        // Select option
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.appendChild(option);
    });
}

function handleProjectChange(e) {
    const projectId = e.target.value;
    const serviceContainer = document.getElementById('serviceSelectContainer');
    const serviceSelect = document.getElementById('taskService');
    
    if (projectId) {
        // Show service dropdown and populate it
        populateServiceDropdown(projectId);
        serviceContainer.classList.remove('hidden');
    } else {
        // Hide service dropdown
        serviceContainer.classList.add('hidden');
        serviceSelect.innerHTML = '<option value="">No Service</option>';
    }
}

function populateServiceDropdown(projectId) {
    const serviceSelect = document.getElementById('taskService');
    serviceSelect.innerHTML = '<option value="">No Service</option>';
    
    // Filter services for selected project
    const projectServices = services.filter(s => s.projectId === projectId);
    
    projectServices.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = service.name;
        serviceSelect.appendChild(option);
    });
}

function openTaskModalWithProject(projectId) {
    // Navigate to project detail view instead
    openProjectDetailView(projectId);
}

async function deleteProject(projectId, projectName) {
    const confirmDelete = confirm(`Are you sure you want to delete "${projectName}"?\n\nThis will also delete all associated services and tasks. This action cannot be undone.`);
    
    if (!confirmDelete) return;
    
    try {
        // Delete the project
        const projectRef = doc(db, 'projects', projectId);
        await deleteDoc(projectRef);
        
        // Delete all services associated with this project
        const projectServices = services.filter(s => s.projectId === projectId);
        for (const service of projectServices) {
            const serviceRef = doc(db, 'services', service.id);
            await deleteDoc(serviceRef);
        }
        
        // Delete all tasks associated with this project
        const projectTasks = tasks.filter(t => t.projectId === projectId);
        for (const task of projectTasks) {
            const taskRef = doc(db, 'tasks', task.id);
            await deleteDoc(taskRef);
        }
        
        showNotification(`"${projectName}" deleted successfully`, 'success');
        
        // If we're viewing this project's detail, go back to home
        if (currentMainView === 'project-detail' && currentProjectId === projectId) {
            switchToView('home');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        showNotification('Error deleting project: ' + error.message, 'error');
    }
}

async function deleteService(serviceId, serviceName) {
    const confirmDelete = confirm(`Are you sure you want to delete "${serviceName}"?\n\nThis will also delete all tasks in this service. This action cannot be undone.`);
    
    if (!confirmDelete) return;
    
    try {
        // Delete the service
        const serviceRef = doc(db, 'services', serviceId);
        await deleteDoc(serviceRef);
        
        // Delete all tasks associated with this service
        const serviceTasks = tasks.filter(t => t.serviceId === serviceId);
        for (const task of serviceTasks) {
            const taskRef = doc(db, 'tasks', task.id);
            await deleteDoc(taskRef);
        }
        
        showNotification(`"${serviceName}" deleted successfully`, 'success');
        
        // If we're viewing this service board, go back to project detail
        if (currentMainView === 'service-board' && currentServiceId === serviceId) {
            backToProjectView();
        }
    } catch (error) {
        console.error('Error deleting service:', error);
        showNotification('Error deleting service: ' + error.message, 'error');
    }
}

function openProjectModal() {
    document.getElementById('projectModal').classList.add('active');
    document.getElementById('projectForm').reset();
    document.querySelector('.color-btn').click(); // Select first color
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('active');
}

async function handleProjectSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('projectName').value;
    const color = document.getElementById('projectColor').value;
    
    try {
        await addDoc(collection(db, 'projects'), {
            name,
            color,
            userId: currentUser.uid,
            createdAt: serverTimestamp()
        });
        showNotification('Project created successfully!', 'success');
        closeProjectModal();
    } catch (error) {
        showNotification('Error creating project', 'error');
    }
}

function getProjectName(projectId) {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown';
}

// ============================================
// Everything View Functions
// ============================================

function openEverythingView() {
    currentMainView = 'everything';
    
    // Hide all views
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('inboxView').classList.add('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('kanbanView').classList.add('hidden');
    document.getElementById('projectDetailView').classList.add('hidden');
    document.getElementById('serviceBoardView').classList.add('hidden');
    
    // Show everything view
    document.getElementById('everythingView').classList.remove('hidden');
    
    // Clear navigation highlights
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-purple-100', 'dark:bg-gray-700');
    });
    
    // Highlight Everything button
    document.getElementById('everythingBtn').classList.add('bg-purple-100', 'dark:bg-gray-700');
    
    // Populate filter dropdowns
    populateEverythingFilters();
    
    // Render tasks
    renderEverythingView();
}

function populateEverythingFilters() {
    // Populate project filter
    const projectSelect = document.getElementById('filterByProject');
    projectSelect.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
    });
    
    // Populate assignee filter
    const assigneeSelect = document.getElementById('filterByAssignee');
    assigneeSelect.innerHTML = '<option value="">All Assignees</option><option value="unassigned">Unassigned</option>';
    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.uid;
        option.textContent = user.displayName || user.email;
        assigneeSelect.appendChild(option);
    });
}

function applyEverythingFilters() {
    everythingFilters.project = document.getElementById('filterByProject').value;
    everythingFilters.client = document.getElementById('filterByClient').value.trim().toLowerCase();
    everythingFilters.assignee = document.getElementById('filterByAssignee').value;
    everythingFilters.status = document.getElementById('filterByStatus').value;
    
    renderEverythingView();
}

function clearEverythingFilters() {
    document.getElementById('filterByProject').value = '';
    document.getElementById('filterByClient').value = '';
    document.getElementById('filterByAssignee').value = '';
    document.getElementById('filterByStatus').value = '';
    
    everythingFilters = {
        project: '',
        client: '',
        assignee: '',
        status: ''
    };
    
    renderEverythingView();
}

function getFilteredEverythingTasks() {
    return tasks.filter(task => {
        // Filter by project
        if (everythingFilters.project && task.projectId !== everythingFilters.project) {
            return false;
        }
        
        // Filter by client (search in task description or custom field)
        if (everythingFilters.client) {
            const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
            if (!taskText.includes(everythingFilters.client)) {
                return false;
            }
        }
        
        // Filter by assignee
        if (everythingFilters.assignee) {
            if (everythingFilters.assignee === 'unassigned') {
                // Check if task has no assignees
                if (Array.isArray(task.assignedTo)) {
                    if (task.assignedTo.length > 0) return false;
                } else {
                    if (task.assignedTo) return false;
                }
            } else {
                // Check if the selected user is assigned to the task
                if (Array.isArray(task.assignedTo)) {
                    // New format: array of user IDs
                    if (!task.assignedTo.includes(everythingFilters.assignee)) {
                        return false;
                    }
                } else {
                    // Legacy format: single user ID or __ALL__
                    if (task.assignedTo !== everythingFilters.assignee && task.assignedTo !== '__ALL__') {
                        return false;
                    }
                }
            }
        }
        
        // Filter by status
        if (everythingFilters.status && task.status !== everythingFilters.status) {
            return false;
        }
        
        return true;
    });
}

function toggleEverythingView(viewType) {
    everythingViewType = viewType;
    
    const listBtn = document.getElementById('everythingListViewBtn');
    const boardBtn = document.getElementById('everythingBoardViewBtn');
    const listView = document.getElementById('everythingListView');
    const boardView = document.getElementById('everythingBoardView');
    
    if (viewType === 'list') {
        listBtn.classList.add('bg-purple-600', 'text-white');
        listBtn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        boardBtn.classList.remove('bg-purple-600', 'text-white');
        boardBtn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        listView.classList.remove('hidden');
        boardView.classList.add('hidden');
    } else {
        boardBtn.classList.add('bg-purple-600', 'text-white');
        boardBtn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        listBtn.classList.remove('bg-purple-600', 'text-white');
        listBtn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        boardView.classList.remove('hidden');
        listView.classList.add('hidden');
    }
    
    renderEverythingView();
}

function renderEverythingView() {
    console.log('=== renderEverythingView START ===');
    
    const filteredTasks = getFilteredEverythingTasks();
    console.log('Filtered tasks:', filteredTasks.length, 'of', tasks.length, 'total');
    
    // Update task count
    const countElement = document.getElementById('filteredTasksCount');
    if (countElement) countElement.textContent = filteredTasks.length;
    
    // Update sidebar badge count
    const everythingCountBadge = document.getElementById('everythingTaskCount');
    if (everythingCountBadge) {
        everythingCountBadge.textContent = tasks.length;
    }
    
    const listView = document.getElementById('everythingListView');
    const boardView = document.getElementById('everythingBoardView');
    const emptyState = document.getElementById('everythingEmptyState');
    
    if (filteredTasks.length === 0) {
        console.log('⚠️ No tasks to display in Everything view');
        if (listView) listView.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    console.log('Rendering in', everythingViewType, 'mode');
    
    if (everythingViewType === 'list') {
        renderEverythingListView(filteredTasks);
    } else {
        renderEverythingBoardView(filteredTasks);
    }
    
    console.log('=== renderEverythingView COMPLETE ===');
}

function renderEverythingListView(tasksList) {
    const container = document.getElementById('everythingListView');
    container.innerHTML = '';
    
    tasksList.forEach(task => {
        const taskElement = createTaskElement(task, 'list');
        container.appendChild(taskElement);
    });
}

function renderEverythingBoardView(tasksList) {
    const todoColumn = document.getElementById('everythingTodoColumn');
    const progressColumn = document.getElementById('everythingProgressColumn');
    const checkingColumn = document.getElementById('everythingCheckingColumn');
    const completedColumn = document.getElementById('everythingCompletedColumn');
    
    if (!todoColumn || !progressColumn || !checkingColumn || !completedColumn) {
        console.error('Everything board columns not found!');
        return;
    }
    
    todoColumn.innerHTML = '';
    progressColumn.innerHTML = '';
    checkingColumn.innerHTML = '';
    completedColumn.innerHTML = '';
    
    let todoCount = 0, progressCount = 0, checkingCount = 0, completedCount = 0;
    
    tasksList.forEach(task => {
        const taskElement = createTaskElement(task, 'kanban');
        
        if (task.status === 'completed') {
            completedColumn.appendChild(taskElement);
            completedCount++;
        } else if (task.status === 'clientChecking') {
            checkingColumn.appendChild(taskElement);
            checkingCount++;
        } else if (task.status === 'inProgress') {
            progressColumn.appendChild(taskElement);
            progressCount++;
        } else {
            todoColumn.appendChild(taskElement);
            todoCount++;
        }
    });
    
    // Update column counts
    document.getElementById('everythingTodoCount').textContent = todoCount;
    document.getElementById('everythingProgressCount').textContent = progressCount;
    document.getElementById('everythingCheckingCount').textContent = checkingCount;
    document.getElementById('everythingCompletedCount').textContent = completedCount;
    
    // Setup drag and drop
    setupDragAndDrop();
}

function getAssignedUserName(userId) {
    if (userId === '__ALL__') {
        return 'Everyone';
    }
    const user = users.find(u => u.uid === userId);
    return user ? (user.displayName || user.email) : 'Unknown User';
}

function getTaskOwnerName(userId) {
    const user = users.find(u => u.uid === userId);
    return user ? (user.displayName || user.email) : 'Unknown User';
}

function getTaskCreatorInfo(task) {
    const creator = users.find(u => u.uid === task.userId);
    const creatorName = creator ? (creator.displayName || creator.email) : 'Unknown';
    
    if (task.assignedTo) {
        const assignedUser = getAssignedUserName(task.assignedTo);
        return `${creatorName} → ${assignedUser}`;
    }
    
    return `Created by ${creatorName}`;
}

// ============================================
// Service Functions
// ============================================

function loadServices() {
    if (!currentUser) return;

    const servicesRef = collection(db, 'services');
    
    // ALL authenticated users can see all services
    const q = query(servicesRef, orderBy('createdAt', 'desc'));

    unsubscribeServices = onSnapshot(q, 
        (snapshot) => {
            console.log('Services loaded:', snapshot.size);
            services = [];
            snapshot.forEach((doc) => {
                services.push({ id: doc.id, ...doc.data() });
            });
            
            // Re-render projects to update nested services in sidebar
            renderProjects();
            
            // Update current view if needed
            if (currentMainView === 'project-detail') {
                renderServicesForProject(currentProjectId);
            } else if (currentMainView === 'service-board') {
                renderServiceBoard();
            }
        },
        (error) => {
            console.error('Error loading services:', error);
            alert('Error loading services: ' + error.message);
        }
    );
}

function openServiceModal() {
    document.getElementById('serviceModal').classList.add('active');
    document.getElementById('serviceForm').reset();
}

function closeServiceModal() {
    document.getElementById('serviceModal').classList.remove('active');
}

async function handleServiceSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('serviceName').value;
    const description = document.getElementById('serviceDescription').value;
    
    try {
        await addDoc(collection(db, 'services'), {
            name,
            description,
            projectId: currentProjectId,
            userId: currentUser.uid,
            createdAt: serverTimestamp()
        });
        showNotification('Service created successfully!', 'success');
        closeServiceModal();
    } catch (error) {
        showNotification('Error creating service', 'error');
        console.error(error);
    }
}

function openProjectDetailView(projectId) {
    console.log('openProjectDetailView called with projectId:', projectId);
    currentProjectId = projectId;
    currentMainView = 'project-detail';
    
    const project = projects.find(p => p.id === projectId);
    if (!project) {
        console.error('Project not found:', projectId);
        return;
    }
    
    console.log('Opening project:', project.name);
    
    // Hide all views
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('inboxView').classList.add('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('kanbanView').classList.add('hidden');
    document.getElementById('serviceBoardView').classList.add('hidden');
    
    // Show project detail view
    document.getElementById('projectDetailView').classList.remove('hidden');
    document.getElementById('projectDetailTitle').textContent = project.name;
    document.getElementById('projectDetailTitle').style.color = project.color;
    
    // Clear navigation highlights
    document.querySelectorAll('.nav-btn, .filter-btn').forEach(btn => {
        btn.classList.remove('bg-purple-100', 'dark:bg-gray-700');
    });
    
    console.log('Rendering services for project...');
    renderServicesForProject(projectId);
}

function renderServicesForProject(projectId) {
    console.log('renderServicesForProject called for projectId:', projectId);
    console.log('Total services available:', services.length);
    
    const projectServices = services.filter(s => s.projectId === projectId);
    console.log('Services for this project:', projectServices.length);
    
    const container = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('noServicesState');
    
    if (!container) {
        console.error('servicesGrid container not found!');
        return;
    }
    
    if (projectServices.length === 0) {
        console.log('No services found for this project');
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    console.log('Rendering', projectServices.length, 'services');
    if (emptyState) emptyState.classList.add('hidden');
    container.innerHTML = '';
    
    projectServices.forEach(service => {
        const card = document.createElement('div');
        card.className = 'group bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 hover:shadow-lg transition cursor-pointer border-2 border-transparent hover:border-purple-600 relative';
        card.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">${escapeHtml(service.name)}</h3>
                    ${service.description ? `<p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(service.description)}</p>` : '<p class="text-sm text-gray-400 dark:text-gray-500">No description</p>'}
                </div>
                <div class="flex items-center space-x-2">
                    <i class="fas fa-layer-group text-2xl text-purple-600 dark:text-purple-400"></i>
                    <button class="delete-service-btn opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900 transition" title="Delete service">
                        <i class="fas fa-trash text-sm text-red-600 dark:text-red-400"></i>
                    </button>
                </div>
            </div>
            <div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div class="flex items-center space-x-4 text-sm">
                    <span class="text-gray-600 dark:text-gray-400">
                        <i class="fas fa-tasks mr-1"></i>${getServiceTaskCount(service.id)} tasks
                    </span>
                </div>
                <button class="view-board-btn text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium">
                    View Board <i class="fas fa-arrow-right ml-1"></i>
                </button>
            </div>
        `;
        
        // View board button
        const viewBoardBtn = card.querySelector('.view-board-btn');
        viewBoardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Service card clicked:', service.name, service.id);
            openServiceBoard(service.id);
        });
        
        // Delete button
        const deleteBtn = card.querySelector('.delete-service-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteService(service.id, service.name);
        });
        
        // Card click (also opens service board)
        card.addEventListener('click', () => {
            console.log('Service card clicked:', service.name, service.id);
            openServiceBoard(service.id);
        });
        
        container.appendChild(card);
    });
    
    console.log('Finished rendering services');
}

function getServiceTaskCount(serviceId) {
    const count = tasks.filter(t => t.serviceId === serviceId).length;
    console.log('getServiceTaskCount for', serviceId, ':', count);
    return count;
}

function updateServiceTaskCounts() {
    // Update task counts for each service in the sidebar without full re-render
    services.forEach(service => {
        const serviceElements = document.querySelectorAll(`[data-service-id="${service.id}"] .task-count`);
        const count = getServiceTaskCount(service.id);
        serviceElements.forEach(el => {
            if (el) el.textContent = count;
        });
    });
}

function openServiceBoard(serviceId) {
    console.log('=== openServiceBoard called ===');
    console.log('Opening service board for serviceId:', serviceId);
    
    currentServiceId = serviceId;
    currentMainView = 'service-board';
    
    const service = services.find(s => s.id === serviceId);
    const project = projects.find(p => p.id === service.projectId);
    
    console.log('Service found:', service ? service.name : 'NOT FOUND');
    console.log('Project found:', project ? project.name : 'NOT FOUND');
    console.log('Total tasks available:', tasks.length);
    
    if (!service) {
        console.error('❌ Service not found with id:', serviceId);
        return;
    }
    
    // Hide all views
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('inboxView').classList.add('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('kanbanView').classList.add('hidden');
    document.getElementById('projectDetailView').classList.add('hidden');
    
    // Show service board view
    document.getElementById('serviceBoardView').classList.remove('hidden');
    document.getElementById('serviceBoardTitle').textContent = service.name;
    document.getElementById('serviceBoardProject').textContent = project ? project.name : 'Unknown Project';
    
    renderServiceBoard();
}

function renderServiceBoard() {
    console.log('=== renderServiceBoard START ===');
    console.log('State:', {
        currentMainView,
        currentServiceId,
        totalTasksInMemory: tasks.length
    });
    
    if (currentMainView !== 'service-board' || !currentServiceId) {
        console.log('⚠️ Exiting - not in service-board view');
        return;
    }
    
    // Filter tasks for this service
    const serviceTasks = tasks.filter(t => {
        const matches = t.serviceId === currentServiceId;
        if (matches) {
            console.log('✅ Task matched:', {
                title: t.title,
                serviceId: t.serviceId,
                status: t.status
            });
        }
        return matches;
    });
    
    console.log(`Found ${serviceTasks.length} tasks for serviceId: ${currentServiceId}`);
    
    if (serviceTasks.length === 0) {
        console.error('❌ NO TASKS FOUND');
        console.log('Debug Info:', {
            currentServiceId,
            allServiceIds: [...new Set(tasks.map(t => t.serviceId).filter(Boolean))],
            sampleTasks: tasks.slice(0, 3).map(t => ({
                title: t.title,
                serviceId: t.serviceId,
                projectId: t.projectId
            }))
        });
    }
    
    // Get column elements
    const columns = {
        todo: document.getElementById('serviceTodoColumn'),
        progress: document.getElementById('serviceProgressColumn'),
        checking: document.getElementById('serviceCheckingColumn'),
        completed: document.getElementById('serviceCompletedColumn')
    };
    
    // Verify columns exist
    const missingColumns = Object.entries(columns)
        .filter(([key, el]) => !el)
        .map(([key]) => key);
    
    if (missingColumns.length > 0) {
        console.error('❌ Missing columns:', missingColumns);
        return;
    }
    
    // Clear all columns
    Object.values(columns).forEach(col => col.innerHTML = '');
    
    const counts = { todo: 0, progress: 0, checking: 0, completed: 0 };
    
    // Distribute tasks to columns
    serviceTasks.forEach(task => {
        const taskElement = createTaskElement(task, 'kanban');
        
        // Normalize status and place in correct column
        const status = task.status || 'todo';
        
        switch (status) {
            case 'todo':
            case 'toAssign':
                columns.todo.appendChild(taskElement);
                counts.todo++;
                break;
            case 'inProgress':
                columns.progress.appendChild(taskElement);
                counts.progress++;
                break;
            case 'clientChecking':
                columns.checking.appendChild(taskElement);
                counts.checking++;
                break;
            case 'completed':
                columns.completed.appendChild(taskElement);
                counts.completed++;
                break;
            default:
                console.warn('Unknown status:', status, 'for task:', task.title);
                columns.todo.appendChild(taskElement);
                counts.todo++;
        }
    });
    
    console.log('✅ Distribution:', counts);
    
    // Update count badges
    document.getElementById('serviceTodoCount').textContent = counts.todo;
    document.getElementById('serviceProgressCount').textContent = counts.progress;
    document.getElementById('serviceCheckingCount').textContent = counts.checking;
    document.getElementById('serviceCompletedCount').textContent = counts.completed;
    
    // Setup drag and drop
    setupDragAndDrop();
    
    console.log('=== renderServiceBoard COMPLETE ===');
}

function backToProjectView() {
    if (currentProjectId) {
        openProjectDetailView(currentProjectId);
    }
}

function openTaskModalForService() {
    openTaskModal();
    // The task will be assigned to current service
}

// ============================================
// View Functions
// ============================================

function switchView(view) {
    console.log('=== switchView ===', view);
    currentView = view;
    currentMainView = view;
    
    // Hide home view when switching to list/kanban
    document.getElementById('homeView').classList.add('hidden');
    
    // Toggle view visibility
    if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('kanbanView').classList.add('hidden');
    } else if (view === 'kanban') {
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('kanbanView').classList.remove('hidden');
    }
    
    console.log('✅ View switched to:', currentView);
    
    // Remove home button highlight
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        homeBtn.classList.remove('bg-purple-100', 'dark:bg-gray-700');
    }
    
    renderTasks();
}

// ============================================
// Drag and Drop Functions
// ============================================

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function setupDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-column');
    
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
    });
}

function handleDragOver(e) {
    e.preventDefault();
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedElement) return;
    
    const column = e.target.closest('.kanban-column');
    if (!column) return;
    
    const newStatus = column.dataset.status;
    const taskId = draggedElement.dataset.taskId;
    
    console.log('Dropping task', taskId, 'to status:', newStatus);
    console.log('Current view before drop:', currentView, 'Main view:', currentMainView);
    
    // Find the task in local array and update it immediately (optimistic update)
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
        tasks[taskIndex].status = newStatus;
        console.log('Updated task locally:', tasks[taskIndex].title, 'to', newStatus);
        
        // Re-render immediately based on current view
        if (currentMainView === 'service-board') {
            console.log('Re-rendering service board after drop');
            renderServiceBoard();
        } else if (currentMainView === 'kanban') {
            console.log('Re-rendering kanban view after drop');
            renderKanbanView(filterTasks());
        }
    }
    
    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { status: newStatus });
        showNotification('Task moved successfully!', 'success');
        console.log('Drop successful and saved to Firestore');
    } catch (error) {
        showNotification('Error updating task', 'error');
        console.error('Drop error:', error);
        // Revert optimistic update on error
        if (taskIndex !== -1) {
            // The real-time listener will restore the correct state
            console.log('Error occurred, waiting for Firestore to restore state');
        }
    }
    
    draggedElement = null;
}

// ============================================
// Dark Mode Functions
// ============================================

// Dark mode functions removed - not used

// ============================================
// Utility Functions
// ============================================

function formatDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    
    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString();
}

function getPriorityBadgeClass(priority) {
    const classes = {
        high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
        medium: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
        low: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    };
    return classes[priority] || classes.low;
}

function getStatusBadgeClass(status) {
    const classes = {
        todo: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        inProgress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
        clientChecking: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
        completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    };
    return classes[status] || classes.todo;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg fade-in ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    } text-white`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// Notification Functions
// ============================================

function addNotification(notification) {
    notifications.unshift(notification);
    updateNotificationBadge();
    renderNotifications();
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('hidden');
    
    if (!panel.classList.contains('hidden')) {
        // Mark all as read when opening
        notifications.forEach(n => n.read = true);
        updateNotificationBadge();
        renderNotifications();
    }
}

function clearAllNotifications() {
    notifications = [];
    updateNotificationBadge();
    renderNotifications();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const emptyState = document.getElementById('emptyNotifications');
    
    if (notifications.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = '';
    
    notifications.forEach(notification => {
        const div = document.createElement('div');
        div.className = 'border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition';
        div.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    <i class="fas fa-bell text-purple-600 dark:text-purple-400"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800 dark:text-white">${notification.title}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${notification.message}</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">${getTimeAgo(notification.timestamp)}</p>
                </div>
            </div>
        `;
        
        if (notification.taskId) {
            div.addEventListener('click', () => {
                openTaskModal(notification.taskId);
                document.getElementById('notificationPanel').classList.add('hidden');
            });
        }
        
        container.appendChild(div);
    });
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// ============================================
// Home Dashboard Functions
// ============================================

function updateHomeDashboard() {
    if (currentMainView !== 'home') return;
    
    // Update statistics
    const totalTasks = tasks.length;
    const inProgressTasks = tasks.filter(t => t.status === 'inProgress').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        return new Date(t.dueDate) < new Date();
    }).length;
    
    document.getElementById('statTotal').textContent = totalTasks;
    document.getElementById('statInProgress').textContent = inProgressTasks;
    document.getElementById('statCompleted').textContent = completedTasks;
    document.getElementById('statOverdue').textContent = overdueTasks;
    
    // Update completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    document.getElementById('progressBar').style.width = `${completionRate}%`;
    
    // Render my work section
    renderMyWork();
    
    // Render assigned to me section
    renderAssignedToMe();
}

function switchWorkMainTab(tab) {
    currentWorkTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.work-main-tab').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        btn.classList.add('border-transparent', 'text-gray-600', 'dark:text-gray-400');
    });
    
    if (tab === 'todo') {
        document.getElementById('todoMainTab').classList.add('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        document.getElementById('todoMainTab').classList.remove('border-transparent', 'text-gray-600', 'dark:text-gray-400');
        document.getElementById('todoMainContent').classList.remove('hidden');
        document.getElementById('doneMainContent').classList.add('hidden');
    } else {
        document.getElementById('doneMainTab').classList.add('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        document.getElementById('doneMainTab').classList.remove('border-transparent', 'text-gray-600', 'dark:text-gray-400');
        document.getElementById('todoMainContent').classList.add('hidden');
        document.getElementById('doneMainContent').classList.remove('hidden');
    }
    
    renderMyWork();
}

function switchWorkSubFilter(filter) {
    currentWorkSubFilter = filter;
    
    // Update sub-tab buttons
    document.querySelectorAll('.work-sub-tab').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300', 'font-medium');
        btn.classList.add('text-gray-600', 'dark:text-gray-400');
    });
    
    const activeBtn = document.querySelector(`.work-sub-tab[data-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300', 'font-medium');
        activeBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
    }
    
    renderMyWork();
}

function renderMyWork() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filteredTasks = [];
    
    if (currentWorkTab === 'todo') {
        // Filter incomplete tasks
        const incompleteTasks = tasks.filter(task => task.status !== 'completed');
        
        switch (currentWorkSubFilter) {
            case 'today':
                filteredTasks = incompleteTasks.filter(task => {
                    if (!task.dueDate) return false;
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate.getTime() === today.getTime();
                });
                break;
            case 'overdue':
                filteredTasks = incompleteTasks.filter(task => {
                    if (!task.dueDate) return false;
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate < today;
                });
                break;
            case 'next':
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                filteredTasks = incompleteTasks.filter(task => {
                    if (!task.dueDate) return false;
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate >= tomorrow;
                });
                break;
            case 'unscheduled':
                filteredTasks = incompleteTasks.filter(task => !task.dueDate);
                break;
        }
        
        const container = document.getElementById('myWorkList');
        const emptyState = document.getElementById('noMyWorkTasks');
        const countElement = document.getElementById('myWorkCount');
        
        countElement.textContent = filteredTasks.length;
        
        if (filteredTasks.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        container.innerHTML = '';
        
        filteredTasks.forEach(task => {
            const div = createMiniTaskCard(task);
            container.appendChild(div);
        });
    } else {
        // Done tab - show completed tasks
        const completedTasks = tasks.filter(task => task.status === 'completed');
        
        const container = document.getElementById('doneTasksList');
        const emptyState = document.getElementById('noDoneTasks');
        const countElement = document.getElementById('myWorkCount');
        
        countElement.textContent = completedTasks.length;
        
        if (completedTasks.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        container.innerHTML = '';
        
        completedTasks.forEach(task => {
            const div = createMiniTaskCard(task);
            container.appendChild(div);
        });
    }
}

function renderAssignedToMe() {
    // Show tasks that are:
    // 1. Specifically assigned to current user
    // 2. Assigned to everyone (__ALL__)
    // 3. Incomplete
    const assignedTasks = tasks.filter(task => {
        if (task.status === 'completed') return false;
        
        if (!task.assignedTo) return false;
        
        // Handle new format (array)
        if (Array.isArray(task.assignedTo)) {
            return task.assignedTo.includes(currentUser.uid);
        }
        
        // Handle legacy format (string)
        return task.assignedTo === currentUser.uid || task.assignedTo === '__ALL__';
    });
    
    const container = document.getElementById('assignedToMeList');
    const emptyState = document.getElementById('noAssignedTasks');
    const countElement = document.getElementById('assignedToMeCount');
    
    countElement.textContent = assignedTasks.length;
    
    if (assignedTasks.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    container.innerHTML = '';
    
    assignedTasks.slice(0, 10).forEach(task => {
        const div = createMiniTaskCard(task, 'purple');
        container.appendChild(div);
    });
}

function createMiniTaskCard(task, colorTheme = 'gray') {
    const div = document.createElement('div');
    const bgColors = {
        gray: 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600',
        purple: 'bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 hover:bg-purple-100 dark:hover:bg-purple-900 dark:hover:bg-opacity-30',
        red: 'bg-red-50 dark:bg-red-900 dark:bg-opacity-20 hover:bg-red-100 dark:hover:bg-red-900 dark:hover:bg-opacity-30'
    };
    
    div.className = `flex items-center space-x-3 p-3 ${bgColors[colorTheme]} rounded-lg cursor-pointer transition`;
    
    const priorityColors = {
        high: 'text-red-600',
        medium: 'text-orange-600',
        low: 'text-green-600'
    };
    
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
    const assignedToText = task.assignedTo ? getAssignedUserName(task.assignedTo) : '';
    const isAssignedToAll = task.assignedTo === '__ALL__';
    const assignedBadgeClass = isAssignedToAll 
        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
        : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
    const assignedIcon = isAssignedToAll ? 'fa-users' : 'fa-user';
    
    div.innerHTML = `
        <button class="task-mini-checkbox w-5 h-5 rounded border-2 ${task.status === 'completed' ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-gray-500'} flex items-center justify-center hover:border-purple-600 transition">
            ${task.status === 'completed' ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
        </button>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 dark:text-white truncate ${task.status === 'completed' ? 'line-through opacity-60' : ''}">${escapeHtml(task.title)}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="text-xs ${priorityColors[task.priority]} font-medium capitalize">${task.priority}</span>
                ${task.dueDate ? `<span class="text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}">${formatDate(new Date(task.dueDate))}</span>` : '<span class="text-xs text-gray-400">No due date</span>'}
                ${assignedToText ? `<span class="text-xs px-2 py-0.5 ${assignedBadgeClass} rounded-full"><i class="fas ${assignedIcon} mr-1"></i>${assignedToText}</span>` : ''}
            </div>
        </div>
    `;
    
    div.querySelector('.task-mini-checkbox').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskComplete(task.id);
    });
    
    div.addEventListener('click', () => openTaskModal(task.id));
    return div;
}

function switchToView(view) {
    console.log('switchToView called with:', view, 'from:', currentMainView);
    currentMainView = view;
    
    // Hide all views
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('inboxView').classList.add('hidden');
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('kanbanView').classList.add('hidden');
    document.getElementById('everythingView').classList.add('hidden');
    document.getElementById('projectDetailView').classList.add('hidden');
    document.getElementById('serviceBoardView').classList.add('hidden');
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn, .filter-btn').forEach(btn => {
        btn.classList.remove('bg-purple-100', 'dark:bg-gray-700');
    });
    
    // Reset current project and service when navigating away
    if (view !== 'project-detail' && view !== 'service-board') {
        currentProjectId = null;
        currentServiceId = null;
    }
    
    // Show selected view
    if (view === 'home') {
        document.getElementById('homeView').classList.remove('hidden');
        document.getElementById('homeBtn').classList.add('bg-purple-100', 'dark:bg-gray-700');
        currentView = 'home';
        updateHomeDashboard();
    } else if (view === 'inbox') {
        document.getElementById('inboxView').classList.remove('hidden');
        document.getElementById('inboxBtn').classList.add('bg-purple-100', 'dark:bg-gray-700');
        currentView = 'inbox';
        renderInbox();
    } else if (view === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        currentView = 'list';
        renderTasks();
    } else if (view === 'kanban') {
        document.getElementById('kanbanView').classList.remove('hidden');
        currentView = 'kanban';
        renderTasks();
    }
    
    console.log('View switched. currentView:', currentView, 'currentMainView:', currentMainView);
}

// ============================================
// Inbox Functions
// ============================================

function checkAndGenerateInboxNotifications() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(23, 59, 59, 999);
    
    tasks.forEach(task => {
        if (task.status === 'completed' || !task.dueDate) return;
        
        const dueDate = new Date(task.dueDate);
        const taskInboxId = `deadline-${task.id}`;
        
        // Check if notification already exists
        const existingNotification = inboxItems.find(item => item.id === taskInboxId);
        
        // Create deadline notifications for tasks due within 48 hours
        if (dueDate <= twoDaysFromNow && dueDate >= now) {
            const timeLeft = formatTimeLeft(dueDate);
            const urgency = dueDate <= tomorrow ? 'urgent' : 'warning';
            
            if (!existingNotification) {
                addInboxItem({
                    id: taskInboxId,
                    type: 'deadline',
                    urgency: urgency,
                    title: urgency === 'urgent' ? '⚠️ Urgent Deadline' : '⏰ Upcoming Deadline',
                    message: `"${task.title}" is due ${timeLeft}`,
                    taskId: task.id,
                    timestamp: new Date(),
                    read: false
                });
            }
        } else if (existingNotification && dueDate > twoDaysFromNow) {
            // Remove notification if deadline is no longer within 48 hours
            removeInboxItem(taskInboxId);
        }
    });
    
    updateInboxBadge();
}

function formatTimeLeft(dueDate) {
    const now = new Date();
    const diff = dueDate - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'in less than an hour';
    if (hours < 24) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
}

async function addInboxItem(item) {
    // Don't add duplicates locally
    if (inboxItems.find(i => i.id === item.id)) return;
    
    inboxItems.unshift(item);
    updateInboxBadge();
    
    // Save notification to Firestore for the recipient
    try {
        if (item.recipientUid) {
            await addDoc(collection(db, 'notifications'), {
                recipientUid: item.recipientUid,
                type: item.type,
                title: item.title,
                message: item.message,
                taskId: item.taskId,
                timestamp: serverTimestamp(),
                read: false,
                urgent: item.urgent || false
            });
            console.log('✅ Notification saved to Firestore for user:', item.recipientUid);
        }
    } catch (error) {
        console.error('Error saving notification to Firestore:', error);
    }
    
    // Add to notification panel as well
    addNotification({
        id: Date.now().toString(),
        title: item.title,
        message: item.message,
        taskId: item.taskId,
        timestamp: item.timestamp,
        read: false
    });
}

function removeInboxItem(itemId) {
    inboxItems = inboxItems.filter(item => item.id !== itemId);
    updateInboxBadge();
}

function switchInboxFilter(filter) {
    currentInboxFilter = filter;
    
    // Update tab buttons
    document.querySelectorAll('.inbox-tab').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        btn.classList.add('border-transparent', 'text-gray-600', 'dark:text-gray-400');
        
        // Update badge colors
        const badge = btn.querySelector('span:last-child');
        if (badge) {
            badge.classList.remove('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300');
            badge.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        }
    });
    
    const activeBtn = document.querySelector(`.inbox-tab[data-inbox-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.add('border-blue-600', 'text-blue-600', 'dark:text-blue-400');
        activeBtn.classList.remove('border-transparent', 'text-gray-600', 'dark:text-gray-400');
        
        const badge = activeBtn.querySelector('span:last-child');
        if (badge) {
            badge.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
            badge.classList.add('bg-blue-100', 'dark:bg-blue-900', 'text-blue-700', 'dark:text-blue-300');
        }
    }
    
    renderInbox();
}

function markAllInboxRead() {
    inboxItems.forEach(item => item.read = true);
    updateInboxBadge();
    renderInbox();
}

function renderInbox() {
    console.log('=== Rendering Inbox ===');
    console.log('Current filter:', currentInboxFilter);
    console.log('Total inbox notifications:', inboxItems.length);
    
    const container = document.getElementById('inboxItemsList');
    const emptyState = document.getElementById('emptyInbox');
    
    if (!container) {
        console.error('❌ Inbox container not found!');
        return;
    }
    
    // Get tasks assigned to current user
    const assignedTasks = tasks.filter(task => {
        if (!task.assignedTo) return false;
        
        // Handle array format
        if (Array.isArray(task.assignedTo)) {
            return task.assignedTo.includes(currentUser.uid);
        }
        
        // Handle legacy format
        return task.assignedTo === currentUser.uid || task.assignedTo === '__ALL__';
    });
    
    console.log('Tasks assigned to me:', assignedTasks.length);
    
    // Combine notifications and assigned tasks
    let displayItems = [];
    
    if (currentInboxFilter === 'all' || currentInboxFilter === 'assigned') {
        // Add assigned tasks as inbox items
        assignedTasks.forEach(task => {
            displayItems.push({
                id: `task-${task.id}`,
                type: 'task',
                taskType: 'assigned',
                title: '📋 ' + task.title,
                message: `Status: ${task.status || 'todo'} | Due: ${task.dueDate ? formatDate(new Date(task.dueDate)) : 'No due date'}`,
                taskId: task.id,
                task: task,
                timestamp: task.createdAt || new Date(),
                read: task.status === 'completed'
            });
        });
    }
    
    // Add notifications
    let filteredNotifications = [...inboxItems];
    if (currentInboxFilter !== 'all') {
        filteredNotifications = filteredNotifications.filter(item => {
            switch (currentInboxFilter) {
                case 'deadlines':
                    return item.type === 'deadline';
                case 'assigned':
                    return item.type === 'assigned';
                case 'unread':
                    return !item.read;
                default:
                    return true;
            }
        });
    }
    
    displayItems = [...displayItems, ...filteredNotifications];
    
    // Sort by timestamp (newest first)
    displayItems.sort((a, b) => {
        const aTime = a.timestamp?.seconds || a.timestamp?.getTime() / 1000 || 0;
        const bTime = b.timestamp?.seconds || b.timestamp?.getTime() / 1000 || 0;
        return bTime - aTime;
    });
    
    // Update counts
    const totalNotifications = inboxItems.length + assignedTasks.length;
    document.getElementById('inboxAllCount').textContent = totalNotifications;
    document.getElementById('inboxDeadlinesCount').textContent = inboxItems.filter(i => i.type === 'deadline').length;
    document.getElementById('inboxAssignedCount').textContent = assignedTasks.length + inboxItems.filter(i => i.type === 'assigned').length;
    document.getElementById('inboxUnreadCount').textContent = inboxItems.filter(i => !i.read).length + assignedTasks.filter(t => t.status !== 'completed').length;
    
    console.log('📋 Displaying', displayItems.length, 'items in inbox');
    
    if (displayItems.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    container.innerHTML = '';
    
    displayItems.forEach(item => {
        const div = item.type === 'task' 
            ? createInboxTaskCard(item)
            : createInboxItemCard(item);
        container.appendChild(div);
    });
    
    console.log('✅ Inbox rendered');
}

function createInboxTaskCard(item) {
    const div = document.createElement('div');
    const task = item.task;
    
    const statusColors = {
        todo: 'border-l-4 border-gray-400 bg-gray-50 dark:bg-gray-800',
        inProgress: 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20',
        clientChecking: 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900 dark:bg-opacity-20',
        completed: 'border-l-4 border-green-500 bg-green-50 dark:bg-green-900 dark:bg-opacity-20'
    };
    
    const statusIcons = {
        todo: 'fa-circle',
        inProgress: 'fa-spinner',
        clientChecking: 'fa-eye',
        completed: 'fa-check-circle'
    };
    
    const status = task.status || 'todo';
    const isCompleted = status === 'completed';
    
    div.className = `${statusColors[status]} rounded-lg p-4 cursor-pointer hover:shadow-md transition`;
    
    div.innerHTML = `
        <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <i class="fas ${statusIcons[status]} text-purple-600 dark:text-purple-400"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 mb-1">
                    <span class="inline-block px-2 py-1 text-xs font-semibold rounded ${isCompleted ? 'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200'}">
                        ASSIGNED TASK
                    </span>
                    ${!isCompleted ? '<div class="w-2 h-2 bg-purple-600 rounded-full"></div>' : ''}
                </div>
                <h3 class="text-sm font-semibold text-gray-800 dark:text-white mb-1 ${isCompleted ? 'line-through opacity-60' : ''}">${escapeHtml(task.title)}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${item.message}</p>
                <div class="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                    <span><i class="fas fa-folder mr-1"></i>${task.projectId ? getProjectName(task.projectId) : 'No project'}</span>
                    ${task.priority ? `<span class="px-2 py-0.5 rounded ${getPriorityBadgeClass(task.priority)}">${task.priority}</span>` : ''}
                </div>
            </div>
        </div>
    `;
    
    div.addEventListener('click', () => {
        openTaskModal(task.id);
    });
    
    return div;
}

function createInboxItemCard(item) {
    const div = document.createElement('div');
    
    const urgencyColors = {
        urgent: 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900 dark:bg-opacity-20',
        warning: 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900 dark:bg-opacity-20',
        info: 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20',
        normal: 'border-l-4 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
    };
    
    const iconColors = {
        deadline: 'text-red-600',
        assigned: 'text-purple-600',
        info: 'text-blue-600'
    };
    
    const iconTypes = {
        deadline: 'fa-clock',
        assigned: 'fa-user-plus',
        info: 'fa-info-circle'
    };
    
    const urgency = item.urgency || 'normal';
    const unreadIndicator = item.read ? '' : '<div class="w-2 h-2 bg-blue-600 rounded-full"></div>';
    
    div.className = `${urgencyColors[urgency]} rounded-lg p-4 cursor-pointer hover:shadow-md transition ${!item.read ? 'font-semibold' : ''}`;
    
    div.innerHTML = `
        <div class="flex items-start space-x-3">
            <div class="flex-shrink-0 w-10 h-10 ${item.read ? 'bg-gray-200 dark:bg-gray-600' : 'bg-blue-100 dark:bg-blue-900'} rounded-full flex items-center justify-center">
                <i class="fas ${iconTypes[item.type]} ${iconColors[item.type]}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 mb-1">
                    ${unreadIndicator}
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-white">${item.title}</h3>
                </div>
                <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">${item.message}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${getTimeAgo(item.timestamp)}</p>
            </div>
            <button class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 inbox-item-dismiss" data-item-id="${item.id}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.inbox-item-dismiss')) {
            item.read = true;
            updateInboxBadge();
            if (item.taskId) {
                openTaskModal(item.taskId);
            }
            renderInbox();
        }
    });
    
    const dismissBtn = div.querySelector('.inbox-item-dismiss');
    dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeInboxItem(item.id);
        renderInbox();
    });
    
    return div;
}

function updateInboxBadge() {
    const badge = document.getElementById('inboxBadge');
    
    if (!badge) return;
    
    // Count unread notifications
    const unreadNotifications = inboxItems.filter(item => !item.read).length;
    
    // Count incomplete assigned tasks
    const incompleteAssignedTasks = tasks.filter(task => {
        if (task.status === 'completed') return false;
        if (!task.assignedTo) return false;
        
        // Handle array format
        if (Array.isArray(task.assignedTo)) {
            return task.assignedTo.includes(currentUser.uid);
        }
        
        // Handle legacy format
        return task.assignedTo === currentUser.uid || task.assignedTo === '__ALL__';
    }).length;
    
    // Total count = notifications + assigned tasks
    const totalCount = unreadNotifications + incompleteAssignedTasks;
    
    console.log('📬 Inbox badge update:', {
        unreadNotifications,
        incompleteAssignedTasks,
        totalCount
    });
    
    if (totalCount > 0) {
        badge.textContent = totalCount > 99 ? '99+' : totalCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

