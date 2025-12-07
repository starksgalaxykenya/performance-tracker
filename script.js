// --- Global Variables ---
let auth;
let db;
let serverTimestamp;
let currentUserId = null; 
let allDeals = []; 
let dealStatusChart = null; 
let allTodos = []; 

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

// Status Colors Map (Must match CSS)
const statusColors = {
    'Prospective': '#3498db',
    'Cold': '#9b59b6',
    'Warm': '#f39c12',
    'Hot': '#e74c3c',
    'In Progress': '#f1c40f',
    'Closed-Won': '#267921'
};


// -------------------------------------------------------------------
// --- AUTHENTICATION HANDLERS ---
// -------------------------------------------------------------------

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        await authFns.signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Login Failed: " + error.message);
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    if (password.length < 6) {
         alert("Password must be at least 6 characters long.");
        return;
    }

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
            listenForTodos(); 
            
        } else {
            currentUserId = null;
            dashboardContainer?.classList.add('hidden');
            // Hide all modals/forms when logging out
            dealInputForm?.classList.add('hidden');
            moveDealModal?.classList.add('hidden');
            reportModal?.classList.add('hidden');
            calculatorModal?.classList.add('hidden');
            modalBackdrop?.classList.add('hidden');
            loginContainer?.classList.remove('hidden');
        }
    });
}

// -------------------------------------------------------------------
// --- EVENT LISTENERS ---
// -------------------------------------------------------------------

function setupEventListeners() {
    // Auth Toggles
    document.getElementById('show-signup')?.addEventListener('click', () => { loginContainer?.classList.add('hidden'); signupContainer?.classList.remove('hidden'); });
    document.getElementById('show-login')?.addEventListener('click', () => { signupContainer?.classList.add('hidden'); loginContainer?.classList.remove('hidden'); });

    // Auth Actions - CRITICAL: These now correctly reference the functions defined above
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
    
    // Search/Filter Listener
    dealSearchInput?.addEventListener('input', () => renderDealsInModal(dealSearchInput.value)); 
    
    // Quick Status Change Listener (Delegation for select elements)
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
    
    // REPORT LISTENERS
    document.getElementById('open-report-btn')?.addEventListener('click', showReportModal);
    document.getElementById('cancel-report-btn')?.addEventListener('click', hideReportModal);
    document.getElementById('send-report-btn')?.addEventListener('click', sendReport);

    // CALCULATOR LISTENERS
    document.getElementById('open-calculator-btn')?.addEventListener('click', showCalculatorModal);
    document.getElementById('cancel-calc-btn')?.addEventListener('click', hideCalculatorModal);
    document.getElementById('convert-btn')?.addEventListener('click', performConversion);
    document.querySelectorAll('.calculator-grid .calc-btn').forEach(button => {
        button.addEventListener('click', handleCalculatorInput);
    });

    // TO-DO LISTENERS
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

// -------------------------------------------------------------------
// --- DEAL INPUT FORM LOGIC ---
// -------------------------------------------------------------------

function showAddDealForm(initialStatus, dealData = null) {
    if (dealInitialStatusInput) {
        dealInitialStatusInput.value = initialStatus; 
    }
    
    document.getElementById('deal-doc-id').value = dealData ? dealData.id : '';
    document.getElementById('deal-client-name').value = dealData ? dealData.clientName : '';
    document.getElementById('deal-client-phone').value = dealData ? dealData.clientPhone : ''; // 🌟 UPDATED: Load phone number
    document.getElementById('deal-car-model').value = dealData ? dealData.carModel : '';
    document.getElementById('deal-car-year').value = dealData ? dealData.carYear : '';
    document.getElementById('deal-car-color').value = dealData ? dealData.carColor : '';
    document.getElementById('deal-value').value = dealData ? dealData.value : '';
    document.getElementById('deal-deposit').value = dealData && dealData.deposit !== undefined ? dealData.deposit : '0'; 

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
    document.getElementById('deal-doc-id').value = '';
    dealInputForm?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
}

async function createOrUpdateDeal() {
    const docId = document.getElementById('deal-doc-id').value;
    const clientName = document.getElementById('deal-client-name').value.trim();
    const clientPhone = document.getElementById('deal-client-phone').value.trim(); // 🌟 UPDATED: Get phone number
    const carModel = document.getElementById('deal-car-model').value.trim();
    const carYear = document.getElementById('deal-car-year').value.trim();
    const carColor = document.getElementById('deal-car-color').value.trim();
    const value = parseFloat(document.getElementById('deal-value').value) || 0;
    const deposit = parseFloat(document.getElementById('deal-deposit').value) || 0;
    
    let status = '';
    if (docId) {
        status = allDeals.find(d => d.id === docId)?.status || 'Prospective';
    } else {
        status = document.getElementById('deal-initial-status')?.value || 'Prospective';
    }
    
    if (!clientName || !carModel || !carYear || !carColor || value <= 0) {
        alert("Please fill in all required fields (Client Name, Car Model, Year, Color, and Budget > 0).");
        return;
    }

    const dealData = {
        userId: currentUserId,
        clientName: clientName,
        clientPhone: clientPhone, // 🌟 UPDATED: Save phone number
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
            // Create new deal
            dealRef = dbFns.doc(dbFns.collection(db, 'deals')); 
            await dbFns.setDoc(dealRef, { ...dealData, createdAt: serverTimestamp() });
            alert(`New deal for ${clientName} added!`);
        }
        
        hideAddDealForm();
    } catch (error) {
        alert("Error saving deal: " + error.message);
    }
}


// -------------------------------------------------------------------
// --- DEAL ACTION LOGIC (DRAG & DROP, MOVE, DELETE) ---
// -------------------------------------------------------------------

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
        button.style.backgroundColor = statusColors[status]; 
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

async function handleStatusQuickChange(docId, newStatus) {
    if (!docId || !newStatus) return;

    try {
        const dealRef = dbFns.doc(db, 'deals', docId);
        await dbFns.setDoc(dealRef, { status: newStatus }, { merge: true });
        // The onSnapshot listener will handle the UI update
    } catch (error) {
        alert('Error updating deal status: ' + error.message);
    }
}

function hideMoveDealModal() {
    moveDealModal?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
    dealToMoveIdInput.value = '';
}

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
            // The onSnapshot listener will handle the UI update
        } catch (error) {
             alert('Error moving deal: ' + error.message);
        }
    }
    draggedDealId = null;
}


// -------------------------------------------------------------------
// --- DATA LOGIC (KANBAN, CHART, SUMMARY) ---
// -------------------------------------------------------------------

function initializeChart() {
    const ctx = document.getElementById('deal-status-chart')?.getContext('2d');
    
    if (!ctx) return; 

    if (dealStatusChart) {
        dealStatusChart.destroy(); 
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
            maintainAspectRatio: false, // Allows height to be controlled by CSS/container
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


function listenForDeals() {
    if (!currentUserId) return;
    const dealsQuery = dbFns.query(dbFns.collection(db, 'deals'), dbFns.where('userId', '==', currentUserId));

    dbFns.onSnapshot(dealsQuery, (snapshot) => {
        // Clear all kanban columns before re-rendering
        document.querySelectorAll('.deal-list').forEach(list => list.innerHTML = '');
        
        // Reset and rebuild the allDeals cache based on the current snapshot
        const newAllDeals = [];
        snapshot.docs.forEach(doc => {
            newAllDeals.push({ ...doc.data(), id: doc.id });
        });
        allDeals = newAllDeals;

        // Re-render all deals into their correct columns
        allDeals.forEach(deal => {
            const columnElement = document.querySelector(`.deal-list[data-status="${deal.status}"]`);
            if (columnElement) {
                columnElement.appendChild(createDealCard(deal));
            }
        });
        
        updateDashboardSummary(); 
        updateChart();
    }, error => {
        console.error("Error loading deals: ", error);
    });
}

// -------------------------------------------------------------------
// --- STICKY NOTE LOGIC ---
// -------------------------------------------------------------------

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


// -------------------------------------------------------------------
// --- DEAL LIST MODAL FUNCTIONS ---
// -------------------------------------------------------------------

function openDealListModal(status) {
    document.getElementById('deal-list-modal-title').textContent = `${status} Deals (${allDeals.filter(d => d.status === status).length})`;
    dealListModal.setAttribute('data-current-status', status); 
    dealSearchInput.value = ''; 

    renderDealsInModal('');
    dealListModal.classList.remove('hidden');
}

function renderDealsInModal(searchTerm = '') {
    const status = dealListModal.getAttribute('data-current-status');
    searchTerm = searchTerm.toLowerCase().trim();
    
    let deals = allDeals.filter(d => d.status === status);
    
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


// -------------------------------------------------------------------
// --- NEW FEATURE: WEEKLY REPORT (Mailto) ---
// -------------------------------------------------------------------

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

// -------------------------------------------------------------------
// --- NEW FEATURE: CALCULATOR & CONVERTER ---
// -------------------------------------------------------------------

let calculatorState = '0';
let waitingForSecondOperand = false;
let pendingOperator = null;
let operand = null;

function updateCalculatorDisplay(value) {
    calcDisplay.value = value.toString().substring(0, 16); // Limit to 16 characters
    calculatorState = value.toString();
}

function showCalculatorModal() {
    calculatorModal?.classList.remove('hidden');
    modalBackdrop?.classList.remove('hidden');
    updateCalculatorDisplay('0'); // Reset calculator display
    calculatorState = '0';
    waitingForSecondOperand = false;
    pendingOperator = null;
    operand = null;
}

function hideCalculatorModal() {
    calculatorModal?.classList.add('hidden');
    modalBackdrop?.classList.add('hidden');
}

function handleCalculatorInput(e) {
    const input = e.target.getAttribute('data-input');
    
    if (input === 'C') {
        updateCalculatorDisplay('0');
        calculatorState = '0';
        waitingForSecondOperand = false;
        pendingOperator = null;
        operand = null;
        return;
    } 
    
    if (input === '<') { // DEL
        updateCalculatorDisplay(calculatorState.length > 1 ? calculatorState.slice(0, -1) : '0');
        return;
    }

    if (['+', '-', '*', '/'].includes(input)) {
        handleOperator(input);
        return;
    }

    if (input === '=') {
        handleOperator(pendingOperator);
        pendingOperator = null;
        waitingForSecondOperand = false;
        return;
    }

    if (input === '.') {
        if (waitingForSecondOperand) {
            updateCalculatorDisplay('0.');
            waitingForSecondOperand = false;
        } else if (!calculatorState.includes('.')) {
            updateCalculatorDisplay(calculatorState + '.');
        }
        return;
    }

    // Handle number input
    if (waitingForSecondOperand) {
        updateCalculatorDisplay(input);
        waitingForSecondOperand = false;
    } else {
        updateCalculatorDisplay(calculatorState === '0' ? input : calculatorState + input);
    }
}

function handleOperator(nextOperator) {
    const inputValue = parseFloat(calculatorState);

    if (operand === null) {
        operand = inputValue;
    } else if (pendingOperator) {
        const result = performCalculation(operand, inputValue, pendingOperator);
        updateCalculatorDisplay(result);
        operand = result;
    }

    waitingForSecondOperand = true;
    pendingOperator = nextOperator;
}

function performCalculation(first, second, operator) {
    switch (operator) {
        case '+': return first + second;
        case '-': return first - second;
        case '*': return first * second;
        case '/': return second === 0 ? 'Error' : first / second;
        default: return second;
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


// -------------------------------------------------------------------
// --- NEW FEATURE: TO-DO LIST (Firestore Integration) ---
// -------------------------------------------------------------------

function listenForTodos() {
    if (!currentUserId) return;
    const todosQuery = dbFns.query(
        dbFns.collection(db, 'todos'), 
        dbFns.where('userId', '==', currentUserId),
        dbFns.orderBy('createdAt', 'asc') 
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
