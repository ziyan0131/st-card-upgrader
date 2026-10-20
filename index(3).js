/**
 * 角色卡升级工具 v1.0 - SillyTavern Extension
 * 选择已有角色卡 → 编写AI修改指令 → 生成升级版本并导入
 * 入口: 魔法棒菜单(升级图标) + 扩展设置面板
 */

const extensionName = 'st-card-upgrader';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// State
let currentCharData = null;
let currentWorldInfo = null;
let generatedResult = null;

const upgradeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

// ========== Initialization ==========
jQuery(async () => {
    try {
        // 1) Load HTML template into extensions settings panel
        const htmlResponse = await fetch(`/${extensionFolderPath}/tool.html`);
        if (!htmlResponse.ok) throw new Error('Failed to load tool.html');
        const toolHtml = await htmlResponse.text();

        // 2) Add to extensions settings panel with inline-drawer
        jQuery('#extensions_settings2').append(`
            <div class="cu-ext-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>${upgradeIcon} 角色卡升级工具</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        ${toolHtml}
                    </div>
                </div>
            </div>
        `);

        // 3) Add to wand menu (extensionsMenu)
        jQuery('#extensionsMenu').append(`
            <div id="cu_wand_btn" class="list-group-item flex-container flexGap5" title="角色卡升级工具">
                ${upgradeIcon}
                角色卡升级工具
            </div>
        `);
        jQuery('#cu_wand_btn').on('click', () => {
            // Open the extensions panel and expand our drawer
            const drawer = jQuery('.cu-ext-settings .inline-drawer-content');
            if (drawer.is(':hidden')) {
                jQuery('.cu-ext-settings .inline-drawer-toggle').trigger('click');
            }
            // Scroll to our panel
            const panel = document.getElementById('card-upgrader-panel');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Close wand menu
            jQuery('#extensionsMenu').fadeOut(200);
        });

        // 4) Bind events
        bindEvents();

        // 5) Initial load characters
        await loadCharacterList();

        console.log('[CardUpgrader] 角色卡升级工具 v1.0 loaded');
    } catch (e) {
        console.error('[CardUpgrader] init error:', e);
    }
});

// ========== Event Bindings ==========
function bindEvents() {
    jQuery('#cu-refresh-chars').on('click', async () => {
        await loadCharacterList();
        showToast('角色列表已刷新 ✓');
    });

    jQuery('#cu-character-select').on('change', async function () {
        const selectedAvatar = jQuery(this).val();
        if (selectedAvatar) {
            await loadCharacterData(selectedAvatar);
        } else {
            hideAllSections();
            currentCharData = null;
            currentWorldInfo = null;
        }
    });

    jQuery('#cu-toggle-preview').on('click', function () {
        const info = jQuery('#cu-card-info');
        info.toggleClass('collapsed');
        jQuery(this).text(info.hasClass('collapsed') ? '展开' : '收起');
    });

    jQuery('#cu-toggle-worldinfo').on('click', function () {
        const list = jQuery('#cu-worldinfo-list');
        list.toggleClass('collapsed');
        jQuery(this).text(list.hasClass('collapsed') ? '展开' : '收起');
    });

    jQuery('#cu-generate-btn').on('click', async () => {
        await generateUpgrade();
    });

    jQuery('#cu-import-btn').on('click', async () => {
        await importAsNewCard();
    });

    jQuery('#cu-copy-btn').on('click', () => {
        if (generatedResult) {
            const text = JSON.stringify(generatedResult, null, 2);
            navigator.clipboard.writeText(text).then(() => {
                showToast('已复制到剪贴板 ✓');
            }).catch(() => {
                showToast('复制失败，请手动复制');
            });
        }
    });
}

// ========== Load Character List ==========
async function loadCharacterList() {
    try {
        const ctx = SillyTavern.getContext();
        const characters = ctx.characters || [];
        const select = jQuery('#cu-character-select');
        const currentVal = select.val();

        select.empty();
        select.append('<option value="">-- 请选择角色卡 --</option>');

        characters.forEach(char => {
            if (!char || !char.avatar) return;
            const name = char.name || char.avatar || 'Unknown';
            const avatar = char.avatar;
            select.append(`<option value="${escapeHtml(avatar)}">${escapeHtml(name)}</option>`);
        });

        if (currentVal && select.find(`option[value="${currentVal}"]`).length) {
            select.val(currentVal);
        }
    } catch (err) {
        console.error('[CardUpgrader] Error loading characters:', err);
        showToast('加载角色列表失败');
    }
}

// ========== Load Character Data ==========
async function loadCharacterData(avatar) {
    try {
        const response = await fetch('/api/characters/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_url: avatar }),
        });

        if (!response.ok) throw new Error('Failed to fetch character data');

        currentCharData = await response.json();
        displayCharacterInfo(currentCharData);
        await loadWorldInfo(currentCharData);

        jQuery('#cu-card-preview').show();
        jQuery('#cu-modify-section').show();
        jQuery('#cu-prompt-section').show();
        jQuery('#cu-generate-section').show();
        jQuery('#cu-result-section').hide();
    } catch (err) {
        console.error('[CardUpgrader] Error loading character:', err);
        showToast('加载角色卡数据失败');
    }
}

// ========== Display Character Info ==========
function displayCharacterInfo(charData) {
    const data = charData.data || charData;

    jQuery('#cu-info-name').text(data.name || charData.name || 'N/A');
    jQuery('#cu-info-creator').text(data.creator || 'N/A');
    jQuery('#cu-info-description').text(data.description || charData.description || '无');
    jQuery('#cu-info-firstmes').text(data.first_mes || charData.first_mes || '无');
    jQuery('#cu-info-personality').text(data.personality || charData.personality || '无');
    jQuery('#cu-info-scenario').text(data.scenario || charData.scenario || '无');
    jQuery('#cu-info-sysprompt').text(data.system_prompt || '无');

    const version = detectVersion(charData);
    jQuery('#cu-info-version').text(`v${version}`);
}

// ========== Version Detection ==========
function detectVersion(charData) {
    const data = charData.data || charData;
    const name = data.name || charData.name || '';

    if (data.character_version) {
        const cv = String(data.character_version);
        const cvMatch = cv.match(/(\d+\.?\d*)/);
        if (cvMatch) return parseFloat(cvMatch[1]);
    }

    const versionMatch = name.match(/[\sv]+([\d]+\.\d+)\s*$/);
    if (versionMatch) return parseFloat(versionMatch[1]);

    return 1.0;
}

function getNextVersion(charData) {
    const current = detectVersion(charData);
    return (Math.floor(current) + 1) + '.0';
}

// ========== Load World Info ==========
async function loadWorldInfo(charData) {
    currentWorldInfo = null;
    const data = charData.data || charData;

    if (data.character_book && data.character_book.entries) {
        const entries = data.character_book.entries;
        const entryCount = Array.isArray(entries) ? entries.length : Object.keys(entries).length;
        if (entryCount > 0) {
            currentWorldInfo = data.character_book;
            displayWorldInfo(currentWorldInfo);
            jQuery('#cu-worldinfo-section').show();
            return;
        }
    }

    jQuery('#cu-worldinfo-section').hide();
}

// ========== Display World Info ==========
function displayWorldInfo(worldInfo) {
    const list = jQuery('#cu-worldinfo-list');
    list.empty();

    const entries = worldInfo.entries || {};
    const entryArray = Array.isArray(entries) ? entries : Object.values(entries);

    if (entryArray.length === 0) {
        list.html('<p style="font-size:12px;color:#999;text-align:center;">暂无世界书条目</p>');
        return;
    }

    entryArray.forEach((entry, idx) => {
        const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : (Array.isArray(entry.key) ? entry.key.join(', ') : String(entry.keys || entry.key || ''));
        const content = entry.content || '';
        const name = entry.comment || entry.name || `条目 ${idx + 1}`;

        list.append(`
            <div class="cu-wi-entry">
                <div class="cu-wi-entry-header">
                    <span class="cu-wi-key">📌 ${escapeHtml(name)}</span>
                    <span style="font-size:11px;color:#aaa;">关键词: ${escapeHtml(keys)}</span>
                </div>
                <div class="cu-wi-content">${escapeHtml(content.substring(0, 500))}${content.length > 500 ? '...' : ''}</div>
            </div>
        `);
    });
}

// ========== Generate Upgrade ==========
async function generateUpgrade() {
    if (!currentCharData) {
        showToast('请先选择角色卡');
        return;
    }

    const prompt = jQuery('#cu-ai-prompt').val().trim();
    if (!prompt) {
        showToast('请输入AI修改提示词');
        return;
    }

    const fields = [];
    if (jQuery('#cu-mod-description').is(':checked')) fields.push('description');
    if (jQuery('#cu-mod-firstmes').is(':checked')) fields.push('first_mes');
    if (jQuery('#cu-mod-personality').is(':checked')) fields.push('personality');
    if (jQuery('#cu-mod-scenario').is(':checked')) fields.push('scenario');
    if (jQuery('#cu-mod-sysprompt').is(':checked')) fields.push('system_prompt');
    if (jQuery('#cu-mod-mesexample').is(':checked')) fields.push('mes_example');
    const modifyWorldInfo = jQuery('#cu-mod-worldinfo').is(':checked');

    if (fields.length === 0 && !modifyWorldInfo) {
        showToast('请至少选择一项需要修改的内容');
        return;
    }

    jQuery('#cu-generate-btn').prop('disabled', true).addClass('cu-generating');
    jQuery('#cu-progress').show();
    jQuery('#cu-result-section').hide();
    updateProgress(10, '正在构建提示词...');

    try {
        const data = currentCharData.data || currentCharData;
        const nextVersion = getNextVersion(currentCharData);

        // Build AI prompt
        let aiPrompt = `你是一个专业的角色卡设计专家。现在需要升级一个SillyTavern角色卡到 v${nextVersion} 版本。\n\n## 当前角色卡信息\n角色名称: ${data.name || currentCharData.name || 'Unknown'}\n`;

        fields.forEach(field => {
            const value = data[field] || currentCharData[field] || '';
            const fieldName = getFieldDisplayName(field);
            aiPrompt += `\n### ${fieldName}\n${value || '(空)'}\n`;
        });

        if (modifyWorldInfo && currentWorldInfo) {
            aiPrompt += `\n### 世界书条目\n`;
            const entries = Array.isArray(currentWorldInfo.entries) ? currentWorldInfo.entries : Object.values(currentWorldInfo.entries || {});
            entries.forEach((entry, idx) => {
                const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : (entry.keys || '');
                const comment = entry.comment || entry.name || `条目${idx + 1}`;
                aiPrompt += `\n条目「${comment}」 [关键词: ${keys}]:\n${entry.content || '(空)'}\n`;
            });
        }

        aiPrompt += `\n## 用户修改要求\n${prompt}\n`;
        aiPrompt += `\n## 输出要求\n请根据用户的修改要求，对上述角色卡内容进行升级修改。严格使用以下JSON格式输出，不要输出JSON之外的任何内容：\n\n\`\`\`json\n{\n`;

        fields.forEach((field, i) => {
            aiPrompt += `  "${field}": "修改后的${getFieldDisplayName(field)}内容"${(i < fields.length - 1 || modifyWorldInfo) ? ',' : ''}\n`;
        });

        if (modifyWorldInfo) {
            aiPrompt += `  "world_info_entries": [\n    {\n      "keys": ["关键词1", "关键词2"],\n      "content": "条目内容",\n      "comment": "条目名称/备注"\n    }\n  ]\n`;
        }

        aiPrompt += `}\n\`\`\`\n\n重要注意事项：\n1. 只输出一个完整的JSON代码块，不要有任何额外文字\n2. 保持角色的核心特征和设定不变，仅按用户要求优化\n3. 文本中的换行请使用 \\n 表示\n4. 确保JSON格式正确、可被直接解析\n5. 所有字段的值必须是字符串类型`;

        updateProgress(30, '正在调用AI生成...（可能需要一些时间）');

        // Call AI using SillyTavern's generateQuietPrompt
        const ctx = SillyTavern.getContext();
        let aiResponse;
        try {
            aiResponse = await ctx.generateQuietPrompt(aiPrompt, false);
        } catch (genErr) {
            console.error('[CardUpgrader] generateQuietPrompt error:', genErr);
            throw new Error('AI生成失败，请确保已配置有效的API连接');
        }

        if (!aiResponse || aiResponse.trim().length === 0) {
            throw new Error('AI返回了空回复，请检查API连接');
        }

        updateProgress(70, '正在解析AI回复...');

        const parsed = parseAIResponse(aiResponse);

        if (!parsed) {
            console.warn('[CardUpgrader] Raw AI response:', aiResponse);
            showToast('AI回复格式无法解析，请重试或调整提示词');
            updateProgress(0, '解析失败 - 请重试');
            jQuery('#cu-generate-btn').prop('disabled', false).removeClass('cu-generating');
            return;
        }

        updateProgress(90, '正在准备结果...');

        generatedResult = buildUpgradedCard(parsed, nextVersion);
        displayResult(generatedResult, nextVersion);

        updateProgress(100, '✅ 生成完成！');
        jQuery('#cu-result-section').show();

        setTimeout(() => {
            document.getElementById('cu-result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

    } catch (err) {
        console.error('[CardUpgrader] Generation error:', err);
        showToast('生成失败: ' + err.message);
        updateProgress(0, '生成失败: ' + err.message);
    } finally {
        jQuery('#cu-generate-btn').prop('disabled', false).removeClass('cu-generating');
    }
}

// ========== Parse AI Response ==========
function parseAIResponse(response) {
    try {
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }

        const braceStart = response.indexOf('{');
        const braceEnd = response.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
            return JSON.parse(response.substring(braceStart, braceEnd + 1));
        }

        return null;
    } catch (err) {
        console.error('[CardUpgrader] JSON parse error:', err);
        try {
            let cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                cleaned = cleaned.substring(start, end + 1);
            }
            return JSON.parse(cleaned);
        } catch (e2) {
            return null;
        }
    }
}

// ========== Build Upgraded Card ==========
function buildUpgradedCard(parsed, nextVersion) {
    const data = currentCharData.data || currentCharData;
    const origName = (data.name || currentCharData.name || 'Character');
    const baseName = origName.replace(/\s*[vV]?\d+\.\d+\s*$/, '').trim();

    const upgraded = {
        name: `${baseName} v${nextVersion}`,
        description: parsed.description !== undefined ? parsed.description : (data.description || currentCharData.description || ''),
        first_mes: parsed.first_mes !== undefined ? parsed.first_mes : (data.first_mes || currentCharData.first_mes || ''),
        personality: parsed.personality !== undefined ? parsed.personality : (data.personality || currentCharData.personality || ''),
        scenario: parsed.scenario !== undefined ? parsed.scenario : (data.scenario || currentCharData.scenario || ''),
        system_prompt: parsed.system_prompt !== undefined ? parsed.system_prompt : (data.system_prompt || ''),
        mes_example: parsed.mes_example !== undefined ? parsed.mes_example : (data.mes_example || currentCharData.mes_example || ''),
        creator_notes: data.creator_notes || '',
        creator: data.creator || '',
        character_version: nextVersion,
        tags: data.tags || [],
        post_history_instructions: data.post_history_instructions || '',
        alternate_greetings: data.alternate_greetings || [],
    };

    if (parsed.world_info_entries && Array.isArray(parsed.world_info_entries)) {
        upgraded.character_book = {
            name: `${baseName} World Book v${nextVersion}`,
            entries: {},
        };
        parsed.world_info_entries.forEach((entry, idx) => {
            upgraded.character_book.entries[idx] = {
                uid: idx,
                keys: Array.isArray(entry.keys) ? entry.keys : [entry.keys || ''].filter(Boolean),
                secondary_keys: Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [],
                content: entry.content || '',
                comment: entry.comment || entry.name || `Entry ${idx + 1}`,
                constant: entry.constant || false,
                selective: entry.selective !== undefined ? entry.selective : true,
                order: entry.order !== undefined ? entry.order : idx * 100,
                position: entry.position !== undefined ? entry.position : 0,
                enabled: true,
                insertion_order: entry.insertion_order !== undefined ? entry.insertion_order : idx * 100,
            };
        });
    } else if (currentWorldInfo) {
        upgraded.character_book = JSON.parse(JSON.stringify(currentWorldInfo));
    }

    return upgraded;
}

// ========== Display Result ==========
function displayResult(result, nextVersion) {
    const container = jQuery('#cu-result-content');
    container.empty();

    container.append(`
        <div class="cu-result-field">
            <div class="cu-result-field-title">🏷️ 新版本</div>
            <div class="cu-result-field-content">${escapeHtml(result.name)} (v${nextVersion})</div>
        </div>
    `);

    const fieldConfigs = [
        { key: 'description', label: '描述' },
        { key: 'first_mes', label: '首条消息' },
        { key: 'personality', label: '人设' },
        { key: 'scenario', label: '场景' },
        { key: 'system_prompt', label: '系统提示词' },
        { key: 'mes_example', label: '对话示例' },
    ];

    fieldConfigs.forEach(({ key, label }) => {
        if (result[key]) {
            container.append(`
                <div class="cu-result-field">
                    <div class="cu-result-field-title">📝 ${label}</div>
                    <div class="cu-result-field-content">${escapeHtml(result[key])}</div>
                </div>
            `);
        }
    });

    if (result.character_book && result.character_book.entries) {
        const entries = Array.isArray(result.character_book.entries)
            ? result.character_book.entries
            : Object.values(result.character_book.entries);

        if (entries.length > 0) {
            container.append(`<div class="cu-result-field"><div class="cu-result-field-title">📖 世界书 (${entries.length} 个条目)</div></div>`);
            entries.forEach((entry, idx) => {
                const keys = Array.isArray(entry.keys) ? entry.keys.join(', ') : (entry.keys || '');
                container.append(`
                    <div class="cu-wi-entry">
                        <div class="cu-wi-entry-header">
                            <span class="cu-wi-key">📌 ${escapeHtml(entry.comment || entry.name || `条目 ${idx + 1}`)}</span>
                            <span style="font-size:11px;color:#aaa;">关键词: ${escapeHtml(String(keys))}</span>
                        </div>
                        <div class="cu-wi-content">${escapeHtml(entry.content || '')}</div>
                    </div>
                `);
            });
        }
    }
}

// ========== Import as New Card ==========
async function importAsNewCard() {
    if (!generatedResult) {
        showToast('没有可导入的结果');
        return;
    }

    try {
        const charName = generatedResult.name;

        // Build JSON body matching SillyTavern's /api/characters/create
        const jsonBody = {
            name: charName,
            description: generatedResult.description || '',
            personality: generatedResult.personality || '',
            first_mes: generatedResult.first_mes || '',
            mes_example: generatedResult.mes_example || '',
            scenario: generatedResult.scenario || '',
            creator_notes: generatedResult.creator_notes || '',
            system_prompt: generatedResult.system_prompt || '',
            post_history_instructions: generatedResult.post_history_instructions || '',
            tags: generatedResult.tags || [],
            creator: generatedResult.creator || '',
            character_version: generatedResult.character_version || '',
            alternate_greetings: generatedResult.alternate_greetings || [],
            extensions: {},
        };

        // Include character_book if present
        if (generatedResult.character_book) {
            jsonBody.character_book = generatedResult.character_book;
        }

        const res = await fetch('/api/characters/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonBody),
        });

        if (res.ok) {
            showToast(`✅ ${charName} 已成功导入！`);
            await loadCharacterList();
            return;
        }

        // Fallback: try V2 JSON import endpoint
        const v2Card = {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: charName,
                description: generatedResult.description || '',
                first_mes: generatedResult.first_mes || '',
                personality: generatedResult.personality || '',
                scenario: generatedResult.scenario || '',
                mes_example: generatedResult.mes_example || '',
                creator_notes: generatedResult.creator_notes || '',
                system_prompt: generatedResult.system_prompt || '',
                post_history_instructions: generatedResult.post_history_instructions || '',
                creator: generatedResult.creator || '',
                character_version: generatedResult.character_version || '',
                tags: generatedResult.tags || [],
                alternate_greetings: generatedResult.alternate_greetings || [],
                extensions: {},
            },
        };

        if (generatedResult.character_book) {
            v2Card.data.character_book = generatedResult.character_book;
        }

        const jsonBlob = new Blob([JSON.stringify(v2Card)], { type: 'application/json' });
        const formData = new FormData();
        formData.append('avatar', jsonBlob, `${charName}.json`);
        formData.append('file_type', 'json');

        const importRes = await fetch('/api/characters/import', {
            method: 'POST',
            body: formData,
        });

        if (importRes.ok) {
            showToast(`✅ ${charName} 已成功导入！`);
            await loadCharacterList();
            return;
        }

        throw new Error('API导入失败');

    } catch (err) {
        console.error('[CardUpgrader] Import error:', err);
        showToast('API导入失败，正在下载JSON文件...');
        downloadAsJson(generatedResult);
    }
}

// ========== Download Fallback ==========
function downloadAsJson(data) {
    const v2Card = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: data,
    };
    const jsonStr = JSON.stringify(v2Card, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name || 'character'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSON文件已下载，请在酒馆中手动导入');
}

// ========== Utility Functions ==========
function hideAllSections() {
    jQuery('#cu-card-preview').hide();
    jQuery('#cu-worldinfo-section').hide();
    jQuery('#cu-modify-section').hide();
    jQuery('#cu-prompt-section').hide();
    jQuery('#cu-generate-section').hide();
    jQuery('#cu-result-section').hide();
}

function updateProgress(percent, text) {
    jQuery('#cu-progress-fill').css('width', percent + '%');
    jQuery('#cu-progress-text').text(text);
}

function getFieldDisplayName(field) {
    const map = {
        description: '描述',
        first_mes: '首条消息',
        personality: '人设',
        scenario: '场景',
        system_prompt: '系统提示词',
        mes_example: '对话示例',
    };
    return map[field] || field;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function showToast(message) {
    jQuery('.cu-toast').remove();
    const toast = jQuery(`<div class="cu-toast">${escapeHtml(message)}</div>`);
    jQuery('body').append(toast);
    setTimeout(() => {
        toast.fadeOut(300, () => toast.remove());
    }, 3000);
}
