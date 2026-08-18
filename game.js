// --- LÓGICA DE COMUNICACIÓN CON PHP ---
// Reemplaza por la URL real de tu api.php alojada en InfinityFree
const API_URL = 'https://filemanager.ai/new3/index.php?u=if0_42689020&p=Nj4HVAwJEQoNBw&home=%2Fhtdocs';

// Actualiza todas las llamadas fetch agregando API_URL:
async function checkSession() {
    const res = await fetch(`${API_URL}?action=check_session`);
    // ...
}

async function register() {
    console.log("Intento de registro...");
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    if (!usernameInput || !passwordInput) {
        alert("Error: No se encontraron los campos de entrada de texto.");
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert("Por favor ingresa un usuario y una contraseña.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        alert(data.message || data.error);
    } catch (err) {
        console.error("Error en registro:", err);
        alert("No se pudo conectar con el servidor backend (api.php).");
    }
}

async function login() {
    console.log("Intento de inicio de sesión...");
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        alert("Por favor ingresa tu usuario y contraseña.");
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
            alert(`¡Bienvenido de nuevo, ${currentUser}!`);
        } else {
            alert(data.error || "Error al iniciar sesión.");
        }
    } catch (err) {
        console.error("Error en login:", err);
        alert("No se pudo conectar con el servidor backend (api.php).");
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
        console.log("Sesión no iniciada o backend offline.");
    }
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
        if (authPanel) authPanel.style.display = 'flex';
        if (userPanel) userPanel.style.display = 'none';
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}?action=logout`);
    } catch(e){}
    currentUser = null;
    updateUI(false);
}

async function saveScore(finalScore) {
    // ...
    const res = await fetch(`${API_URL}?action=save_score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore })
    });
    // ...
}

async function fetchLeaderboard() {
    const res = await fetch(`${API_URL}?action=get_scores`);
    // ...
}
let currentUser = null;

async function checkSession() {
    const res = await fetch('api.php?action=check_session');
    const data = await res.json();
    if (data.loggedIn) {
        currentUser = data.username;
        updateUI(true);
    } else {
        updateUI(false);
    }
}

function updateUI(isLoggedIn) {
    if (isLoggedIn) {
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('user-panel').style.display = 'block';
        document.getElementById('user-display').innerText = currentUser;
    } else {
        document.getElementById('auth-panel').style.display = 'flex';
        document.getElementById('user-panel').style.display = 'none';
    }
}

async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch('api.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    alert(data.message || data.error);
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch('api.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.username) {
        currentUser = data.username;
        updateUI(true);
    } else {
        alert(data.error);
    }
}

async function logout() {
    await fetch('api.php?action=logout');
    currentUser = null;
    updateUI(false);
}

async function saveScore(finalScore) {
    if (finalScore === 0) return;

    if (!currentUser) {
        alert(`Juego terminado. Tu puntuación fue de ${finalScore}. ¡Inicia sesión para guardarla!`);
        return;
    }

    const res = await fetch('api.php?action=save_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore })
    });
    const data = await res.json();

    if (data.message) {
        alert(`¡Puntuación de ${finalScore} guardada en MySQL!`);
        fetchLeaderboard();
    } else {
        alert(data.error);
    }
}

async function fetchLeaderboard() {
    const res = await fetch('api.php?action=get_scores');
    const data = await res.json();
    const tbody = document.getElementById('leaderboard');
    tbody.innerHTML = data.map(row => `<tr><td>${row.username}</td><td>${row.top_score}</td></tr>`).join('');
}

// --- LÓGICA DEL MOTOR DE TETRIS ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(20, 20);

const arena = createMatrix(12, 20);
let score = 0;
let level = 1;
let dropInterval = 1000;
let dropCounter = 0;
let lastTime = 0;
let isPaused = false;

const player = { pos: {x: 0, y: 0}, matrix: null };
let nextPiece = null;

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE135', '#3877FF'];

function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function createPiece(type) {
    if (type === 'I') return [[0, 1, 0, 0],[0, 1, 0, 0],[0, 1, 0, 0],[0, 1, 0, 0]];
    if (type === 'L') return [[0, 2, 0],[0, 2, 0],[0, 2, 2]];
    if (type === 'J') return [[0, 3, 0],[0, 3, 0],[3, 3, 0]];
    if (type === 'O') return [[4, 4],[4, 4]];
    if (type === 'Z') return [[5, 5, 0],[0, 5, 5],[0, 0, 0]];
    if (type === 'S') return [[0, 6, 6],[6, 6, 0],[0, 0, 0]];
    if (type === 'T') return [[0, 7, 0],[7, 7, 7],[0, 0, 0]];
}

function getRandomPiece() {
    const pieces = 'TJLOSZI';
    return { matrix: createPiece(pieces[pieces.length * Math.random() | 0]) };
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (nextPiece) {
        const offsetX = (4 - nextPiece.matrix[0].length) / 2;
        const offsetY = (4 - nextPiece.matrix.length) / 2;
        drawMatrix(nextPiece.matrix, {x: offsetX, y: offsetY}, nextContext);
    }
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function updateLevelAndSpeed() {
    level = Math.floor(score / 100) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    document.getElementById('level').innerText = level;
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
        score += rowCount * 10;
        rowCount *= 2;
    }
    document.getElementById('score').innerText = score;
    updateLevelAndSpeed();
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function playerReset() {
    if (!nextPiece) nextPiece = getRandomPiece();

    player.matrix = nextPiece.matrix;
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    nextPiece = getRandomPiece();
    drawNext();

    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        saveScore(score);
        score = 0;
        level = 1;
        dropInterval = 1000;
        document.getElementById('score').innerText = score;
        document.getElementById('level').innerText = level;
    }
}

function playerMove(offset) {
    player.pos.x += offset;
    if (collide(arena, player)) player.pos.x -= offset;
}

function playerRotate() {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -1);
            player.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    matrix.forEach(row => row.reverse());
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    if (isPaused) {
        btn.innerText = 'Reanudar';
        btn.style.background = '#0DFF72';
    } else {
        btn.innerText = 'Pausar (P)';
        btn.style.background = '#FFE135';
        lastTime = performance.now();
        update();
    }
}

function update(time = 0) {
    if (isPaused) {
        context.fillStyle = 'rgba(0, 0, 0, 0.75)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#FFF';
        context.font = '1px sans-serif';
        context.textAlign = 'center';
        context.fillText('PAUSA', canvas.width / 40, canvas.height / 40);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    if (event.keyCode === 80 || event.keyCode === 32) { togglePause(); return; }
    if (isPaused) return;

    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 38) playerRotate();
});

// Inicialización
checkSession();
playerReset();
fetchLeaderboard();
update();

document.addEventListener('DOMContentLoaded', () => {
    console.log("El script game.js se ha cargado correctamente.");

    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            alert("¡Clic detectado en Entrar!");
            login();
        });
    }

    if (btnRegister) {
        btnRegister.addEventListener('click', () => {
            alert("¡Clic detectado en Registrarse!");
            register();
        });
    }
});
