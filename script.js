// --- Global Variables ---
let auth;
let db;
let serverTimestamp;
let currentUserId = null; 

// Storage for imported Firebase Modular Functions
let authFns = {};
let dbFns = {};

// --- UI Element Selectors ---
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const dashboardContainer = document.getElementById('dashboard-container');


// --- MAIN SETUP FUNCTION ---
// Function signature updated to receive the function bundles
export function setupApp(authService, dbService, timestampService, authFunctions, dbFunctions) {
    // 1. Assign imported Firebase services and functions
    auth = authService;
    db = dbService;
    serverTimestamp = timestampService;
    
    // Store the modular functions for internal use
    authFns = authFunctions;
    dbFns = dbFunctions;

    // 2. Initial UI State Safety Check
    if (loginContainer && dashboardContainer && signupContainer) {
        loginContainer.classList.remove('hidden'); 
        dashboardContainer.classList.add('hidden');
        signupContainer.classList.add('hidden');
    }
    
    // 3. Attach all event listeners
    setupEventListeners();
    
    // 4. Start listening for authentication changes
    setupAuthStateObserver(); // This will now use authFns.onAuthStateChanged
}

// ... (setupEventListeners remains the same) ...


// --- AUTHENTICATION HANDLERS (Using authFns) ---

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await authFns.signInWithEmailAndPassword(auth, email, password); 
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    try {
        const userCredential = await authFns.createUserWithEmailAndPassword(auth, email, password);
        // Use dbFns.doc and dbFns.setDoc for Firestore operation
        await dbFns.setDoc(dbFns.doc(db, 'users', userCredential.user.uid), {
            email: email,
            createdAt: serverTimestamp,
            role: 'salesperson' 
        });
    } catch (error) {
        alert("Signup failed: " + error.message);
    }
}

function handleLogout() {
    authFns.signOut(auth);
}

function setupAuthStateObserver() {
    // FIX: Calling the function via the stored object 'authFns'
    authFns.onAuthStateChanged(auth, user => { 
        if (user) {
            currentUserId = user.uid;
            loginContainer?.classList.add('hidden');
            signupContainer?.classList.add('hidden');
            dashboardContainer?.classList.remove('hidden');
            
            loadDeals();
            loadStickyNote();
        } else {
            currentUserId = null;
            dashboardContainer?.classList.add('hidden');
            loginContainer?.classList.remove('hidden');
        }
    });
}


// --- FIRESTORE DATA LOGIC (Using dbFns) ---

// ... (createDealCard remains the same) ...

/** Fetches deals from Firestore and populates the Kanban board. */
function loadDeals() {
    document.querySelectorAll('.deal-list').forEach(list => list.innerHTML = '');

    // Define the Firestore query using dbFns
    const dealsQuery = dbFns.query(
        dbFns.collection(db, 'deals'),
        dbFns.where('salespersonId', '==', currentUserId)
    );

    // Real-time listener using dbFns
    dbFns.onSnapshot(dealsQuery, (snapshot) => {
        // ... (rest of the snapshot logic remains the same, using dbFns.doc/dbFns.setDoc/etc. where needed) ...
        snapshot.docChanges().forEach(change => {
            const deal = { id: change.doc.id, ...change.doc.data() };
            const columnElement = document.querySelector(`.deal-list[data-status="${deal.status}"]`);

            if (change.type === 'added') {
                if (columnElement) {
                     columnElement.appendChild(createDealCard(deal));
                }
            } else if (change.type === 'removed') {
                document.querySelector(`[data-deal-id="${deal.id}"]`)?.remove();
            } else if (change.type === 'modified') {
                const existingCard = document.querySelector(`[data-deal-id="${deal.id}"]`);
                if (existingCard) {
                    existingCard.remove();
                }
                if (columnElement) {
                    columnElement.appendChild(createDealCard(deal));
                }
            }
        });
    }, error => {
        console.error("Error loading deals: ", error);
    });
}

// --- STICKY NOTE LOGIC ---

/** Loads and displays the user's sticky note. */
async function loadStickyNote() {
    const noteRef = dbFns.doc(db, 'stickynotes', currentUserId);
    const docSnap = await dbFns.getDoc(noteRef);
    if (docSnap.exists()) {
        document.getElementById('sticky-note-input').value = docSnap.data().content || '';
    } else {
         document.getElementById('sticky-note-input').value = '';
    }
}

/** Saves the sticky note content to Firestore. */
async function saveStickyNote() {
    const content = document.getElementById('sticky-note-input').value;
    try {
        await dbFns.setDoc(dbFns.doc(db, 'stickynotes', currentUserId), {
            userId: currentUserId,
            content: content,
            updatedAt: serverTimestamp()
        }, { merge: true });
        alert("Note saved successfully!");
    } catch (error) {
        alert("Error saving note: " + error.message);
    }
}
