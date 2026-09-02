/* 生成 source/admin/secret.js —— 把 GitHub 令牌用「后台密码」加密后内置到后台页面。
   仓库里只存密文（AES-256-GCM，密钥由密码经 PBKDF2 派生），令牌明文不落任何文件。

   用法（Git Bash）：
     GH_TOKEN=github令牌 ADMIN_PASS='你的后台密码' node tools/make-admin-vault.js
   令牌可以从 git 凭据里现取：
     GH_TOKEN=$(git credential fill <<< $'protocol=https\nhost=github.com\n' | sed -n 's/^password=//p') \
     ADMIN_PASS='你的后台密码' node tools/make-admin-vault.js
   不传 ADMIN_PASS 则自动生成一个强密码并打印。
   改密码 / 换令牌 = 重新运行本脚本 + 提交推送 source/admin/secret.js。 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'source', 'admin', 'secret.js');
const ITERS = 600000; // PBKDF2-SHA256 迭代次数（OWASP 2023 建议 600k）

const token = (process.env.GH_TOKEN || '').trim();
if (!token) {
  console.error('✗ 请通过环境变量提供令牌：GH_TOKEN=github令牌 node tools/make-admin-vault.js');
  process.exit(1);
}

let pass = (process.env.ADMIN_PASS || '').trim();
let auto = false;
if (!pass) {
  // 自动生成 4×4 强密码（去掉易混字符 I O 0 1，约 96 bit 熵）
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = crypto.randomBytes(16);
  pass = Array.from({ length: 4 }, (_, g) =>
    Array.from({ length: 4 }, (_, i) => ABC[rnd[g * 4 + i] % ABC.length]).join('')
  ).join('-');
  auto = true;
}
if (pass.length < 8) {
  console.error('✗ 密码太短：这个密码保护着仓库写权限，请至少 12 位混合字符。');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pass, salt, ITERS, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(token, 'utf8'), cipher.final(), cipher.getAuthTag()]);

// 自检：用相同参数能解回原文才落盘
const dkey = crypto.pbkdf2Sync(pass, salt, ITERS, 32, 'sha256');
const d = crypto.createDecipheriv('aes-256-gcm', dkey, iv);
d.setAuthTag(ct.subarray(ct.length - 16));
const round = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8');
if (round !== token) {
  console.error('✗ 自检失败：加解密不一致，未写入任何文件');
  process.exit(1);
}

fs.writeFileSync(OUT,
  `/* 后台内置密钥（AES-256-GCM 密文，由后台密码派生）。改密码/换令牌：运行 tools/make-admin-vault.js */\n` +
  `window.VAULT={v:1,iters:${ITERS},salt:"${salt.toString('base64')}",iv:"${iv.toString('base64')}",ct:"${ct.toString('base64')}"};\n`);

console.log('✅ 已生成 source/admin/secret.js（只含密文，不含令牌明文，已通过解密自检）');
if (auto) console.log('🔑 本次后台密码：' + pass);
console.log('记得提交推送：git add source/admin/secret.js && git commit && git push');
