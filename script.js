let tiles = [];
let connections = []; // Format: { fromId: null, toId: null }
let tileCounter = 0;

// Inicjalizacja
window.onload = () => {
    const saved = localStorage.getItem('blueprint_task_data');
    if (saved) {
        loadData(JSON.parse(saved));
    }
};

function addTile(x = 250, y = 100, title = "Nowe Zadanie", content = "") {
    tileCounter++;
    const tile = {
        id: tileCounter,
        x: x,
        y: y,
        title: title,
        content: content,
        color: '#3498db'
    };
    tiles.push(tile);
    renderTile(tile);
    saveToLocalStorage();
}

function renderTile(tile) {
    const container = document.getElementById('tiles-layer');
    const el = document.createElement('div');
    el.className = 'tile';
    el.id = `tile-${tile.id}`;
    el.style.left = `${tile.x}px`;
    el.style.top = `${tile.y}px`;

    el.innerHTML = `
        <div class="tile-header" style="background: ${tile.color}">
            <input class="tile-title" value="${tile.title}" onchange="updateTile(${tile.id}, 'title', this.value)">
            <button onclick="removeTile(${tile.id})" style="color:white; margin-left:5px;">×</button>
        </div>
        <div class="tile-content">
            <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)">${tile.content}</textarea>
        </div>
        <div class="pin pin-input" title="Wejście"></div>
        <div class="pin-output-container">
            <div class="pin-output" title="Wyjście"></div>
        </div>
    `;

    // Prosty mechanizm Drag & Drop
    el.onmousedown = function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        let shiftX = e.clientX - el.getBoundingClientRect().left;
        let shiftY = e.clientY - el.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            let newX = pageX - shiftX;
            let newY = pageY - shiftY;
            el.style.left = newX + 'px';
            el.style.top = newY + 'px';
            tile.x = newX;
            tile.y = newY;
        }

        function onMouseMove(e) { moveAt(e.pageX, e.pageY); }

        document.addEventListener('mousemove', onMouseMove);
        el.onmouseup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            el.onmouseup = null;
            saveToLocalStorage();
        };
    };

    container.appendChild(el);
}

function updateTile(id, field, value) {
    const tile = tiles.find(t => t.id === id);
    if (tile) tile[field] = value;
    saveToLocalStorage();
}

function removeTile(id) {
    tiles = tiles.filter(t => t.id !== id);
    document.getElementById(`tile-${id}`).remove();
    saveToLocalStorage();
}

function clearBoard() {
    if(confirm("Czy na pewno wyczyścić cały projekt?")) {
        tiles = [];
        document.getElementById('tiles-layer').innerHTML = "";
        localStorage.removeItem('blueprint_task_data');
        tileCounter = 0;
    }
}

// --- FUNKCJE ZAPISU PLIKÓW ---

// 1. Zapis do TXT (czytelna lista zadań)
function saveToTxt() {
    let content = "BLUEPRINT TASK - EKSPORT ZADAŃ\n";
    content += "================================\n\n";
    
    tiles.forEach((t, index) => {
        content += `${index + 1}. TYTUŁ: ${t.title}\n`;
        content += `   TREŚĆ: ${t.content}\n`;
        content += `   POZYCJA: x:${Math.round(t.x)}, y:${Math.round(t.y)}\n`;
        content += `--------------------------------\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    downloadBlob(blob, 'moje-zadania.txt');
}

// 2. Zapis do JSON (do wczytania później)
function saveProject() {
    const data = JSON.stringify({ tiles, tileCounter });
    const blob = new Blob([data], { type: 'application/json' });
    downloadBlob(blob, 'projekt-blueprint.json');
}

// Wspólna funkcja pobierania
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Wczytywanie z pliku
function triggerLoad() {
    document.getElementById('loadInput').click();
}

document.getElementById('loadInput').onchange = function(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
        const data = JSON.parse(event.target.result);
        loadData(data);
    };
    reader.readAsText(file);
};

function loadData(data) {
    document.getElementById('tiles-layer').innerHTML = "";
    tiles = data.tiles || [];
    tileCounter = data.tileCounter || 0;
    tiles.forEach(t => renderTile(t));
}

function saveToLocalStorage() {
    localStorage.setItem('blueprint_task_data', JSON.stringify({ tiles, tileCounter }));
}