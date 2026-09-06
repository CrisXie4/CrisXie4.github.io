/* 追加后台图标（lucide via api.iconify.design）。
   icons.js 被 CDN 长缓存，改动无法及时生效，新图标一律放本文件。 */
'use strict';
(function () {
  var SYMBOLS = {
    'bag': '<path d="M16 10a4 4 0 0 1-8 0M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>'
  };
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">';
  for (var k in SYMBOLS) sprite += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + SYMBOLS[k] + '</symbol>';
  sprite += '</svg>';
  document.documentElement.insertAdjacentHTML('beforeend', sprite);
})();
