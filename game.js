/* =========================================================
   TETRIMANIA — LÓGICA DE JUEGO CORTADA Y CORREGIDA
   ========================================================= */

let currentUser = null;
let gameMode = 'arcade';
let dropCounter = 0;
let baseSpeed = 1000;
let dropInterval = 1000;
let lastTime = 0;
let shakeOffsetX = 0;
let shakeOffsetY = 0;
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
    if (typeof FX !== 'undefined') FX.flash('255,13,114', 0.4, 0.6);
    triggerScreenShake(12, 400);
    if (typeof MusicEngine !== 'undefined') {
        MusicEngine.stop();
        MusicEngine.playGameOverJingle();
    }
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
        if (typeof MusicEngine !== 'undefined') MusicEngine.playTrack('menu');
    } else {
        showScreen('screen-auth');
    }
}

function updateCanvasSize() {
    if (isVsModeActive()) {
        canvas.width = 480;
        canvas.height = 400;
    } else {
        canvas.width = 240;
        canvas.height = 400;
    }
}

function startGame(mode) {
    gameMode = mode;
    let title = '🎮 MODO ARCADE';
    if (mode === 'bossrush') title = '👾 MODO BOSS RUSH';
    else if (mode === 'vs') title = '⚔️ MODO VS IA DEDICADO';
    
    document.getElementById('mode-title').innerText = title;
    showScreen('screen-game');
    updateCanvasSize();
    resetGame();
    if (typeof MusicEngine !== 'undefined') MusicEngine.playTrack(mode);
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

    updateCanvasSize();

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
    const blockSize = 20;

    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                let drawX = x + offset.x + offsetX;
                let drawY = y + offset.y + offsetY;

                if (drawY < 0 || drawY >= 20) return;

                if (ctx === context && isBossLevel() && currentBossRule === 'upside_down') {
                    drawY = 19 - (y + offset.y);
                }

                const px = drawX * blockSize;
                const py = drawY * blockSize;

                if (isGhost) {
                    ctx.fillStyle = overrideColor || 'rgba(255, 255, 255, 0.35)';
                    ctx.fillRect(px, py, blockSize, blockSize);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = overrideColor || COLORS[value];
                    ctx.strokeRect(px, py, blockSize, blockSize);
                } else {
                    ctx.fillStyle = overrideColor || COLORS[value];
                    ctx.fillRect(px, py, blockSize, blockSize);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#000000';
                    ctx.strokeRect(px, py, blockSize, blockSize);
                }
            }
        });
    });
}

function drawBossOverlays() {
    if (!isBossLevel()) return;

    if (currentBossRule === 'controls_fog') {
        context.fillStyle = 'rgba(20, 0, 30, 0.85)';
        context.fillRect(2 * 20, 6 * 20, 8 * 20, 8 * 20); 
        context.fillStyle = '#FF2222';
        context.font = 'bold 16px sans-serif';
        context.textAlign = 'center';
        context.fillText('NIEBLA', 6 * 20, 10 * 20);
    } 
    else if (currentBossRule === 'phantoms') {
        context.strokeStyle = '#FF2222';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(0, 10 * 20);
        context.lineTo(12 * 20, 10 * 20);
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
    contextNext.fillStyle = '#000000';
    contextNext.fillRect(0, 0, canvasNext.width, canvasNext.height);

    if (player.nextMatrix) {
        if (isBossLevel() && currentBossRule === 'glitch') {
            contextNext.fillStyle = '#FF2222';
            contextNext.font = 'bold 24px sans-serif';
            contextNext.textAlign = 'center';
            contextNext.textBaseline = 'middle';
            contextNext.fillText('?', canvasNext.width / 2, canvasNext.height / 2);
            return;
        }

        const size = 18;
        const offsetX = (canvasNext.width - player.nextMatrix[0].length * size) / 2;
        const offsetY = (canvasNext.height - player.nextMatrix.length * size) / 2;

        player.nextMatrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    contextNext.fillStyle = COLORS[value];
                    contextNext.fillRect(offsetX + x * size, offsetY + y * size, size - 1, size - 1);
                }
            });
        });
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
    context.fillRect(11.9 * 20, 0, 4, 20 * 20);

    drawMatrix(aiArena, { x: 0, y: 0 }, context, false, null, 12, 0);
    if (aiPlayer.matrix) {
        drawMatrix(aiPlayer.matrix, aiPlayer.pos, context, false, '#FF4444', 12, 0);
    }
}

function draw() {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.save();
    context.translate(shakeOffsetX, shakeOffsetY);

    if (isVsModeActive()) {
        drawAIDuel();

        if (isPaused && !gameOver) {
            context.fillStyle = 'rgba(0, 0, 0, 0.75)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            context.fillStyle = '#FFE135';
            context.font = 'bold 30px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('PAUSA', canvas.width / 2, canvas.height / 2);
        }
        if (typeof FX !== 'undefined') FX.render(context);
        context.restore();
        return;
    }

    drawMatrix(arena, { x: 0, y: 0 });

    if (player.matrix) {
        const activeDrawMatrix = player.glitchMatrix || player.matrix;
        const ghostPos = getGhostPosition(0);
        
        if (ghostPos) {
            drawMatrix(activeDrawMatrix, ghostPos, context, true);

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

        drawMatrix(activeDrawMatrix, player.pos);

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
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.fillStyle = '#FFE135';
        context.font = 'bold 24px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('PAUSA', canvas.width / 2, canvas.height / 2);
    }

    if (typeof FX !== 'undefined') FX.render(context);
    context.restore();
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

    if (targetGrid === arena) {
        if (typeof FX !== 'undefined') FX.flash('255,13,114', 0.25, 0.3);
        triggerScreenShake(5, 180);
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
    // Reiniciamos o recalculamos el score/parámetros para evitar el bucle infinito
    player.score = 0; 
    dropInterval = Math.max(100, baseSpeed - (player.level - 1) * 100);
    arena.forEach(row => row.fill(0));

    updateAIDifficulty();

    // Limpiamos la regla anterior antes de asignar o actualizar
    currentBossRule = null;

    if (typeof FX !== 'undefined') {
        FX.flash('255,225,53', 0.3, 0.4);
        FX.spawnScorePopup(`NIVEL ${player.level}`, 5.5, 9, '#FFE135');
    }
    triggerScreenShake(8, 200);

    if (isBossLevel()) {
        setupBossLevel(player.level);
    } else {
        updateCanvasSize();
    }
    
    updateScoreDisplay();
}

function arenaSweep() {
    let rowCount = 0;
    let clearedRows = [];
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        clearedRows.push(y);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        const gained = Math.pow(2, rowCount - 1) * 10;
        player.score += gained;
        const isTetris = rowCount >= 4;
        triggerScreenShake(isTetris ? 14 : 6, isTetris ? 280 : 150);

        if (typeof FX !== 'undefined') {
            FX.spawnLineClearFx(clearedRows);
            const topRow = Math.min(...clearedRows);
            FX.spawnScorePopup(`+${gained}`, 5.5, topRow, '#FFE135');
            if (isTetris) FX.spawnScorePopup('¡TETRIMANIA!', 5.5, Math.max(0, topRow - 1), '#FF0D72');
            else if (rowCount >= 2) FX.spawnScorePopup(`COMBO x${rowCount}`, 5.5, Math.max(0, topRow - 1), '#0DFF72');
        }

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

function triggerLockFx() {
    if (typeof FX === 'undefined' || !player.matrix) return;
    const activeMatrix = player.glitchMatrix || player.matrix;
    let color = '#EDEBFF';
    outer: for (const row of activeMatrix) {
        for (const v of row) {
            if (v !== 0) { color = COLORS[v]; break outer; }
        }
    }
    FX.spawnLockFx(activeMatrix, player.pos, color);
}

function playerDrop() {
    if (isPaused || gameOver) return;
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        triggerLockFx();
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function playerInstantDrop() {
    if (isPaused || gameOver) return;
    const startY = player.pos.y;
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    if (typeof FX !== 'undefined' && player.matrix) {
        FX.spawnDropTrail(player.glitchMatrix || player.matrix, player.pos, startY, player.pos.y, '#0DC2FF');
    }
    merge(arena, player);
    triggerLockFx();
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
    player.glitchMatrix = null;
    player.fakeMatrix = null;

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
        let testMatrix = aiPlayer.matrix.map(row => [...row]);
        for (let i = 0; i < r; i++) rotate(testMatrix, 1);

        for (let x = -2; x < 12; x++) {
            let testPos = { x: x, y: 0 };
            if (collide(aiArena, { pos: testPos, matrix: testMatrix })) continue;

            while (!collide(aiArena, { pos: testPos, matrix: testMatrix })) {
                testPos.y++;
            }
            testPos.y--;

            let tempGrid = aiArena.map(row => [...row]);
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

    const gameScreen = document.getElementById('screen-game');
    if (!isPaused && !gameOver && gameScreen && gameScreen.classList.contains('active')) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
        updateAI(deltaTime);
    }
    
    if (gameScreen && gameScreen.classList.contains('active')) {
        draw();
    }
    
    requestAnimationFrame(update);
}

function updateScoreDisplay() {
    const scoreElem = document.getElementById('score');
    const levelElem = document.getElementById('level');
    if (scoreElem) {
        const prev = parseInt(scoreElem.innerText, 10) || 0;
        scoreElem.innerText = player.score;
        if (player.score > prev) {
            scoreElem.classList.remove('pop');
            void scoreElem.offsetWidth;
            scoreElem.classList.add('pop');
        }
    }
    if (levelElem) levelElem.innerText = player.level;
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
    
    context.clearRect(0, 0, canvas.width, canvas.height);
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
    if (!msgDiv) return;
    msgDiv.style.color = isError ? '#FF5555' : '#0DFF72';
    msgDiv.innerText = msg;
}

function register() {
    const usernameElem = document.getElementById('username');
    const passwordElem = document.getElementById('password');
    if (!usernameElem || !passwordElem) return;

    const username = usernameElem.value.trim();
    const password = passwordElem.value.trim();

    if (!username || !password) return showAuthMessage("Rellena todos los campos", true);

    const users = getLocalUsers();
    if (users[username]) return showAuthMessage("El usuario ya existe", true);

    users[username] = password;
    saveLocalUsers(users);
    showAuthMessage("¡Registrado! Ahora inicia sesión.");
}

function login() {
    const usernameElem = document.getElementById('username');
    const passwordElem = document.getElementById('password');
    if (!usernameElem || !passwordElem) return;

    const username = usernameElem.value.trim();
    const password = passwordElem.value.trim();

    if (!username || !password) return showAuthMessage("Rellena todos los campos", true);

    const users = getLocalUsers();
    if (users[username] && users[username] === password) {
        currentUser = username;
        localStorage.setItem('tetris_session', username);
        document.getElementById('user-display').innerText = currentUser;
        showScreen('screen-menu');
        if (typeof MusicEngine !== 'undefined') MusicEngine.playTrack('menu');
    } else {
        showAuthMessage("Credenciales incorrectas", true);
    }
}

function logout() {
    localStorage.removeItem('tetris_session');
    currentUser = null;
    if (typeof MusicEngine !== 'undefined') MusicEngine.stop();
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
    const gameScreen = document.getElementById('screen-game');
    if (!gameScreen || !gameScreen.classList.contains('active')) return;

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

    document.getElementById('btn-login')?.addEventListener('click', login);
    document.getElementById('btn-register')?.addEventListener('click', register);
    document.getElementById('btn-logout')?.addEventListener('click', logout);
    
    document.getElementById('btn-mode-arcade')?.addEventListener('click', () => startGame('arcade'));
    document.getElementById('btn-mode-bossrush')?.addEventListener('click', () => startGame('bossrush'));
    document.getElementById('btn-mode-vs')?.addEventListener('click', () => startGame('vs'));

    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
        isPaused = true;
        showScreen('screen-menu');
        if (typeof MusicEngine !== 'undefined') MusicEngine.playTrack('menu');
    });

    document.getElementById('pause-btn')?.addEventListener('click', togglePause);

    document.getElementById('btn-settings-menu')?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-settings-game')?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-settings')?.addEventListener('click', closeSettingsModal);

    const slider = document.getElementById('speed-slider');
    const display = document.getElementById('speed-value-display');
    if (slider && display) {
        slider.addEventListener('input', (e) => {
            display.innerText = `x${e.target.value}`;
        });
    }

    document.getElementById('btn-retry')?.addEventListener('click', () => {
        closeGameOverModal();
        resetGame();
        if (typeof MusicEngine !== 'undefined') MusicEngine.playTrack(gameMode);
    });

    document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
        closeGameOverModal();
        showScreen('screen-menu');
        if (typeof MusicEngine !== 'undefined') MusicEngine.playTrack('menu');
    });

    setupAudioControls();
    checkSession();
    update();
});

function setupAudioControls() {
    if (typeof MusicEngine === 'undefined') return;

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

    const unlockAudio = () => { MusicEngine.ensureContext(); };
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
}

function triggerScreenShake(intensity = 6, duration = 150) {
    const startTime = Date.now();

    const shakeInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime >= duration) {
            shakeOffsetX = 0;
            shakeOffsetY = 0;
            clearInterval(shakeInterval);
            return;
        }

        shakeOffsetX = (Math.random() - 0.5) * intensity;
        shakeOffsetY = (Math.random() - 0.5) * intensity;
    }, 16);
}