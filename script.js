// ... (Keep existing code from line 1 up to setupEventListeners) ...

// --- Global Variables ---
let auth;
let db;
let serverTimestamp;
let currentUserId = null; 
let allDeals = []; 
let dealStatusChart = null; 
let allTodos = []; // NEW: Array to hold all To-Do items

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
const dealInitialStatusInput = document.getElementById('deal-initial-status');

// NEW SELECTORS
const totalDealsCount = document.getElementById('total-deals-count');
const totalDealsValue = document.getElementById('total-deals-value');
const closedDealsCount = document.getElementById('closed-deals-count');
const totalClosedValue = document.getElementById('total-closed-value');

const reportModal = document.getElementById('weekly-report-modal');
const reportTextInput = document.getElementById('report-text');

const calculatorModal = document.getElementById('calculator-modal');
const calcDisplay = document.getElementById('calc-display');
const conversionRateInput = document.getElementById('conversion-rate');
const baseAmountInput = document.getElementById('base-amount');
const convertedAmountDisplay = document.getElementById('converted-amount');

const newTodoInput = document.getElementById('new-todo-input');
const todoListUL = document.getElementById('todo-list');


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


// --- EVENT LISTENERS ---

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
    
    // NEW: REPORT LISTENERS
    document.getElementById('open-report-btn')?.addEventListener('click', showReportModal);
    document.getElementById('cancel-report-btn')?.addEventListener('click', hideReportModal);
    document.getElementById('send-report-btn')?.addEventListener('click', sendReport);

    // NEW: CALCULATOR LISTENERS
    document.getElementById('open-calculator-btn')?.addEventListener('click', showCalculatorModal);
    document.getElementById('cancel-calc-btn')?.addEventListener('click', hideCalculatorModal);
    document.getElementById('convert-btn')?.addEventListener('click', performConversion);
    document.querySelectorAll('.calculator-grid .calc-btn').forEach(button => {
        button.addEventListener('click', handleCalculatorInput);
    });

    // NEW: TO-DO LISTENERS
    document.getElementById('add-todo-btn')?.addEventListener('click', addTodoItem);
    newTodoInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTodoItem();
    });
    todoListUL?.addEventListener('click', handleTodoActions);

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

// ... (Keep existing AUTHENTICATION HANDLERS) ...

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
            listenForTodos(); // NEW: Start listening for To-Dos
            
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

// ... (Keep existing DEAL INPUT FORM LOGIC, DEAL ACTION LOGIC) ...

// --- DATA LOGIC (UPDATED with Chart/Cache) ---

// ... (Keep existing initializeChart and createDealCard) ...

/** UPDATED: Updates the summary panel (Counters) based on the current allDeals cache. */
function updateDashboardSummary() {
    const totalDeals = allDeals.length;
    const totalValue = allDeals.reduce((sum, deal) => sum + deal.value, 0);

    const closedDeals = allDeals.filter(deal => deal.status === 'Closed-Won');
    const closedCount = closedDeals.length;
    const closedValue = closedDeals.reduce((sum, deal) => sum + deal.value, 0);

    // Update DOM elements
    if (totalDealsCount) totalDealsCount.textContent = totalDeals.toLocaleString();
    if (totalDealsValue) totalDealsValue.textContent = `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (closedDealsCount) closedDealsCount.textContent = closedCount.toLocaleString();
    if (totalClosedValue) totalClosedValue.textContent = `$${closedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}


/** Listens to Firestore for real-time deal updates. (No change needed here) */
function listenForDeals() {
    if (!currentUserId) return;
    const dealsQuery = dbFns.query(dbFns.collection(db, 'deals'), dbFns.where('userId', '==', currentUserId));
    // ... (Keep existing onSnapshot logic and calls to updateDashboardSummary, updateChart) ...
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

// ... (Keep existing DRAG AND DROP HANDLERS, STICKY NOTE LOGIC, DEAL LIST MODAL FUNCTIONS) ...

// --- NEW FEATURE: WEEKLY REPORT (Mailto) ---

function showReportModal() {
    reportModal?.classList.remove('hidden');
    modalBackdrop?.classList.remove('hidden');
}

function hideReportModal() {
    reportModal?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
}

function sendReport() {
    const reportText = reportTextInput?.value || "";
    if (reportText.trim().length < 20) {
        alert("Please write a more substantial report (at least 20 characters).");
        return;
    }
    
    const currentDate = new Date().toLocaleDateString('en-US');
    const subject = encodeURIComponent(`Weekly Report - ${currentDate}`);
    const body = encodeURIComponent(`Summary of the week:\n\n${reportText}\n\n---\nMetrics (Auto-Generated):\nTotal Closed Value: ${totalClosedValue?.textContent}\nClosed Deals: ${closedDealsCount?.textContent}\nTotal Deal Value: ${totalDealsValue?.textContent}\nTotal Deals: ${totalDealsCount?.textContent}\n`);

    // Use mailto: link to open the user's default email client
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    
    hideReportModal();
}

// --- NEW FEATURE: CALCULATOR & CONVERTER ---

function showCalculatorModal() {
    calculatorModal?.classList.remove('hidden');
    modalBackdrop?.classList.remove('hidden');
    calcDisplay.value = '0'; // Reset calculator display
}

function hideCalculatorModal() {
    calculatorModal?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
}

function handleCalculatorInput(e) {
    const input = e.target.getAttribute('data-input');
    
    let currentDisplay = calcDisplay.value === '0' ? '' : calcDisplay.value;
    
    if (input === 'C') {
        calcDisplay.value = '0';
    } else if (input === '<') { // DEL
        calcDisplay.value = currentDisplay.slice(0, -1) || '0';
    } else if (input === '=') {
        try {
            // Use eval for basic arithmetic, but wrap it for safety
            calcDisplay.value = Function('return ' + currentDisplay.replace(/[^-()\d/*+.]/g, ''))();
        } catch {
            calcDisplay.value = 'Error';
        }
    } else if (['+', '-', '*', '/'].includes(input)) {
        // Prevent multiple operators in a row
        if (!['+', '-', '*', '/'].includes(currentDisplay.slice(-1))) {
            calcDisplay.value = currentDisplay + input;
        }
    } else {
        calcDisplay.value = currentDisplay + input;
    }
}

function performConversion() {
    const base = parseFloat(baseAmountInput.value);
    const rate = parseFloat(conversionRateInput.value);
    
    if (isNaN(base) || isNaN(rate) || rate <= 0) {
        convertedAmountDisplay.textContent = 'Invalid Input';
        return;
    }
    
    const result = (base * rate).toFixed(2);
    convertedAmountDisplay.textContent = result.toLocaleString();
}


// --- NEW FEATURE: TO-DO LIST (Firestore Integration) ---

/** Listens to Firestore for real-time to-do updates. */
function listenForTodos() {
    if (!currentUserId) return;
    const todosQuery = dbFns.query(
        dbFns.collection(db, 'todos'), 
        dbFns.where('userId', '==', currentUserId),
        dbFns.orderBy('createdAt', 'asc') // Order by creation time
    );

    dbFns.onSnapshot(todosQuery, (snapshot) => {
        allTodos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTodos();
    }, error => {
        console.error("Error loading to-dos: ", error);
    });
}

function renderTodos() {
    if (!todoListUL) return;
    todoListUL.innerHTML = allTodos.map(todo => `
        <li data-doc-id="${todo.id}" class="${todo.completed ? 'completed' : ''}">
            <input type="checkbox" ${todo.completed ? 'checked' : ''} data-action="toggle">
            <span>${todo.text}</span>
            <button data-action="delete" class="delete-todo-btn">X</button>
        </li>
    `).join('');
}

async function addTodoItem() {
    const text = newTodoInput?.value.trim();
    if (!text) return;

    try {
        const todoData = {
            userId: currentUserId,
            text: text,
            completed: false,
            createdAt: serverTimestamp()
        };
        const todoRef = dbFns.doc(dbFns.collection(db, 'todos'));
        await dbFns.setDoc(todoRef, todoData);
        newTodoInput.value = '';
    } catch (error) {
        alert("Error adding To-Do: " + error.message);
    }
}

async function handleTodoActions(e) {
    const target = e.target;
    const listItem = target.closest('li');
    if (!listItem) return;

    const docId = listItem.getAttribute('data-doc-id');
    const action = target.getAttribute('data-action');
    
    if (action === 'toggle') {
        const isCompleted = target.checked;
        const todoRef = dbFns.doc(db, 'todos', docId);
        await dbFns.setDoc(todoRef, { completed: isCompleted }, { merge: true });
    } else if (action === 'delete') {
        if (confirm('Delete this task?')) {
            await dbFns.deleteDoc(dbFns.doc(db, 'todos', docId));
        }
    }
}
