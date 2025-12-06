// --- Global Variables (will be set by setupApp) ---
let auth;
let db;
let serverTimestamp;
let currentUserId = null; 

// --- UI Element Selectors ---
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const dashboardContainer = document.getElementById('dashboard-container');


// --- MAIN SETUP FUNCTION ---
export function setupApp(authService, dbService, timestampService) {
    // Assign imported services to local variables
    auth = authService;
    db = dbService;
    serverTimestamp = timestampService;

    // Attach all event listeners
    setupEventListeners();
    // Start listening for authentication changes
    setupAuthStateObserver();
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Toggle between Login and Signup forms
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        loginContainer.classList.add('hidden');
        signupContainer.classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        signupContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });

    // Handle Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);

    // Handle Signup
    document.getElementById('signup-btn').addEventListener('click', handleSignup);

    // Handle Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Handle Sticky Note Save
    document.getElementById('save-note-btn').addEventListener('click', saveStickyNote);
}


// --- AUTHENTICATION HANDLERS (Using modular imports) ---

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create a user document in Firestore upon signup
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: email,
            createdAt: serverTimestamp(),
            role: 'salesperson' 
        });
    } catch (error) {
        alert("Signup failed: " + error.message);
    }
}

function handleLogout() {
    signOut(auth);
}

function setupAuthStateObserver() {
    onAuthStateChanged(auth, user => {
        if (user) {
            // User is logged in
            currentUserId = user.uid;
            loginContainer.classList.add('hidden');
            signupContainer.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');
            
            // Load user-specific data
            loadDeals();
            loadStickyNote();
        } else {
            // User is logged out
            currentUserId = null;
            dashboardContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        }
    });
}


// --- FIREBASE DATA LOGIC (Using modular imports) ---

/** Renders a single deal card. */
function createDealCard(deal) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.draggable = true;
    card.setAttribute('data-deal-id', deal.id);
    card.innerHTML = `
        <p><strong>Client:</strong> ${deal.clientName}</p>
        <p><strong>Car:</strong> ${deal.carModel}</p>
        <p><strong>Value:</strong> $${deal.dealValue.toLocaleString()}</p>
        <p><strong>Status:</strong> ${deal.status}</p>
    `;
    // NOTE: Drag-and-drop event listeners would be implemented here
    return card;
}

/** Fetches deals from Firestore and populates the Kanban board. */
function loadDeals() {
    // Clear existing deals
    document.querySelectorAll('.deal-list').forEach(list => list.innerHTML = '');

    // Define the Firestore query
    const dealsQuery = query(
        collection(db, 'deals'),
        where('salespersonId', '==', currentUserId)
    );

    // Real-time listener: listens to changes in the deals collection
    onSnapshot(dealsQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            const deal = { id: change.doc.id, ...change.doc.data() };
            const columnElement = document.querySelector(`.deal-list[data-status="${deal.status}"]`);

            if (change.type === 'added') {
                if (columnElement) {
                     columnElement.appendChild(createDealCard(deal));
                }
            } 
            // TODO: Implement 'modified' logic to update the card's content/move it 
            // and 'removed' logic to delete the card element from the DOM
        });
    }, error => {
        console.error("Error loading deals: ", error);
    });
}

// --- STICKY NOTE LOGIC ---

/** Loads and displays the user's sticky note. */
async function loadStickyNote() {
    const noteRef = doc(db, 'stickynotes', currentUserId);
    const docSnap = await getDoc(noteRef);
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
        await setDoc(doc(db, 'stickynotes', currentUserId), {
            userId: currentUserId,
            content: content,
            updatedAt: serverTimestamp()
        }, { merge: true });
        alert("Note saved successfully!");
    } catch (error) {
        alert("Error saving note: " + error.message);
    }
}
