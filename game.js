let currentUser = null;
let gameMode = 'arcade'; // 'arcade' o 'bossrush'
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let gameOver = false;

const POINTS_PER_LEVEL = 100;
const bossTutorialsShown = new Set();
let currentBossRule = null;

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

const canvasNext = document.getElementById('next');
const contextNext = canvasNext.getContext('2d');
contextNext.scale(20, 20);

const arena = createMatrix(12, 20);

const PIECES = 'TJLOSZI';
const COLORS = [
    null,
    '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE135', '#3877FF',
    '#777777' // Color 8: Gris para las piezas reflejadas fijadas
];

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
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
        description: '¡La pieza está glitcheada! No sabrás cuál es hasta colocarla.<br>Este jefe solo requiere la mitad de puntos (50 pts).'
    },
    {
        id: 'mirror',
        title: '🪞 Reflejo',
        description: '¡Doble impacto! Al colocar tu pieza, una copia exacta se colocará simétricamente reflejada al otro lado del tablero.'
    },
    {
        id: 'x2',
        title: '✂️ X2 (Tablero Dividido)',
        description: 'El tablero está dividido por la mitad.<br>¡Colocar la primera pieza autocompletará el nivel!'
    }
];

// ==========================================
// GESTIÓN DE PANTALLAS
// ==========================================

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
    } else {
        showScreen('screen-auth');
    }
}

function startGame(mode) {
    gameMode = mode;
    document.getElementById('mode-title').innerText = mode === 'bossrush' ? '👾 MODO BOSS RUSH' : '🎮 MODO ARCADE';
    showScreen('screen-game');
    resetGame();
}

// ==========================================
// ALMACENAMIENTO LOCAL
// ==========================================

function getLocalUsers() { return JSON.parse(localStorage.getItem('tetris_users') || '{}'); }
function saveLocalUsers(users) { localStorage.setItem('tetris_users', JSON.stringify(users)); }
function getLocalScores() { return JSON.parse(localStorage.getItem('tetris_scores') || '[]'); }
function saveLocalScores(scores) { localStorage.setItem('tetris_scores', JSON.stringify(scores)); }

// ==========================================
// MODAL DE TUTORIAL DE JEFE
// ==========================================

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
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        modal.style.display = 'none';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
            <div style="background: #1e1e2f; border: 3px solid #ff2222; padding: 25px; border-radius: 12px; text-align: center; max-width: 340px; color: #ffffff; box-shadow: 0 0 20px #ff2222;">
                <h2 style="color: #ff2222; margin-top: 0;">👾 ¡NIVEL DE JEFE!</h2>
                <div id="boss-modal-text" style="margin: 15px 0; font-size: 15px; line-height: 1.4;"></div>
                <button id="boss-modal-close" style="background: #ff2222; color: #fff; border: none; padding: 10px 20px; font-weight: bold; border-radius: 5px; cursor: pointer;">¡ENTENDIDO!</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('boss-modal-close').addEventListener('click', () => {
            modal.style.display = 'none';
            isPaused = false;
        });
    }
    return modal;
}

function setupBossLevel(level) {
    const selectedRule = BOSS_RULES[Math.floor(Math.random() * BOSS_RULES.length)];
    currentBossRule = selectedRule.id;
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

// ==========================================
// LÓGICA DEL JUEGO
// ==========================================

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

function isBossLevel() {
    return gameMode === 'bossrush' || player.level % 3 === 0;
}

function drawMatrix(matrix, offset, ctx = context, isGhost = false, overrideColor = null) {
    if (!matrix) return;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                let drawX = x + offset.x;
                let drawY = y + offset.y;

                if (ctx === context && isBossLevel() && currentBossRule === 'upside_down') {
                    drawY = 19 - drawY;
                }

                if (isGhost) {
                    ctx.fillStyle = overrideColor || 'rgba(255, 255, 255, 0.15)';
                    ctx.fillRect(drawX, drawY, 1, 1);
                    ctx.lineWidth = 0.08;
                    ctx.strokeStyle = overrideColor || COLORS[value];
                    ctx.strokeRect(drawX, drawY, 1, 1);
                } else {
                    if (overrideColor) {
                        ctx.fillStyle = overrideColor;
                    } else if (isBossLevel() && currentBossRule === 'glitch' && ctx === context) {
                        ctx.fillStyle = '#A0A0A0';
                    } else {
                        ctx.fillStyle = COLORS[value];
                    }

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
        context.font = '1px Arial';
        context.fillText('NIEBLA', 4, 10);
    } 
    else if (currentBossRule === 'x2') {
        context.strokeStyle = '#FF2222';
        context.lineWidth = 0.2;
        context.beginPath();
        context.moveTo(0, 10);
        context.lineTo(12, 10);
        context.stroke();
    }
}

function getGhostPosition() {
    if (!player.matrix) return null;
    const ghostPos = { x: player.pos.x, y: player.pos.y };
    while (!collide(arena, { pos: ghostPos, matrix: player.matrix })) {
        ghostPos.y++;
    }
    ghostPos.y--;
    return ghostPos;
}

function drawNextPiece() {
    contextNext.fillStyle = '#000';
    contextNext.fillRect(0, 0, canvasNext.width, canvasNext.height);

    if (player.nextMatrix) {
        if (isBossLevel() && currentBossRule === 'glitch') {
            contextNext.fillStyle = '#FF2222';
            contextNext.font = '2px Arial';
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
    
    // Invertir horizontalmente la matriz (Efecto Espejo)
    const mirroredMatrix = player.matrix.map(row => [...row].reverse());
    
    // Calcular la posición horizontal simétrica opuesta en el tablero (ancho = 12)
    const mirroredX = 12 - player.pos.x - player.matrix[0].length;
    const mirroredPos = { x: mirroredX, y: player.pos.y };

    // Dibujar la pieza en el tablero de color grisáceo (#777777)
    drawMatrix(mirroredMatrix, mirroredPos, context, false, '#777777');
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    drawMatrix(arena, { x: 0, y: 0 });

    if (player.matrix) {
        const ghostPos = getGhostPosition();
        if (ghostPos) {
            drawMatrix(player.matrix, ghostPos, context, true);
        }
        
        // Renderizar la pieza reflejada activa cayendo en tiempo real
        if (isBossLevel() && currentBossRule === 'mirror') {
            drawMirrorPiece();
        }

        drawMatrix(player.matrix, player.pos);
    }

    drawBossOverlays();
}

function collide(arena, playerObj) {
    const m = playerObj.matrix;
    const o = playerObj.pos;
    if (!m) return false;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0) {
                const targetX = x + o.x;
                const targetY = y + o.y;

                if (targetX < 0 || targetX >= 12 || targetY >= 20) return true;
                if (arena[targetY] && arena[targetY][targetX] !== 0) return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    // 1. Fusionar la pieza principal del jugador
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const targetY = y + player.pos.y;
                const targetX = x + player.pos.x;
                if (targetY >= 0 && targetY < 20 && targetX >= 0 && targetX < 12) {
                    arena[targetY][targetX] = value;
                }
            }
        });
    });

    // 2. Si la regla "mirror" está activa, fusionar también la pieza reflejada en gris (valor 8)
    if (isBossLevel() && currentBossRule === 'mirror') {
        const mirroredMatrix = player.matrix.map(row => [...row].reverse());
        const mirroredX = 12 - player.pos.x - player.matrix[0].length;

        mirroredMatrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const targetY = y + player.pos.y;
                    const targetX = x + mirroredX;
                    if (targetY >= 0 && targetY < 20 && targetX >= 0 && targetX < 12) {
                        arena[targetY][targetX] = 8; // Bloque gris para el reflejo
                    }
                }
            });
        });
    }
}

function advanceLevel() {
    player.level++;
    dropInterval = Math.max(100, 1000 - (player.level - 1) * 100);
    arena.forEach(row => row.fill(0));

    if (isBossLevel()) {
        setupBossLevel(player.level);
    } else {
        currentBossRule = null;
    }
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;

        player.score += rowCount * 10;
        rowCount *= 2;
    }

    const targetPoints = (isBossLevel() && currentBossRule === 'glitch') 
        ? (POINTS_PER_LEVEL / 2) 
        : POINTS_PER_LEVEL;

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

        if (isBossLevel() && currentBossRule === 'x2') {
            player.score += POINTS_PER_LEVEL;
            advanceLevel();
            updateScoreDisplay();
            playerReset();
            dropCounter = 0;
            return;
        }

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

    if (isBossLevel() && currentBossRule === 'x2') {
        player.score += POINTS_PER_LEVEL;
        advanceLevel();
        updateScoreDisplay();
        playerReset();
        dropCounter = 0;
        return;
    }

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
    drawNextPiece();

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        gameOver = true;
        alert("¡Juego Terminado!");
        saveScore(player.score);
    }
}

function playerRotate(dir) {
    if (isPaused || gameOver) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
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

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isPaused && !gameOver && document.getElementById('screen-game').classList.contains('active')) {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
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
    player.score = 0;
    player.level = 1;
    dropInterval = 1000;
    gameOver = false;
    isPaused = false;
    player.nextMatrix = null;
    currentBossRule = null;
    bossTutorialsShown.clear();
    updateScoreDisplay();

    if (isBossLevel()) {
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

// ==========================================
// AUTENTICACIÓN
// ==========================================

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
    } else {
        showAuthMessage("Credenciales incorrectas", true);
    }
}

function logout() {
    localStorage.removeItem('tetris_session');
    currentUser = null;
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

// ==========================================
// CONTROLES Y EVENTOS
// ==========================================

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
    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-register').addEventListener('click', register);
    document.getElementById('btn-logout').addEventListener('click', logout);
    
    document.getElementById('btn-mode-arcade').addEventListener('click', () => startGame('arcade'));
    document.getElementById('btn-mode-bossrush').addEventListener('click', () => startGame('bossrush'));
    document.getElementById('btn-back-menu').addEventListener('click', () => {
        isPaused = true;
        showScreen('screen-menu');
    });

    document.getElementById('pause-btn').addEventListener('click', togglePause);

    checkSession();
    update();
});