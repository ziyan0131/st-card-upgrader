/**
 * 角色卡升级工具 v1.0 - SillyTavern Extension
 * 弹出窗口式界面，像制卡工具一样独立浮窗
 */

const extensionName = 'st-card-upgrader';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let cuWindow = null;
let cuVisible = false;

const starIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

function openUpgrader() {
    if (cuWindow && document.body.contains(cuWindow)) {
        cuWindow.style.display = 'flex';
        cuVisible = true;
        return;
    }
    cuWindow = document.createElement('div');
    cuWindow.id = 'cu-window';
    cuWindow.innerHTML = `
        <div class="cu-container" id="cu-container">
            <div class="cu-header" id="cu-header">
                <span class="cu-header-title">${starIcon.replace(/16/g,'18')} 角色卡升级工具</span>
                <div class="cu-header-actions">
                    <button class="cu-hdr-btn" id="cu-fullscreen-btn" title="全屏/还原">⛶</button>
                    <button class="cu-hdr-btn" id="cu-minimize-btn" title="最小化">─</button>
                    <button class="cu-hdr-btn cu-close-btn" id="cu-close-btn" title="关闭">✕</button>
                </div>
            </div>
            <iframe id="cu-iframe" src="/${extensionFolderPath}/tool.html" allow="clipboard-read; clipboard-write"></iframe>
            <div class="cu-resize cu-r-se" data-d="se"></div>
            <div class="cu-resize cu-r-s" data-d="s"></div>
            <div class="cu-resize cu-r-e" data-d="e"></div>
        </div>
    `;
    document.body.appendChild(cuWindow);
    cuVisible = true;

    document.getElementById('cu-close-btn').addEventListener('click', () => {
        cuWindow.style.display = 'none'; cuVisible = false;
    });
    document.getElementById('cu-minimize-btn').addEventListener('click', () => {
        cuWindow.style.display = 'none'; cuVisible = false;
    });
    let fs = false;
    document.getElementById('cu-fullscreen-btn').addEventListener('click', () => {
        fs = !fs;
        document.getElementById('cu-container').classList.toggle('cu-fullscreen', fs);
    });

    initDrag();
    initResize();

    const iframe = document.getElementById('cu-iframe');
    iframe.addEventListener('load', () => passCtx(iframe));
}

function initDrag() {
    const h = document.getElementById('cu-header');
    const c = document.getElementById('cu-container');
    let dragging = false, sx, sy, sl, st;
    function start(cx, cy) {
        dragging = true;
        const r = c.getBoundingClientRect();
        sx = cx; sy = cy; sl = r.left; st = r.top;
        c.style.transition = 'none';
        document.body.style.userSelect = 'none';
        const f = document.getElementById('cu-iframe');
        if (f) f.style.pointerEvents = 'none';
    }
    h.addEventListener('mousedown', e => { if (!e.target.closest('.cu-hdr-btn')) start(e.clientX, e.clientY); });
    h.addEventListener('touchstart', e => { if (!e.target.closest('.cu-hdr-btn')) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    function move(cx, cy) {
        if (!dragging) return;
        c.style.position = 'fixed';
        c.style.left = (sl + cx - sx) + 'px';
        c.style.top = (st + cy - sy) + 'px';
        c.style.margin = '0'; c.style.transform = 'none';
    }
    document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => { if (dragging) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    function end() {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = '';
        const f = document.getElementById('cu-iframe');
        if (f) f.style.pointerEvents = '';
    }
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
}

function initResize() {
    const c = document.getElementById('cu-container');
    let resizing = false, dir, sx, sy, sw, sh;
    c.querySelectorAll('.cu-resize').forEach(handle => {
        function start(cx, cy) {
            resizing = true; dir = handle.dataset.d;
            sx = cx; sy = cy;
            const r = c.getBoundingClientRect();
            sw = r.width; sh = r.height;
            c.style.transition = 'none';
            document.body.style.userSelect = 'none';
            const f = document.getElementById('cu-iframe');
            if (f) f.style.pointerEvents = 'none';
        }
        handle.addEventListener('mousedown', e => { e.preventDefault(); start(e.clientX, e.clientY); });
        handle.addEventListener('touchstart', e => { start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    });
    function move(cx, cy) {
        if (!resizing) return;
        const dx = cx - sx, dy = cy - sy;
        let nw = sw, nh = sh;
        if (dir.includes('e')) nw = Math.max(320, sw + dx);
        if (dir.includes('s')) nh = Math.max(300, sh + dy);
        Object.assign(c.style, { width: nw + 'px', height: nh + 'px', maxWidth: 'none', maxHeight: 'none' });
    }
    document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => { if (resizing) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    function end() {
        if (!resizing) return;
        resizing = false;
        document.body.style.userSelect = '';
        const f = document.getElementById('cu-iframe');
        if (f) f.style.pointerEvents = '';
    }
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
}

function passCtx(iframe) {
    try {
        const ctx = SillyTavern.getContext();
        const chars = (ctx.characters || []).map(c => ({
            name: c.name || '',
            avatar: c.avatar || '',
            description: (c.data?.description || c.description || '').substring(0, 200),
            data: c.data || null
        }));
        iframe.contentWindow.postMessage({ type: 'cu-context', characters: chars }, '*');
    } catch (e) {
        console.warn('[CU] passCtx fail:', e);
    }
}

// Listen messages from iframe
window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || !msg.type || !msg.type.startsWith('cu-')) return;
    const iframe = document.getElementById('cu-iframe');

    try {
        if (msg.type === 'cu-get-context') {
            if (iframe) passCtx(iframe);
        }
        if (msg.type === 'cu-get-character') {
            try {
                const ctx = SillyTavern.getContext();
                const char = (ctx.characters || []).find(c => c.avatar === msg.avatar);
                if (char) {
                    // Return full character data
                    iframe.contentWindow.postMessage({
                        type: 'cu-character-data',
                        success: true,
                        data: JSON.parse(JSON.stringify(char))
                    }, '*');
                } else {
                    iframe.contentWindow.postMessage({ type: 'cu-character-data', success: false, error: '未找到角色' }, '*');
                }
            } catch (e) {
                iframe.contentWindow.postMessage({ type: 'cu-character-data', success: false, error: e.message }, '*');
            }
        }
        if (msg.type === 'cu-generate-ai') {
            try {
                const ctx = SillyTavern.getContext();
                const result = await ctx.generateQuietPrompt(msg.prompt, false);
                iframe.contentWindow.postMessage({ type: 'cu-ai-result', success: true, text: result }, '*');
            } catch (e) {
                iframe.contentWindow.postMessage({ type: 'cu-ai-result', success: false, error: e.message }, '*');
            }
        }
        if (msg.type === 'cu-create-character') {
            try {
                const d = msg.data;
                const res = await fetch('/api/characters/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(d)
                });
                if (res.ok) {
                    iframe.contentWindow.postMessage({ type: 'cu-create-result', success: true }, '*');
                } else {
                    // Try import
                    const v2 = { spec: 'chara_card_v2', spec_version: '2.0', data: d };
                    const blob = new Blob([JSON.stringify(v2)], { type: 'application/json' });
                    const fd = new FormData();
                    fd.append('avatar', blob, (d.name || 'char') + '.json');
                    fd.append('file_type', 'json');
                    const res2 = await fetch('/api/characters/import', { method: 'POST', body: fd });
                    if (res2.ok) {
                        iframe.contentWindow.postMessage({ type: 'cu-create-result', success: true }, '*');
                    } else {
                        throw new Error('HTTP ' + res2.status);
                    }
                }
            } catch (e) {
                iframe.contentWindow.postMessage({ type: 'cu-create-result', success: false, error: e.message }, '*');
            }
        }
    } catch (e) {
        console.warn('[CU] msg err:', e);
    }
});

// Init
jQuery(async () => {
    try {
        // Extensions settings panel
        jQuery('#extensions_settings2').append(`
            <div class="cu-ext-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>${starIcon} 角色卡升级工具</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div style="padding:10px 0;">
                            <p style="margin-bottom:8px;">角色卡升级工具 v1.0 - 选择角色卡，手动/AI修改后导入新版本</p>
                            <div id="cu_launch_btn" class="menu_button menu_button_icon">
                                ${starIcon}
                                <span>打开角色卡升级工具</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
        jQuery('#cu_launch_btn').on('click', openUpgrader);

        // Wand menu
        jQuery('#extensionsMenu').append(`
            <div id="cu_wand_btn" class="list-group-item flex-container flexGap5" title="角色卡升级工具">
                ${starIcon}
                角色卡升级工具
            </div>
        `);
        jQuery('#cu_wand_btn').on('click', () => {
            openUpgrader();
            jQuery('#extensionsMenu').fadeOut(200);
        });

        console.log('[CU] 角色卡升级工具 v1.0 loaded');
    } catch (e) {
        console.error('[CU] init error:', e);
    }
});
