let tiles = [];
let connections = []; // { fromId, toId }
let tileCounter = 0;
let activeLine = null;

window.onload = () => {
    const saved = localStorage.getItem('blueprint_task_data');
    if (saved) {
        const data = JSON.parse(saved);
        tiles = data.tiles || [];
        connections = data.connections || [];
        tileCounter = data.tileCounter || 0;
        tiles.forEach(t => renderTile(t));
        drawConnections();
    }
};

function addTile(x = 250, y = 100, title = "Zadanie Logic", content = "") {
    tileCounter++;
    const tile = {
        id: tileCounter,
        x: x,
        y: y,
        title: title,
        content: content,
        color: '#2c3e50'
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
            <button class="btn-close" onclick="removeTile(${tile.id})">×</button>
        </div>
        <div class="tile-content">
            <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)" placeholder="Wpisz treść...">${tile.content}</textarea>
        </div>
        <div class="pin pin-input" title="Input" onmouseup="dropConnection(event, ${tile.id})"></div>
        <div class="pin pin-output" title="Output" onmousedown="startConnection(event, ${tile.id})"></div>
    `;

    // Obsługa Drag & Drop kafelka
    el.onmousedown = function(e) {
        if (e.target.classList.contains('pin') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
        
        let shiftX = e.clientX - el.getBoundingClientRect().left;
        let shiftY = e.clientY - el.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            tile.x = pageX - shiftX;
            tile.y = pageY - shiftY;
            el.style.left = tile.x + 'px';
            el.style.top = tile.y + 'px';
            drawConnections(); // Dynamiczne odświeżanie nitek
        }

        function onMouseMove(e) { moveAt(e.pageX, e.pageY); }
        document.addEventListener('mousemove', onMouseMove);

        document.onmouseup = function() {
            document.removeEventListener('mousemove', onMouseMove);
            saveToLocalStorage();
            document.onmouseup = null;
        };
    };

    container.appendChild(el);
}

// --- SYSTEM NITEK (CONNECTIONS) ---

function startConnection(e, fromId) {
    e.stopPropagation();
    const pinRect = e.target.getBoundingClientRect();
    const startX = pinRect.left + pinRect.width / 2 + window.scrollX;
    const startY = pinRect.top + pinRect.height / 2 + window.scrollY;

    activeLine = { fromId, startX, startY };

    const onMouseMove = (moveEv) => {
        if (!activeLine) return;
        drawTempLine(startX, startY, moveEv.pageX, moveEv.pageY);
    };

    const onMouseUp = () => {
        const temp = document.getElementById('temp-line');
        if (temp) temp.remove();
        activeLine = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function dropConnection(e, toId) {
    if (activeLine && activeLine.fromId !== toId) {
        // Dodaj połączenie jeśli nie istnieje
        const exists = connections.some(c => c.fromId === activeLine.fromId && c.toId === toId);
        if (!exists) {
            connections.push({ fromId: activeLine.fromId, toId: toId });
            drawConnections();
            saveToLocalStorage();
        }
    }
}

function drawTempLine(x1, y1, x2, y2) {
    const svg = document.getElementById('svg-layer');
    let line = document.getElementById('temp-line');
    if (!line) {
        line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.id = 'temp-line';
        line.setAttribute("class", "connection-line");
        line.style.stroke = "rgba(255,255,255,0.4)";
        line.style.strokeDasharray = "4,4";
        svg.appendChild(line);
    }
    line.setAttribute("d", getBezierPath(x1, y1, x2, y2));
}

function drawConnections() {
    const group = document.getElementById('connections-group');
    group.innerHTML = "";

    connections.forEach((conn, index) => {
        const outPin = document.querySelector(`#tile-${conn.fromId} .pin-output`);
        const inPin = document.querySelector(`#tile-${conn.toId} .pin-input`);

        if (outPin && inPin) {
            const r1 = outPin.getBoundingClientRect();
            const r2 = inPin.getBoundingClientRect();
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "connection-line");
            path.setAttribute("d", getBezierPath(
                r1.left + r1.width/2, r1.top + r1.height/2,
                r2.left + r2.width/2, r2.top + r2.height/2
            ));
            
            // Kliknięcie w nitkę usuwa ją
            path.onclick = () => {
                connections.splice(index, 1);
                drawConnections();
                saveToLocalStorage();
            };
            
            group.appendChild(path);
        }
    });
}

function getBezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// --- FUNKCJE POMOCNICZE ---

function updateTile(id, field, value) {
    const tile = tiles.find(t => t.id === id);
    if (tile) tile[field] = value;
    saveToLocalStorage();
}

function removeTile(id) {
    tiles = tiles.filter(t => t.id !== id);
    connections = connections.filter(c => c.fromId !== id && c.toId !== id);
    const el = document.getElementById(`tile-${id}`);
    if (el) el.remove();
    drawConnections();
    saveToLocalStorage();
}

function clearBoard() {
    if(confirm("Czy usunąć wszystkie nody i połączenia?")) {
        tiles = [];
        connections = [];
        document.getElementById('tiles-layer').innerHTML = "";
        document.getElementById('connections-group').innerHTML = "";
        localStorage.removeItem('blueprint_task_data');
        tileCounter = 0;
    }
}

function saveToLocalStorage() {
    localStorage.setItem('blueprint_task_data', JSON.stringify({ tiles, connections, tileCounter }));
}


function saveProject() {
    const data = JSON.stringify({ tiles, connections, tileCounter });
    const blob = new Blob([data], { type: 'application/json' });
    downloadBlob(blob, 'project-blueprint.json');
}

function saveToTxt() {
    let content = "BLUEPRINT EXPORT\n\n";
    tiles.forEach((t, i) => {
        content += `[${i+1}] ${t.title.toUpperCase()}\nContent: ${t.content}\n\n`;
    });
    downloadBlob(new Blob([content], {type: 'text/plain'}), 'export-tasks.txt');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function triggerLoad() { document.getElementById('loadInput').click(); }

document.getElementById('loadInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        tiles = data.tiles || [];
        connections = data.connections || [];
        tileCounter = data.tileCounter || 0;
        document.getElementById('tiles-layer').innerHTML = "";
        tiles.forEach(t => renderTile(t));
        drawConnections();
        saveToLocalStorage();
    };
    reader.readAsText(e.target.files[0]);
};
