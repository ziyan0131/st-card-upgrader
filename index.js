/**
 * 角色卡升级工具 v2.1 - SillyTavern Extension
 * 修复：使用 /api/characters/get 获取完整角色卡数据
 */
const extensionName = 'st-card-upgrader';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
let cuWindow = null;

const starIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

function openUpgrader() {
    if (cuWindow && document.body.contains(cuWindow)) {
        cuWindow.style.display = 'flex'; return;
    }
    cuWindow = document.createElement('div');
    cuWindow.id = 'cu-window';
    cuWindow.innerHTML = `
        <div class="cu-container" id="cu-container">
            <div class="cu-header" id="cu-header">
                <span class="cu-header-title">${starIcon.replace(/16/g,'18')} 角色卡升级工具</span>
                <div class="cu-header-actions">
                    <button class="cu-hdr-btn" id="cu-fullscreen-btn" title="全屏">⛶</button>
                    <button class="cu-hdr-btn" id="cu-minimize-btn" title="最小化">─</button>
                    <button class="cu-hdr-btn cu-close-btn" id="cu-close-btn" title="关闭">✕</button>
                </div>
            </div>
            <iframe id="cu-iframe" src="/${extensionFolderPath}/tool.html" allow="clipboard-read; clipboard-write"></iframe>
            <div class="cu-resize cu-r-se" data-d="se"></div>
            <div class="cu-resize cu-r-s" data-d="s"></div>
            <div class="cu-resize cu-r-e" data-d="e"></div>
        </div>`;
    document.body.appendChild(cuWindow);
    document.getElementById('cu-close-btn').onclick = () => cuWindow.style.display = 'none';
    document.getElementById('cu-minimize-btn').onclick = () => cuWindow.style.display = 'none';
    let fs = false;
    document.getElementById('cu-fullscreen-btn').onclick = () => {
        fs = !fs; document.getElementById('cu-container').classList.toggle('cu-fullscreen', fs);
    };
    initDrag(); initResize();
    document.getElementById('cu-iframe').addEventListener('load', function() { passCtx(this); });
}

function initDrag() {
    const h = document.getElementById('cu-header'), c = document.getElementById('cu-container');
    let d = false, sx, sy, sl, st;
    function s(cx, cy) { d=true; const r=c.getBoundingClientRect(); sx=cx;sy=cy;sl=r.left;st=r.top; c.style.transition='none'; document.body.style.userSelect='none'; const f=document.getElementById('cu-iframe'); if(f)f.style.pointerEvents='none'; }
    h.addEventListener('mousedown', e => { if(!e.target.closest('.cu-hdr-btn')) s(e.clientX,e.clientY); });
    h.addEventListener('touchstart', e => { if(!e.target.closest('.cu-hdr-btn')) s(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
    function m(cx, cy) { if(!d)return; c.style.position='fixed'; c.style.left=(sl+cx-sx)+'px'; c.style.top=(st+cy-sy)+'px'; c.style.margin='0'; c.style.transform='none'; }
    document.addEventListener('mousemove', e => m(e.clientX,e.clientY));
    document.addEventListener('touchmove', e => { if(d)m(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
    function e2() { if(!d)return; d=false; document.body.style.userSelect=''; const f=document.getElementById('cu-iframe'); if(f)f.style.pointerEvents=''; }
    document.addEventListener('mouseup', e2); document.addEventListener('touchend', e2);
}

function initResize() {
    const c = document.getElementById('cu-container');
    let r=false, dir, sx, sy, sw, sh;
    c.querySelectorAll('.cu-resize').forEach(h => {
        function s(cx,cy) { r=true; dir=h.dataset.d; sx=cx;sy=cy; const b=c.getBoundingClientRect(); sw=b.width;sh=b.height; c.style.transition='none'; document.body.style.userSelect='none'; const f=document.getElementById('cu-iframe'); if(f)f.style.pointerEvents='none'; }
        h.addEventListener('mousedown', e => { e.preventDefault(); s(e.clientX,e.clientY); });
        h.addEventListener('touchstart', e => { s(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
    });
    function m(cx,cy) { if(!r)return; let nw=sw,nh=sh; if(dir.includes('e'))nw=Math.max(320,sw+cx-sx); if(dir.includes('s'))nh=Math.max(300,sh+cy-sy); Object.assign(c.style,{width:nw+'px',height:nh+'px',maxWidth:'none',maxHeight:'none'}); }
    document.addEventListener('mousemove', e => m(e.clientX,e.clientY));
    document.addEventListener('touchmove', e => { if(r)m(e.touches[0].clientX,e.touches[0].clientY); }, {passive:true});
    function e2() { if(!r)return; r=false; document.body.style.userSelect=''; const f=document.getElementById('cu-iframe'); if(f)f.style.pointerEvents=''; }
    document.addEventListener('mouseup', e2); document.addEventListener('touchend', e2);
}

function passCtx(iframe) {
    try {
        const ctx = SillyTavern.getContext();
        // Send character list (name + avatar only, for the list)
        const chars = (ctx.characters || []).map(c => ({
            name: c.name || '', avatar: c.avatar || '',
            character_version: c.data?.character_version || c.character_version || '',
        }));
        iframe.contentWindow.postMessage({ type: 'cu-context', characters: chars }, '*');
    } catch (e) { console.warn('[CU] passCtx:', e); }
}

window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || !msg.type || !msg.type.startsWith('cu-')) return;
    const iframe = document.getElementById('cu-iframe');
    if (!iframe) return;

    try {
        if (msg.type === 'cu-get-context') { passCtx(iframe); }

        // === KEY FIX: Get FULL character data via API ===
        if (msg.type === 'cu-get-character') {
            try {
                // Method 1: Try /api/characters/get (returns full data with all fields)
                const apiRes = await fetch('/api/characters/get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar_url: msg.avatar })
                });
                
                if (apiRes.ok) {
                    const fullData = await apiRes.json();
                    console.log('[CU] Full character data loaded via API, keys:', Object.keys(fullData));
                    if (fullData.data) console.log('[CU] .data keys:', Object.keys(fullData.data));
                    iframe.contentWindow.postMessage({ type: 'cu-character-data', success: true, data: fullData }, '*');
                } else {
                    // Method 2: Fallback to context
                    console.warn('[CU] API /api/characters/get returned', apiRes.status, ', falling back to context');
                    const ctx = SillyTavern.getContext();
                    const char = (ctx.characters || []).find(c => c.avatar === msg.avatar);
                    if (char) {
                        iframe.contentWindow.postMessage({ type: 'cu-character-data', success: true, data: JSON.parse(JSON.stringify(char)) }, '*');
                    } else {
                        throw new Error('角色未找到');
                    }
                }
            } catch(e) {
                console.error('[CU] get-character error:', e);
                iframe.contentWindow.postMessage({ type: 'cu-character-data', success: false, error: e.message }, '*');
            }
        }

        // Get avatar image
        if (msg.type === 'cu-get-avatar') {
            try {
                // Try multiple avatar URL patterns
                const urls = [
                    `/characters/${encodeURIComponent(msg.avatar)}`,
                    `/thumbnail?type=avatar&file=${encodeURIComponent(msg.avatar)}`,
                    `/api/characters/get-avatar?avatar=${encodeURIComponent(msg.avatar)}`,
                ];
                let found = false;
                for (const url of urls) {
                    try {
                        const res = await fetch(url);
                        if (res.ok) {
                            const blob = await res.blob();
                            if (blob.size > 100) { // valid image
                                const reader = new FileReader();
                                reader.onload = () => {
                                    iframe.contentWindow.postMessage({ type: 'cu-avatar-data', success: true, dataUrl: reader.result }, '*');
                                };
                                reader.readAsDataURL(blob);
                                found = true;
                                break;
                            }
                        }
                    } catch {}
                }
                if (!found) {
                    iframe.contentWindow.postMessage({ type: 'cu-avatar-data', success: false }, '*');
                }
            } catch(e) {
                iframe.contentWindow.postMessage({ type: 'cu-avatar-data', success: false }, '*');
            }
        }

        // AI generate
        if (msg.type === 'cu-generate-ai') {
            try {
                const ctx = SillyTavern.getContext();
                const result = await ctx.generateQuietPrompt(msg.prompt, false);
                iframe.contentWindow.postMessage({ type: 'cu-ai-result', success: true, text: result, id: msg.id }, '*');
            } catch(e) {
                iframe.contentWindow.postMessage({ type: 'cu-ai-result', success: false, error: e.message, id: msg.id }, '*');
            }
        }

        // Create character
        if (msg.type === 'cu-create-character') {
            try {
                const d = msg.charData;
                const avatarB64 = msg.avatarBase64;
                const charName = d.name || 'Character';

                const createRes = await fetch('/api/characters/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(d)
                });

                let created = createRes.ok;
                let avatarFileName = '';

                if (createRes.ok) {
                    try { const r = await createRes.json(); avatarFileName = r.file_name || r.avatar || ''; } catch {}
                } else {
                    // Fallback: import
                    const v2 = { spec: 'chara_card_v2', spec_version: '2.0', data: d };
                    const blob = new Blob([JSON.stringify(v2)], { type: 'application/json' });
                    const fd = new FormData();
                    fd.append('avatar', blob, charName + '.json');
                    fd.append('file_type', 'json');
                    const importRes = await fetch('/api/characters/import', { method: 'POST', body: fd });
                    created = importRes.ok;
                    if (importRes.ok) { try { const r2 = await importRes.json(); avatarFileName = r2.file_name||r2.avatar||''; } catch {} }
                }

                // Upload avatar
                if (created && avatarB64) {
                    try {
                        const parts = avatarB64.split(',');
                        const byteStr = atob(parts.length > 1 ? parts[1] : parts[0]);
                        const arr = new Uint8Array(byteStr.length);
                        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
                        const avatarBlob = new Blob([arr], { type: 'image/png' });
                        const fd = new FormData();
                        fd.append('avatar', avatarBlob, charName + '.png');
                        fd.append('overwrite_name', charName);
                        if (avatarFileName) fd.append('avatar_url', avatarFileName);
                        await fetch('/api/characters/edit', { method: 'POST', body: fd }).catch(() => {});
                    } catch(ae) { console.warn('[CU] avatar upload:', ae); }
                }

                if (created) {
                    try { const ctx = SillyTavern.getContext(); if(ctx.getCharacters) await ctx.getCharacters(); } catch {}
                    iframe.contentWindow.postMessage({ type: 'cu-create-result', success: true }, '*');
                } else { throw new Error('创建失败'); }
            } catch(e) {
                iframe.contentWindow.postMessage({ type: 'cu-create-result', success: false, error: e.message }, '*');
            }
        }
    } catch(e) { console.warn('[CU] msg err:', e); }
});

jQuery(async () => {
    try {
        jQuery('#extensions_settings2').append(`
            <div class="cu-ext-settings"><div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>${starIcon} 角色卡升级工具</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content"><div style="padding:10px 0">
                    <p style="margin-bottom:8px">角色卡升级工具 v2.1</p>
                    <div id="cu_launch_btn" class="menu_button menu_button_icon">${starIcon}<span>打开角色卡升级工具</span></div>
                </div></div>
            </div></div>`);
        jQuery('#cu_launch_btn').on('click', openUpgrader);
        jQuery('#extensionsMenu').append(`<div id="cu_wand_btn" class="list-group-item flex-container flexGap5" title="角色卡升级工具">${starIcon} 角色卡升级工具</div>`);
        jQuery('#cu_wand_btn').on('click', () => { openUpgrader(); jQuery('#extensionsMenu').fadeOut(200); });
        console.log('[CU] 角色卡升级工具 v2.1 loaded');
    } catch(e) { console.error('[CU] init:', e); }
});
