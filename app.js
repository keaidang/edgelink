/* ----------------------------------------------------
 * EdgeLink Frontend Logic
 * Handles client actions, API integration, Local History,
 * QR Code creation, and Admin panel dashboard.
 * ---------------------------------------------------- */

// State management
let localHistory = [];
let adminLinks = [];
let activeAdminToken = localStorage.getItem('edgelink_admin_token') || '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initHistory();
  checkUrlParams();
  
  // If admin token exists, try auto-login
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
  
  // Auto-remove toast
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, duration);
}

// Clipboard Copy Helper
async function copyToClipboard(inputId) {
  const input = document.getElementById(inputId);
  input.select();
  input.setSelectionRange(0, 99999); // For mobile devices
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(input.value);
    } else {
      document.execCommand('copy');
    }
    showToast('链接复制成功！', 'success');
  } catch (err) {
    showToast('复制失败，请手动选择复制', 'error');
  }
}

function copyText(text) {
  const tempInput = document.createElement('input');
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  try {
    document.execCommand('copy');
    showToast('复制链接成功！', 'success');
  } catch (e) {
    showToast('复制失败', 'error');
  }
  document.body.removeChild(tempInput);
}

// Tab Switching logic
function switchTab(tabId) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
  
  // Update panels
  document.querySelectorAll('.content-panel').forEach(panel => panel.classList.remove('active'));
  document.getElementById(`panel${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
  
  if (tabId === 'admin' && activeAdminToken) {
    // If logged in, reload admin stats
    fetchAdminLinks();
  }
}

// URL query parameter check (for redirect error handling)
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('error')) {
    const errorType = params.get('error');
    const code = params.get('code') || '';
    if (errorType === 'notfound') {
      showToast(`短链接 /${code} 不存在或已被删除！`, 'warning', 5000);
    } else if (errorType === 'system') {
      const msg = params.get('message') || '未知系统错误';
      showToast(`重定向失败，系统异常: ${msg}`, 'error', 6000);
    }
    
    // Clean up URL query parameters without page reload
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

/* ----------------------------------------------------
 * SHORTENER API ACTIONS
 * ---------------------------------------------------- */

// Handle shortening form submission
async function handleShorten(e) {
  e.preventDefault();
  
  const longUrlInput = document.getElementById('longUrl');
  const customCodeInput = document.getElementById('customCode');
  const btnSubmit = document.getElementById('btnSubmit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const btnLoader = btnSubmit.querySelector('.btn-loader');
  
  const longUrl = longUrlInput.value.trim();
  const customCode = customCodeInput.value.trim();
  
  // Set loading state
  btnSubmit.disabled = true;
  btnText.textContent = '正在生成...';
  btnLoader.classList.remove('hidden');
  
  try {
    const response = await fetch('/api/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: longUrl, customCode: customCode || undefined })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '请求生成短链接失败');
    }
    
    // Show success panel
    const resultCard = document.getElementById('resultCard');
    const shortUrlOutput = document.getElementById('shortUrlOutput');
    const btnVisitLink = document.getElementById('btnVisitLink');
    
    shortUrlOutput.value = result.shortUrl;
    btnVisitLink.href = result.shortUrl;
    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth' });
    
    showToast('短链接生成成功！', 'success');
    
    // Save to local history
    addToHistory({
      code: result.code,
      url: longUrl,
      shortUrl: result.shortUrl,
      createdAt: result.createdAt,
      clicks: 0
    });
    
    // Clear form
    customCodeInput.value = '';
    
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    // Reset button state
    btnSubmit.disabled = false;
    btnText.textContent = '缩短链接';
    btnLoader.classList.add('hidden');
  }
}

/* ----------------------------------------------------
 * LOCAL HISTORY MANAGEMENT
 * ---------------------------------------------------- */

function initHistory() {
  const historyData = localStorage.getItem('edgelink_history');
  if (historyData) {
    try {
      localHistory = JSON.parse(historyData);
    } catch (e) {
      localHistory = [];
    }
  }
  renderHistory();
  // Fetch live stats for history in background
  if (localHistory.length > 0) {
    refreshHistoryStats();
  }
}

function addToHistory(item) {
  // Prevent duplicate entries
  localHistory = localHistory.filter(h => h.code !== item.code);
  localHistory.unshift(item); // Add to top
  
  // Cap history size to 30 items
  if (localHistory.length > 30) {
    localHistory.pop();
  }
  
  localStorage.setItem('edgelink_history', JSON.stringify(localHistory));
  renderHistory();
}

function removeFromHistory(code) {
  localHistory = localHistory.filter(h => h.code !== code);
  localStorage.setItem('edgelink_history', JSON.stringify(localHistory));
  renderHistory();
  showToast('记录已移除', 'info');
}

function renderHistory() {
  const historyList = document.getElementById('historyList');
  
  if (localHistory.length === 0) {
    historyList.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">暂无生成记录，立即在上方创建一个吧！</td>
      </tr>
    `;
    return;
  }
  
  historyList.innerHTML = '';
  
  localHistory.forEach(item => {
    const row = document.createElement('tr');
    
    // Format date
    let dateStr = '未知';
    if (item.createdAt) {
      const d = new Date(item.createdAt);
      dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    row.innerHTML = `
      <td><a href="${item.shortUrl}" target="_blank" class="link-code">/${item.code}</a></td>
      <td title="${item.url}"><a href="${item.url}" target="_blank" class="link-url">${item.url}</a></td>
      <td><span class="clicks-badge" id="clicks-${item.code}">${item.clicks || 0}</span></td>
      <td><span class="date-text">${dateStr}</span></td>
      <td>
        <div class="row-actions">
          <button onclick="copyText('${item.shortUrl}')" class="btn btn-secondary btn-small">复制</button>
          <button onclick="showQRCode('${item.shortUrl}', '${item.code}')" class="btn btn-secondary btn-small">二维码</button>
          <button onclick="removeFromHistory('${item.code}')" class="btn btn-danger btn-small" style="padding: 6px 8px;" title="从历史列表中移除">✕</button>
        </div>
      </td>
    `;
    historyList.appendChild(row);
  });
}

// Background poll to fetch real-time click statistics for user's history links
async function refreshHistoryStats() {
  if (localHistory.length === 0) return;
  
  let updated = false;
  
  await Promise.all(
    localHistory.map(async (item) => {
      try {
        const response = await fetch(`/api/stats?code=${item.code}`);
        if (response.ok) {
          const data = await response.json();
          if (data.clicks !== undefined && data.clicks !== item.clicks) {
            item.clicks = data.clicks;
            
            // Update cell directly for instant UI feedback
            const cell = document.getElementById(`clicks-${item.code}`);
            if (cell) {
              cell.textContent = data.clicks;
              cell.classList.add('animate-pulse');
              setTimeout(() => cell.classList.remove('animate-pulse'), 1000);
            }
            updated = true;
          }
        }
      } catch (err) {
        // Fail silently for individual items
      }
    })
  );
  
  if (updated) {
    localStorage.setItem('edgelink_history', JSON.stringify(localHistory));
  }
}

/* ----------------------------------------------------
 * QR CODE GENERATION
 * ---------------------------------------------------- */

function showQRCode(shortUrl = null, code = null) {
  // If arguments omitted, pull from current successful shorten card
  if (!shortUrl) {
    shortUrl = document.getElementById('shortUrlOutput').value;
    code = shortUrl.split('/').pop();
  }
  
  const container = document.getElementById('qrcodeContainer');
  const qrUrlText = document.getElementById('qrUrlText');
  const btnDownloadQR = document.getElementById('btnDownloadQR');
  
  container.innerHTML = '';
  qrUrlText.textContent = shortUrl;
  
  // Render canvas
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  
  // Trigger modal visibility
  document.getElementById('qrModal').classList.remove('hidden');
  
  // Build QR Code on canvas
  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(canvas, shortUrl, {
      width: 220,
      margin: 1.5,
      color: {
        dark: '#0f141e',
        light: '#ffffff'
      }
    }, function (error) {
      if (error) {
        console.error(error);
        container.innerHTML = '<span style="color:red">二维码生成失败</span>';
      }
    });
    
    // Bind download action
    btnDownloadQR.onclick = () => {
      const link = document.createElement('a');
      link.download = `edgelink-${code}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('二维码开始下载', 'success');
    };
  } else {
    container.innerHTML = '<span style="color:red">二维码库正在加载，请重试</span>';
  }
}

function closeQRModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

/* ----------------------------------------------------
 * ADMIN CONTROLLER
 * ---------------------------------------------------- */

// Process admin password validation
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
    
    // Successful login
    activeAdminToken = token;
    localStorage.setItem('edgelink_admin_token', token);
    
    adminAuthCard.classList.add('hidden');
    adminConsole.classList.remove('hidden');
    
    // Process listed links
    adminLinks = result.links || [];
    renderAdminLinks();
    showToast('管理员验证通过', 'success');
    
  } catch (err) {
    showToast(err.message, 'error');
    // Clear invalid token
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

// Fetch entire database links list
async function fetchAdminLinks() {
  if (!activeAdminToken) return;
  
  const listBody = document.getElementById('adminLinksList');
  listBody.innerHTML = '<tr class="empty-row"><td colspan="5">正在刷新 KV 数据...</td></tr>';
  
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
    if (err.message.includes('Unauthorized') || err.message.includes('key')) {
      handleAdminLogout();
    }
  }
}

function renderAdminLinks(filterQuery = '') {
  const listBody = document.getElementById('adminLinksList');
  
  // Filter search
  let filtered = adminLinks;
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    filtered = adminLinks.filter(item => 
      item.code.toLowerCase().includes(q) || 
      item.url.toLowerCase().includes(q)
    );
  }
  
  // Render stats counters
  document.getElementById('statTotalLinks').textContent = adminLinks.length;
  
  const totalClicks = adminLinks.reduce((sum, item) => sum + (item.clicks || 0), 0);
  document.getElementById('statTotalClicks').textContent = totalClicks;
  
  if (filtered.length === 0) {
    listBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">${filterQuery ? '没有找到匹配的短链接' : 'KV 数据库中暂无短链接记录'}</td>
      </tr>
    `;
    return;
  }
  
  listBody.innerHTML = '';
  
  filtered.forEach(item => {
    const row = document.createElement('tr');
    
    // Resolve shortURL domain dynamically
    const origin = window.location.origin;
    const shortUrl = `${origin}/${item.code}`;
    
    let dateStr = '未知';
    if (item.createdAt) {
      const d = new Date(item.createdAt);
      dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
    
    row.innerHTML = `
      <td><a href="${shortUrl}" target="_blank" class="link-code">/${item.code}</a></td>
      <td title="${item.url}"><a href="${item.url}" target="_blank" class="link-url">${item.url}</a></td>
      <td><span class="clicks-badge">${item.clicks || 0}</span></td>
      <td><span class="date-text">${dateStr}</span></td>
      <td>
        <div class="row-actions">
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

// Delete link action
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
    
    // Update local state and re-render
    adminLinks = adminLinks.filter(item => item.code !== code);
    
    // Also remove from history if present
    localHistory = localHistory.filter(h => h.code !== code);
    localStorage.setItem('edgelink_history', JSON.stringify(localHistory));
    renderHistory();
    
    renderAdminLinks(document.getElementById('adminSearchInput').value.trim());
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}
