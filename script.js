let tiles = [];
let connections = []; // { fromId, fromPinIdx, toId }
let tileCounter = 0;
let selectedTileId = null;
let activeLine = null;

// Kolory Unreal Engine Style
const ueColors = ['#1e1e1e', '#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#d35400'];

window.onload = () => {
    initColorPalette();
    const saved = localStorage.getItem('ue_blueprint_data');
    if (saved) {
        const data = JSON.parse(saved);
        tiles = data.tiles || [];
        connections = data.connections || [];
        tileCounter = data.tileCounter || 0;
        tiles.forEach(t => renderTile(t));
        drawConnections();
    }
};

function initColorPalette() {
    const palette = document.getElementById('colorPalette');
    ueColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = color;
        swatch.onclick = () => changeSelectedTileColor(color);
        palette.appendChild(swatch);
    });
}

function addTile() {
    tileCounter++;
    const tile = {
        id: tileCounter,
        x: 300, y: 150,
        title: "NEW_NODE_" + tileCounter,
        content: "",
        color: '#2c3e50',
        outputCount: 1
    };
    tiles.push(tile);
    renderTile(tile);
    selectTile(tile.id);
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
        <div class="tile-header" id="header-${tile.id}" style="background: ${tile.color}">
            <input class="tile-title" value="${tile.title}" onchange="updateTile(${tile.id}, 'title', this.value)">
            <button class="btn-close" onclick="removeTile(${tile.id})">×</button>
        </div>
        <div class="tile-content">
            <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)" placeholder="Logic content...">${tile.content}</textarea>
        </div>
        <div class="pin pin-input" data-id="${tile.id}" onmouseup="dropLine(event, ${tile.id})"></div>
        <div class="outputs-wrapper" id="outputs-${tile.id}">
            ${generateOutputPins(tile)}
        </div>
        <button class="add-pin-btn" onclick="addPin(${tile.id})">+</button>
    `;

    // Kliknięcie zaznacza Tile
    el.onmousedown = (e) => {
        selectTile(tile.id);
        if (e.target.closest('.pin') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        
        let shiftX = e.clientX - el.getBoundingClientRect().left;
        let shiftY = e.clientY - el.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            tile.x = pageX - shiftX;
            tile.y = pageY - shiftY;
            el.style.left = tile.x + 'px';
            el.style.top = tile.y + 'px';
            drawConnections();
        }

        function onMouseMove(e) { moveAt(e.pageX, e.pageY); }
        document.addEventListener('mousemove', onMouseMove);
        document.onmouseup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            saveToLocalStorage();
            document.onmouseup = null;
        };
    };

    container.appendChild(el);
    updateInfo();
}

function generateOutputPins(tile) {
    let html = '';
    for(let i=0; i < tile.outputCount; i++) {
        html += `<div class="pin-output" data-idx="${i}" onmousedown="startLine(event, ${tile.id}, ${i})"></div>`;
    }
    return html;
}

function addPin(tileId) {
    const tile = tiles.find(t => t.id === tileId);
    if (tile && tile.outputCount < 50) {
        tile.outputCount++;
        document.getElementById(`outputs-${tileId}`).innerHTML = generateOutputPins(tile);
        saveToLocalStorage();
    }
}

function selectTile(id) {
    selectedTileId = id;
    document.querySelectorAll('.tile').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.getElementById(`tile-${id}`);
    if (selectedEl) selectedEl.classList.add('selected');
}

function changeSelectedTileColor(color) {
    if (!selectedTileId) return;
    const tile = tiles.find(t => t.id === selectedTileId);
    if (tile) {
        tile.color = color;
        document.getElementById(`header-${tile.id}`).style.background = color;
        saveToLocalStorage();
    }
}

// --- LOGIKA POŁĄCZEŃ ---

function startLine(e, fromId, fromPinIdx) {
    e.stopPropagation();
    const pinRect = e.target.getBoundingClientRect();
    const startX = pinRect.left + pinRect.width/2;
    const startY = pinRect.top + pinRect.height/2;

    activeLine = { fromId, fromPinIdx, startX, startY };

    function onMouseMove(ev) {
        if (!activeLine) return;
        drawTempLine(activeLine.startX, activeLine.startY, ev.pageX, ev.pageY);
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
        const exists = connections.some(c => c.fromId === activeLine.fromId && c.fromPinIdx === activeLine.fromPinIdx && c.toId === toId);
        if (!exists) {
            connections.push({ fromId: activeLine.fromId, fromPinIdx: activeLine.fromPinIdx, toId: toId });
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
        line.style.stroke = "rgba(255,255,255,0.4)";
        line.style.strokeDasharray = "5,5";
        group.appendChild(line);
    }
    line.setAttribute("d", getBezier(x1, y1, x2, y2));
}

function drawConnections() {
    const group = document.getElementById('lines-group');
    group.innerHTML = "";

    connections.forEach((conn, index) => {
        const fromTileEl = document.getElementById(`tile-${conn.fromId}`);
        const toTileEl = document.getElementById(`tile-${conn.toId}`);
        
        if (fromTileEl && toTileEl) {
            const outPins = fromTileEl.querySelectorAll('.pin-output');
            const inPin = toTileEl.querySelector('.pin-input');
            const outPin = outPins[conn.fromPinIdx];

            if (outPin && inPin) {
                const r1 = outPin.getBoundingClientRect();
                const r2 = inPin.getBoundingClientRect();
                
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("class", "connection-line");
                path.setAttribute("d", getBezier(r1.left + r1.width/2, r1.top + r1.height/2, r2.left + r2.width/2, r2.top + r2.height/2));
                path.onclick = () => { connections.splice(index, 1); drawConnections(); saveToLocalStorage(); };
                group.appendChild(path);
            }
        }
    });
    updateInfo();
}

function getBezier(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// --- NARZĘDZIA ---

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
    if(confirm("Czy na pewno wyczyścić cały projekt?")) {
        tiles = []; connections = []; tileCounter = 0;
        document.getElementById('tiles-layer').innerHTML = "";
        drawConnections();
        localStorage.removeItem('ue_blueprint_data');
    }
}

function saveToLocalStorage() {
    localStorage.setItem('ue_blueprint_data', JSON.stringify({ tiles, connections, tileCounter }));
}

function updateInfo() {
    document.getElementById('infoPanel').innerText = `Nodes: ${tiles.length} | Connections: ${connections.length}`;
}

function saveProject() {
    const blob = new Blob([JSON.stringify({ tiles, connections, tileCounter })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'blueprint_export.json';
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
