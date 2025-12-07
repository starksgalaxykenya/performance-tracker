// --- Global Variables ---
let auth;
let db;
let serverTimestamp;
let currentUserId = null; 
let allDeals = []; 
let dealStatusChart = null; 

// Storage for imported Firebase Modular Functions
let authFns = {};
let dbFns = {};

// --- UI Element Selectors ---
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const dashboardContainer = document.getElementById('dashboard-container');
const dealInputForm = document.getElementById('deal-input-form');
const dealFormTitle = document.getElementById('deal-form-title');
const dealDocIdInput = document.getElementById('deal-doc-id'); 
const modalBackdrop = document.getElementById('modal-backdrop');
const moveDealModal = document.getElementById('move-deal-modal');
const statusButtonsContainer = document.getElementById('status-buttons-container');
const dealToMoveIdInput = document.getElementById('deal-to-move-id');

const dealListModal = document.getElementById('deal-list-modal');
const dealSearchInput = document.getElementById('deal-search-input');
const dealsListBody = document.getElementById('deals-list-body');

// Note: I'm adding a missing input from the HTML provided in the script scope
const dealInitialStatusInput = document.getElementById('deal-initial-status');


const kanbanStatuses = ['Prospective', 'Cold', 'Warm', 'Hot', 'In Progress', 'Closed-Won'];

// NEW: Status Colors Map (Must match CSS)
const statusColors = {
    'Prospective': '#3498db',
    'Cold': '#9b59b6',
    'Warm': '#f39c12',
    'Hot': '#e74c3c',
    'In Progress': '#f1c40f',
    'Closed-Won': '#267921'
};


// --- EVENT LISTENERS (UPDATED for Chart, Search, Quick-Change) ---

/**
 * Initializes all necessary DOM event listeners for the application.
 */
function setupEventListeners() {
    // Auth Toggles
    document.getElementById('show-signup')?.addEventListener('click', () => { loginContainer?.classList.add('hidden'); signupContainer?.classList.remove('hidden'); });
    document.getElementById('show-login')?.addEventListener('click', () => { signupContainer?.classList.add('hidden'); loginContainer?.classList.remove('hidden'); });

    // Auth Actions
    document.getElementById('login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('signup-btn')?.addEventListener('click', handleSignup);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    // Deal Modals
    document.getElementById('add-deal-btn')?.addEventListener('click', () => showAddDealForm('Prospective')); 
    document.querySelectorAll('.btn-add-column').forEach(button => {
        button.addEventListener('click', (e) => showAddDealForm(e.target.getAttribute('data-status')));
    });

    // Deal Form
    document.getElementById('submit-deal-btn')?.addEventListener('click', createOrUpdateDeal);
    document.getElementById('cancel-deal-btn')?.addEventListener('click', hideAddDealForm);

    // Sticky Note
    document.getElementById('save-note-btn')?.addEventListener('click', saveStickyNote);
    
    // Move Deal Modal
    document.getElementById('cancel-move-btn')?.addEventListener('click', hideMoveDealModal);
    statusButtonsContainer?.addEventListener('click', handleStatusSelection);

    // Deal List Modal
    document.getElementById('close-deal-list-modal')?.addEventListener('click', () => dealListModal?.classList.add('hidden'));
    
    // NEW: Search/Filter Listener
    dealSearchInput?.addEventListener('input', () => renderDealsInModal(dealSearchInput.value)); 
    
    // NEW: Quick Status Change Listener (Delegation for select elements)
    dealsListBody?.addEventListener('change', (e) => {
        if (e.target.classList.contains('quick-status-change')) {
            const docId = e.target.getAttribute('data-doc-id');
            const newStatus = e.target.value;
            handleStatusQuickChange(docId, newStatus);
        }
    });
    
    // Add click listeners for the kanban column headers to open the modal
    document.querySelectorAll('.kanban-column h3').forEach(header => {
        header.addEventListener('click', (e) => {
            const status = e.target.closest('.kanban-column').querySelector('.deal-list').getAttribute('data-status');
            openDealListModal(status);
        });
    });
    
    // Add click listeners for deal actions (edit/delete) within the modal
    dealsListBody?.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const docId = target.getAttribute('data-doc-id');
        const deal = allDeals.find(d => d.id === docId);

        if (!deal) return;
        
        if (target.getAttribute('data-action') === 'edit') {
            dealListModal?.classList.add('hidden');
            showAddDealForm(deal.status, deal);
        } else if (target.getAttribute('data-action') === 'delete') {
            if (confirm(`Are you sure you want to delete the deal for ${deal.clientName}?`)) {
                deleteDeal(docId);
                dealListModal?.classList.add('hidden');
            }
        }
    });
    
    // --- DRAG AND DROP LISTENERS (for the column containers) ---
    document.querySelectorAll('.deal-list').forEach(list => {
        list.addEventListener('dragover', (e) => { e.preventDefault(); }); // Essential to allow dropping
        list.addEventListener('drop', handleDrop);
    });

}

// --- MAIN SETUP FUNCTION ---
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
    setupAuthStateObserver(); 
}

// --- AUTHENTICATION HANDLERS ---

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await authFns.signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Login Failed: " + error.message);
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    try {
        await authFns.createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Signup Failed: " + error.message);
    }
}

function handleLogout() {
    authFns.signOut(auth);
}

function setupAuthStateObserver() {
    authFns.onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            loginContainer?.classList.add('hidden');
            signupContainer?.classList.add('hidden');
            dashboardContainer?.classList.remove('hidden');
            
            listenForDeals();
            loadStickyNote();
            initializeChart();
            
        } else {
            currentUserId = null;
            dashboardContainer?.classList.add('hidden');
            // Hide the move/form modals if they were open
            dealInputForm?.classList.add('hidden');
            moveDealModal?.classList.add('hidden');
            modalBackdrop?.classList.add('hidden');
            loginContainer?.classList.remove('hidden');
        }
    });
}


// --- DEAL INPUT FORM LOGIC ---

function showAddDealForm(initialStatus, dealData = null) {
    // Check if the element exists before accessing it
    if (dealInitialStatusInput) {
        dealInitialStatusInput.value = initialStatus; 
    }
    
    // Clear form fields
    document.getElementById('deal-doc-id').value = dealData ? dealData.id : '';
    document.getElementById('deal-client-name').value = dealData ? dealData.clientName : '';
    document.getElementById('deal-car-model').value = dealData ? dealData.carModel : '';
    document.getElementById('deal-car-year').value = dealData ? dealData.carYear : '';
    document.getElementById('deal-car-color').value = dealData ? dealData.carColor : '';
    document.getElementById('deal-value').value = dealData ? dealData.value : '';
    document.getElementById('deal-deposit').value = dealData ? dealData.deposit : '0'; 

    const formTitle = document.querySelector('#deal-input-form h2');
    if (dealData) {
        formTitle.textContent = `Edit Deal: ${dealData.clientName}`;
    } else {
        formTitle.textContent = `Add Deal to: ${initialStatus}`;
    }

    dealInputForm?.classList.remove('hidden');
    modalBackdrop?.classList.remove('hidden');
}

function hideAddDealForm() {
    // Clear form fields (This is a simplified approach, relying on the next showAddDealForm to re-set)
    document.getElementById('deal-doc-id').value = '';

    dealInputForm?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
}

async function createOrUpdateDeal() {
    const docId = document.getElementById('deal-doc-id').value;
    const clientName = document.getElementById('deal-client-name').value.trim();
    const carModel = document.getElementById('deal-car-model').value.trim();
    const carYear = document.getElementById('deal-car-year').value.trim();
    const carColor = document.getElementById('deal-car-color').value.trim();
    const value = parseFloat(document.getElementById('deal-value').value) || 0;
    const deposit = parseFloat(document.getElementById('deal-deposit').value) || 0;
    
    // Get status from the deal being edited or the column it was clicked from
    let status = '';
    if (docId) {
        // If editing, use existing status from the deal cache
        status = allDeals.find(d => d.id === docId)?.status || 'Prospective';
    } else {
        // If adding, use the status from the hidden input
        status = document.getElementById('deal-initial-status')?.value || 'Prospective';
    }
    
    if (!clientName || !carModel || !carYear || !carColor || value <= 0) {
        alert("Please fill in all required fields (Client Name, Car Model, Year, Color, and Budget > 0).");
        return;
    }

    const dealData = {
        userId: currentUserId,
        clientName: clientName,
        carModel: carModel,
        carYear: parseInt(carYear),
        carColor: carColor,
        value: value, 
        deposit: deposit,
        status: status,
        updatedAt: serverTimestamp()
    };
    
    try {
        let dealRef;
        if (docId) {
            // Update existing deal
            dealRef = dbFns.doc(db, 'deals', docId);
            await dbFns.setDoc(dealRef, dealData, { merge: true });
            alert(`Deal for ${clientName} updated!`);
        } else {
            // ✅ FIX: This is the critical line. It correctly uses dbFns.doc() with a collection reference 
            // to generate a new ID, resolving the "Invalid document reference" error.
            dealRef = dbFns.doc(dbFns.collection(db, 'deals')); 
            await dbFns.setDoc(dealRef, { ...dealData, createdAt: serverTimestamp() });
            alert(`New deal for ${clientName} added!`);
        }
        
        hideAddDealForm();
    } catch (error) {
        alert("Error saving deal: " + error.message);
    }
}


// --- DEAL ACTION LOGIC ---

async function deleteDeal(docId) {
    if (!confirm("Are you sure you want to delete this deal? This action cannot be undone.")) {
        return;
    }
    
    try {
        await dbFns.deleteDoc(dbFns.doc(db, 'deals', docId));
        alert('Deal deleted successfully!');
    } catch (error) {
        alert('Error deleting deal: ' + error.message);
    }
}

async function moveDealToNewStatus(docId) {
    dealToMoveIdInput.value = docId;
            
    statusButtonsContainer.innerHTML = '';
    kanbanStatuses.forEach(status => {
        const button = document.createElement('button');
        button.className = 'btn status-btn';
        button.textContent = status;
        button.setAttribute('data-new-status', status);
        button.style.backgroundColor = statusColors[status]; // Apply color to button
        statusButtonsContainer.appendChild(button);
    });

    moveDealModal?.classList.remove('hidden');
    modalBackdrop?.classList.remove('hidden');
}

async function handleStatusSelection(e) {
    const button = e.target.closest('.status-btn');
    if (!button) return;

    const newStatus = button.getAttribute('data-new-status');
    const docId = dealToMoveIdInput.value;

    if (docId && newStatus) {
        try {
            const dealRef = dbFns.doc(db, 'deals', docId);
            await dbFns.setDoc(dealRef, { status: newStatus }, { merge: true });
            alert(`Deal moved to ${newStatus}!`);
        } catch (error) {
            alert('Error moving deal: ' + error.message);
        }
    }
    
    hideMoveDealModal();
}

// NEW: Function to handle status change directly from the modal dropdown
async function handleStatusQuickChange(docId, newStatus) {
    if (!docId || !newStatus) return;

    try {
        const dealRef = dbFns.doc(db, 'deals', docId);
        await dbFns.setDoc(dealRef, { status: newStatus }, { merge: true });
        alert('Deal status updated successfully!');
        
        // Re-render the modal list to show current data (deal may have moved out of the list)
        renderDealsInModal(dealSearchInput.value); 

    } catch (error) {
        alert('Error updating deal status: ' + error.message);
    }
}

function hideMoveDealModal() {
    moveDealModal?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
    dealToMoveIdInput.value = '';
}


// --- DATA LOGIC (UPDATED with Chart/Cache) ---

/** NEW: Initializes the Chart.js chart instance. */
function initializeChart() {
    const ctx = document.getElementById('deal-status-chart').getContext('2d');
    
    if (dealStatusChart) {
        dealStatusChart.destroy(); // Destroy previous instance if it exists
    }

    dealStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: true,
                    text: 'Deal Status Distribution',
                    font: { size: 16 }
                }
            }
        }
    });
}

/** NEW: Updates the chart data based on the current allDeals cache. */
function updateChart() {
    if (!dealStatusChart) return;
    
    const statusCounts = kanbanStatuses.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
    allDeals.forEach(deal => {
        if (kanbanStatuses.includes(deal.status)) {
            statusCounts[deal.status]++;
        }
    });

    const labels = kanbanStatuses.filter(status => statusCounts[status] > 0);
    const data = labels.map(status => statusCounts[status]);
    const backgroundColors = labels.map(status => statusColors[status]);
    
    dealStatusChart.data.labels = labels;
    dealStatusChart.data.datasets[0].data = data;
    dealStatusChart.data.datasets[0].backgroundColor = backgroundColors;
    
    dealStatusChart.update();
}


/** Creates a deal card element. (UPDATED with status color attribute) */
function createDealCard(deal) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-deal-id', deal.id);
    card.setAttribute('data-status', deal.status); 
    
    card.addEventListener('dragstart', handleDragStart);

    // Add click listener for the action buttons
    card.addEventListener('click', (e) => {
        const btn = e.target.closest('.deal-action-btn');
        if (!btn) return;
        
        const cardDocId = btn.getAttribute('data-doc-id');
        const action = btn.getAttribute('data-action');
        const dealData = allDeals.find(d => d.id === cardDocId);

        if (action === 'delete') {
            deleteDeal(cardDocId);
        } else if (action === 'move') {
            moveDealToNewStatus(cardDocId);
        } else if (action === 'edit') {
            showAddDealForm(dealData.status, dealData);
        }
    });


    // Format car details
    const carDetailsString = `${deal.carColor} ${deal.carYear} ${deal.carModel}`;

    let depositInfo = '';
    if (deal.status === 'In Progress' && deal.deposit > 0) {
        depositInfo = `<p><strong>Deposit:</strong> <span class="brand-color">$${deal.deposit.toLocaleString()}</span></p>`;
    }

    card.innerHTML = `
        <div class="deal-actions">
            <button class="deal-action-btn edit-btn" data-doc-id="${deal.id}" data-action="edit" title="Edit Deal">✏️</button>
            <button class="deal-action-btn delete-btn" data-doc-id="${deal.id}" data-action="delete" title="Delete Deal">🗑️</button>
            <button class="deal-action-btn move-btn" data-doc-id="${deal.id}" data-action="move" title="Move Deal">➡️</button>
        </div>
        <p><strong>Client:</strong> ${deal.clientName}</p>
        <p><strong>Car:</strong> ${carDetailsString}</p>
        <p><strong>Budget:</strong> $${deal.value.toLocaleString()}</p>
        ${depositInfo}
    `;
    return card;
}


/** Updates the summary panel (Total Deals, etc.). */
function updateDashboardSummary() {
    // This is a placeholder as the summary fields were not present in the HTML snippets, 
    // but the logic ensures the core data structure (allDeals) is available for other functions.
}


/** Listens to Firestore for real-time deal updates. */
function listenForDeals() {
    if (!currentUserId) return;
    const dealsQuery = dbFns.query(dbFns.collection(db, 'deals'), dbFns.where('userId', '==', currentUserId));

    dbFns.onSnapshot(dealsQuery, (snapshot) => {
        document.querySelectorAll('.deal-list').forEach(list => list.innerHTML = '');
        
        snapshot.docChanges().forEach(change => {
            const deal = { ...change.doc.data(), id: change.doc.id };
            
            if (change.type === 'added' || change.type === 'modified') {
                // Update allDeals cache
                const existingIndex = allDeals.findIndex(d => d.id === deal.id);
                if (existingIndex > -1) {
                    allDeals[existingIndex] = deal;
                } else {
                    allDeals.push(deal);
                }
                
                // Update UI card (re-render)
                const columnElement = document.querySelector(`.deal-list[data-status="${deal.status}"]`);
                document.querySelector(`[data-deal-id=\"${deal.id}\"]`)?.remove();
                if (columnElement) {
                    columnElement.appendChild(createDealCard(deal));
                }

            } else if (change.type === 'removed') {
                // Remove from allDeals cache
                allDeals = allDeals.filter(d => d.id !== deal.id);
                // Remove from UI
                document.querySelector(`[data-deal-id=\"${deal.id}\"]`)?.remove();
            }
        });
        
        updateDashboardSummary(); 
        updateChart();
    }, error => {
        console.error("Error loading deals: ", error);
    });
}

/** DRAG AND DROP HANDLERS */
let draggedDealId = null;

function handleDragStart(e) {
    draggedDealId = e.target.getAttribute('data-deal-id');
    e.dataTransfer.setData('text/plain', draggedDealId);
    e.target.classList.add('dragging');
}

async function handleDrop(e) {
    e.preventDefault();
    const docId = e.dataTransfer.getData('text/plain');
    
    document.querySelector('.dragging')?.classList.remove('dragging');
    
    const targetList = e.target.closest('.deal-list');
    
    if (targetList) {
        const newStatus = targetList.getAttribute('data-status');
        
        try {
            const dealRef = dbFns.doc(db, 'deals', docId);
            await dbFns.setDoc(dealRef, { status: newStatus }, { merge: true });
            alert(`Deal moved to ${newStatus} via Drag & Drop!`);
        } catch (error) {
             alert('Error moving deal: ' + error.message);
        }
    }
    draggedDealId = null;
}


// --- STICKY NOTE LOGIC ---

async function loadStickyNote() {
    if (!currentUserId) return;
    const noteRef = dbFns.doc(db, 'stickynotes', currentUserId);
    try {
        const docSnap = await dbFns.getDoc(noteRef);
        if (docSnap.exists()) {
            document.getElementById('sticky-note-input').value = docSnap.data().content || '';
        } else {
             document.getElementById('sticky-note-input').value = '';
        }
    } catch (error) {
         console.error("Error loading note:", error);
    }
}

async function saveStickyNote() {
    if (!currentUserId) return;
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


// --- DEAL LIST MODAL FUNCTIONS (NEW/UPDATED) ---

/** Opens the modal and sets the context for filtering/rendering. */
function openDealListModal(status) {
    const deals = allDeals.filter(d => d.status === status);
    
    document.getElementById('deal-list-modal-title').textContent = `${status} Deals (${deals.length})`;
    dealListModal.setAttribute('data-current-status', status); 
    dealSearchInput.value = ''; // Clear search on open

    renderDealsInModal('');
    dealListModal.classList.remove('hidden');
}


/** NEW: Function to render deals inside the modal, handling search/filter. */
function renderDealsInModal(searchTerm = '') {
    const status = dealListModal.getAttribute('data-current-status');
    searchTerm = searchTerm.toLowerCase().trim();
    
    // Filter by status first
    let deals = allDeals.filter(d => d.status === status);
    
    // Then filter by search term
    if (searchTerm) {
        deals = deals.filter(deal => 
            deal.clientName.toLowerCase().includes(searchTerm) ||
            deal.carModel.toLowerCase().includes(searchTerm) ||
            deal.carYear.toString().includes(searchTerm)
        );
    }
    
    dealsListBody.innerHTML = deals.length > 0
        ? deals.map(createDealItemInModal).join('')
        : '<p style="text-align: center; color: #777; padding: 20px;">No matching deals found.</p>';
}

/** NEW: Helper to create deal item with quick-change status dropdown. */
function createDealItemInModal(deal) {
    const statusOptions = kanbanStatuses.map(s => 
        `<option value="${s}" ${s === deal.status ? 'selected' : ''}>${s}</option>`
    ).join('');
    
    return `
        <div class="deal-item-modal">
            <div class="deal-details">
                <strong style="color: ${statusColors[deal.status]}">${deal.clientName}</strong>
                <small>${deal.carModel} (${deal.carYear}) | Budget: $${deal.value.toLocaleString()}</small>
            </div>
            <div class="deal-actions-modal">
                <select class="quick-status-change" data-doc-id="${deal.id}">
                    ${statusOptions}
                </select>
                <button class="deal-action-btn edit-btn" data-doc-id="${deal.id}" data-action="edit" title="Edit Deal">✏️</button>
                <button class="deal-action-btn delete-btn" data-doc-id="${deal.id}" data-action="delete" title="Delete Deal">🗑️</button>
            </div>
        </div>
    `;
}
