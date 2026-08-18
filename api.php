<?php
session_start();

header("Content-Type: application/json; charset=UTF-8");

// Datos de conexión para XAMPP / WAMP local por defecto
$host = "localhost"; 
$user = "root";      
$pass = "";          // En XAMPP la contraseña suele estar vacía
$dbname = "tetris_db"; // Nombre de tu base de datos en phpMyAdmin

mysqli_report(MYSQLI_REPORT_OFF);
$conn = @new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    echo json_encode(["error" => "Error de conexión a MySQL local: " . $conn->connect_error]);
    exit;
}

$action = $_GET['action'] ?? '';
$inputRaw = file_get_contents("php://input");
$data = json_decode($inputRaw, true) ?? [];

if ($action === 'register') {
    $username = trim($data['username'] ?? '');
    $password = trim($data['password'] ?? '');

    if (empty($username) || empty($password)) {
        echo json_encode(["error" => "Ingresa usuario y contraseña"]);
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $conn->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    $stmt->bind_param("ss", $username, $hash);

    if ($stmt->execute()) {
        echo json_encode(["message" => "¡Usuario registrado con éxito!"]);
    } else {
        echo json_encode(["error" => "El usuario ya existe"]);
    }
    $stmt->close();
    exit;
}

if ($action === 'login') {
    $username = trim($data['username'] ?? '');
    $password = trim($data['password'] ?? '');

    if (empty($username) || empty($password)) {
        echo json_encode(["error" => "Ingresa usuario y contraseña"]);
        exit;
    }

    $stmt = $conn->prepare("SELECT id, password_hash FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($userRow = $result->fetch_assoc()) {
        if (password_verify($password, $userRow['password_hash'])) {
            $_SESSION['user_id'] = $userRow['id'];
            $_SESSION['username'] = $username;
            echo json_encode(["username" => $username]);
        } else {
            echo json_encode(["error" => "Contraseña incorrecta"]);
        }
    } else {
        echo json_encode(["error" => "El usuario no existe"]);
    }
    $stmt->close();
    exit;
}

if ($action === 'check_session') {
    if (isset($_SESSION['username'])) {
        echo json_encode(["loggedIn" => true, "username" => $_SESSION['username']]);
    } else {
        echo json_encode(["loggedIn" => false]);
    }
    exit;
}

if ($action === 'logout') {
    session_destroy();
    echo json_encode(["message" => "Sesión cerrada"]);
    exit;
}

if ($action === 'save_score') {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(["error" => "Debes iniciar sesión"]);
        exit;
    }

    $score = intval($data['score'] ?? 0);
    $userId = $_SESSION['user_id'];

    if ($score > 0) {
        $stmt = $conn->prepare("INSERT INTO scores (user_id, score) VALUES (?, ?)");
        $stmt->bind_param("ii", $userId, $score);
        $stmt->execute();
        $stmt->close();
        echo json_encode(["message" => "Puntuación guardada"]);
    } else {
        echo json_encode(["error" => "Puntuación inválida"]);
    }
    exit;
}

if ($action === 'get_scores') {
    $sql = "SELECT u.username, MAX(s.score) as score 
            FROM scores s 
            JOIN users u ON s.user_id = u.id 
            GROUP BY u.id 
            ORDER BY score DESC 
            LIMIT 5";
            
    $result = $conn->query($sql);
    $scores = [];

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $scores[] = $row;
        }
    }
    echo json_encode($scores);
    exit;
}

$conn->close();