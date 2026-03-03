let tiles = [];
let connections = [];
let tileCounter = 0;
let selectedIds = new Set();
let activeLine = null;
let history = [];
let offset = { x: 0, y: 0 }, zoom = 1.0;
let isPanning = false, isSelecting = false;
let selectStart = { x: 0, y: 0 }, lastMousePos = { x: 0, y: 0 }, contextMenuPos = { x: 0, y: 0 };

const myCustomColors = [
    { name: 'Róż', hex: '#FF1493', class: 'pink' },
    { name: 'Zieleń', hex: '#39FF14', class: 'green' },
    { name: 'Pomarańcz', hex: '#FF6700', class: 'orange' },
    { name: 'Żółty', hex: '#FFF01F', class: 'yellow' },
    { name: 'Niebieski', hex: '#00BFFF', class: 'blue' },
    { name: 'Granat', hex: '#1a2a44', class: 'navy' }
];

window.onload = () => {
    initPalette();
    setupEvents();
    load();
};

function initPalette() {
    const p = document.getElementById('palette');
    myCustomColors.forEach(c => {
        const div = document.createElement('div');
        div.className = `swatch`;
        div.style.background = c.hex;
        div.onclick = () => changeSelectedColor(c.class, c.hex);
        p.appendChild(div);
    });
}

function setupEvents() {
    const view = document.getElementById('viewport');
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) deleteSelected();
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    });

    view.addEventListener('mousedown', (e) => {
        if (e.button === 2) { isPanning = true; lastMousePos = { x: e.clientX, y: e.clientY }; }
        else if (e.button === 0 && e.target === view) { 
            isSelecting = true; selectStart = { x: e.clientX, y: e.clientY };
            deselectAll(); document.getElementById('context-menu').style.display = 'none';
        }
    });

    window.addEventListener('mousemove', (e) => {
        const cR = document.getElementById('canvas').getBoundingClientRect();
        if (isPanning) {
            offset.x += e.clientX - lastMousePos.x; offset.y += e.clientY - lastMousePos.y;
            lastMousePos = { x: e.clientX, y: e.clientY }; updateTransform();
        } else if (isSelecting) {
            updateSelectionBox(e.clientX, e.clientY);
        } else if (activeLine) {
            drawTempLine((e.clientX - cR.left) / zoom, (e.clientY - cR.top) / zoom);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (activeLine && !e.target.classList.contains('pin')) showContextMenu(e.clientX, e.clientY);
        else if (activeLine) { if(document.getElementById('temp-line')) document.getElementById('temp-line').remove(); activeLine = null; }
        if (isSelecting || isPanning) saveState();
        isPanning = false; isSelecting = false;
        document.getElementById('selection-box').style.display = 'none';
        save();
    });

    view.addEventListener('wheel', e => {
        e.preventDefault();
        zoom = Math.max(0.2, Math.min(zoom * (e.deltaY > 0 ? 0.9 : 1.1), 2));
        updateTransform();
    }, { passive: false });
    view.addEventListener('contextmenu', e => e.preventDefault());
}

function saveState() {
    const state = JSON.stringify({ tiles, connections, tileCounter });
    if (history.length === 0 || history[history.length - 1] !== state) {
        history.push(state); if (history.length > 40) history.shift();
    }
}

function undo() {
    if (history.length > 1) {
        history.pop();
        const prev = JSON.parse(history[history.length - 1]);
        tiles = prev.tiles; connections = prev.connections; tileCounter = prev.tileCounter;
        refreshCanvas();
    }
}

function refreshCanvas() {
    document.getElementById('tiles-layer').innerHTML = "";
    tiles.forEach(t => renderTile(t));
    drawConnections();
}

function addTile(x = null, y = null) {
    tileCounter++;
    const t = { id: tileCounter, x: x || (Math.abs(offset.x)+400)/zoom, y: y || (Math.abs(offset.y)+200)/zoom, title: "NODE_"+tileCounter, content: "", colorClass: 'pink', color: '#FF1493', inputs: 1, outputs: 1, collapsed: false };
    tiles.push(t); renderTile(t); saveState();
}

function renderTile(tile) {
    const el = document.createElement('div');
    el.className = `tile ${selectedIds.has(tile.id) ? 'selected' : ''}`;
    el.id = `tile-${tile.id}`;
    el.style.left = `${tile.x}px`; el.style.top = `${tile.y}px`;

    el.innerHTML = `
        <div class="tile-header header-${tile.colorClass}">
            <input class="tile-title" value="${tile.title}" onchange="updateTile(${tile.id}, 'title', this.value)">
            <div class="header-btns">
                <button class="btn-icon" onclick="toggleContent(${tile.id})">📝</button>
                <button class="btn-icon" onclick="removeTile(${tile.id})">×</button>
            </div>
        </div>
        <div class="tile-body">
            <div class="pins-col inputs-col">
                ${Array(tile.inputs).fill().map((_, i) => `<div class="pin pin-input" onmouseup="dropLine(event, ${tile.id}, ${i})"></div>`).join('')}
                <button class="add-pin-btn" onclick="addPin(${tile.id}, 'inputs')">+</button>
            </div>
            <div class="tile-main-content" style="display: ${tile.collapsed ? 'none' : 'flex'}">
                <textarea class="tile-textarea" onchange="updateTile(${tile.id}, 'content', this.value)">${tile.content}</textarea>
            </div>
            <div class="pins-col outputs-col">
                ${Array(tile.outputs).fill().map((_, i) => `<div class="pin pin-output" onmousedown="startLine(event, ${tile.id}, ${i})"></div>`).join('')}
                <button class="add-pin-btn" onclick="addPin(${tile.id}, 'outputs')">+</button>
            </div>
        </div>
    `;

    el.onmousedown = (e) => {
        e.stopPropagation();
        if (!selectedIds.has(tile.id) && !e.shiftKey) deselectAll();
        selectTile(tile.id, true);
        if (e.target.closest('.header-btns') || e.target.closest('.pin') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        let sX = e.clientX, sY = e.clientY;
        const move = (m) => {
            const dx = (m.clientX - sX)/zoom, dy = (m.clientY - sY)/zoom;
            selectedIds.forEach(id => {
                const t = tiles.find(x => x.id === id);
                if (t) { t.x += dx; t.y += dy; const tEl = document.getElementById(`tile-${id}`); tEl.style.left = t.x + 'px'; tEl.style.top = t.y + 'px'; }
            });
            sX = m.clientX; sY = m.clientY; drawConnections();
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); saveState(); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };
    document.getElementById('tiles-layer').appendChild(el);
}

function startLine(e, fromId, fromPinIdx) {
    e.stopPropagation(); e.preventDefault();
    const r = e.target.getBoundingClientRect();
    const cR = document.getElementById('canvas').getBoundingClientRect();
    activeLine = { fromId, fromPinIdx, x: (r.left + r.width/2 - cR.left)/zoom, y: (r.top + r.height/2 - cR.top)/zoom };
}

function dropLine(e, toId, toPinIdx) {
    if (activeLine && activeLine.fromId !== toId) {
        connections.push({ fromId: activeLine.fromId, fromPinIdx: activeLine.fromPinIdx, toId, toPinIdx });
        activeLine = null; saveState(); drawConnections();
    }
}

function drawConnections() {
    const g = document.getElementById('lines-group'); g.innerHTML = "";
    connections.forEach((c, i) => {
        const outPs = document.querySelectorAll(`#tile-${c.fromId} .pin-output`), inPs = document.querySelectorAll(`#tile-${c.toId} .pin-input`);
        const outP = outPs[c.fromPinIdx], inP = inPs[c.toPinIdx];
        if (outP && inP) {
            const r1 = outP.getBoundingClientRect(), r2 = inP.getBoundingClientRect(), cR = document.getElementById('canvas').getBoundingClientRect();
            const x1 = (r1.left + r1.width/2 - cR.left)/zoom, y1 = (r1.top + r1.height/2 - cR.top)/zoom;
            const x2 = (r2.left + r2.width/2 - cR.left)/zoom, y2 = (r2.top + r2.height/2 - cR.top)/zoom;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "connection-line"); path.setAttribute("d", `M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`);
            const t = tiles.find(x => x.id === c.fromId); path.style.stroke = t ? t.color : "#fff";
            path.onclick = (ev) => { ev.stopPropagation(); connections.splice(i, 1); saveState(); drawConnections(); };
            g.appendChild(path);
        }
    });
}

function drawTempLine(tx, ty) {
    const g = document.getElementById('lines-group');
    let l = document.getElementById('temp-line') || document.createElementNS("http://www.w3.org/2000/svg", "path");
    if(!l.id) { l.id = 'temp-line'; l.setAttribute("class", "connection-line"); l.style.stroke = "rgba(255,255,255,0.4)"; l.style.strokeDasharray = "5,5"; g.appendChild(l); }
    l.setAttribute("d", `M ${activeLine.x} ${activeLine.y} C ${activeLine.x + 60} ${activeLine.y}, ${tx - 60} ${ty}, ${tx} ${ty}`);
}

function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu'); menu.style.display = 'block'; menu.style.left = x + 'px'; menu.style.top = y + 'px';
    const cR = document.getElementById('canvas').getBoundingClientRect(); contextMenuPos = { x: (x - cR.left)/zoom, y: (y - cR.top)/zoom };
}

function createNodeAtMouse() {
    addTile(contextMenuPos.x, contextMenuPos.y);
    const newNode = tiles[tiles.length-1];
    if (activeLine) { connections.push({ fromId: activeLine.fromId, fromPinIdx: activeLine.fromPinIdx, toId: newNode.id, toPinIdx: 0 }); drawConnections(); activeLine = null; }
    document.getElementById('context-menu').style.display = 'none'; saveState();
}

function changeSelectedColor(cls, hex) { selectedIds.forEach(id => { const t = tiles.find(x => x.id === id); if (t) { t.colorClass = cls; t.color = hex; } }); saveState(); refreshCanvas(); }
function deleteSelected() { tiles = tiles.filter(t => !selectedIds.has(t.id)); connections = connections.filter(c => !selectedIds.has(c.fromId) && !selectedIds.has(c.toId)); selectedIds.clear(); saveState(); refreshCanvas(); }
function updateSelectionBox(mx, my) {
    const box = document.getElementById('selection-box');
    const x = Math.min(mx, selectStart.x), y = Math.min(my, selectStart.y), w = Math.abs(mx - selectStart.x), h = Math.abs(my - selectStart.y);
    box.style.display = 'block'; box.style.left = x + 'px'; box.style.top = y + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
    tiles.forEach(t => { const r = document.getElementById(`tile-${t.id}`).getBoundingClientRect(); selectTile(t.id, r.left < x+w && r.left+r.width > x && r.top < y+h && r.top+r.height > y); });
}
function addPin(id, type) { const t = tiles.find(x => x.id === id); if (t && t[type] < 15) { t[type]++; saveState(); refreshCanvas(); } }
function updateTransform() { document.getElementById('canvas').style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`; }
function deselectAll() { selectedIds.clear(); document.querySelectorAll('.tile').forEach(t => t.classList.remove('selected')); }
function selectTile(id, s) { const el = document.getElementById(`tile-${id}`); if(s) { selectedIds.add(id); el?.classList.add('selected'); } else { selectedIds.delete(id); el?.classList.remove('selected'); } }
function updateTile(id, f, v) { const t = tiles.find(x => x.id === id); if(t) t[f] = v; save(); }
function removeTile(id) { tiles = tiles.filter(t => t.id !== id); connections = connections.filter(c => c.fromId !== id && c.toId !== id); saveState(); refreshCanvas(); }
function toggleContent(id) { const t = tiles.find(x => x.id === id); if(t) { t.collapsed = !t.collapsed; refreshCanvas(); } }
function clearBoard() { if(confirm("Clear?")) { localStorage.clear(); location.reload(); } }
function save() { localStorage.setItem('berry_bp_v6_6', JSON.stringify({ tiles, connections, tileCounter })); }
function load() { const s = localStorage.getItem('berry_bp_v6_6'); if (s) { const d = JSON.parse(s); tiles = d.tiles || []; connections = d.connections || []; tileCounter = d.tileCounter || 0; refreshCanvas(); } }
function saveProject() { const b = new Blob([JSON.stringify({ tiles, connections, tileCounter })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'project.json'; a.click(); }
function triggerLoad() { document.getElementById('loadInput').click(); }
document.getElementById('loadInput').onchange = (e) => { const r = new FileReader(); r.onload = (ev) => { const d = JSON.parse(ev.target.result); tiles = d.tiles; connections = d.connections; tileCounter = d.tileCounter; saveState(); refreshCanvas(); }; r.readAsText(e.target.files[0]); };
