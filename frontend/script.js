document.addEventListener('DOMContentLoaded', () => {

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

    let farmGridData = [];
    let farmBlocks = [];
    let dronePlaced = false;
    let dronePos = { x: 0, y: 0 };
    let goalPos = null;
    let draggedItemInfo = null;
    let currentDay = 0;
    let todos = [];

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

    const draggableItems = document.querySelectorAll('.item');
    const dustbin = document.getElementById('dustbin');

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


    // --- CORE FUNCTIONS ---

    function updateStatus(text, isError = false) {
        statusText.textContent = text;
        statusText.style.color = isError ? 'var(--error-color)' : 'var(--text-light)';
    }

    function createFarmGrid() {
        const width = parseInt(farmWidthInput.value);
        const height = parseInt(farmHeightInput.value);

        if (width <= 0 || height <= 0) {
            updateStatus('Invalid grid size.', true);
            return;
        }

        farmGrid.innerHTML = '';
        pathOverlay.innerHTML = '';
        farmGridData = [];
        farmBlocks = [];
        dronePlaced = false;
        goalPos = null;
        startBtn.disabled = true;
        nextDayBtn.disabled = true;
        nextDayBtn.textContent = 'Next Day';
        currentDay = 0;

        const gridWidth = width * BLOCK_SIZE_PX;
        const gridHeight = height * BLOCK_SIZE_PX;

        farmGrid.style.width = `${gridWidth}px`;
        farmGrid.style.height = `${gridHeight}px`;
        farmGrid.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
        farmGrid.style.gridTemplateRows = `repeat(${height}, 1fr)`;

        pathOverlay.style.width = `${gridWidth}px`;
        pathOverlay.style.height = `${gridHeight}px`;

        for (let y = 0; y < height; y++) {
            const rowData = [];
            const rowBlocks = [];
            for (let x = 0; x < width; x++) {
                const type = y === 0 ? 'barren_land' : 'card';
                rowData.push({ type: type });
                const block = document.createElement('div');
                block.classList.add('farm-block', type);
                block.dataset.x = x;
                block.dataset.y = y;

                block.addEventListener('dragover', onDragOver);
                block.addEventListener('dragenter', onDragEnter);
                block.addEventListener('dragleave', onDragLeave);
                block.addEventListener('drop', onDropOnBlock);
                block.addEventListener('click', onBlockClick);
                block.setAttribute('draggable', true);
                block.addEventListener('dragstart', onBlockDragStart);

                farmGrid.appendChild(block);
                rowBlocks.push(block);
            }
            farmGridData.push(rowData);
            farmBlocks.push(rowBlocks);
        }
        
        const droneEl = document.getElementById('drone');
        if (droneEl) droneEl.remove();

        dayDisplay.textContent = currentDay;
        todos = JSON.parse(JSON.stringify(TODOS[currentDay])); // Deep copy
        updateTodoList();
        updateStats();
        updateStatus('Farm created. Place drone to begin.');
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
        if (allCompleted) {
            if (TODOS[currentDay + 10]) {
                nextDayBtn.disabled = false;
                updateStatus('All tasks for the day complete! You can proceed to the next day.');
            } else {
                // This is the final day
                nextDayBtn.textContent = 'Finish';
                nextDayBtn.disabled = false;
                updateStatus('All tasks complete! Press Finish to see your results.');
            }
        }
    }

    function advanceDay() {
        if (nextDayBtn.textContent === 'Finish') {
            showCongratsPopup();
            return;
        }

        const droneEl = document.getElementById('drone');
        if (droneEl) {
            droneEl.remove();
            dronePlaced = false;
        }
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
                        if (nextStage === 'young') {
                            blockEl.classList.add('needs-pesticide');
                        }
                    }, 300);
                }
            }
        }

        todos = JSON.parse(JSON.stringify(TODOS[currentDay]));
        updateTodoList();
        updateStatus(`Welcome to Day ${currentDay}. Check your new tasks.`);
    }

    function placeDrone(x, y) {
        let drone = document.getElementById('drone');
        if (!drone) {
            drone = document.createElement('div');
            drone.id = 'drone';
            farmContainer.prepend(drone);
            drone.setAttribute('draggable', 'true');
            drone.addEventListener('dragstart', onDroneDragStart);
        }

        drone.style.left = `${x * BLOCK_SIZE_PX}px`;
        drone.style.top = `${y * BLOCK_SIZE_PX}px`;
        
        dronePos = { x, y };
        dronePlaced = true;
        checkSimReady();
    }

    function checkSimReady() {
        const task = taskSelect.value;
        const method = methodSelect.value;

        if (!dronePlaced) {
            updateStatus('Place the drone on the farm.');
            startBtn.disabled = true;
            return;
        }

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
        blockEl.classList.remove(oldType);
        blockEl.classList.add(newType);
        updateStats();
    }

    // --- DRAG-AND-DROP HANDLERS ---

    function onDragStart(e) {
        draggedItemInfo = {
            id: e.target.id,
            type: e.target.dataset.itemType,
            source: 'panel'
        };
        e.dataTransfer.effectAllowed = 'move';
    }

    function onBlockDragStart(e) {
        const x = parseInt(e.target.dataset.x);
        const y = parseInt(e.target.dataset.y);
        const type = farmGridData[y][x].type;

        if (type !== 'barren_land' && type !== 'card') {
            draggedItemInfo = {
                type: 'block-clear',
                x: x,
                y: y,
                el: e.target
            };
            e.dataTransfer.effectAllowed = 'move';
        } else {
            e.preventDefault();
        }
    }

    function onDroneDragStart(e) {
        draggedItemInfo = {
            id: 'drone',
            type: 'vehicle-on-farm'
        };
        e.dataTransfer.effectAllowed = 'move';
    }

    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function onDragEnter(e) {
        const target = e.target;
        if (target.classList.contains('farm-block') || target.id === 'dustbin') {
            target.classList.add('drag-over');
        }
    }

    function onDragLeave(e) {
        const target = e.target;
        if (target.classList.contains('farm-block') || target.id === 'dustbin') {
            target.classList.remove('drag-over');
        }
    }

    function onDropOnBlock(e) {
        e.preventDefault();
        const targetBlock = e.target.closest('.farm-block');
        if (!targetBlock || !draggedItemInfo) return;

        targetBlock.classList.remove('drag-over');
        const x = parseInt(targetBlock.dataset.x);
        const y = parseInt(targetBlock.dataset.y);
        const currentType = farmGridData[y][x].type;

        if (draggedItemInfo.type === 'vehicle') {
            placeDrone(x, y);
        } else if (draggedItemInfo.type === 'tool') {
            const tool = draggedItemInfo.id;
            if (tool === 'pickaxe') {
                if (currentType === 'grass') {
                    updateBlockType(x, y, 'barren_land');
                } else if (currentType === 'barren_land') {
                    updateBlockType(x, y, 'plough_land');
                }
            } else if (tool === 'harvester') {
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
        }
    }

    function onDropOnDustbin(e) {
        e.preventDefault();
        dustbin.classList.remove('drag-over');
        if (!draggedItemInfo) return;

        if (draggedItemInfo.type === 'block-clear') {
            const { x, y, el } = draggedItemInfo;
            updateBlockType(x, y, 'barren_land');
        } else if (draggedItemInfo.type === 'vehicle-on-farm') {
            const droneEl = document.getElementById('drone');
            if (droneEl) droneEl.remove();
            dronePlaced = false;
            checkSimReady();
        }
    }

    // --- OTHER EVENT HANDLERS ---

    function onBlockClick(e) {
        if (taskSelect.value !== 'go-to-selected') return;

        const block = e.currentTarget;
        goalPos = {
            x: parseInt(block.dataset.x),
            y: parseInt(block.dataset.y)
        };
        
        farmBlocks.flat().forEach(b => b.classList.remove('goal'));
        block.classList.add('goal');
        
        checkSimReady();
    }

    async function handleStartSimulation() {
        if (!dronePlaced) {
            updateStatus('Place the drone first!', true);
            return;
        }

        startBtn.disabled = true;
        updateStatus('Starting simulation...');

        const method = methodSelect.value;
        if (method === 'explore') {
            await exploreGrid();
        } else {
            // Handle path-based tasks
            const task = taskSelect.value;
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

            if (goals.length === 0 && task !== 'go-to-selected') {
                updateStatus('No valid targets found for this task.', true);
                startBtn.disabled = false;
                return;
            }

            const payload = {
                grid: farmGridData.map(row => row.map(cell => ({ type: cell.type }))),
                start: dronePos,
                goals: goals,
                algorithm: algorithmSelect.value
            };
            
            try {
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
                    await animateDrone(result.path, method);
                    updateStatus('Task Complete.');
                } else {
                    updateStatus('No path could be found.', true);
                }

            } catch (error) {
                console.error('Simulation Error:', error);
                updateStatus(`Error: ${error.message}`, true);
            }
        }

        startBtn.disabled = false;
        checkSimReady();
    }

    async function exploreGrid() {
        const payload = {
            grid: farmGridData.map(row => row.map(cell => ({ type: cell.type }))),
            start: dronePos,
            algorithm: 'scan' // Full grid scan
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Backend failed to generate scan path.');
            
            const result = await response.json();
            if (!result.path) throw new Error('No scan path returned.');

            await animateDrone(result.path);

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

        } catch (error) {
            console.error('Exploration Error:', error);
            updateStatus(`Exploration failed: ${error.message}`, true);
        }
    }

    async function flipCard(x, y) {
        const blockEl = farmBlocks[y][x];
        blockEl.classList.add('flipping');

        // Determine outcome
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
            }, 300); // Halfway through animation
        });
    }

    async function animateDrone(path, action = 'none') {
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        const drone = document.getElementById('drone');

        for (const step of path) {
            updateStatus(`Moving to (${step.x}, ${step.y})...`);
            drone.style.left = `${step.x * BLOCK_SIZE_PX}px`;
            drone.style.top = `${step.y * BLOCK_SIZE_PX}px`;
            dronePos = { x: step.x, y: step.y };
            await delay(150);

            // Perform action at the destination of a path segment
            const blockType = farmGridData[step.y][step.x].type;
            if (action === 'plant-seeds' && blockType === 'plough_land') {
                updateBlockType(step.x, step.y, 'germinated');
            } else if (action === 'pesticide-control' && blockType === 'young') {
                farmBlocks[step.y][step.x].classList.remove('needs-pesticide');
            }
        }

        // After path is complete, update todos
        if (action === 'plant-seeds') {
            todos.find(t => t.id === 'plant_seeds').completed = farmGridData.flat().every(b => b.type !== 'plough_land');
        } else if (action === 'pesticide-control') {
            todos.find(t => t.id === 'pesticide').completed = true;
        }
        updateTodoList();
    }

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
        // Use a timeout to allow the animation to finish before resetting
        setTimeout(createFarmGrid, 500);
    }

    function showInfoPopup(title, message) {
        infoPopupTitle.textContent = title;
        infoPopupMessage.textContent = message;
        infoPopup.classList.remove('popup-hidden');
        infoPopup.classList.add('popup-visible');
    }

    function hideInfoPopup() {
        infoPopup.classList.add('popup-hidden');
        infoPopup.classList.remove('popup-visible');
    }

    // --- INITIALIZATION ---
    createGridBtn.addEventListener('click', createFarmGrid);
    startBtn.addEventListener('click', handleStartSimulation);
    nextDayBtn.addEventListener('click', advanceDay);
    closeCongratsBtn.addEventListener('click', hideCongratsPopup);
    closeInfoBtn.addEventListener('click', hideInfoPopup);

    draggableItems.forEach(item => {
        item.addEventListener('dragstart', onDragStart);
    });

    dustbin.addEventListener('dragover', onDragOver);
    dustbin.addEventListener('dragenter', onDragEnter);
    dustbin.addEventListener('dragleave', onDragLeave);
    dustbin.addEventListener('drop', onDropOnDustbin);

    taskSelect.addEventListener('change', checkSimReady);
    methodSelect.addEventListener('change', checkSimReady);
    algorithmSelect.addEventListener('change', checkSimReady);
    
    createFarmGrid();
    updateStatus('Welcome! Create your farm or use the default.');
});
