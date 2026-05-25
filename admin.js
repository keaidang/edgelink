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
  
  let filtered = adminLinks;
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    filtered = adminLinks.filter(item => 
      item.code.toLowerCase().includes(q) || 
      item.url.toLowerCase().includes(q)
    );
  }
  
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
