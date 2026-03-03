<!doctype html>
<html lang="pl" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blueprint Task v2.5</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        * { font-family: 'JetBrains Mono', monospace; box-sizing: border-box; }
        html, body { margin: 0; padding: 0; overflow: hidden; background: #000000; height: 100%; }
        
        .grid-background {
            background-color: #050505;
            background-image: 
                linear-gradient(#151515 1px, transparent 1px),
                linear-gradient(90deg, #151515 1px, transparent 1px),
                linear-gradient(#1a1a1a 1px, transparent 1px),
                linear-gradient(90deg, #1a1a1a 1px, transparent 1px);
            background-size: 20px 20px, 20px 20px, 100px 100px, 100px 100px;
        }
        
        .tile {
            position: absolute; min-width: 220px;
            background: rgba(15, 15, 15, 0.95); 
            border: 1px solid #333; border-radius: 4px;
            cursor: move; user-select: none; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 10;
        }
        
        .tile-header { 
            padding: 8px 10px; display: flex; align-items: center; 
            justify-content: space-between; border-radius: 3px 3px 0 0;
        }
        
        .tile-title { 
            background: transparent; border: none; color: #fff; 
            font-size: 11px; font-weight: 700; flex: 1; outline: none;
            text-transform: uppercase; letter-spacing: 0.5px;
        }

        .btn-close {
            background: transparent; border: none; color: rgba(255,255,255,0.5);
            cursor: pointer; font-size: 16px; padding: 0 5px; line-height: 1;
            transition: color 0.2s;
        }
        .btn-close:hover { color: #ff4d4d; }

        .tile-content { padding: 12px; }
        .tile-textarea { 
            width: 100%; background: #0a0a0a; border: 1px solid #222; color: #aaa; 
            font-size: 11px; padding: 8px; resize: none; outline: none; min-height: 70px;
            border-radius: 2px;
        }

        /* Piny w stylu Blueprint */
        .pin {
            width: 12px; height: 12px; border-radius: 50%; border: 2px solid;
            background: #0d0d0d; cursor: crosshair; position: absolute; z-index: 20;
            transition: transform 0.1s, background 0.1s;
        }
        .pin:hover { transform: scale(1.3); }
        .pin-input { left: -7px; top: 42px; border-color: #f1c40f; } /* Żółty - Wejście */
        .pin-output { right: -7px; top: 42px; border-color: #2ecc71; } /* Zielony - Wyjście */

        .toolbar {
            position: fixed; left: 0; top: 0; width: 200px; height: 100%;
            background: #0a0a0a; border-right: 1px solid #222; padding: 15px;
            display: flex; flex-direction: column; gap: 8px; z-index: 1000;
        }
        .toolbar-btn {
            background: #151515; border: 1px solid #2a2a2a; color: #aaa;
            padding: 8px 12px; font-size: 11px; cursor: pointer; text-align: left; border-radius: 4px;
        }
        .toolbar-btn:hover { background: #222; color: #fff; }
        
        #canvas-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
        #canvas { position: absolute; width: 5000px; height: 5000px; transform-origin: 0 0; }
        
        /* Nitki połączeń */
        .connection-line {
            fill: none; stroke: #ffffff; stroke-width: 3;
            stroke-linecap: round; pointer-events: stroke;
            filter: drop-shadow(0 0 3px rgba(255,255,255,0.2));
            cursor: pointer;
        }
        .connection-line:hover { stroke: #ff4d4d; stroke-width: 4; }
        #svg-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    </style>
</head>
<body>

    <div class="toolbar">
        <div style="color: #4a9eff; font-size: 13px; font-weight: bold; letter-spacing: 1px;">BLUEPRINT TASK</div>
        <div style="color: #444; font-size: 9px; margin-bottom: 10px;">ENGINE v2.5 | READY</div>
        
        <button class="toolbar-btn" onclick="addTile()">+ Dodaj Node</button>
        <hr style="border: 0; border-top: 1px solid #222; margin: 5px 0;">
        
        <button class="toolbar-btn" onclick="saveToTxt()">📄 Eksport .TXT</button>
        <button class="toolbar-btn" onclick="saveProject()">💾 Zapisz Projekt</button>
        <button class="toolbar-btn" onclick="triggerLoad()">📂 Wczytaj Plik</button>
        <button class="toolbar-btn" style="color: #e74c3c; margin-top: auto;" onclick="clearBoard()">⚠ Wyczyść scenerię</button>
        
        <input type="file" id="loadInput" style="display:none" accept=".json">
    </div>

    <div id="canvas-container" class="grid-background">
        <div id="canvas">
            <svg id="svg-layer">
                <g id="connections-group"></g>
            </svg>
            <div id="tiles-layer"></div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
