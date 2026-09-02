/* 六哥博客后台公共库：GitHub API 直连（Content API 提交到 main，推送后自动构建上线）
   令牌只保存在本机浏览器 localStorage，不经过任何第三方服务器 */
'use strict';

const GH = { owner: 'CrisXie4', repo: 'CrisXie4.github.io', branch: 'main' };
const PAT_KEY = 'gh_pat';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const Pat = {
  get: () => localStorage.getItem(PAT_KEY) || '',
  set: v => localStorage.setItem(PAT_KEY, v.trim()),
  clear: () => localStorage.removeItem(PAT_KEY),
};

class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function ghApi(path, opts = {}) {
  const t = Pat.get();
  if (!t) throw new ApiError('NO_TOKEN', '未登录');
  let r;
  try {
    r = await fetch('https://api.github.com' + path, {
      method: opts.method || 'GET',
      headers: Object.assign(
        { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json' },
        opts.body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) { throw new ApiError('NETWORK', '网络错误，连不上 GitHub API'); }
  if (r.status === 401) { Pat.clear(); throw new ApiError('AUTH', '令牌无效或已过期，请重新登录'); }
  if (r.status === 403) throw new ApiError('FORBIDDEN', 'GitHub 返回 403：令牌权限不足或触发限流');
  if (r.status === 404) throw new ApiError('NOT_FOUND', '内容不存在（404）');
  if (!r.ok) {
    let msg = 'GitHub API 错误 ' + r.status;
    try { const j = await r.json(); if (j.message) msg += '：' + j.message; } catch (e) {}
    throw new ApiError('HTTP', msg);
  }
  return r.json();
}

/* ---------- base64（正确处理 UTF-8 / 二进制） ---------- */
function b64ToText(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
function textToB64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ---------- 仓库文件读写 ---------- */
const encPath = p => p.split('/').map(encodeURIComponent).join('/');

async function getRepoFile(path) {
  const j = await ghApi(`/repos/${GH.owner}/${GH.repo}/contents/${encPath(path)}?ref=${GH.branch}`);
  return { text: b64ToText(j.content), sha: j.sha };
}

async function putRepoFile(path, textOrB64, message, sha, isB64) {
  const body = { message, content: isB64 ? textOrB64 : textToB64(textOrB64), branch: GH.branch };
  if (sha) body.sha = sha;
  return ghApi(`/repos/${GH.owner}/${GH.repo}/contents/${encPath(path)}`, { method: 'PUT', body });
}

async function listTree() {
  const j = await ghApi(`/repos/${GH.owner}/${GH.repo}/git/trees/${GH.branch}?recursive=1`);
  return j.tree || [];
}

/* 并发受限的批量执行 */
async function pool(items, worker, limit = 5) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); }
  }));
  return out;
}

/* ---------- front-matter 解析 / 生成 ---------- */
function unquote(s) {
  s = s.trim();
  if (s.length > 1 && s[0] === '"' && s.endsWith('"')) return s.slice(1, -1).replace(/\\(.)/g, '$1');
  if (s.length > 1 && s[0] === "'" && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { attrs: {}, body: text };
  const attrs = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      if (!Array.isArray(attrs[listKey])) attrs[listKey] = [];
      attrs[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1], val = kv[2].trim();
    if (val === '') { attrs[key] = []; listKey = key; continue; }
    listKey = null;
    if (val.startsWith('[') && val.endsWith(']')) {
      attrs[key] = val.slice(1, -1).split(',').map(unquote).filter(Boolean);
    } else {
      attrs[key] = unquote(val);
    }
  }
  return { attrs, body: text.slice(m[0].length) };
}

const YAML_PLAIN = /^[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5\s\-_.,·。！？、：；（）()]*$/;
function yamlScalar(s) {
  s = String(s ?? '');
  if (!s) return "''";
  if (YAML_PLAIN.test(s) && !/[:#]/.test(s)) return s;
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function buildPostText(a, body) {
  const list = k => Array.isArray(a[k]) && a[k].length ? a[k].map(v => '\n  - ' + yamlScalar(v)).join('') : ' []';
  const L = [
    '---',
    'title: ' + yamlScalar(a.title),
    'date: ' + a.date,
    'tags:' + list('tags'),
    'categories:' + list('categories'),
  ];
  if (a.cover) L.push('cover: ' + yamlScalar(a.cover));
  if (a.description) L.push('description: ' + yamlScalar(a.description));
  if (a.brevity) L.push('brevity: true');
  L.push('---', '');
  return L.join('\n') + body.replace(/\r\n/g, '\n').replace(/\s+$/, '\n');
}

function slugify(title) {
  return String(title).trim()
    .replace(/[\s./\\]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

/* 从文件名取 hexo permalink（:year/:month/:day/:title/） */
function postUrl(path) {
  const name = path.split('/').pop().replace(/\.md$/i, '');
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)$/);
  if (!m) return null;
  return `/${m[1]}/${m[2]}/${m[3]}/${encodeURIComponent(m[4])}/`;
}

/* ---------- 登录（GitHub 个人访问令牌） ---------- */
/* 页面需包含：<div id="login"></div><div id="app" class="hide">…</div> */
function initAuth(onReady) {
  const box = $('#login'), app = $('#app');
  box.innerHTML = `
    <div class="card">
      <h2>🔐 登录博客后台</h2>
      <p class="tip" style="margin:8px 0">粘贴 GitHub 个人访问令牌（PAT），仅保存在本机浏览器，直接与 GitHub API 通信。</p>
      <input id="patInput" type="password" placeholder="github_pat_… / ghp_…" autocomplete="off">
      <div><button class="btn" id="loginBtn">登录</button></div>
      <div id="loginErr"></div>
      <div class="tip" style="text-align:left">
        <b>没有令牌？</b>打开
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank">GitHub 令牌创建页</a>：
        Repository access 选 <b>Only select repositories → CrisXie4/CrisXie4.github.io</b>，
        Permissions 里 Repository permissions → Contents 选 <b>Read and write</b>，生成后复制过来。<br>
        经典令牌（ghp_ 开头）也可以，勾选 repo 权限即可。
      </div>
    </div>`;
  const err = m => { $('#loginErr').textContent = m || ''; };
  const enter = async () => {
    const v = $('#patInput').value.trim();
    if (!v) return err('请先粘贴令牌');
    Pat.set(v);
    $('#loginBtn').disabled = true;
    err('验证中…');
    try {
      await ghApi('/user');
      await ghApi(`/repos/${GH.owner}/${GH.repo}`);
      err('');
      box.classList.add('hide'); app.classList.remove('hide');
      onReady();
    } catch (e) {
      err(e.code === 'AUTH' || e.code === 'FORBIDDEN' ? '登录失败：令牌无效，或没有勾选本仓库 Contents 读写权限' : e.message);
      $('#loginBtn').disabled = false;
    }
  };
  $('#loginBtn').onclick = enter;
  $('#patInput').addEventListener('keydown', e => { if (e.key === 'Enter') enter(); });

  if (!Pat.get()) { app.classList.add('hide'); box.classList.remove('hide'); return; }
  ghApi(`/repos/${GH.owner}/${GH.repo}`).then(() => {
    box.classList.add('hide'); app.classList.remove('hide');
    onReady();
  }).catch(e => {
    box.classList.remove('hide'); app.classList.add('hide');
    err(e.message);
  });
}

function logout() { Pat.clear(); location.reload(); }

/* ---------- 小工具 ---------- */
let toastTimer = null;
function toast(msg, ms = 2600) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.remove('hide');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hide'), ms);
}

function splitList(s) {
  return String(s || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
}

function nowLocalMin() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
