/* 轻量 Markdown 预览渲染器（仅供 /write 编辑器实时预览；
   正式发布的渲染由 Hexo 完成，此处的目标只是"看起来接近"） */
'use strict';
window.mdRender = (function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push('<code>' + esc(c) + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, t, u) => '<img src="' + u + '" alt="' + t + '">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>');
    s = s
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<b><i>$1</i></b>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
    return s;
  }

  return function (src) {
    const lines = String(src).replace(/\r\n/g, '\n').split('\n');
    let html = '', buf = [], i = 0;
    const flushP = () => { if (buf.length) { html += '<p>' + buf.map(inline).join('<br>') + '</p>'; buf = []; } };

    while (i < lines.length) {
      const l = lines[i];

      const fence = l.match(/^```(\w*)\s*$/);
      if (fence) {
        flushP(); let code = ''; i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { code += lines[i] + '\n'; i++; }
        i++;
        html += '<pre><code' + (fence[1] ? ' class="language-' + esc(fence[1]) + '"' : '') + '>' + esc(code) + '</code></pre>';
        continue;
      }

      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushP(); html += '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'; i++; continue; }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flushP(); html += '<hr>'; i++; continue; }

      if (/^>\s?/.test(l)) {
        flushP(); let q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        html += '<blockquote>' + q.map(inline).join('<br>') + '</blockquote>';
        continue;
      }

      if (/^\s*[-*+]\s+/.test(l)) {
        flushP(); const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
        html += '<ul>' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>';
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(l)) {
        flushP(); const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        html += '<ol>' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</ol>';
        continue;
      }

      if (/^\s*$/.test(l)) { flushP(); i++; continue; }

      buf.push(l); i++;
    }
    flushP();
    return html;
  };
})();
