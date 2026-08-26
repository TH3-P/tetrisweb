let currentUser = null;
let gameMode = 'arcade';
let dropCounter = 0;
let baseSpeed = 1000;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let gameOver = false;

const POINTS_PER_LEVEL = 100;
const bossTutorialsShown = new Set();
let currentBossRule = null;

// IA Y MODO VS
let aiMoveCounter = 0;
let aiMoveInterval = 150; 
let aiDropDelay = 200;    
let aiState = 'MOVING';   
let aiAccuracy = 0.75;    

let aiArena = createMatrix(12, 20);
let aiPlayer = {
    pos: { x: 0, y: 0 },
    matrix: null,
    nextMatrix: null,
    targetX: 0,
    targetRotation: 0
};

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');

const canvasNext = document.getElementById('next');
const contextNext = canvasNext.getContext('2d');

const arena = createMatrix(12, 20);

const PIECES = 'TJLOSZI';
const COLORS = [
    null,
    '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE135', '#3877FF',
    '#777777'
];

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    glitchMatrix: null,
    fakeMatrix: null,
    nextMatrix: null,
    score: 0,
    level: 1
};

const BOSS_RULES = [
    {
        id: 'controls_fog',
        title: '🌫️ Controles Invertidos y Niebla',
        description: 'Mover a la izquierda te moverá a la derecha y viceversa.<br>El centro del tablero está oscurecido por niebla.'
    },
    {
        id: 'upside_down',
        title: '🙃 De Cabeza',
        description: 'El tablero está invertido visualmente.<br>¡Observa tus movimientos al revés!'
    },
    {
        id: 'glitch',
        title: '👾 Glitch',
        description: '¡La pieza sufre fallos de color y genera siluetas falsas de proyección en el tablero!'
    },
    {
        id: 'mirror',
        title: '🪞 Reflejo',
        description: 'Al colocar tu pieza, una copia exacta se colocará simétricamente reflejada en gris al otro lado del tablero.'
    },
    {
        id: 'phantoms',
        title: '👻 Phantoms (Proyección Dual)',
        description: 'El tablero está dividido por la mitad horizontalmente.<br>Mientras cae la pieza arriba, su duplicado se proyecta abajo.'
    },
    {
        id: 'vs',
        title: '⚔️ Tetris VS IA',
        description: '¡Duelo estilo Tetris 99! Completa 2 o más líneas para enviarle basura a la IA.<br>¡Gana consiguiendo 150 pts!'
    }
];

function loadSettings() {
    const savedMultiplier = localStorage.getItem('tetris_speed_multiplier') || '1';
    const slider = document.getElementById('speed-slider');
    const display = document.getElementById('speed-value-display');
    
    if (slider) {
        slider.value = savedMultiplier;
        updateSpeedFromMultiplier(parseFloat(savedMultiplier));
    }
    if (display) {
        display.innerText = `x${savedMultiplier}`;
    }
}

function updateSpeedFromMultiplier(multiplier) {
    baseSpeed = 1000 / multiplier;
    dropInterval = Math.max(100, baseSpeed - (player.level - 1) * 100);
}

function openSettingsModal() {
    isPaused = true;
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    const slider = document.getElementById('speed-slider');
    if (slider) {
        const val = slider.value;
        localStorage.setItem('tetris_speed_multiplier', val);
        updateSpeedFromMultiplier(parseFloat(val));
    }
    document.getElementById('settings-modal').style.display = 'none';
    isPaused = false;
    lastTime = performance.now();
}

function showGameOverModal() {
    MusicEngine.stop();
    MusicEngine.playGameOverJingle();
    document.getElementById('gameover-modal').style.display = 'flex';
}

function closeGameOverModal() {
    document.getElementById('gameover-modal').style.display = 'none';
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function checkSession() {
    const session = localStorage.getItem('tetris_session');
    if (session) {
        currentUser = session;
        document.getElementById('user-display').innerText = currentUser;
        showScreen('screen-menu');
        MusicEngine.playTrack('menu');
    } else {
        showScreen('screen-auth');
    }
}

function startGame(mode) {
    gameMode = mode;
    let title = '🎮 MODO ARCADE';
    if (mode === 'bossrush') title = '👾 MODO BOSS RUSH';
    else if (mode === 'vs') title = '⚔️ MODO VS IA DEDICADO';
    
    document.getElementById('mode-title').innerText = title;
    showScreen('screen-game');
    resetGame();
    MusicEngine.playTrack(mode);
}

function getLocalUsers() { return JSON.parse(localStorage.getItem('tetris_users') || '{}'); }
function saveLocalUsers(users) { localStorage.setItem('tetris_users', JSON.stringify(users)); }
function getLocalScores() { return JSON.parse(localStorage.getItem('tetris_scores') || '[]'); }
function saveLocalScores(scores) { localStorage.setItem('tetris_scores', JSON.stringify(scores)); }

function getOrCreateBossModal() {
    let modal = document.getElementById('boss-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'boss-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(3, 2, 10, 0.88)';
        modal.style.display = 'none';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '9999';
        modal.style.backdropFilter = 'blur(3px)';

        modal.innerHTML = `
            <div style="font-family: 'Space Mono', monospace; background: linear-gradient(180deg, #1c1638, #130f28); border: 1px solid #F538FF; padding: 25px; border-radius: 12px; text-align: center; max-width: 340px; color: #EDEBFF; box-shadow: 0 0 0 1px rgba(245,56,255,0.2), 0 0 45px rgba(245, 56, 255, 0.35), 0 20px 50px rgba(0,0,0,0.7);">
                <h2 style="font-family: 'Press Start 2P', monospace; font-size: 1rem; line-height: 1.6; color: #FF0D72; margin-top: 0; text-shadow: 0 0 10px rgba(255,13,114,0.6);">👾 ¡NIVEL DE JEFE!</h2>
                <div id="boss-modal-text" style="margin: 15px 0; font-size: 13px; line-height: 1.5;"></div>
                <button id="boss-modal-close" style="font-family: 'Space Mono', monospace; background: #FF0D72; color: #fff; border: none; padding: 12px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 0 #b8004f, 0 0 14px rgba(255,13,114,0.4);">¡ENTENDIDO!</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('boss-modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
            isPaused = false;
            lastTime = performance.now();
        });
    }
    return modal;
}

function setupBossLevel(level) {
    const selectedRule = BOSS_RULES[Math.floor(Math.random() * BOSS_RULES.length)];
    currentBossRule = selectedRule.id;

    if (currentBossRule === 'vs') {
        initAI();
    }

    triggerBossTutorial(level, selectedRule);
}

function triggerBossTutorial(level, ruleObj) {
    if (bossTutorialsShown.has(ruleObj.id) && gameMode !== 'bossrush') return;
    bossTutorialsShown.add(ruleObj.id);

    isPaused = true;
    const modal = getOrCreateBossModal();
    const modalText = document.getElementById('boss-modal-text');

    modalText.innerHTML = `
        <strong>NUEVA REGLA DE JEFE (Nivel ${level}):</strong><br><br>
        <div style="font-size: 16px; color: #FFE135; margin-bottom: 8px;">${ruleObj.title}</div>
        ${ruleObj.description}
    `;

    modal.style.display = 'flex';
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function createPiece(type) {
    if (type === 'I') return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
    if (type === 'L') return [[0,3,0],[0,3,0],[0,3,3]];
    if (type === 'J') return [[0,2,0],[0,2,0],[2,2,0]];
    if (type === 'O') return [[4,4],[4,4]];
    if (type === 'Z') return [[6,6,0],[0,6,6],[0,0,0]];
    if (type === 'S') return [[0,5,5],[5,5,0],[0,0,0]];
    if (type === 'T') return [[0,1,0],[1,1,1],[0,0,0]];
}

function generateDifferentFakePiece(currentMatrix) {
    let otherPieces = PIECES.split('');
    let selectedType;
    let candidate;

    // Selecciona una pieza que sea estructuralmente diferente a la actual
    do {
        selectedType = otherPieces[Math.floor(Math.random() * otherPieces.length)];
        candidate = createPiece(selectedType);
    } while (candidate.length === currentMatrix.length && candidate[0].length === currentMatrix[0].length && candidate.toString() === currentMatrix.toString());

    return candidate;
}

function isBossLevel() {
    return gameMode === 'bossrush' || (gameMode === 'arcade' && player.level % 3 === 0);
}

function isVsModeActive() {
    return gameMode === 'vs' || (isBossLevel() && currentBossRule === 'vs');
}

function drawMatrix(matrix, offset, ctx = context, isGhost = false, overrideColor = null, offsetX = 0, offsetY = 0) {
    if (!matrix) return;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                let drawX = x + offset.x + offsetX;
                let drawY = y + offset.y + offsetY;

                if (drawY < 0 || drawY >= 20) return;

                if (ctx === context && isBossLevel() && currentBossRule === 'upside_down') {
                    drawY = 19 - (y + offset.y);
                }

                if (isGhost) {
                    ctx.fillStyle = overrideColor || 'rgba(255, 255, 255, 0.35)';
                    ctx.fillRect(drawX, drawY, 1, 1);
                    ctx.lineWidth = 0.08;
                    ctx.strokeStyle = overrideColor || COLORS[value];
                    ctx.strokeRect(drawX, drawY, 1, 1);
                } else {
                    ctx.fillStyle = overrideColor || COLORS[value];
                    ctx.fillRect(drawX, drawY, 1, 1);
                    ctx.lineWidth = 0.05;
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(drawX, drawY, 1, 1);
                }
            }
        });
    });
}

function drawBossOverlays() {
    if (!isBossLevel()) return;

    if (currentBossRule === 'controls_fog') {
        context.fillStyle = 'rgba(20, 0, 30, 0.85)';
        context.fillRect(2, 6, 8, 8); 
        context.fillStyle = '#FF2222';
        context.font = '1px sans-serif';
        context.fillText('NIEBLA', 4, 10);
    } 
    else if (currentBossRule === 'phantoms') {
        context.strokeStyle = '#FF2222';
        context.lineWidth = 0.15;
        context.beginPath();
        context.moveTo(0, 10);
        context.lineTo(12, 10);
        context.stroke();
    }
}

function getGhostPosition(offsetX = 0) {
    if (!player.matrix) return null;
    
    const activeMatrix = player.glitchMatrix || player.matrix;
    const ghostPos = { x: player.pos.x + offsetX, y: player.pos.y };

    while (!collide(arena, { pos: ghostPos, matrix: activeMatrix })) {
        ghostPos.y++;
    }
    ghostPos.y--;
    
    return ghostPos;
}

function drawNextPiece() {
    contextNext.setTransform(1, 0, 0, 1, 0, 0);
    contextNext.fillStyle = '#000';
    contextNext.fillRect(0, 0, canvasNext.width, canvasNext.height);

    const scaleNextX = canvasNext.width / 4;
    const scaleNextY = canvasNext.height / 4;
    contextNext.scale(scaleNextX, scaleNextY);

    if (player.nextMatrix) {
        if (isBossLevel() && currentBossRule === 'glitch') {
            contextNext.fillStyle = '#FF2222';
            contextNext.font = '2px sans-serif';
            contextNext.fillText('?', 1.5, 2.5);
            return;
        }

        const offset = {
            x: (4 - player.nextMatrix[0].length) / 2,
            y: (4 - player.nextMatrix.length) / 2
        };
        drawMatrix(player.nextMatrix, offset, contextNext);
    }
}

function drawMirrorPiece() {
    if (!player.matrix) return;
    const drawMat = player.glitchMatrix || player.matrix;
    const mirroredMatrix = drawMat.map(row => [...row].reverse());
    const mirroredX = 12 - player.pos.x - player.matrix[0].length;
    drawMatrix(mirroredMatrix, { x: mirroredX, y: player.pos.y }, context, false, '#777777');
}

function drawAIDuel() {
    drawMatrix(arena, { x: 0, y: 0 }, context);
    if (player.matrix) {
        const activeDrawMatrix = player.glitchMatrix || player.matrix;
        const ghostPos = getGhostPosition();
        if (ghostPos) drawMatrix(activeDrawMatrix, ghostPos, context, true);
        
        drawMatrix(activeDrawMatrix, player.pos, context);
    }

    context.fillStyle = '#FF2222';
    context.fillRect(11.9, 0, 0.2, 20);

    drawMatrix(aiArena, { x: 0, y: 0 }, context, false, null, 12, 0);
    if (aiPlayer.matrix) {
        drawMatrix(aiPlayer.matrix, aiPlayer.pos, context, false, '#FF4444', 12, 0);
    }
}

function draw() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (isVsModeActive()) {
        const scaleX = canvas.width / 24;
        const scaleY = canvas.height / 20;
        context.scale(scaleX, scaleY);

        drawAIDuel();

        if (isPaused && !gameOver) {
            context.fillStyle = 'rgba(0, 0, 0, 0.75)';
            context.fillRect(0, 0, 24, 20);

            context.fillStyle = '#FFE135';
            context.font = 'bold 2px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('PAUSA', 12, 10);
        }
        return;
    }

    const scaleX = canvas.width / 12;
    const scaleY = canvas.height / 20;
    context.scale(scaleX, scaleY);

    drawMatrix(arena, { x: 0, y: 0 });

    if (player.matrix) {
        const activeDrawMatrix = player.glitchMatrix || player.matrix;
        const ghostPos = getGhostPosition(0);
        
        if (ghostPos) {
            // Silueta fantasma real en el fondo
            drawMatrix(activeDrawMatrix, ghostPos, context, true);

            // Silueta fantasma falsa desalineada (glitch en el fondo)
            if (isBossLevel() && currentBossRule === 'glitch') {
                const fakeOffset = (player.pos.x > 5) ? -3 : 3;
                const fakeGhostPos = getGhostPosition(fakeOffset);
                if (fakeGhostPos && fakeGhostPos.x >= 0 && fakeGhostPos.x < 12) {
                    drawMatrix(activeDrawMatrix, fakeGhostPos, context, true, 'rgba(255, 0, 100, 0.4)');
                }
            }

            if (isBossLevel() && currentBossRule === 'phantoms' && ghostPos.y + 10 < 20) {
                drawMatrix(activeDrawMatrix, { x: ghostPos.x, y: ghostPos.y + 10 }, context, true);
            }
        }
        
        if (isBossLevel() && currentBossRule === 'mirror') {
            drawMirrorPiece();
        }

        // Renderizado de la pieza activa
        drawMatrix(activeDrawMatrix, player.pos);

       // SILUETA GLITCH DE UNA PIEZA DISTINTA SOBRE LA PIEZA QUE CAE (SÓLIDA / MISMA OPACIDAD)
if (isBossLevel() && currentBossRule === 'glitch' && player.fakeMatrix) {
    drawMatrix(player.fakeMatrix, player.pos, context, false);
}

        if (isBossLevel() && currentBossRule === 'phantoms' && player.pos.y + 10 < 20) {
            drawMatrix(activeDrawMatrix, { x: player.pos.x, y: player.pos.y + 10 });
        }
    }

    drawBossOverlays();

    if (isPaused && !gameOver) {
        context.fillStyle = 'rgba(0, 0, 0, 0.75)';
        context.fillRect(0, 0, 12, 20);

        context.fillStyle = '#FFE135';
        context.font = 'bold 1.5px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('PAUSA', 6, 10);
    }
}

function collide(targetArena, playerObj) {
    const m = playerObj.matrix;
    const o = playerObj.pos;
    if (!m) return false;

    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0) {
                const targetX = x + o.x;
                const targetY = y + o.y;

                if (targetX < 0 || targetX >= 12 || targetY >= 20) return true;
                if (targetArena[targetY] && targetArena[targetY][targetX] !== 0) return true;
            }
        }
    }
    return false;
}

function merge(targetArena, playerObj) {
    const activeMatrix = playerObj.glitchMatrix || playerObj.matrix;

    activeMatrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const targetY = y + playerObj.pos.y;
                const targetX = x + playerObj.pos.x;
                if (targetY >= 0 && targetY < 20 && targetX >= 0 && targetX < 12) {
                    targetArena[targetY][targetX] = value;
                }
            }
        });
    });

    if (targetArena === arena) {
        if (isBossLevel() && currentBossRule === 'mirror') {
            const mirroredMatrix = activeMatrix.map(row => [...row].reverse());
            const mirroredX = 12 - playerObj.pos.x - playerObj.matrix[0].length;

            mirroredMatrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const targetY = y + playerObj.pos.y;
                        const targetX = x + mirroredX;
                        if (targetY >= 0 && targetY < 20 && targetX >= 0 && targetX < 12) {
                            targetArena[targetY][targetX] = 8;
                        }
                    }
                });
            });
        }

        if (isBossLevel() && currentBossRule === 'phantoms') {
            const phantomY = playerObj.pos.y + 10;
            if (!collide(arena, { pos: { x: playerObj.pos.x, y: phantomY }, matrix: playerObj.matrix })) {
                activeMatrix.forEach((row, y) => {
                    row.forEach((value, x) => {
                        if (value !== 0) {
                            const targetY = y + phantomY;
                            const targetX = x + playerObj.pos.x;
                            if (targetY >= 0 && targetY < 20 && targetX >= 0 && targetX < 12) {
                                targetArena[targetY][targetX] = value;
                            }
                        }
                    });
                });
            }
        }
    }
}

function sendGarbage(targetGrid, linesCount) {
    let garbageLines = 0;
    if (linesCount === 2) garbageLines = 1;
    else if (linesCount === 3) garbageLines = 2;
    else if (linesCount >= 4) garbageLines = 4;

    if (garbageLines === 0) return;

    for (let i = 0; i < garbageLines; i++) {
        targetGrid.shift();
        const hole = Math.floor(Math.random() * 12);
        const newRow = new Array(12).fill(8);
        newRow[hole] = 0;
        targetGrid.push(newRow);
    }
}

function updateAIDifficulty() {
    if (gameMode === 'vs') {
        aiMoveInterval = Math.max(60, 180 - (player.level - 1) * 15);
        aiDropDelay = Math.max(80, 250 - (player.level - 1) * 20);
        aiAccuracy = Math.min(1.0, 0.70 + (player.level - 1) * 0.05);
    } else {
        aiMoveInterval = 140;
        aiDropDelay = 200;
        aiAccuracy = 0.80;
    }
}

function advanceLevel() {
    player.level++;
    dropInterval = Math.max(100, baseSpeed - (player.level - 1) * 100);
    arena.forEach(row => row.fill(0));

    updateAIDifficulty();

    if (isBossLevel()) {
        setupBossLevel(player.level);
    } else {
        currentBossRule = null;
    }
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        player.score += Math.pow(2, rowCount - 1) * 10;
        if (isVsModeActive()) {
            sendGarbage(aiArena, rowCount);
        }
    }

    let targetPoints = POINTS_PER_LEVEL;
    if (isBossLevel()) {
        if (currentBossRule === 'mirror') {
            targetPoints = POINTS_PER_LEVEL * 3;
        } else if (currentBossRule === 'vs') {
            targetPoints = 150;
        }
    }

    const calculatedLevel = Math.floor(player.score / targetPoints) + 1;
    if (calculatedLevel > player.level) {
        advanceLevel();
    }

    updateScoreDisplay();
}

function playerDrop() {
    if (isPaused || gameOver) return;
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function playerInstantDrop() {
    if (isPaused || gameOver) return;
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    dropCounter = 0;
}

function playerMove(dir) {
    if (isPaused || gameOver) return;
    let realDir = (isBossLevel() && currentBossRule === 'controls_fog') ? -dir : dir;

    player.pos.x += realDir;
    if (collide(arena, player)) {
        player.pos.x -= realDir;
    }
}

function getRandomPiece() {
    return createPiece(PIECES[Math.floor(Math.random() * PIECES.length)]);
}

function playerReset() {
    if (!player.nextMatrix) {
        player.nextMatrix = getRandomPiece();
    }
    
    player.matrix = player.nextMatrix;
    player.nextMatrix = getRandomPiece();

    if (isBossLevel() && currentBossRule === 'glitch') {
        player.glitchMatrix = player.matrix.map(row => 
            row.map(val => (val !== 0 ? Math.floor(Math.random() * 7) + 1 : 0))
        );
        player.fakeMatrix = generateDifferentFakePiece(player.matrix);
    } else {
        player.glitchMatrix = null;
        player.fakeMatrix = null;
    }

    drawNextPiece();

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        gameOver = true;
        saveScore(player.score);
        showGameOverModal();
    }
}

function playerRotate(dir) {
    if (isPaused || gameOver) return;
    const pos = player.pos.x;
    let offset = 1;

    rotate(player.matrix, dir);
    if (player.glitchMatrix) {
        rotate(player.glitchMatrix, dir);
    }

    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            if (player.glitchMatrix) {
                rotate(player.glitchMatrix, -dir);
            }
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function initAI() {
    aiArena.forEach(row => row.fill(0));
    aiPlayer.nextMatrix = getRandomPiece();
    updateAIDifficulty();
    aiPlayerReset();
}

function aiPlayerReset() {
    aiPlayer.matrix = aiPlayer.nextMatrix;
    aiPlayer.nextMatrix = getRandomPiece();
    aiPlayer.pos.y = 0;
    aiPlayer.pos.x = (aiArena[0].length / 2 | 0) - (aiPlayer.matrix[0].length / 2 | 0);
    aiState = 'MOVING';

    if (collide(aiArena, aiPlayer)) {
        aiArena.forEach(row => row.fill(0));
    } else {
        decideAIMove();
    }
}

function evaluateBoard(grid) {
    let aggregateHeight = 0;
    let completeLines = 0;
    let holes = 0;
    let bumpiness = 0;

    const columnHeights = new Array(12).fill(0);

    for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 20; y++) {
            if (grid[y][x] !== 0) {
                columnHeights[x] = 20 - y;
                break;
            }
        }
    }

    aggregateHeight = columnHeights.reduce((a, b) => a + b, 0);

    for (let x = 0; x < 12; x++) {
        let blockFound = false;
        for (let y = 0; y < 20; y++) {
            if (grid[y][x] !== 0) blockFound = true;
            else if (blockFound && grid[y][x] === 0) holes++;
        }
    }

    for (let x = 0; x < 11; x++) {
        bumpiness += Math.abs(columnHeights[x] - columnHeights[x + 1]);
    }

    for (let y = 0; y < 20; y++) {
        if (grid[y].every(val => val !== 0)) completeLines++;
    }

    return (-0.51 * aggregateHeight) + (0.76 * completeLines) - (0.35 * holes) - (0.18 * bumpiness);
}

function decideAIMove() {
    let moves = [];

    for (let r = 0; r < 4; r++) {
        let testMatrix = JSON.parse(JSON.stringify(aiPlayer.matrix));
        for (let i = 0; i < r; i++) rotate(testMatrix, 1);

        for (let x = -2; x < 12; x++) {
            let testPos = { x: x, y: 0 };
            if (collide(aiArena, { pos: testPos, matrix: testMatrix })) continue;

            while (!collide(aiArena, { pos: testPos, matrix: testMatrix })) {
                testPos.y++;
            }
            testPos.y--;

            let tempGrid = JSON.parse(JSON.stringify(aiArena));
            testMatrix.forEach((row, dy) => {
                row.forEach((val, dx) => {
                    if (val !== 0) {
                        let targetY = testPos.y + dy;
                        let targetX = testPos.x + dx;
                        if (targetY >= 0 && targetY < 20 && targetX >= 0 && targetX < 12) {
                            tempGrid[targetY][targetX] = val;
                        }
                    }
                });
            });

            let score = evaluateBoard(tempGrid);
            moves.push({ x: x, rotation: r, score: score });
        }
    }

    moves.sort((a, b) => b.score - a.score);

    let selectedMove = moves[0];
    if (Math.random() > aiAccuracy && moves.length > 2) {
        selectedMove = moves[Math.floor(Math.random() * Math.min(3, moves.length))];
    }

    if (selectedMove) {
        aiPlayer.targetX = selectedMove.x;
        aiPlayer.targetRotation = selectedMove.rotation;
    }
}

function updateAI(deltaTime) {
    if (!isVsModeActive() || isPaused || gameOver) return;

    aiMoveCounter += deltaTime;

    if (aiState === 'MOVING') {
        if (aiMoveCounter > aiMoveInterval) {
            if (aiPlayer.targetRotation > 0) {
                rotate(aiPlayer.matrix, 1);
                aiPlayer.targetRotation--;
            } 
            else if (aiPlayer.pos.x < aiPlayer.targetX) {
                aiPlayer.pos.x++;
                if (collide(aiArena, aiPlayer)) aiPlayer.pos.x--;
            } else if (aiPlayer.pos.x > aiPlayer.targetX) {
                aiPlayer.pos.x--;
                if (collide(aiArena, aiPlayer)) aiPlayer.pos.x++;
            } else {
                aiState = 'DROPPING';
            }
            aiMoveCounter = 0;
        }
    } 
    else if (aiState === 'DROPPING') {
        if (aiMoveCounter > aiDropDelay) {
            while (!collide(aiArena, aiPlayer)) {
                aiPlayer.pos.y++;
            }
            aiPlayer.pos.y--;

            merge(aiArena, aiPlayer);
            aiSweep();
            aiPlayerReset();
            aiMoveCounter = 0;
        }
    }
}

function aiSweep() {
    let rowCount = 0;
    outer: for (let y = aiArena.length - 1; y >= 0; --y) {
        for (let x = 0; x < aiArena[y].length; ++x) {
            if (aiArena[y][x] === 0) continue outer;
        }
        const row = aiArena.splice(y, 1)[0].fill(0);
        aiArena.unshift(row);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        sendGarbage(arena, rowCount);
    }
}

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isPaused && !gameOver && document.getElementById('screen-game').classList.contains('active')) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
        updateAI(deltaTime);
    }
    
    if (document.getElementById('screen-game').classList.contains('active')) {
        draw();
    }
    
    requestAnimationFrame(update);
}

function updateScoreDisplay() {
    document.getElementById('score').innerText = player.score;
    document.getElementById('level').innerText = player.level;
}

function resetGame() {
    arena.forEach(row => row.fill(0));
    aiArena.forEach(row => row.fill(0));

    player.score = 0;
    player.level = 1;
    dropInterval = baseSpeed;
    dropCounter = 0;
    gameOver = false;
    isPaused = false;

    player.matrix = null;
    player.glitchMatrix = null;
    player.fakeMatrix = null;
    player.nextMatrix = null;
    aiPlayer.matrix = null;
    aiPlayer.nextMatrix = null;

    currentBossRule = null;
    bossTutorialsShown.clear();
    
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    contextNext.setTransform(1, 0, 0, 1, 0, 0);
    contextNext.clearRect(0, 0, canvasNext.width, canvasNext.height);

    updateScoreDisplay();

    if (gameMode === 'vs') {
        initAI();
    } else if (isBossLevel()) {
        setupBossLevel(player.level);
    }

    playerReset();
    fetchLeaderboard();
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    if (btn) btn.innerText = isPaused ? "Reanudar (Espacio)" : "Pausar (Espacio)";
}

function showAuthMessage(msg, isError = false) {
    const msgDiv = document.getElementById('auth-message');
    msgDiv.style.color = isError ? '#FF5555' : '#0DFF72';
    msgDiv.innerText = msg;
}

function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) return showAuthMessage("Rellena todos los campos", true);

    const users = getLocalUsers();
    if (users[username]) return showAuthMessage("El usuario ya existe", true);

    users[username] = password;
    saveLocalUsers(users);
    showAuthMessage("¡Registrado! Ahora inicia sesión.");
}

function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) return showAuthMessage("Rellena todos los campos", true);

    const users = getLocalUsers();
    if (users[username] && users[username] === password) {
        currentUser = username;
        localStorage.setItem('tetris_session', username);
        document.getElementById('user-display').innerText = currentUser;
        showScreen('screen-menu');
        MusicEngine.playTrack('menu');
    } else {
        showAuthMessage("Credenciales incorrectas", true);
    }
}

function logout() {
    localStorage.removeItem('tetris_session');
    currentUser = null;
    MusicEngine.stop();
    showScreen('screen-auth');
}

function saveScore(finalScore) {
    if (!currentUser || finalScore <= 0) return;
    let scores = getLocalScores();
    scores.push({ username: currentUser, score: finalScore });
    saveLocalScores(scores);
    fetchLeaderboard();
}

function fetchLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboard');
    if (!leaderboardBody) return;

    let scores = getLocalScores();
    const maxScores = {};
    scores.forEach(entry => {
        if (!maxScores[entry.username] || entry.score > maxScores[entry.username]) {
            maxScores[entry.username] = entry.score;
        }
    });

    const sortedScores = Object.keys(maxScores)
        .map(user => ({ username: user, score: maxScores[user] }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    leaderboardBody.innerHTML = '';
    sortedScores.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.username}</td><td>${row.score}</td>`;
        leaderboardBody.appendChild(tr);
    });
}

document.addEventListener('keydown', event => {
    if (!document.getElementById('screen-game').classList.contains('active')) return;

    if ([32, 37, 38, 39, 40].includes(event.keyCode)) {
        event.preventDefault();
    }

    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate(1);
    else if (event.keyCode === 90 || event.keyCode === 122) playerInstantDrop();
    else if (event.keyCode === 32) togglePause();
});

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-register').addEventListener('click', register);
    document.getElementById('btn-logout').addEventListener('click', logout);
    
    document.getElementById('btn-mode-arcade').addEventListener('click', () => startGame('arcade'));
    document.getElementById('btn-mode-bossrush').addEventListener('click', () => startGame('bossrush'));
    
    const btnVsMode = document.getElementById('btn-mode-vs');
    if (btnVsMode) {
        btnVsMode.addEventListener('click', () => startGame('vs'));
    }

    document.getElementById('btn-back-menu').addEventListener('click', () => {
        isPaused = true;
        showScreen('screen-menu');
        MusicEngine.playTrack('menu');
    });

    document.getElementById('pause-btn').addEventListener('click', togglePause);

    const btnSettingsMenu = document.getElementById('btn-settings-menu');
    if (btnSettingsMenu) btnSettingsMenu.addEventListener('click', openSettingsModal);
    
    const btnSettingsGame = document.getElementById('btn-settings-game');
    if (btnSettingsGame) btnSettingsGame.addEventListener('click', openSettingsModal);

    document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);

    const slider = document.getElementById('speed-slider');
    const display = document.getElementById('speed-value-display');
    if (slider && display) {
        slider.addEventListener('input', (e) => {
            display.innerText = `x${e.target.value}`;
        });
    }

    document.getElementById('btn-retry').addEventListener('click', () => {
        closeGameOverModal();
        resetGame();
    });

    document.getElementById('btn-gameover-menu').addEventListener('click', () => {
        closeGameOverModal();
        showScreen('screen-menu');
        MusicEngine.playTrack('menu');
    });

    setupAudioControls();
    checkSession();
    update();
});

function setupAudioControls() {
    const muteIcon = (isMuted) => isMuted ? '🔇' : '🔊';

    function syncMuteButtons() {
        const icon = muteIcon(MusicEngine.isMuted());
        document.querySelectorAll('.btn-mute').forEach(btn => btn.innerText = icon);
    }

    document.querySelectorAll('.btn-mute').forEach(btn => {
        btn.addEventListener('click', () => {
            MusicEngine.ensureContext();
            MusicEngine.setMuted(!MusicEngine.isMuted());
            syncMuteButtons();
        });
    });
    syncMuteButtons();

    const volumeSlider = document.getElementById('volume-slider');
    const volumeDisplay = document.getElementById('volume-value-display');
    if (volumeSlider) {
        volumeSlider.value = MusicEngine.getVolume();
        if (volumeDisplay) volumeDisplay.innerText = `${Math.round(MusicEngine.getVolume() * 100)}%`;
        volumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            MusicEngine.setVolume(v);
            if (volumeDisplay) volumeDisplay.innerText = `${Math.round(v * 100)}%`;
        });
    }

    // Desbloquea el audio con la primera interacción del usuario (política de autoplay)
    const unlockAudio = () => { MusicEngine.ensureContext(); };
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
}
