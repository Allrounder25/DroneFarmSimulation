document.addEventListener('DOMContentLoaded', () => {

    // --- ENUMS & CONSTANTS ---
    // --- CONFIGURATION & STATE ---
    const BLOCK_SIZE_PX = 200;
    const API_URL = '/run-simulation';

    const CARD_OUTCOMES = [
        { type: 'barren_land', probability: 0.7 },
        { type: 'grass', probability: 0.15 },
        { type: 'stone', probability: 0.1 },
        { type: 'truck', probability: 0.05 }
    ];

    const GROWTH_STAGES = {
        'germinated': 'young',
        'young': 'final'
    };

    const TODOS = {
        0: [
            { id: 'explore', text: 'Explore the area', completed: false },
            { id: 'prepare_land', text: 'Prepare all land for planting', completed: false },
            { id: 'plant_seeds', text: 'Plant seeds on all prepared land', completed: false }
        ],
        10: [
            { id: 'pesticide', text: 'Apply pesticide to all young crops', completed: false }
        ],
        20: [
            { id: 'harvest', text: 'Harvest all final crops', completed: false }
        ]
    };

    // --- STATE VARIABLES ---
    let farmGridData = [];
    let farmBlocks = [];
    let dronePlaced = false; // Will be true once grid is created
    let dronePos = { x: 0, y: 0 }; // Represents grid coordinates
    const warehouseDroneHome = { x: 0.5, y: -1 }; // Conceptual home position in warehouse
    let droneBattery = 100;
    let currentMode = 'normal'; // 'normal' or 'automated'
    let automatedModeInterval = null;
    let dayTimerInterval = null;
    let dayChangeCountdown = 15;

    let isDroneAtBase = true;
    let isSimulating = false; // To prevent multiple simulations at once

    let goalPos = null;
    let selectedTool = null;
    let currentDay = 0;
    let todos = [];

    // --- DOM ELEMENT CACHING ---
    // --- DOM ELEMENT REFERENCES ---
    const farmContainer = document.getElementById('farm-container');
    const farmGrid = document.getElementById('farm-grid');
    const pathOverlay = document.getElementById('path-overlay');
    
    const createGridBtn = document.getElementById('create-grid-btn');
    const farmWidthInput = document.getElementById('farm-width');
    const farmHeightInput = document.getElementById('farm-height');
    
    const startBtn = document.getElementById('start-btn');
    const statusText = document.getElementById('status-text');
    const taskSelect = document.getElementById('task-select');
    const methodSelect = document.getElementById('method-select');
    const algorithmSelect = document.getElementById('algorithm-select');

    const dayDisplay = document.getElementById('day-display');
    const todoList = document.getElementById('todo-list');
    const nextDayBtn = document.getElementById('next-day-btn');

    const pickaxeTool = document.getElementById('pickaxe');
    const harvesterTool = document.getElementById('harvester');

    const batteryLevel = document.querySelector('.battery-level');
    const batteryText = document.getElementById('battery-text');

    const congratsPopup = document.getElementById('congrats-popup');
    const closeCongratsBtn = document.getElementById('close-congrats-btn');
    const finalStats = document.getElementById('final-stats');

    const infoPopup = document.getElementById('info-popup');
    const infoPopupTitle = document.getElementById('info-popup-title');
    const infoPopupMessage = document.getElementById('info-popup-message');
    const closeInfoBtn = document.getElementById('close-info-btn');

    const totalLandsStatus = document.getElementById('total-lands-status');
    const obstaclesStatus = document.getElementById('obstacles-status');
    const farmingAreaStatus = document.getElementById('farming-area-status');
    const cropsCollectedStatus = document.getElementById('crops-collected-status');
    const cursor = document.querySelector('.cursor');
    const dayTimerDisplay = document.getElementById('day-timer');

    // New DOM Elements
    const homeTabBtn = document.getElementById('home-tab-btn');
    const trainingTabBtn = document.getElementById('training-tab-btn');
    const homeTab = document.getElementById('home-tab');
    const trainingTab = document.getElementById('training-tab');
    const infectionChanceSlider = document.getElementById('infection-chance');
    const infectionChanceValue = document.getElementById('infection-chance-value');
    const windSpeedSlider = document.getElementById('wind-speed');
    const windSpeedValue = document.getElementById('wind-speed-value');
    const episodesInput = document.getElementById('episodes');
    const startTrainingBtn = document.getElementById('start-training-btn');
    const modeChoicePopup = document.getElementById('mode-choice-popup');
    const normalModeBtn = document.getElementById('normal-mode-btn');
    const automatedModeBtn = document.getElementById('automated-mode-btn');


    // --- CORE FUNCTIONS ---
    // --- TABS & MODES ---

    function switchTab(tabId) {
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        // Show the selected tab content and activate the button
        document.getElementById(`${tabId}-tab`).classList.add('active');
        document.getElementById(`${tabId}-tab-btn`).classList.add('active');
    }

    function chooseNormalMode() {
        hideModeChoicePopup();
        currentMode = 'normal';
        // Per requirements, normal mode advances to the next phase (Day 10 in original logic)
        updateStatus('Normal mode selected. Manually manage your farm.');
        advanceDay();
    }

    function startAutomatedMode() {
        hideModeChoicePopup();
        currentMode = 'automated';
        updateStatus('Automated mode activated! The drone will now manage pesticides.');
        currentDay = 2; // Start automated mode on Day 2
        dayDisplay.textContent = currentDay;

        // Initial run for day 2
        handleAutomatedDayChange();

        // Set interval for subsequent days
        automatedModeInterval = setInterval(handleNextDay, 15000);
        startDayTimer();
    }

    // --- TRAINING ---
    async function startTraining() {
        updateStatus('Starting training... this may take a while.');
        const size = parseInt(farmWidthInput.value);
        const infectionChance = parseFloat(infectionChanceSlider.value);
        const windSpeed = parseFloat(windSpeedSlider.value);
        const episodes = parseInt(episodesInput.value);

        try {
            const response = await fetch('/train-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ size, infection_chance: infectionChance, wind_speed: windSpeed, episodes })
            });
    
            if (!response.ok) {
                updateStatus('Error starting training.', true);
                return;
            }
    
            const result = await response.json();
            updateStatus(`Training complete! First 5 rewards: ${result.rewards.slice(0, 5).join(', ')}...`);
        } catch (error) {
            updateStatus('Error during training.', true);
            console.error(error);
        }
    }

    // --- UI & INTERACTIONS ---
    function onToolClick(e) {
        const tool = e.currentTarget;
        const toolId = tool.id;

        if (selectedTool === toolId) {
            selectedTool = null;
            cursor.style.backgroundImage = `url('images/cursor.png')`;
            tool.classList.remove('selected');
        } else {
            if(selectedTool){
                document.getElementById(selectedTool).classList.remove('selected');
            }
            selectedTool = toolId;
            cursor.style.backgroundImage = `url('images/${toolId}.png')`;
            tool.classList.add('selected');
        }
    }

    function updateStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? 'var(--error-color)' : 'var(--text-light)';
    }

    function renderSeverity(x, y) {
        const blockEl = farmBlocks[y][x];
        const blockData = farmGridData[y][x];
        // Remove existing display if any
        const existingDisplay = blockEl.querySelector('.severity-text');
        if (existingDisplay) {
            existingDisplay.remove();
        }

        if (blockData.infected && blockData.severity) {
            const severityEl = document.createElement('div');
            severityEl.className = 'severity-text'; // Use 'severity-text' for consistency
            severityEl.textContent = blockData.severity;
            blockEl.appendChild(severityEl);
        }
    }

    function createFarmGrid(isTrainingMode = false) {
        const width = parseInt(farmWidthInput.value);
        const height = parseInt(farmHeightInput.value);

        if (width <= 0 || height <= 0) {
            updateStatus('Invalid grid size.', true);
            return;
        }

        const gridTotalWidth = width * BLOCK_SIZE_PX;
        const gridTotalHeight = height * BLOCK_SIZE_PX;

        farmGrid.innerHTML = '';
        pathOverlay.innerHTML = '';
        farmGridData = [];
        farmBlocks = [];
        goalPos = null;
        startBtn.disabled = true;
        nextDayBtn.disabled = true;
        nextDayBtn.textContent = 'Next Day';
        currentDay = 0;

        farmGrid.style.width = `${gridTotalWidth}px`;
        farmGrid.style.height = `${gridTotalHeight}px`;
        farmGrid.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
        farmGrid.style.gridTemplateRows = `repeat(${height}, 1fr)`;

        pathOverlay.style.width = `${gridTotalWidth}px`;
        pathOverlay.style.height = `${gridTotalHeight}px`;

        for (let y = 0; y < height; y++) {
            const rowData = [];
            const rowBlocks = [];
            for (let x = 0; x < width; x++) {
                const type = isTrainingMode ? 'young' : 'card';
                rowData.push({ type: type, isWarehouse: false, severity: null });
                const block = document.createElement('div');
                block.classList.add('farm-block', type);
                block.dataset.x = x;
                block.dataset.y = y;
                block.addEventListener('click', onBlockClick);
                farmGrid.appendChild(block);
                rowBlocks.push(block);
            }
            farmGridData.push(rowData);
            farmBlocks.push(rowBlocks);
        }

        if (isTrainingMode) {
            const infectionChance = parseFloat(infectionChanceSlider.value);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (Math.random() < infectionChance) {
                        const severityLevels = ['High', 'Medium', 'Low'];
                        const severity = severityLevels[Math.floor(Math.random() * severityLevels.length)];
                        farmGridData[y][x].severity = severity;
                        farmGridData[y][x].infected = true;
                        renderSeverity(x, y);
                    }
                }
            }
            updateStatus('Training grid created. Adjust parameters and start training.');
        } else {
            updateStatus('Farm created. Ready for simulation.');
        }

        const droneEl = document.getElementById('drone');
        if (droneEl) droneEl.remove();
        placeDroneAtWarehouse();
        dronePlaced = true; 
        isDroneAtBase = true;
        updateBattery(100);

        dayDisplay.textContent = currentDay;
        todos = JSON.parse(JSON.stringify(TODOS[currentDay]));
        updateTodoList();
        updateStats();
        checkSimReady();
    }

    function updateStats() {
        let totalLands = 0;
        let obstacles = 0;
        let farmingArea = 0;
        let cropsCollected = 0;

        for (const row of farmGridData) {
            for (const block of row) {
                totalLands++;
                if (['stone', 'truck'].includes(block.type)) {
                    obstacles++;
                }
                if (!['stone', 'truck', 'card'].includes(block.type)) {
                    farmingArea++;
                }
                if (block.type === 'harvested') {
                    cropsCollected++;
                }
            }
        }

        totalLandsStatus.textContent = totalLands;
        obstaclesStatus.textContent = obstacles;
        farmingAreaStatus.textContent = farmingArea;
        cropsCollectedStatus.textContent = cropsCollected;
    }

    function updateTodoList() {
        todoList.innerHTML = '';
        todos.forEach(todo => {
            const li = document.createElement('li');
            li.textContent = todo.text;
            if (todo.completed) {
                li.classList.add('completed');
            }
            todoList.appendChild(li);
        });
        checkTodoCompletion();
    }

    function checkTodoCompletion() {
        const allCompleted = todos.every(todo => todo.completed);
        if (allCompleted && currentDay === 0) {
            nextDayBtn.disabled = true; // Disable until a mode is chosen
            showModeChoicePopup();
        } else if (allCompleted && TODOS[currentDay + 10]) {
            nextDayBtn.disabled = false;
            updateStatus('All tasks for the day complete! You can proceed to the next day.');
        } else if (allCompleted && !TODOS[currentDay + 10]) { // End of all tasks
            nextDayBtn.textContent = 'Finish';
            nextDayBtn.disabled = false;
            updateStatus('All tasks complete! Press Finish to see your results.');
        }
    }

    function advanceDay() {
        if (currentMode === 'automated') {
            handleAutomatedDayChange();
            return;
        }


        if (nextDayBtn.textContent === 'Finish') {
            showCongratsPopup();
            return;
        }
        
        placeDroneAtWarehouse();
        dronePlaced = true;
        isDroneAtBase = true;
        
        currentDay += 10;
        dayDisplay.textContent = currentDay;
        nextDayBtn.disabled = true;

        for (let y = 0; y < farmGridData.length; y++) {
            for (let x = 0; x < farmGridData[y].length; x++) {
                const blockData = farmGridData[y][x];
                const nextStage = GROWTH_STAGES[blockData.type];
                if (nextStage) {
                    const blockEl = farmBlocks[y][x];
                    blockEl.classList.add('flipping');
                    setTimeout(() => {
                        updateBlockType(x, y, nextStage);
                        blockEl.classList.remove('flipping');
                    }, 300);
                }
            }
        }

        todos = JSON.parse(JSON.stringify(TODOS[currentDay]));
        updateTodoList();
        updateStatus(`Welcome to Day ${currentDay}. Check your new tasks.`);
    }

    // --- DRONE & MOVEMENT ---
    function placeDroneAtWarehouse() {
        let drone = document.getElementById('drone');
        if (!drone) {
            const droneImg = document.querySelector('#drone-block img');
            drone = document.createElement('div');
            drone.id = 'drone';
            drone.style.backgroundImage = `url('${droneImg.src}')`;
            farmContainer.prepend(drone);
        }

        const warehouseBlock = document.getElementById('drone-block');
        const farmContainerRect = farmContainer.getBoundingClientRect();
        const warehouseRect = warehouseBlock.getBoundingClientRect();

        const top = warehouseRect.top - farmContainerRect.top;
        const left = warehouseRect.left - farmContainerRect.left;

        drone.style.transition = 'none';
        drone.style.left = `${left}px`;
        drone.style.top = `${top}px`;
        
        dronePos = { ...warehouseDroneHome };
        isDroneAtBase = true;
        
        setTimeout(() => {
            if(isDroneAtBase) {
                const rechargeInterval = setInterval(() => {
                    if (droneBattery < 100) {
                        updateBattery(droneBattery + 5);
                    } else {
                        clearInterval(rechargeInterval);
                    }
                }, 200);
            }
        }, 2000);
    }
    
    function updateBattery(newValue) {
        droneBattery = Math.max(0, Math.min(100, newValue));
        batteryLevel.style.width = `${droneBattery}%`;
        batteryText.textContent = `${Math.round(droneBattery)}%`;

        if (droneBattery > 60) {
            batteryLevel.style.background = 'linear-gradient(90deg, #ffc400, #00e676)';
        } else if (droneBattery > 20) {
            batteryLevel.style.background = 'linear-gradient(90deg, #ff3d00, #ffc400)';
        } else {
            batteryLevel.style.background = '#ff3d00';
        }
    }

    function placeDrone(x, y) {
        let drone = document.getElementById('drone');
        if (!drone) {
            drone = document.createElement('div');
            drone.id = 'drone';
            farmContainer.prepend(drone);
        }

        drone.style.left = `${x * BLOCK_SIZE_PX}px`;
        drone.style.top = `${y * BLOCK_SIZE_PX}px`;
        
        dronePos = { x, y };
        dronePlaced = true;
        checkSimReady();
    }

    // --- SIMULATION & TASKS ---
        function checkSimReady() {
            if (isSimulating) return;
    
            const task = taskSelect.value;
            
            if (task === 'go-to-selected' && !goalPos) {
                updateStatus('Click a block to set the goal.');
                startBtn.disabled = true;
                return;
            }
            
            startBtn.disabled = false;
            updateStatus('Ready. Press Start.');
        }
    
        function updateBlockType(x, y, newType) {
            const oldType = farmGridData[y][x].type;
            farmGridData[y][x].type = newType;
            const blockEl = farmBlocks[y][x];
            // Clear infection status when type changes
            farmGridData[y][x].infected = false;
            farmGridData[y][x].severity = null;
            renderSeverity(x, y);

            blockEl.classList.remove(oldType);
            blockEl.classList.add(newType);
            updateStats();
        }
    
        // --- OTHER EVENT HANDLERS ---
    
        function onBlockClick(e) {
            const block = e.currentTarget;
            const x = parseInt(block.dataset.x);
            const y = parseInt(block.dataset.y);
    
            const currentType = farmGridData[y][x].type;
    
            if (selectedTool) {
                if (selectedTool === 'pickaxe') {
                    if (currentType === 'grass') {
                        updateBlockType(x, y, 'barren_land');
                    } else if (currentType === 'barren_land') {
                        updateBlockType(x, y, 'plough_land');
                    }
                } else if (selectedTool === 'harvester') {
                    if (currentType === 'final') {
                        updateBlockType(x, y, 'harvested');
                        const harvestTodo = todos.find(t => t.id === 'harvest');
                        if (harvestTodo) {
                            harvestTodo.completed = farmGridData.flat().every(b => b.type !== 'final');
                        }
                        updateTodoList();
                    }
                }
                const prepareLandTodo = todos.find(t => t.id === 'prepare_land');
                if (prepareLandTodo) {
                    prepareLandTodo.completed = !farmGridData.flat().some(b => ['grass', 'barren_land', 'card'].includes(b.type));
                }
                updateTodoList();
                return;
            }
    
            if (taskSelect.value !== 'go-to-selected') return;
    
            goalPos = { x, y };
            
            farmBlocks.flat().forEach(b => b.classList.remove('goal'));
            block.classList.add('goal');
            
            checkSimReady();
        }
    async function handleStartSimulation() {
        if (isSimulating) {
            updateStatus('Simulation already in progress.', true);
            return;
        }

        if (droneBattery <= 10) {
            updateStatus('Drone battery too low! Please wait for it to recharge.', true);
            return;
        }

        isSimulating = true;
        isDroneAtBase = false;
        startBtn.disabled = true;
        updateStatus('Starting simulation...');

        const startPosForPathfinding = { x: 0, y: 0 };
        dronePos = startPosForPathfinding;

        const method = methodSelect.value;
        try {
            if (method === 'explore') {
                await exploreGrid(startPosForPathfinding);
            } else {
                await handlePathBasedTask(startPosForPathfinding);
            }
        } catch (error) {
            console.error('Simulation Error:', error);
            updateStatus(`Error: ${error.message}`, true);
        } finally {
            if (!isDroneAtBase) {
                await returnDroneToBase();
            }
            isSimulating = false;
            startBtn.disabled = false;
            checkSimReady();
        }
    }
    
    async function handlePathBasedTask(startPos) {
        const task = taskSelect.value;
        const method = methodSelect.value;
        let goals = [];

        if (task === 'go-to-selected' && goalPos) {
            goals.push(goalPos);
        } else if (task === 'select-all') {
            for (let y = 0; y < farmGridData.length; y++) {
                for (let x = 0; x < farmGridData[y].length; x++) {
                    const blockType = farmGridData[y][x].type;
                    if (method === 'plant-seeds' && blockType === 'plough_land') {
                        goals.push({x, y});
                    } else if (method === 'pesticide-control' && blockType === 'young') {
                        goals.push({x, y});
                    }
                }
            }
        }

        if (goals.length === 0) {
            updateStatus('No valid targets found for this task.', true);
            return; 
        }

        const payload = {
            grid: farmGridData.map(row => row.map(cell => ({ type: cell.type }))),
            start: startPos,
            goals: goals,
            algorithm: algorithmSelect.value
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Backend server error');
        }

        const result = await response.json();

        if (result.status === 'success' && result.path) {
            updateStatus('Path found! Visualizing...');
            const firstStep = result.path[0];
            if (firstStep) {
                await animateDrone([{x: firstStep.x, y: firstStep.y}]);
            }
            const missionSuccess = await animateDrone(result.path, method);
            if(missionSuccess){
                updateStatus('Task Complete.');
            } else {
                updateStatus('Mission aborted due to low battery.');
            }
        } else {
            updateStatus('No path could be found.', true);
        }
    }

    async function exploreGrid(startPos) {
        const payload = {
            grid: farmGridData.map(row => row.map(cell => ({ type: cell.type }))),
            start: startPos,
            algorithm: 'scan' // Full grid scan
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Backend failed to generate scan path.');
        
        const result = await response.json();
        if (!result.path) throw new Error('No scan path returned.');

        const missionSuccess = await animateDrone(result.path);
        if (!missionSuccess) {
            updateStatus('Exploration aborted due to low battery.');
            return;
        }

        let unlockedCount = 0;
        for (let y = 0; y < farmGridData.length; y++) {
            for (let x = 0; x < farmGridData[y].length; x++) {
                if (farmGridData[y][x].type === 'card') {
                    unlockedCount++;
                    await flipCard(x, y);
                }
            }
        }
        
        if (unlockedCount > 0) {
            showInfoPopup('Exploration Complete', `${unlockedCount} new areas were discovered!`);
        }
        
        todos.find(t => t.id === 'explore').completed = true;
        updateTodoList();
    }

    async function flipCard(x, y) {
        const blockEl = farmBlocks[y][x];
        blockEl.classList.add('flipping');

        let random = Math.random();
        let outcomeType = 'barren_land';
        for (const outcome of CARD_OUTCOMES) {
            if (random < outcome.probability) {
                outcomeType = outcome.type;
                break;
            }
            random -= outcome.probability;
        }

        return new Promise(resolve => {
            setTimeout(() => {
                updateBlockType(x, y, outcomeType);
                blockEl.classList.remove('flipping');
                resolve();
            }, 300);
        });
    }

    async function animateDrone(path, action = 'none') {
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        const drone = document.getElementById('drone');
        drone.style.transition = `left 0.15s linear, top 0.15s linear`;

        for (const step of path) {
            if (droneBattery <= 10) {
                console.log("Battery critical, aborting mission.");
                return false; 
            }

            updateStatus(`Moving to (${step.x}, ${step.y})...`);
            drone.style.left = `${step.x * BLOCK_SIZE_PX}px`;
            drone.style.top = `${step.y * BLOCK_SIZE_PX}px`;
            dronePos = { x: step.x, y: step.y };
            
            updateBattery(droneBattery - 0.5);

            await delay(150);

            const blockType = farmGridData[step.y][step.x].type;
            if (action === 'plant-seeds' && blockType === 'plough_land') {
                updateBlockType(step.x, step.y, 'germinated');
                updateBattery(droneBattery - 2); 
            } else if (action === 'pesticide-control' && blockType === 'young') {
                farmBlocks[step.y][step.x].classList.remove('needs-pesticide');
                // In automated mode, this would be where we clear infection
                farmGridData[step.y][step.x].infected = false;
                farmGridData[step.y][step.x].severity = null;
                renderSeverity(step.x, step.y);

                updateBattery(droneBattery - 2); 
            }
        }

        if (action === 'plant-seeds') {
            todos.find(t => t.id === 'plant_seeds').completed = farmGridData.flat().every(b => b.type !== 'plough_land');
        } else if (action === 'pesticide-control') {
            todos.find(t => t.id === 'pesticide').completed = true;
        }
        updateTodoList();
        return true;
    }

    async function returnDroneToBase() {
        updateStatus('Task finished, returning to warehouse...');
        
        placeDroneAtWarehouse();
        
        return new Promise(resolve => setTimeout(resolve, 500)); 
    }

    // --- POPUPS & NOTIFICATIONS ---
    function populateFinalStats() {
        finalStats.innerHTML = `
            <p>Total Lands: <span id="final-total-lands">${totalLandsStatus.textContent}</span></p>
            <p>Obstacles: <span id="final-obstacles">${obstaclesStatus.textContent}</span></p>
            <p>Farming Area: <span id="final-farming-area">${farmingAreaStatus.textContent}</span></p>
            <p>Crops Collected: <span id="final-crops-collected">${cropsCollectedStatus.textContent}</span></p>
        `;
    }

    function showCongratsPopup() {
        populateFinalStats();
        congratsPopup.classList.remove('popup-hidden');
        congratsPopup.classList.add('popup-visible');
    }

    function hideCongratsPopup() {
        congratsPopup.classList.add('popup-hidden');
        congratsPopup.classList.remove('popup-visible');
        setTimeout(createFarmGrid, 500);
    }

    function showInfoPopup(title, message) {
        infoPopupTitle.textContent = title;
        infoPopupMessage.textContent = message;
        infoPopup.classList.remove('popup-hidden');
        infoPopup.classList.add('popup-visible');
    }

    function hideInfoPopup() {
        infoPopup.classList.add('hidden');
        infoPopup.classList.remove('visible');
    }

    // --- AUTOMATED MODE LOGIC ---
    function handleNextDay() {
        currentDay++;
        dayDisplay.textContent = currentDay;
        advanceDay();
    }

    function handleAutomatedDayChange() {
        if (currentDay >= 20) {
            stopAutomatedMode();
            updateStatus('Simulation finished!');
            returnDroneToBase().then(showCongratsPopup);
            return;
        }

        // 1. Infect new plants (up to 3)
        const youngPlants = [];
        farmGridData.forEach((row, y) => row.forEach((cell, x) => {
            if (cell.type === 'young' && !cell.infected) {
                youngPlants.push({ x, y });
            }
        }));

        youngPlants.sort(() => 0.5 - Math.random()); // Shuffle

        for (let i = 0; i < Math.min(3, youngPlants.length); i++) {
            const { x, y } = youngPlants[i];
            const severityLevels = ['Low', 'Medium', 'High'];
            const severity = severityLevels[Math.floor(Math.random() * severityLevels.length)];
            farmGridData[y][x].infected = true;
            farmGridData[y][x].severity = severity;
            renderSeverity(x, y);
            updateStatus(`Infection detected at [${y}, ${x}] with ${severity} severity.`);
        }

        // 2. Grow plants from day 18
        if (currentDay >= 18) {
            const youngToGrow = [];
            farmGridData.forEach((row, y) => row.forEach((cell, x) => {
                if (cell.type === 'young') youngToGrow.push({x, y});
            }));

            if (youngToGrow.length > 0) {
                const numToGrow = Math.max(1, Math.floor(Math.random() * youngToGrow.length / (20 - currentDay + 1)));
                youngToGrow.sort(() => 0.5 - Math.random());
                for (let i = 0; i < Math.min(numToGrow, youngToGrow.length); i++) {
                    const {x, y} = youngToGrow[i];
                    updateBlockType(x, y, 'final');
                }
            }
        }

        // 3. Run drone sequence for this day
        runAutomatedDroneSequence();
    }

    function startDayTimer() {
        dayChangeCountdown = 15;
        dayTimerDisplay.textContent = `Next Day: ${dayChangeCountdown}s`;
        dayTimerInterval = setInterval(() => {
            dayChangeCountdown--;
            dayTimerDisplay.textContent = `Next Day: ${dayChangeCountdown}s`;
            if (dayChangeCountdown <= 0) {
                dayChangeCountdown = 15; // Reset for next cycle
            }
        }, 1000);
    }

    function stopAutomatedMode() {
        clearInterval(automatedModeInterval);
        clearInterval(dayTimerInterval);
        dayTimerDisplay.textContent = '';
        automatedModeInterval = null;
        dayTimerInterval = null;
        updateStatus('Automated pesticide control complete.');
    }

    async function runAutomatedDroneSequence() { // Placeholder for now
        updateStatus(`Day ${currentDay}: Scanning for infections...`);
        const infectedGoals = [];
        farmGridData.forEach((row, y) => row.forEach((cell, x) => {
            if (cell.infected) infectedGoals.push({x, y});
        }));

        if (infectedGoals.length > 0) {
            updateStatus(`Found ${infectedGoals.length} infections. Deploying drone...`);
            // This is where the call to the RL model and drone animation would go.
            // For now, we'll just log it.
            console.log("Automated drone would now handle these targets:", infectedGoals);
        } else {
            updateStatus(`Day ${currentDay}: No infections found.`);
        }
    }

    function showModeChoicePopup() {
        modeChoicePopup.classList.remove('popup-hidden');
        modeChoicePopup.classList.add('popup-visible');
    }

    function hideModeChoicePopup() {
        modeChoicePopup.classList.add('popup-hidden');
        modeChoicePopup.classList.remove('popup-visible');
    }

    // --- EVENT LISTENERS & INITIALIZATION ---
    // --- INITIALIZATION ---
    createGridBtn.addEventListener('click', () => createFarmGrid(false));
    startBtn.addEventListener('click', handleStartSimulation);
    nextDayBtn.addEventListener('click', advanceDay);
    closeCongratsBtn.addEventListener('click', hideCongratsPopup);
    closeInfoBtn.addEventListener('click', hideInfoPopup);

    pickaxeTool.addEventListener('click', onToolClick);
    harvesterTool.addEventListener('click', onToolClick);

    taskSelect.addEventListener('change', checkSimReady);
    methodSelect.addEventListener('change', checkSimReady);
    algorithmSelect.addEventListener('change', checkSimReady);

    homeTabBtn.addEventListener('click', () => {
        switchTab('home');
        createFarmGrid(false);
    });
    trainingTabBtn.addEventListener('click', () => {
        switchTab('training');
        createFarmGrid(true);
    });
    infectionChanceSlider.addEventListener('input', () => infectionChanceValue.textContent = infectionChanceSlider.value);
    windSpeedSlider.addEventListener('input', () => windSpeedValue.textContent = windSpeedSlider.value);
    startTrainingBtn.addEventListener('click', startTraining);

    normalModeBtn.addEventListener('click', chooseNormalMode);
    automatedModeBtn.addEventListener('click', startAutomatedMode);

    createFarmGrid();
    updateStatus('Welcome! Create your farm or use the default.');


    document.addEventListener('mousemove', e => {
        cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    });
});