let tiles = [];
let connections = [];
let tileCounter = 0;
let selectedIds = new Set();
let activeLine = null;

// Viewport & Controls
let offset = { x: 0, y: 0 };
let zoom = 1.0;
let isPanning = false;
let isSelecting = false;
let selectStart = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };
let contextMenuPos = { x: 0, y: 0 };

// Kolory programistyczne (Unreal Style)
const ueDataColors = [
    { name: 'Exec', hex: '#ffffff' },
    { name: 'Boolean', hex: '#9b0000' },
    { name: 'Integer', hex: '#1ed5a9' },
    { name: 'Float', hex: '#95ff4a' },
    { name: 'String', hex: '#ff00d4' },
    { name: 'Object', hex: '#0070ff' },
    { name: 'Vector', hex: '#ffc100' },
    { name: 'Struct', hex: '#0046ad' }
];

window.onload = () => {
    initPalette();
    setupEvents();
    const saved = localStorage.getItem('berry_bp_v5');
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
    ueDataColors.forEach(c => {
        const div = document.createElement('div');
        div.className = 'swatch';
        div.style.background = c.hex;
        div.title = c.name;
        div.onclick = () => changeSelectedColor(c.hex);
        p.appendChild(div);
    });
}

function setupEvents() {
    const view = document.getElementById('viewport');
    
    view.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Prawy przycisk - Panning
            isPanning = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
        } else if (e.button === 0 && e.target === view) { // Lewy przycisk na tle - Selekcja
            isSelecting = true;
            selectStart = { x: e.clientX, y: e.clientY };
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
        } else if (isSelecting) {
            const x = Math.min(e.clientX, selectStart.x);
            const y = Math.min(e.clientY, selectStart.y);
            const w = Math.abs(e.clientX - selectStart.x);
            const h = Math.abs(e.clientY - selectStart.y);
            updateSelectionBox(x, y, w, h);
        }
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        isSelecting = false;
        document.getElementById('selection-box').style.display = 'none';
        save();
    });

    view.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoom = Math.max(0.2, Math.min(zoom * delta, 2));
        updateTransform();
    }, { passive: false });

    view.addEventListener('contextmenu', e => e.preventDefault());
}

function updateTransform() {
    document.getElementById('canvas').style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`;
}

function updateSelectionBox(x, y, w, h) {
    const box = document.getElementById('selection-box');
    box.style.display = 'block';
    box.style.left = x + 'px'; box.style.top = y + 'px';
    box.style.width = w + 'px'; box.style.height = h + 'px';

    tiles.forEach(t => {
        const el = document.getElementById(`tile-${t.id}`);
        const r = el.getBoundingClientRect();
        if (r.left < x + w && r.left + r.width > x && r.top < y + h && r.top + r.height > y) {
            selectTile(t.id, true);
        } else {
            selectTile(t.id, false);
        }
    });
}

function addTile(x = null, y = null) {
    tileCounter++;
    const t = {
        id: tileCounter,
        x: x || (Math.abs(offset.x) + 400) / zoom,
        y: y || (Math.abs(offset.y) + 200) / zoom,
        title: "TEXT_NODE_" + tileCounter,
        content: "",
        color: '#0070ff',
        outputs: 1,
        collapsed: true
    };
    tiles.push(t);
    renderTile(t);
    save();
}

function renderTile(tile) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.id = `tile-${tile.id}`;
    el.style.left = `${tile.x}px`; el.style.top = `${tile.y}px`;

    el.innerHTML = `
        <div class="tile-header" id="header-${tile.id}" style="background: ${tile.color}">
            <input class="tile-title" value="${tile.title}" onchange="updateTile(${tile.id}, 'title', this.value)">
            <div class="header-btns">
                <button class="btn-icon" onclick="toggleContent(${tile.id})" title="Toggle Text">📝</button>
                <button class="btn-icon btn-close" onclick="removeTile(${tile.id})">×</button>
            </div>
        </div>
        <div class="tile-content" id="content-${tile.id}" style="display: ${tile.collapsed ? 'none' : 'block'}">
            <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)" placeholder="Enter text here...">${tile.content}</textarea>
        </div>
        <div class="pin pin-input" style="border-color:${tile.color}" onmouseup="dropLine(event, ${tile.id})"></div>
        <div class="pin-output-container" id="out-wrap-${tile.id}">
            ${Array(tile.outputs).fill().map((_, i) => `<div class="pin-output" style="border-color:${tile.color}" onmousedown="startLine(event, ${tile.id}, ${i})"></div>`).join('')}
            <button class="add-output-btn" onclick="addPin(${tile.id})">+</button>
        </div>
    `;

    el.onmousedown = (e) => {
        e.stopPropagation();
        if (!selectedIds.has(tile.id) && !e.shiftKey) deselectAll();
        selectTile(tile.id, true);

        if (e.target.closest('.header-btns') || e.target.closest('.pin') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        let startX = e.clientX; let startY = e.clientY;
        const move = (me) => {
            const dx = (me.clientX - startX) / zoom;
            const dy = (me.clientY - startY) / zoom;
            selectedIds.forEach(id => {
                const targetTile = tiles.find(t => t.id === id);
                targetTile.x += dx; targetTile.y += dy;
                const tileEl = document.getElementById(`tile-${id}`);
                tileEl.style.left = targetTile.x + 'px'; tileEl.style.top = targetTile.y + 'px';
            });
            startX = me.clientX; startY = me.clientY;
            drawConnections();
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); save(); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };
    document.getElementById('tiles-layer').appendChild(el);
}

// Logika Nitki
function startLine(e, fromId, fromPinIdx) {
    e.stopPropagation();
    const pinRect = e.target.getBoundingClientRect();
    const cR = document.getElementById('canvas').getBoundingClientRect();
    activeLine = { fromId, fromPinIdx, x: (pinRect.left + 6 - cR.left) / zoom, y: (pinRect.top + 6 - cR.top) / zoom };

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

function drawConnections() {
    const group = document.getElementById('lines-group'); group.innerHTML = "";
    connections.forEach((conn, i) => {
        const outPin = document.querySelectorAll(`#tile-${conn.fromId} .pin-output`)[conn.fromPinIdx];
        const inPin = document.querySelector(`#tile-${conn.toId} .pin-input`);
        const tile = tiles.find(t => t.id === conn.fromId);
        if (outPin && inPin) {
            const r1 = outPin.getBoundingClientRect(); const r2 = inPin.getBoundingClientRect();
            const cR = document.getElementById('canvas').getBoundingClientRect();
            const x1 = (r1.left + 6 - cR.left) / zoom, y1 = (r1.top + 6 - cR.top) / zoom;
            const x2 = (r2.left + 6 - cR.left) / zoom, y2 = (r2.top + 6 - cR.top) / zoom;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "connection-line");
            path.setAttribute("d", `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`);
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
        line.style.stroke = "rgba(255,255,255,0.4)"; line.style.strokeDasharray = "5,5";
        group.appendChild(line);
    }
    line.setAttribute("d", `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`);
}

// Zarządzanie i UI
function toggleContent(id) {
    const t = tiles.find(x => x.id === id);
    t.collapsed = !t.collapsed;
    document.getElementById(`content-${id}`).style.display = t.collapsed ? 'none' : 'block';
    save();
}

function selectTile(id, state) {
    const el = document.getElementById(`tile-${id}`);
    if (state) { selectedIds.add(id); el.classList.add('selected'); }
    else { selectedIds.delete(id); el.classList.remove('selected'); }
}

function deselectAll() {
    selectedIds.clear();
    document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected'));
}

function changeSelectedColor(c) {
    selectedIds.forEach(id => {
        const t = tiles.find(x => x.id === id);
        t.color = c;
        document.getElementById(`header-${id}`).style.background = c;
        document.getElementById(`tile-${id}`).querySelector('.pin-input').style.borderColor = c;
        document.querySelectorAll(`#tile-${id} .pin-output`).forEach(p => p.style.borderColor = c);
    });
    drawConnections(); save();
}

function addPin(id) {
    const t = tiles.find(x => x.id === id);
    if(t.outputs < 50) {
        t.outputs++;
        const wrap = document.getElementById(`out-wrap-${id}`);
        const p = document.createElement('div');
        p.className = 'pin-output'; p.style.borderColor = t.color;
        p.onmousedown = (e) => startLine(e, id, t.outputs-1);
        wrap.insertBefore(p, wrap.lastElementChild);
        save();
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
    const newNode = tiles[tiles.length-1];
    if (activeLine) { 
        connections.push({ fromId: activeLine.fromId, fromPinIdx: activeLine.fromPinIdx, toId: newNode.id }); 
        drawConnections(); activeLine = null; 
    }
    document.getElementById('context-menu').style.display = 'none';
}

function updateTile(id, field, val) { const t = tiles.find(x => x.id === id); if(t) t[field] = val; save(); }
function removeTile(id) {
    tiles = tiles.filter(t => t.id !== id); connections = connections.filter(c => c.fromId !== id && c.toId !== id);
    document.getElementById(`tile-${id}`).remove(); drawConnections(); save();
}
function clearBoard() { if(confirm("Clear all?")) { localStorage.clear(); location.reload(); } }
function save() { localStorage.setItem('berry_bp_v5', JSON.stringify({ tiles, connections, tileCounter })); }

function saveProject() {
    const blob = new Blob([JSON.stringify({ tiles, connections, tileCounter })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'berry_project.json'; a.click();
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
