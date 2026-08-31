// 公告条：读取 /announce.json（后台 CMS 可编辑），底部展示可关闭公告
(function () {
  fetch('/announce.json', { cache: 'no-store' })
    .then(function (r) { return r.json() })
    .then(function (a) {
      if (!a || !a.enabled || !a.text) return;
      if (localStorage.getItem('announce_closed') === a.text) return;
      var b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:linear-gradient(90deg,#C2543E,#E3A857);color:#fff;padding:11px 48px 11px 18px;text-align:center;font-size:14px;box-shadow:0 -2px 10px rgba(0,0,0,.12);padding-bottom:calc(11px + env(safe-area-inset-bottom))';
      var s = document.createElement('span');
      s.innerHTML = a.text;
      b.appendChild(s);
      if (a.link) {
        var lk = document.createElement('a');
        lk.href = a.link;
        lk.textContent = ' 查看 →';
        lk.style.cssText = 'color:#fff;text-decoration:underline;font-weight:600';
        s.appendChild(lk);
      }
      var x = document.createElement('span');
      x.textContent = '✕';
      x.style.cssText = 'position:absolute;right:16px;top:50%;transform:translateY(-50%);cursor:pointer;opacity:.9;font-size:15px';
      x.onclick = function () { localStorage.setItem('announce_closed', a.text); b.remove(); };
      b.appendChild(x);
      document.body.appendChild(b);
    }).catch(function () {});
})();
