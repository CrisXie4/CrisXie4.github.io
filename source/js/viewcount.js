// 阅读量：唯一访客计数（同一浏览器对同一文章只计一次），数字来自本站计数服务
// pjax 站内跳转不重载页面，监听 pjax:complete 按新路径重新计数
(function () {
  function get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }
  function set(k, v) { try { localStorage.setItem(k, v) } catch (e) { } }
  var vid = get('uvid');
  if (!vid) { vid = 'v' + Math.random().toString(36).slice(2) + Date.now().toString(36); set('uvid', vid); }

  function setPage(n) { var e = document.getElementById('busuanzi_value_page_pv'); if (e) e.textContent = n; }
  function fillSite() {
    fetch('/blog-stat/totals').then(function (r) { return r.json() }).then(function (t) {
      var sp = document.getElementById('busuanzi_value_site_pv'); if (sp) sp.textContent = t.pv;
      var su = document.getElementById('busuanzi_value_site_uv'); if (su) su.textContent = t.uv;
      var cp = document.getElementById('busuanzi_container_site_pv'); if (cp) cp.style.display = 'inline';
      var cu = document.getElementById('busuanzi_container_site_uv'); if (cu) cu.style.display = 'inline';
    }).catch(function () { });
  }
  function refresh(P) {
    fetch('/blog-stat/count?p=' + encodeURIComponent(P)).then(function (r) { return r.json() }).then(function (d) { setPage(d.views) }).catch(function () { });
  }

  function run() {
    var P = location.pathname;
    refresh(P);
    fillSite();
    var KEY = 'vview:' + P;
    if (get(KEY) === '1') return;
    set(KEY, '1');
    fetch('/blog-stat/track?p=' + encodeURIComponent(P) + '&k=' + encodeURIComponent(vid))
      .then(function (r) { return r.json() })
      .then(function (d) { if (d.views !== undefined) setPage(d.views) })
      .catch(function () { });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  document.addEventListener('pjax:complete', function () { setTimeout(run, 0); });
})();
