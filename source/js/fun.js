// 趣味彩蛋包：点击粒子 / 标题彩蛋 / Konami 兔子雨
// 关闭方法：删掉 _config.solitude.yml 里 /js/fun.js 的注入行即可
(function () {
  if (window.__funLoaded) return;
  window.__funLoaded = 1;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) return; // 尊重减少动态效果偏好
  var COLORS = ['#C2543E', '#E3A857', '#8A6E52', '#B58A4C'];
  var TITLE = document.title;

  // 1. 点击冒爱心/星星（暖色系）
  document.addEventListener('click', function (e) {
    for (var i = 0; i < 6; i++) spawn(e.clientX + (Math.random() - 0.5) * 24, e.clientY + (Math.random() - 0.5) * 12);
  });
  function spawn(x, y) {
    var s = document.createElement('span');
    s.textContent = Math.random() > 0.4 ? '♥' : '✦';
    s.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;left:' + x + 'px;top:' + y + 'px;color:' +
      COLORS[Math.floor(Math.random() * COLORS.length)] + ';font-size:' + (10 + Math.random() * 8) +
      'px;transition:transform 1s ease-out,opacity 1s;will-change:transform,opacity';
    document.body.appendChild(s);
    requestAnimationFrame(function () {
      s.style.transform = 'translate(' + ((Math.random() - 0.5) * 60) + 'px,' + (-40 - Math.random() * 50) +
        'px) scale(' + (0.6 + Math.random() * 0.8) + ') rotate(' + ((Math.random() - 0.5) * 180) + 'deg)';
      s.style.opacity = '0';
    });
    setTimeout(function () { s.remove() }, 1100);
  }

  // 2. 标题彩蛋：切走标签页卖萌
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { document.title = '😢 别走，再逛会儿~'; }
    else { document.title = '🎉 欢迎回来！'; setTimeout(function () { document.title = TITLE }, 1500); }
  });

  // 3. Konami 秘技：↑↑↓↓←→←→BA = 兔子雨
  var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], pos = 0;
  document.addEventListener('keydown', function (e) {
    pos = (e.keyCode === seq[pos]) ? pos + 1 : (e.keyCode === seq[0] ? 1 : 0);
    if (pos === seq.length) { pos = 0; rain(); }
  });
  function rain() {
    for (var i = 0; i < 24; i++) {
      (function (i) {
        setTimeout(function () {
          var b = document.createElement('span');
          b.textContent = '🐰';
          b.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;top:-30px;left:' +
            (Math.random() * 100) + 'vw;font-size:' + (18 + Math.random() * 16) +
            'px;transition:transform 2.6s linear,opacity 2.6s;will-change:transform,opacity';
          document.body.appendChild(b);
          requestAnimationFrame(function () {
            b.style.transform = 'translateY(' + (innerHeight + 60) + 'px) rotate(' + (Math.random() * 360) + 'deg)';
            b.style.opacity = '0.15';
          });
          setTimeout(function () { b.remove() }, 2800);
        }, i * 90);
      })(i);
    }
    document.title = '🐰 兔子突袭！';
    setTimeout(function () { document.title = TITLE }, 2500);
  }
})();
