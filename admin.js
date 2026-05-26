/* ----------------------------------------------------
 * EdgeLink Admin Panel Logic
 * Handles admin session, list query, deletion, and stats.
 * ---------------------------------------------------- */

// State management
let adminLinks = [];
let activeAdminToken = localStorage.getItem('edgelink_admin_token') || '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (activeAdminToken) {
    document.getElementById('adminToken').value = activeAdminToken;
    attemptAdminLogin(activeAdminToken);
  }
});

// Toast notification helper
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `<span>${icon}</span><span style="flex:1;">${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, duration);
}

// Clipboard Copy Helper
function copyText(text) {
  const tempInput = document.createElement('textarea');
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  try {
    document.execCommand('copy');
    showToast('复制成功！', 'success');
  } catch (e) {
    showToast('复制失败', 'error');
  }
  document.body.removeChild(tempInput);
}

/* ----------------------------------------------------
 * ADMIN CONTROLLER
 * ---------------------------------------------------- */

function handleAdminLogin(e) {
  e.preventDefault();
  const token = document.getElementById('adminToken').value.trim();
  attemptAdminLogin(token);
}

async function attemptAdminLogin(token) {
  const adminAuthCard = document.getElementById('adminAuthCard');
  const adminConsole = document.getElementById('adminConsole');
  
  try {
    const response = await fetch('/api/admin/list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '验证失败，密码不正确');
    }
    
    activeAdminToken = token;
    localStorage.setItem('edgelink_admin_token', token);
    
    adminAuthCard.classList.add('hidden');
    adminConsole.classList.remove('hidden');
    
    adminLinks = result.links || [];
    renderAdminLinks();
    showToast('管理员验证通过', 'success');
    
  } catch (err) {
    showToast(err.message, 'error');
    localStorage.removeItem('edgelink_admin_token');
    activeAdminToken = '';
  }
}

function handleAdminLogout() {
  localStorage.removeItem('edgelink_admin_token');
  activeAdminToken = '';
  document.getElementById('adminToken').value = '';
  
  document.getElementById('adminConsole').classList.add('hidden');
  document.getElementById('adminAuthCard').classList.remove('hidden');
  showToast('已退出管理员会话', 'info');
}

async function fetchAdminLinks() {
  if (!activeAdminToken) return;
  
  const listBody = document.getElementById('adminLinksList');
  listBody.innerHTML = '<tr class="empty-row"><td colspan="8">正在刷新 KV 数据...</td></tr>';
  
  try {
    const response = await fetch('/api/admin/list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${activeAdminToken}`
      }
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '获取链接列表失败');
    }
    
    adminLinks = result.links || [];
    renderAdminLinks();
    showToast('列表刷新成功', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    if (err.message.includes('Unauthorized') || err.message.includes('Token')) {
      handleAdminLogout();
    }
  }
}

// Selection Management
function toggleSelectAll(master) {
  const checkboxes = document.querySelectorAll('.link-checkbox');
  checkboxes.forEach(cb => cb.checked = master.checked);
  updateSelectedCount();
}

function updateSelectedCount() {
  const checkboxes = document.querySelectorAll('.link-checkbox:checked');
  const count = checkboxes.length;
  const btnBulkDelete = document.getElementById('btnBulkDelete');
  const selectedCountSpan = document.getElementById('selectedCount');
  
  selectedCountSpan.textContent = count;
  if (count > 0) {
    btnBulkDelete.classList.remove('hidden');
  } else {
    btnBulkDelete.classList.add('hidden');
  }
}

async function handleBulkDelete() {
  const checkedBoxes = document.querySelectorAll('.link-checkbox:checked');
  const codes = Array.from(checkedBoxes).map(cb => cb.value);
  
  if (codes.length === 0) return;
  
  if (!confirm(`您确定要永久删除这 ${codes.length} 个短链接吗？这将防止 KV 存储溢出。`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/admin/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeAdminToken}`
      },
      body: JSON.stringify({ codes })
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '批量删除失败');
    }
    
    showToast(`成功从 KV 中删除 ${result.deleted.length} 个短链接！`, 'success');
    
    // Update local adminLinks array
    adminLinks = adminLinks.filter(item => !result.deleted.includes(item.code));
    renderAdminLinks(document.getElementById('adminSearchInput').value.trim());
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Text Preview Modal Management
let activePreviewText = '';
function previewTextNote(code) {
  const item = adminLinks.find(link => link.code === code);
  if (!item) return;
  
  const previewModal = document.getElementById('previewModal');
  const previewBadge = document.getElementById('previewBadge');
  const previewTextContent = document.getElementById('previewTextContent');
  
  activePreviewText = item.text || '';
  previewTextContent.textContent = activePreviewText;
  
  const clicks = item.clicks || 0;
  const limit = item.viewLimit;
  const isDestroyed = limit && (clicks >= limit);
  
  if (limit) {
    previewBadge.textContent = isDestroyed 
      ? `🚨 已销毁/已失效 (查看限制: ${clicks}/${limit})` 
      : `⚠️ 阅后即焚限制 (剩余查看: ${limit - clicks}次，总共: ${limit}次)`;
    previewBadge.style.background = isDestroyed ? 'rgba(255, 69, 58, 0.1)' : 'rgba(190, 100, 50, 0.08)';
    previewBadge.style.color = isDestroyed ? 'var(--danger-color)' : 'var(--accent-color)';
    previewBadge.style.borderColor = isDestroyed ? 'rgba(255, 69, 58, 0.2)' : 'rgba(190, 100, 50, 0.2)';
  } else {
    previewBadge.textContent = `📝 文字分享 (累计被查看: ${clicks}次)`;
    previewBadge.style.background = 'rgba(50, 215, 75, 0.1)';
    previewBadge.style.color = 'var(--success-color)';
    previewBadge.style.borderColor = 'rgba(50, 215, 75, 0.2)';
  }
  
  previewModal.classList.remove('hidden');
}

function closePreviewModal() {
  document.getElementById('previewModal').classList.add('hidden');
  activePreviewText = '';
}

function copyPreviewText() {
  if (!activePreviewText) return;
  copyText(activePreviewText);
}

// Simple HTML Escaper helper
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAdminLinks(filterQuery = '') {
  const listBody = document.getElementById('adminLinksList');
  
  let filtered = adminLinks;
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    filtered = adminLinks.filter(item => 
      item.code.toLowerCase().includes(q) || 
      (item.url && item.url.toLowerCase().includes(q)) ||
      (item.text && item.text.toLowerCase().includes(q))
    );
  }
  
  // Clear select all state
  document.getElementById('selectAll').checked = false;
  updateSelectedCount();
  
  document.getElementById('statTotalLinks').textContent = adminLinks.length;
  
  const totalClicks = adminLinks.reduce((sum, item) => sum + (item.clicks || 0), 0);
  document.getElementById('statTotalClicks').textContent = totalClicks;
  
  if (filtered.length === 0) {
    listBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">${filterQuery ? '没有找到匹配的短链接' : 'KV 数据库中暂无短链接记录'}</td>
      </tr>
    `;
    return;
  }
  
  listBody.innerHTML = '';
  
  filtered.forEach(item => {
    const row = document.createElement('tr');
    
    const origin = window.location.origin;
    const shortUrl = `${origin}/${item.code}`;
    
    let dateStr = '未知';
    if (item.createdAt) {
      const d = new Date(item.createdAt);
      dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    // Determine type label
    const typeLabel = item.type === 'text' 
      ? '<span style="background: rgba(190, 100, 50, 0.08); color: var(--accent-color); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid rgba(190, 100, 50, 0.2); font-weight: 600;">📝 文字</span>' 
      : '<span style="background: rgba(145, 80, 46, 0.08); color: var(--success-color); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid rgba(145, 80, 46, 0.2); font-weight: 600;">🔗 链接</span>';
      
    // Determine display content
    const displayContent = item.type === 'text'
      ? `<span class="admin-note-preview" style="color: var(--text-secondary); font-style: italic; font-family: var(--font-mono); font-size: 0.85rem; cursor: pointer;" onclick="previewTextNote('${item.code}')" title="点击以查看完整内容">${escapeHtml(item.text.length > 40 ? item.text.substring(0, 40) + '...' : item.text)}</span>`
      : `<a href="${item.url}" target="_blank" class="link-url">${item.url}</a>`;

    // Determine status & clicks
    const clicks = item.clicks || 0;
    const viewLimit = item.viewLimit;
    const isDestroyed = viewLimit && (clicks >= viewLimit);
    
    let statusLabel = '';
    if (isDestroyed) {
      statusLabel = '<span style="background: rgba(255, 69, 58, 0.1); color: var(--danger-color); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid rgba(255, 69, 58, 0.2); font-weight: 600;">已销毁</span>';
    } else if (clicks > 0) {
      statusLabel = '<span style="background: rgba(50, 215, 75, 0.1); color: var(--success-color); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid rgba(50, 215, 75, 0.2); font-weight: 600;">已查看</span>';
    } else {
      statusLabel = '<span style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-color); font-weight: 600;">未查看</span>';
    }

    const limitLabel = viewLimit 
      ? `<span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">${clicks} / ${viewLimit}</span>`
      : '<span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">无限制</span>';
    
    row.innerHTML = `
      <td style="text-align: center;"><input type="checkbox" class="link-checkbox" value="${item.code}" onchange="updateSelectedCount()" style="cursor: pointer;"></td>
      <td><a href="${shortUrl}" target="_blank" class="link-code">/${item.code}</a></td>
      <td>${typeLabel}</td>
      <td title="${item.url || '双击/点击预览'}">${displayContent}</td>
      <td>${statusLabel} <span class="clicks-badge" style="padding: 1px 6px; font-size: 0.75rem;">${clicks}次</span></td>
      <td>${limitLabel}</td>
      <td><span class="date-text">${dateStr}</span></td>
      <td>
        <div class="row-actions">
          ${item.type === 'text' ? `<button onclick="previewTextNote('${item.code}')" class="btn btn-secondary btn-small" title="预览文字内容">预览</button>` : ''}
          <button onclick="copyText('${shortUrl}')" class="btn btn-secondary btn-small">复制</button>
          <button onclick="showQRCode('${shortUrl}', '${item.code}')" class="btn btn-secondary btn-small">二维码</button>
          <button onclick="deleteLink('${item.code}')" class="btn btn-danger btn-small">删除</button>
        </div>
      </td>
    `;
    listBody.appendChild(row);
  });
}

function filterAdminLinks() {
  const query = document.getElementById('adminSearchInput').value.trim();
  renderAdminLinks(query);
}

async function deleteLink(code) {
  if (!confirm(`您确定要永久删除短链接 /${code} 吗？`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeAdminToken}`
      },
      body: JSON.stringify({ code })
    });
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '删除失败');
    }
    
    showToast(`/${code} 已成功从 KV 中删除！`, 'success');
    
    adminLinks = adminLinks.filter(item => item.code !== code);
    renderAdminLinks(document.getElementById('adminSearchInput').value.trim());
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ----------------------------------------------------
 * QR CODE DIALOG
 * ---------------------------------------------------- */

function showQRCode(shortUrl, code) {
  const container = document.getElementById('qrcodeContainer');
  const qrUrlText = document.getElementById('qrUrlText');
  const btnDownloadQR = document.getElementById('btnDownloadQR');
  
  container.innerHTML = '';
  qrUrlText.textContent = shortUrl;
  
  document.getElementById('qrModal').classList.remove('hidden');
  
  if (typeof QRCode !== 'undefined') {
    const qrcode = new QRCode(container, {
      text: shortUrl,
      width: 220,
      height: 220,
      colorDark : '#0f141e',
      colorLight : '#ffffff',
      correctLevel : QRCode.CorrectLevel.H
    });
    
    btnDownloadQR.onclick = () => {
      const canvas = container.querySelector('canvas');
      const img = container.querySelector('img');
      
      const link = document.createElement('a');
      link.download = `edgelink-${code}-qr.png`;
      
      if (canvas) {
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('二维码已开始下载', 'success');
      } else if (img && img.src && img.src.startsWith('data:')) {
        link.href = img.src;
        link.click();
        showToast('二维码已开始下载', 'success');
      } else {
        showToast('未找到可下载的二维码，请重试', 'error');
      }
    };
  } else {
    container.innerHTML = '<span style="color:red">二维码库加载失败，请重试</span>';
  }
}

function closeQRModal() {
  document.getElementById('qrModal').classList.add('hidden');
}
