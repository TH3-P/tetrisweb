// URL relativa para entorno local
const API_URL = 'api.php';

let currentUser = null;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let gameOver = false;

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
    '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE135', '#3877FF'
];

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    nextMatrix: null,
    score: 0,
    level: 1,
    lines: 0
};

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
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

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = COLORS[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                ctx.lineWidth = 0.05;
                ctx.strokeStyle = '#000';
                ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function drawNextPiece() {
    contextNext.fillStyle = '#000';
    contextNext.fillRect(0, 0, canvasNext.width, canvasNext.height);
    if (player.nextMatrix) {
        const offset = {
            x: (4 - player.nextMatrix[0].length) / 2,
            y: (4 - player.nextMatrix.length) / 2
        };
        drawMatrix(player.nextMatrix, offset, contextNext);
    }
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
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
        player.lines++;
        rowCount *= 2;
    }

    if (player.lines >= player.level * 10) {
        player.level++;
        dropInterval = Math.max(100, 1000 - (player.level - 1) * 100);
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

function playerMove(offset) {
    if (isPaused || gameOver) return;
    player.pos.x += offset;
    if (collide(arena, player)) {
        player.pos.x -= offset;
    }
}

function playerReset() {
    if (!player.nextMatrix) {
        player.nextMatrix = createPiece(PIECES[PIECES.length * Math.random() | 0]);
    }
    player.matrix = player.nextMatrix;
    player.nextMatrix = createPiece(PIECES[PIECES.length * Math.random() | 0]);
    drawNextPiece();

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        gameOver = true;
        showMessage("¡Juego Terminado!", true);
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

    if (!isPaused && !gameOver) {
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
    player.lines = 0;
    dropInterval = 1000;
    gameOver = false;
    isPaused = false;
    updateScoreDisplay();
    playerReset();
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    if (btn) btn.innerText = isPaused ? "Reanudar (P)" : "Pausar (P)";
}

function showMessage(msg, isError = false) {
    const msgDiv = document.getElementById('auth-message');
    if (msgDiv) {
        msgDiv.style.color = isError ? '#FF5555' : '#0DFF72';
        msgDiv.innerText = msg;
        setTimeout(() => { msgDiv.innerText = ''; }, 4000);
    }
}

async function register() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showMessage("Ingresa usuario y contraseña", true);
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.error) {
            showMessage(data.error, true);
        } else {
            showMessage(data.message || "¡Usuario registrado!");
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        }
    } catch (err) {
        showMessage("Error de conexión local", true);
    }
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showMessage("Ingresa usuario y contraseña", true);
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.username) {
            currentUser = data.username;
            updateUI(true);
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            resetGame();
        } else {
            showMessage(data.error || "Datos incorrectos", true);
        }
    } catch (err) {
        showMessage("Error de conexión local", true);
    }
}

async function checkSession() {
    try {
        const res = await fetch(`${API_URL}?action=check_session`);
        const data = await res.json();
        if (data.loggedIn) {
            currentUser = data.username;
            updateUI(true);
        } else {
            updateUI(false);
        }
    } catch (e) {
        updateUI(false);
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}?action=logout`);
    } catch (e) {}
    currentUser = null;
    updateUI(false);
}

function updateUI(isLoggedIn) {
    const authPanel = document.getElementById('auth-panel');
    const userPanel = document.getElementById('user-panel');
    const userDisplay = document.getElementById('user-display');

    if (isLoggedIn) {
        if (authPanel) authPanel.style.display = 'none';
        if (userPanel) userPanel.style.display = 'block';
        if (userDisplay) userDisplay.innerText = currentUser;
    } else {
        if (authPanel) authPanel.style.display = 'block';
        if (userPanel) userPanel.style.display = 'none';
    }
}

async function saveScore(finalScore) {
    if (!currentUser || finalScore <= 0) return;

    try {
        await fetch(`${API_URL}?action=save_score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: finalScore })
        });
        fetchLeaderboard();
    } catch (err) {
        console.error("Error guardando puntuación:", err);
    }
}

async function fetchLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboard');
    if (!leaderboardBody) return;

    try {
        const res = await fetch(`${API_URL}?action=get_scores`);
        const scores = await res.json();

        leaderboardBody.innerHTML = '';
        if (Array.isArray(scores)) {
            scores.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.username}</td><td>${row.score}</td>`;
                leaderboardBody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Error obteniendo posiciones:", err);
    }
}

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate(1);
    else if (event.keyCode === 80) togglePause();
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-register').addEventListener('click', register);
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('pause-btn').addEventListener('click', togglePause);

    checkSession();
    fetchLeaderboard();
    playerReset();
    update();
});