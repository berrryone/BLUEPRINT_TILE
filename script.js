let tiles = [];
let connections = []; // { fromId, fromPinIdx, toId }
let tileCounter = 0;
let selectedTileId = null;
let activeLine = null;

// Nawigacja
let offset = { x: 0, y: 0 };
let zoom = 1.0;
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let contextMenuPos = { x: 0, y: 0 };

const ueColors = ['#1e1e1e', '#2c3e50', '#c0392b', '#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#d35400'];

window.onload = () => {
    initPalette();
    setupNavigation();
    const saved = localStorage.getItem('blueprint_v4_data');
    if (saved) {
        const data = JSON.parse(saved);
        tiles = data.tiles || [];
        connections = data.connections || [];
        tileCounter = data.tileCounter || 0;
        tiles.forEach(t => renderTile(t));
        drawConnections();
    }
};

function initPalette() {
    const p = document.getElementById('palette');
    ueColors.forEach(c => {
        const div = document.createElement('div');
        div.className = 'swatch';
        div.style.background = c;
        div.onclick = () => changeColor(c);
        p.appendChild(div);
    });
}

// Nawigacja i Zoom
function setupNavigation() {
    const view = document.getElementById('viewport');
    view.addEventListener('mousedown', (e) => {
        if (e.button === 2) { isPanning = true; lastMousePos = { x: e.clientX, y: e.clientY }; }
        if (e.button === 0 && e.target === view) {
            deselectAll();
            document.getElementById('context-menu').style.display = 'none';
        }
    });
    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            offset.x += e.clientX - lastMousePos.x;
            offset.y += e.clientY - lastMousePos.y;
            lastMousePos = { x: e.clientX, y: e.clientY };
            updateTransform();
        }
    });
    window.addEventListener('mouseup', () => isPanning = false);
    view.addEventListener('contextmenu', e => e.preventDefault());
    view.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoom = Math.min(Math.max(zoom * delta, 0.2), 2);
        updateTransform();
    }, { passive: false });
}

function updateTransform() {
    document.getElementById('canvas').style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`;
}

// Logika Nodów
function addTile(x = null, y = null) {
    tileCounter++;
    const t = {
        id: tileCounter,
        x: x || (Math.abs(offset.x) + 300) / zoom,
        y: y || (Math.abs(offset.y) + 200) / zoom,
        title: "LOGIC_NODE_" + tileCounter,
        content: "",
        color: '#2c3e50',
        outputs: 1
    };
    tiles.push(t);
    renderTile(t);
    selectTile(t.id);
    save();
}

function renderTile(tile) {
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
            <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)" placeholder="Logic...">${tile.content}</textarea>
        </div>
        <div class="pin pin-input" style="border-color:${tile.color}" onmouseup="dropLine(event, ${tile.id})"></div>
        <div class="pin-output-container" id="out-wrap-${tile.id}">
            ${Array(tile.outputs).fill().map((_, i) => `<div class="pin-output" style="border-color:${tile.color}" onmousedown="startLine(event, ${tile.id}, ${i})"></div>`).join('')}
            <button class="add-output-btn" onclick="addPin(${tile.id})">+</button>
        </div>
    `;

    el.onmousedown = (e) => {
        e.stopPropagation();
        selectTile(tile.id);
        if (e.target.closest('.pin') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        let startX = e.clientX; let startY = e.clientY;
        const move = (me) => {
            tile.x += (me.clientX - startX) / zoom;
            tile.y += (me.clientY - startY) / zoom;
            el.style.left = tile.x + 'px'; el.style.top = tile.y + 'px';
            startX = me.clientX; startY = me.clientY;
            drawConnections();
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); save(); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };
    document.getElementById('tiles-layer').appendChild(el);
}

// Logika Połączeń i Menu Kontekstowego
function startLine(e, fromId, fromPinIdx) {
    e.stopPropagation();
    const pinRect = e.target.getBoundingClientRect();
    const cR = document.getElementById('canvas').getBoundingClientRect();
    activeLine = { fromId, fromPinIdx, x: (pinRect.left + 7 - cR.left) / zoom, y: (pinRect.top + 7 - cR.top) / zoom };

    const move = (me) => {
        if(!activeLine) return;
        const curX = (me.clientX - cR.left) / zoom; const curY = (me.clientY - cR.top) / zoom;
        drawTempLine(activeLine.x, activeLine.y, curX, curY);
    };
    const up = (ue) => {
        const temp = document.getElementById('temp-line'); if (temp) temp.remove();
        if (!ue.target.classList.contains('pin-input')) showContextMenu(ue.clientX, ue.clientY);
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
}

function dropLine(e, toId) {
    if (activeLine && activeLine.fromId !== toId) {
        connections.push({ fromId: activeLine.fromId, fromPinIdx: activeLine.fromPinIdx, toId: toId });
        drawConnections(); save(); activeLine = null;
    }
}

function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'block'; menu.style.left = x + 'px'; menu.style.top = y + 'px';
    const cR = document.getElementById('canvas').getBoundingClientRect();
    contextMenuPos = { x: (x - cR.left) / zoom, y: (y - cR.top) / zoom };
}

function createNodeAtMouse() {
    addTile(contextMenuPos.x, contextMenuPos.y);
    const newNode = tiles[tiles.length - 1];
    if (activeLine) { connections.push({ fromId: activeLine.fromId, fromPinIdx: activeLine.fromPinIdx, toId: newNode.id }); drawConnections(); activeLine = null; }
    document.getElementById('context-menu').style.display = 'none';
}

function drawConnections() {
    const group = document.getElementById('lines-group'); group.innerHTML = "";
    connections.forEach((conn, i) => {
        const outPin = document.querySelectorAll(`#tile-${conn.fromId} .pin-output`)[conn.fromPinIdx];
        const inPin = document.querySelector(`#tile-${conn.toId} .pin-input`);
        const tile = tiles.find(t => t.id === conn.fromId);
        if (outPin && inPin) {
            const r1 = outPin.getBoundingClientRect(); const r2 = inPin.getBoundingClientRect();
            const cR = document.getElementById('canvas').getBoundingClientRect();
            const x1 = (r1.left + 7 - cR.left) / zoom, y1 = (r1.top + 7 - cR.top) / zoom;
            const x2 = (r2.left + 7 - cR.left) / zoom, y2 = (r2.top + 7 - cR.top) / zoom;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "connection-line");
            path.setAttribute("d", `M ${x1} ${y1} C ${x1 + Math.abs(x2-x1)*0.5} ${y1}, ${x2 - Math.abs(x2-x1)*0.5} ${y2}, ${x2} ${y2}`);
            path.style.stroke = tile ? tile.color : "#fff";
            path.onclick = () => { connections.splice(i, 1); drawConnections(); save(); };
            group.appendChild(path);
        }
    });
}

function drawTempLine(x1, y1, x2, y2) {
    const group = document.getElementById('lines-group');
    let line = document.getElementById('temp-line');
    if (!line) {
        line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        line.id = 'temp-line'; line.setAttribute("class", "connection-line");
        line.style.stroke = "rgba(255,170,0,0.5)"; line.style.strokeDasharray = "5,5";
        group.appendChild(line);
    }
    line.setAttribute("d", `M ${x1} ${y1} C ${x1 + Math.abs(x2-x1)*0.5} ${y1}, ${x2 - Math.abs(x2-x1)*0.5} ${y2}, ${x2} ${y2}`);
}

// Helpers i Zarządzanie
function selectTile(id) { deselectAll(); selectedTileId = id; const el = document.getElementById(`tile-${id}`); if(el) el.classList.add('selected'); }
function deselectAll() { selectedTileId = null; document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected')); }
function changeColor(c) {
    if(selectedTileId) {
        const t = tiles.find(x => x.id === selectedTileId);
        t.color = c; document.getElementById(`header-${t.id}`).style.background = c;
        document.querySelectorAll(`#tile-${t.id} .pin, #tile-${t.id} .pin-output`).forEach(p => p.style.borderColor = c);
        drawConnections(); save();
    }
}
function addPin(id) {
    const t = tiles.find(x => x.id === id);
    if(t.outputs < 50) {
        t.outputs++;
        const wrap = document.getElementById(`out-wrap-${id}`);
        const newPin = document.createElement('div');
        newPin.className = 'pin-output'; newPin.style.borderColor = t.color;
        newPin.onmousedown = (e) => startLine(e, id, t.outputs - 1);
        wrap.insertBefore(newPin, wrap.lastElementChild);
        save();
    }
}
function updateTile(id, field, val) { const t = tiles.find(x => x.id === id); if(t) t[field] = val; save(); }
function removeTile(id) {
    tiles = tiles.filter(t => t.id !== id); connections = connections.filter(c => c.fromId !== id && c.toId !== id);
    document.getElementById(`tile-${id}`).remove(); drawConnections(); save();
}
function clearBoard() { if(confirm("Resetuj scenę?")) { tiles = []; connections = []; tileCounter = 0; document.getElementById('tiles-layer').innerHTML = ""; drawConnections(); localStorage.removeItem('blueprint_v4_data'); } }
function save() { localStorage.setItem('blueprint_v4_data', JSON.stringify({ tiles, connections, tileCounter })); }

// Eksport
function saveProject() { const blob = new Blob([JSON.stringify({ tiles, connections, tileCounter })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blueprint.json'; a.click(); }
function saveToTxt() {
    let txt = "BLUEPRINT EXPORT\n\n";
    tiles.forEach(t => { txt += `NODE: ${t.title}\nCONTENT: ${t.content}\nOUTPUTS: ${t.outputs}\n---\n`; });
    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blueprint.txt'; a.click();
}
function triggerLoad() { document.getElementById('loadInput').click(); }
document.getElementById('loadInput').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        tiles = data.tiles; connections = data.connections; tileCounter = data.tileCounter;
        document.getElementById('tiles-layer').innerHTML = "";
        tiles.forEach(t => renderTile(t)); drawConnections();
    };
    reader.readAsText(e.target.files[0]);
};
