/* 结构化编辑器：随笔 / 友链 / 作品 / 关于页
   内置一个覆盖本站数据文件结构的 YAML 子集解析器 + 生成器；
   保存前做「生成 → 再解析 → 深度比对」自校验，不一致则拒绝提交。 */
'use strict';

/* ---------- YAML 子集解析 ---------- */
function yamlParse(text) {
  const items = [];
  String(text).replace(/\r/g, '').split('\n').forEach(raw => {
    const t = raw.replace(/\t/g, '  ');
    items.push({ i: t.match(/^ */)[0].length, s: t.trim(), raw: t, blank: t.trim() === '', comment: t.trim().startsWith('#') });
  });
  let p = 0;
  const skipNoise = () => { while (p < items.length && (items[p].blank || items[p].comment)) p++; };

  function indentOf(it) { return it.i; }

  function node(indent) {
    skipNoise();
    if (p >= items.length) return null;
    const it = items[p];
    if (indentOf(it) < indent) return null;
    if (it.s.startsWith('- ') || it.s === '-') return list(indentOf(it));
    return map(indentOf(it));
  }

  function list(indent) {
    const arr = [];
    while (true) {
      skipNoise();
      if (p >= items.length) break;
      const it = items[p];
      if (indentOf(it) !== indent || !(it.s.startsWith('- ') || it.s === '-')) break;
      p++;
      if (it.s === '-') { const v = node(indent + 1); arr.push(v === null ? '' : v); continue; }
      const rest = it.s.slice(2);
      const kv = rest.match(/^([^:]+):(.*)$/);
      if (kv) {
        const obj = {};
        setKV(obj, kv[1].trim(), kv[2].trim(), indent + 2);
        mapInto(obj, indent + 2);
        arr.push(obj);
      } else {
        arr.push(sval(rest));
      }
    }
    return arr;
  }

  function map(indent) {
    const obj = {};
    mapInto(obj, indent);
    return obj;
  }

  function mapInto(obj, indent) {
    while (true) {
      skipNoise();
      if (p >= items.length) break;
      const it = items[p];
      if (indentOf(it) !== indent || it.s.startsWith('- ')) break;
      const kv = it.s.match(/^([^:]+):(.*)$/);
      if (!kv) break;
      p++;
      setKV(obj, kv[1].trim(), kv[2].trim(), indent);
    }
  }

  function setKV(obj, k, v, indent) {
    if (/^([>|][+-]?)$/.test(v)) {
      obj[k] = blockScalar(indent);
    } else if (v === '[]') {
      obj[k] = [];
    } else if (v === '{}') {
      obj[k] = {};
    } else if (v === '') {
      skipNoise();
      if (p < items.length && indentOf(items[p]) > indent) obj[k] = node(items[p].i);
      else obj[k] = '';
    } else {
      obj[k] = sval(v);
    }
  }

  function blockScalar(keyIndent) {
    const raws = [];
    while (p < items.length) {
      const it = items[p];
      if (it.blank) { raws.push(''); p++; continue; }
      if (it.i <= keyIndent) break;
      raws.push(it.raw.slice(keyIndent + 2).replace(/\s+$/, ''));
      p++;
    }
    while (raws.length && raws[raws.length - 1] === '') raws.pop();
    let out = '';
    raws.forEach((l, idx) => {
      if (l === '') out += '\n';
      else out += (idx === 0 || out === '' || out.endsWith('\n') ? '' : ' ') + l;
    });
    if (out !== '') out += '\n'; // clip chomping：与 js-yaml 的 > 行为一致，保留末尾换行
    return out;
  }

  function sval(s) {
    s = s.trim();
    if (s.length > 1 && s[0] === '"' && s.endsWith('"')) return s.slice(1, -1).replace(/\\(.)/g, '$1');
    if (s.length > 1 && s[0] === "'" && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return '';
    return s;
  }

  const result = node(0);
  return result || {};
}

/* ---------- YAML 生成 ---------- */
function sPlain(s) {
  s = String(s);
  if (s === '') return '';
  if (s === 'true' || s === 'false' || s === 'null') return '"' + s + '"';
  if (!/^[\w\u4e00-\u9fa5<]/.test(s)) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  if (/:\s/.test(s) || / #$/.test(s) || / #\s/.test(s) || s.endsWith(':') || /[\r\n]/.test(s)) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return s;
}

function sFold(text, indent) {
  // 折叠块：> 。段内按空格折行（无损），空行 = 段落分隔
  const pad = ' '.repeat(indent);
  const paras = String(text).replace(/\r/g, '').split(/\n+/);
  const lines = [];
  paras.forEach(para => {
    para = para.trim();
    if (!para) { lines.push(''); return; }
    let cur = '';
    para.split(' ').forEach(w => {
      if (cur && (cur + ' ' + w).length > 76) { lines.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
  });
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return ' >\n' + lines.map(l => l === '' ? '' : pad + l).join('\n');
}

function dumpMap(obj, indent) {
  const pad = ' '.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) out += dumpKV(k, v, indent, pad);
  return out;
}

function dumpKV(k, v, indent, keyPad) {
  if (v && typeof v === 'object' && !Array.isArray(v) && v.__fold !== undefined) {
    return keyPad + k + ':' + sFold(v.__fold, indent + 2) + '\n';
  }
  if (Array.isArray(v)) {
    if (!v.length) return keyPad + k + ': []\n';
    return keyPad + k + ':\n' + v.map(it => dumpItem(it, indent + 2)).join('');
  }
  if (v && typeof v === 'object') {
    return keyPad + k + ':\n' + dumpMap(v, indent + 2);
  }
  const s = sPlain(v);
  return keyPad + k + (s === '' ? ':' : ': ' + s) + '\n';
}

function dumpItem(item, indent) {
  const pad = ' '.repeat(indent);
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return pad + '- ' + sPlain(item) + '\n';
  const es = Object.entries(item);
  if (!es.length) return pad + '- {}\n';
  let out = '';
  es.forEach(([k, v], idx) => {
    const keyPad = idx === 0 ? pad + '- ' : pad + '  ';
    out += dumpKV(k, v, indent + 2, keyPad);
  });
  return out;
}

function yamlDump(obj) {
  return Array.isArray(obj) ? obj.map(it => dumpItem(it, 0)).join('') : dumpMap(obj, 0);
}

/* 关于页：按主题文件原有的注释骨架生成（表单之外的内容原样保留） */
function buildAboutYaml(d) {
  return [
    '# 悬浮标签模块\n', dumpKV('authorinfo', d.authorinfo, 0, ''),
    '\n# 标题\n', dumpKV('title', d.title, 0, ''),
    '\n# 介绍块\n', dumpKV('contentinfo', d.contentinfo, 0, ''),
    '\n# 技能图标轮播块\n', dumpKV('skills', d.skills, 0, ''),
    '\n# 座右铭\n', dumpKV('motto', d.motto, 0, ''),
    '\n# 网站统计数据展示模块（接入自己的统计后再配置）\n',
    '# tj:\n',
    '#   provider: 51la\n',
    '#   url: https://v6-widget.51.la/v6/你的ID/quote.js?theme=0&col=true&f=12&badge=icon_0&icon=center\n',
    '#   img: /img/avatar-256.png\n',
    '#   desc: 本站采用 51LA 网站统计\n',
    '\n# 自定义\n', dumpKV('cause', Object.assign({}, d.cause, { content: { __fold: String((d.cause && d.cause.content) || '') } }), 0, ''),
    '\n# 生涯 / 性格 / 特长 / 个人信息模块：需要时参考主题文档补回\n',
    '# careers / personalities / expertise / oneself / award\n',
    '\n# 十年之约\n', dumpKV('tenyear', d.tenyear, 0, ''),
  ].join('');
}

/* 深度比对（__fold 视为字符串；键序不敏感） */
function normObj(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(normObj);
  if (o.__fold !== undefined) return String(o.__fold);
  const r = {};
  Object.keys(o).sort().forEach(k => { r[k] = normObj(o[k]); });
  return r;
}
function deepEqual(a, b) { return JSON.stringify(normObj(a)) === JSON.stringify(normObj(b)); }

/* 校验：dump 后能被重新解析且内容一致，才允许提交 */
function yamlRoundTripOk(obj) {
  try { return deepEqual(obj, yamlParse(yamlDump(obj))); }
  catch (e) { return false; }
}

/* ---------- 表单组件 ---------- */
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const F = {
  field: (label, id, val, ph, type) =>
    `<label class="fl" for="${id}">${label}</label><input id="${id}" type="${type || 'text'}" value="${esc(val ?? '')}" placeholder="${esc(ph || '')}" style="width:100%">`,
  val: id => document.getElementById(id).value,
};

/* 友链 / 作品（同一结构） */
function renderLinksiteForm(root, data, noun) {
  root.innerHTML = '';
  const state = { groups: JSON.parse(JSON.stringify(data.links || [])) };
  if (!state.groups.length) state.groups.push({ class_name: '', descr: '', type: 'card', suffix: '', link_list: [{ name: '', link: '', avatar: '', descr: '', topimg: '' }] });

  function siteRow(item) {
    const idx = 's' + Math.random().toString(36).slice(2, 8);
    const box = el(`<div class="subcard" data-idx="${idx}">
      <div class="subcard-head"><b>${noun}</b>
        <span class="spacer"></span>
        <button type="button" class="btn small gray" data-act="up">上移</button>
        <button type="button" class="btn small gray" data-act="down">下移</button>
        <button type="button" class="btn small ghost" data-act="del">删除</button>
      </div>
      <div class="fgrid">
        <div>${F.field('名称', 'n-' + idx, item.name)}</div>
        <div>${F.field('网址', 'l-' + idx, item.link, 'https://')}</div>
        <div>${F.field('头像图片地址', 'a-' + idx, item.avatar, 'https://…/logo.svg')}</div>
        <div>${F.field('卡片大图地址（可选）', 't-' + idx, item.topimg, 'https://…/cover.webp')}</div>
        <div class="full">${F.field('一句话介绍', 'd-' + idx, item.descr)}</div>
      </div></div>`);
    box.dataset.item = JSON.stringify(item);
    box.addEventListener('input', () => {
      box.dataset.item = JSON.stringify({ name: F.val('n-' + idx), link: F.val('l-' + idx), avatar: F.val('a-' + idx), descr: F.val('d-' + idx), topimg: F.val('t-' + idx) });
    });
    box.addEventListener('click', e => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      const listEl = box.parentElement;
      const kids = [...listEl.children];
      const i = kids.indexOf(box);
      if (act === 'del') box.remove();
      if (act === 'up' && i > 0) listEl.insertBefore(box, kids[i - 1]);
      if (act === 'down' && i < kids.length - 1) listEl.insertBefore(kids[i + 1], box);
      if (act !== 'del') syncGroups();
    });
    return box;
  }

  function groupCard(g) {
    const idx = 'g' + Math.random().toString(36).slice(2, 8);
    const card = el(`<div class="card group-card">
      <div class="subcard-head"><b>分组</b>
        <span class="spacer"></span>
        <button type="button" class="btn small gray" data-act="gup">上移</button>
        <button type="button" class="btn small gray" data-act="gdown">下移</button>
        <button type="button" class="btn small ghost" data-act="gdel">删除分组</button>
      </div>
      <div class="fgrid">
        <div>${F.field('分组名称', 'gc-' + idx, g.class_name)}</div>
        <div>${F.field('分组描述', 'gd-' + idx, g.descr)}</div>
        <div><label class="fl" for="gt-${idx}">展示样式</label>
          <select id="gt-${idx}" style="width:100%">
            <option value="card"${g.type === 'card' ? ' selected' : ''}>card（卡片）</option>
            <option value="item"${g.type === 'item' ? ' selected' : ''}>item（列表）</option>
          </select></div>
        <div>${F.field('suffix（一般留空）', 'gs-' + idx, g.suffix)}</div>
      </div>
      <div class="sec-label" style="margin-top:14px">${noun}列表</div>
      <div class="site-list"></div>
      <button type="button" class="btn small" data-act="addsite" style="margin-top:10px">＋ 添加${noun}</button>
    </div>`);
    card.dataset.head = JSON.stringify({ class_name: g.class_name, descr: g.descr, type: g.type || 'card', suffix: g.suffix || '' });
    card.addEventListener('input', () => {
      card.dataset.head = JSON.stringify({ class_name: F.val('gc-' + idx), descr: F.val('gd-' + idx), type: F.val('gt-' + idx), suffix: F.val('gs-' + idx) });
    });
    const listEl = card.querySelector('.site-list');
    (g.link_list || []).forEach(s => listEl.appendChild(siteRow(s)));
    card.addEventListener('click', e => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      if (act === 'addsite') { listEl.appendChild(siteRow({ name: '', link: '', avatar: '', descr: '', topimg: '' })); syncGroups(); }
      if (act === 'gup' && card.previousElementSibling) root.insertBefore(card, card.previousElementSibling);
      if (act === 'gdown' && card.nextElementSibling) root.insertBefore(card.nextElementSibling, card);
      if (act === 'gdel') card.remove();
      if (act === 'gup' || act === 'gdown') syncGroups();
    });
    return card;
  }

  root.appendChild(el('<div id="grouproot"></div>'));
  const grouproot = root.querySelector('#grouproot');
  state.groups.forEach(g => grouproot.appendChild(groupCard(g)));
  const addBtn = el(`<button type="button" class="btn" style="margin-top:12px">＋ 添加分组</button>`);
  addBtn.onclick = () => { grouproot.appendChild(groupCard({ class_name: '', descr: '', type: 'card', suffix: '', link_list: [] })); syncGroups(); };
  root.appendChild(addBtn);

  function syncGroups() {
    state.groups = [...grouproot.children].map(card => {
      const head = JSON.parse(card.dataset.head);
      head.link_list = [...card.querySelector('.site-list').children].map(s => JSON.parse(s.dataset.item));
      return head;
    });
  }
  root.collect = () => { syncGroups(); return { banner_suffix: data.banner_suffix ?? '', links: state.groups }; };
}

/* 关于页 */
function renderAboutForm(root, data) {
  root.innerHTML = '';
  const d = JSON.parse(JSON.stringify(data));

  function tagList(title, arr) {
    const wrap = el(`<div><div class="sec-label" style="margin:10px 0 6px">${title}</div><div class="taglist"></div>
      <button type="button" class="btn small" data-act="add">＋ 添加标签</button></div>`);
    const listEl = wrap.querySelector('.taglist');
    function row(v) {
      const r = el(`<div style="display:flex;gap:8px;margin-bottom:6px"><input type="text" style="flex:1" value="${esc(v)}"><button type="button" class="btn small ghost" data-act="del">删除</button></div>`);
      r.querySelector('[data-act="del"]').onclick = () => { r.remove(); };
      return r;
    }
    (arr || []).forEach(v => listEl.appendChild(row(v)));
    wrap.querySelector('[data-act="add"]').onclick = () => listEl.appendChild(row(''));
    wrap.collect = () => [...listEl.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
    return wrap;
  }

  function skillRow(s) {
    const r = el(`<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">
      <input type="text" data-k="title" placeholder="技能名" style="flex:2;min-width:110px" value="${esc(s.title || '')}">
      <input type="text" data-k="color" placeholder='颜色，如 "#C2543E"' style="flex:2;min-width:120px" value="${esc(s.color || '')}">
      <input type="text" data-k="icon" placeholder="图标，如 fas fa-pen-fancy" style="flex:3;min-width:170px" value="${esc(s.icon || '')}">
      <button type="button" class="btn small ghost" data-act="del">删除</button></div>`);
    r.querySelector('[data-act="del"]').onclick = () => r.remove();
    return r;
  }

  const c = d.contentinfo || {}, sk = d.skills || {}, mo = d.motto || {}, au = d.authorinfo || {}, cs = d.cause || {}, ty = d.tenyear || {};
  root.innerHTML = `
    <div class="card"><h2><svg class="ic"><use href="#i-about"/></svg>悬浮标签墙</h2>
      <div class="fgrid"><div id="abLeft"></div><div id="abRight"></div></div>
      <label class="fl">图片</label><input id="abImg" type="text" style="width:100%" value="${esc(au.image || '')}">
    </div>
    <div class="card"><h2><svg class="ic"><use href="#i-post"/></svg>介绍块</h2>
      <div class="fgrid">
        <div>${F.field('页面标题', 'abTitle', d.title)}</div>
        <div>${F.field('顶部小字', 'abSup', c.sup)}</div>
        <div>${F.field('名字', 'abName', c.name)}</div>
        <div>${F.field('一句话介绍', 'abCTitle', c.title)}</div>
        <div>${F.field('角标文字', 'abTip', c.tip)}</div>
        <div>${F.field('口号（支持 <br> 换行）', 'abSlogan', c.slogan)}</div>
      </div>
      <div id="abMask"></div>
    </div>
    <div class="card"><h2><svg class="ic"><use href="#i-works"/></svg>技能展示</h2>
      <div class="fgrid"><div>${F.field('标题', 'abSkTitle', sk.title)}</div><div>${F.field('副标题', 'abSkSub', sk.subtitle)}</div></div>
      <div class="sec-label" style="margin:10px 0 6px">技能列表</div>
      <div id="abSkills"></div>
      <button type="button" class="btn small" id="abAddSkill" style="margin-top:8px">＋ 添加技能</button>
    </div>
    <div class="card"><h2><svg class="ic"><use href="#i-clock"/></svg>座右铭</h2>
      <div class="fgrid"><div>${F.field('标题', 'abMoTitle', mo.title)}</div><div>${F.field('前半句', 'abMoPrefix', mo.prefix)}</div>
      <div class="full">${F.field('后半句', 'abMoContent', mo.content)}</div></div>
    </div>
    <div class="card"><h2><svg class="ic"><use href="#i-compass"/></svg>为什么建站</h2>
      <div class="fgrid"><div>${F.field('角标文字', 'abCsTip', cs.tip)}</div><div>${F.field('标题', 'abCsTitle', cs.title)}</div>
      <div class="full"><label class="fl">内容（支持 HTML 标签）</label><textarea id="abCsContent" rows="5" style="width:100%">${esc(cs.content || '')}</textarea></div></div>
    </div>
    <div class="card"><h2><svg class="ic"><use href="#i-announce"/></svg>十年之约</h2>
      <div class="fgrid"><div>${F.field('角标文字', 'abTyTips', ty.tips)}</div><div>${F.field('标题', 'abTyTitle', ty.title)}</div>
      <div>${F.field('开始日期', 'abTyStart', ty.start, '2026-08-31')}</div><div>${F.field('结束日期', 'abTyEnd', ty.end, '2036-08-31')}</div></div>
    </div>
    <div class="tip">说明：表单只管理以上模块；文件里的注释和注释掉的扩展模块（tj、careers 等）保存时会按原样保留。</div>`;

  const left = tagList('左列标签', au.leftTags); document.getElementById('abLeft').replaceWith(left);
  const right = tagList('右列标签', au.rightTags); document.getElementById('abRight').replaceWith(right);
  const mask = tagList('打字机轮播词', c.mask); document.getElementById('abMask').replaceWith(mask);
  const skillsEl = document.getElementById('abSkills');
  (sk.tags || []).forEach(s => skillsEl.appendChild(skillRow(s)));
  document.getElementById('abAddSkill').onclick = () => skillsEl.appendChild(skillRow({}));

  root.collect = () => ({
    authorinfo: { leftTags: left.collect(), rightTags: right.collect(), image: document.getElementById('abImg').value.trim() },
    title: document.getElementById('abTitle').value.trim(),
    contentinfo: {
      sup: document.getElementById('abSup').value.trim(),
      name: document.getElementById('abName').value.trim(),
      title: document.getElementById('abCTitle').value.trim(),
      tip: document.getElementById('abTip').value.trim(),
      slogan: document.getElementById('abSlogan').value.trim(),
      mask: mask.collect(),
    },
    skills: {
      title: document.getElementById('abSkTitle').value.trim(),
      subtitle: document.getElementById('abSkSub').value.trim(),
      tags: [...skillsEl.children].map(r => ({
        title: r.querySelector('[data-k="title"]').value.trim(),
        color: r.querySelector('[data-k="color"]').value.trim(),
        icon: r.querySelector('[data-k="icon"]').value.trim(),
      })),
    },
    motto: {
      title: document.getElementById('abMoTitle').value.trim(),
      prefix: document.getElementById('abMoPrefix').value.trim(),
      content: document.getElementById('abMoContent').value.trim(),
    },
    cause: {
      tip: document.getElementById('abCsTip').value.trim(),
      title: document.getElementById('abCsTitle').value.trim(),
      content: { __fold: document.getElementById('abCsContent').value },
    },
    tenyear: {
      tips: document.getElementById('abTyTips').value.trim(),
      title: document.getElementById('abTyTitle').value.trim(),
      start: document.getElementById('abTyStart').value.trim(),
      end: document.getElementById('abTyEnd').value.trim(),
    },
  });
}

/* node 侧测试用（浏览器无影响） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { yamlParse, yamlDump, buildAboutYaml, yamlRoundTripOk, deepEqual, normObj };
}
