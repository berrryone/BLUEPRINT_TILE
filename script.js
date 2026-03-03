let tiles = [];
let connections = [];
let tileCounter = 0;
let isSnapEnabled = true;
let zoom = 1;
let activeLine = null;

window.onload = () => {
    const saved = localStorage.getItem('visual_logic_data');
    if (saved) {
        const data = JSON.parse(saved);
        tiles = data.tiles || [];
        connections = data.connections || [];
        tileCounter = data.tileCounter || 0;
        tiles.forEach(t => renderTile(t));
        drawConnections();
        updateInfo();
    }
};

function toggleSnap() {
    isSnapEnabled = !isSnapEnabled;
    document.getElementById('snapBtn').innerText = `Snap to Grid: ${isSnapEnabled ? 'ON' : 'OFF'}`;
}

function resetZoom() {
    zoom = 1;
    document.getElementById('canvas').style.transform = `scale(1)`;
}

function addTile() {
    tileCounter++;
    const tile = {
        id: tileCounter,
        x: 300, y: 150,
        title: "LOGIC_NODE_" + tileCounter,
        content: "",
        color: "#2980b9",
        outputs: [1] // Domyślnie jeden pin wyjściowy
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
            <button class="btn-header" onclick="removeTile(${tile.id})">×</button>
        </div>
        <div class="tile-content">
            <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)" placeholder="Opisz logikę...">${tile.content}</textarea>
        </div>
        <div class="pin pin-input" onmouseup="dropLine(event, ${tile.id})"></div>
        <div class="pin-output-container">
            ${tile.outputs.map((o, i) => `<div class="pin-output" onmousedown="startLine(event, ${tile.id}, ${i})"></div>`).join('')}
        </div>
    `;

    // Mechanizm przesuwania (Drag)
    el.onmousedown = function(e) {
        if (e.target.closest('.pin') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        
        let shiftX = (e.clientX / zoom) - tile.x;
        let shiftY = (e.clientY / zoom) - tile.y;

        function moveAt(pageX, pageY) {
            let newX = (pageX / zoom) - shiftX;
            let newY = (pageY / zoom) - shiftY;

            if (isSnapEnabled) {
                newX = Math.round(newX / 20) * 20;
                newY = Math.round(newY / 20) * 20;
            }

            tile.x = newX;
            tile.y = newY;
            el.style.left = newX + 'px';
            el.style.top = newY + 'px';
            drawConnections();
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
    updateInfo();
}

// --- LOGIKA POŁĄCZEŃ ---

function startLine(e, fromId, outIdx) {
    e.stopPropagation();
    const rect = e.target.getBoundingClientRect();
    const canvasRect = document.getElementById('canvas').getBoundingClientRect();
    
    const startX = (rect.left + rect.width/2 - canvasRect.left) / zoom;
    const startY = (rect.top + rect.height/2 - canvasRect.top) / zoom;

    activeLine = { fromId, startX, startY };

    function onMouseMove(ev) {
        if (!activeLine) return;
        const curX = (ev.clientX - canvasRect.left) / zoom;
        const curY = (ev.clientY - canvasRect.top) / zoom;
        drawTempLine(activeLine.startX, activeLine.startY, curX, curY);
    }

    function onMouseUp() {
        const temp = document.getElementById('temp-line');
        if (temp) temp.remove();
        activeLine = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function dropLine(e, toId) {
    if (activeLine && activeLine.fromId !== toId) {
        const exists = connections.some(c => c.fromId === activeLine.fromId && c.toId === toId);
        if (!exists) {
            connections.push({ fromId: activeLine.fromId, toId: toId });
            drawConnections();
            saveToLocalStorage();
        }
    }
}

function drawTempLine(x1, y1, x2, y2) {
    const group = document.getElementById('lines-group');
    let line = document.getElementById('temp-line');
    if (!line) {
        line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.id = 'temp-line';
        line.setAttribute("class", "connection-line");
        line.style.stroke = "rgba(255,255,255,0.3)";
        line.style.strokeDasharray = "5,5";
        group.appendChild(line);
    }
    line.setAttribute("d", calculateBezier(x1, y1, x2, y2));
}

function drawConnections() {
    const group = document.getElementById('lines-group');
    group.querySelectorAll('.connection-line:not(#temp-line)').forEach(n => n.remove());

    connections.forEach((conn, index) => {
        const outPin = document.querySelector(`#tile-${conn.fromId} .pin-output`);
        const inPin = document.querySelector(`#tile-${conn.toId} .pin-input`);

        if (outPin && inPin) {
            const r1 = outPin.getBoundingClientRect();
            const r2 = inPin.getBoundingClientRect();
            const cR = document.getElementById('canvas').getBoundingClientRect();

            const x1 = (r1.left + r1.width/2 - cR.left) / zoom;
            const y1 = (r1.top + r1.height/2 - cR.top) / zoom;
            const x2 = (r2.left + r2.width/2 - cR.left) / zoom;
            const y2 = (r2.top + r2.height/2 - cR.top) / zoom;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "connection-line");
            path.setAttribute("d", calculateBezier(x1, y1, x2, y2));
            path.onclick = () => {
                connections.splice(index, 1);
                drawConnections();
                saveToLocalStorage();
            };
            group.appendChild(path);
        }
    });
    updateInfo();
}

function calculateBezier(x1, y1, x2, y2) {
    const dist = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dist} ${y1}, ${x2 - dist} ${y2}, ${x2} ${y2}`;
}

// --- RESZTA ---

function updateTile(id, field, val) {
    const t = tiles.find(x => x.id === id);
    if (t) t[field] = val;
    saveToLocalStorage();
}

function removeTile(id) {
    tiles = tiles.filter(t => t.id !== id);
    connections = connections.filter(c => c.fromId !== id && c.toId !== id);
    document.getElementById(`tile-${id}`).remove();
    drawConnections();
    saveToLocalStorage();
}

function clearBoard() {
    if (confirm("Wyczyścić wszystko?")) {
        tiles = []; connections = [];
        document.getElementById('tiles-layer').innerHTML = "";
        drawConnections();
        localStorage.removeItem('visual_logic_data');
    }
}

function saveToLocalStorage() {
    localStorage.setItem('visual_logic_data', JSON.stringify({ tiles, connections, tileCounter }));
}

function updateInfo() {
    document.getElementById('infoPanel').innerText = `Nodes: ${tiles.length} | Connections: ${connections.length}`;
}

function saveProject() {
    const data = JSON.stringify({ tiles, connections, tileCounter });
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'logic_project.json';
    a.click();
}

function triggerLoad() { document.getElementById('loadInput').click(); }
document.getElementById('loadInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        tiles = data.tiles; connections = data.connections; tileCounter = data.tileCounter;
        document.getElementById('tiles-layer').innerHTML = "";
        tiles.forEach(t => renderTile(t));
        drawConnections();
    };
    reader.readAsText(e.target.files[0]);
};
