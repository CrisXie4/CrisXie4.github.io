# 六哥的博客（基于 Hexo + Solitude 主题）

个人博客项目，基于 [Hexo](https://hexo.io/) 与 [hexo-theme-solitude](https://github.com/everfu/hexo-theme-solitude) 主题。原站内容已清空，可在此基础搭建自己的博客。

## 本地运行

```bash
npm install        # 安装依赖（本仓库已带 node_modules 可跳过）
npx hexo clean     # 清理缓存
npx hexo server    # 本地预览 http://localhost:4000
```

## 部署（GitHub Pages，推送即上线）

仓库已带 `.github/workflows/pages.yml`：每次 push 到 `main`，GitHub 会自动构建并发布，无需本地构建。

首次上线只需三步：

1. 在 GitHub 新建仓库，名字用 `CrisXie4.github.io`（个人主页式，访问地址 `https://crisxie4.github.io`）
2. 关联并推送：
   ```bash
   git remote add origin https://github.com/CrisXie4/CrisXie4.github.io.git
   git push -u origin main
   ```
3. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**

之后写完文章 `git push` 即自动上线。

> 若想用其他仓库名（如 `blog`），站点会挂在子路径下，需改 `_config.yml`：
> `url: https://crisxie4.github.io/blog` 并新增一行 `root: /blog/`。

## 接手后需要修改的地方（搜索 `TODO` 或 `your-`）

- `_config.yml`：站点标题/作者/描述、`url`（改成你自己的域名）、`deploy.repo`（部署仓库）。
- `_config.solitude.yml`：
  - 头像：已放在 `source/img/avatar.png`（网站路径 `/img/avatar.png`），换头像直接替换这个文件即可。
  - 社交链接：`your-github-id`、`your@email.com` 等。
  - 评论系统：`comment.use` 已置空，部署好自己的 Twikoo/Waline 后再填写。
  - 访问统计（51LA）、Google AdSense 均已移除/关闭，需要时自行接入。
- `source/_data/about.yml`：关于页个人信息（生涯、性格、座右铭等）。
- `source/_data/kit.yml`、`source/_data/tlink.yaml`：视频精选与 AI 导航数据，`tlink.yaml` 中部分图片仍指向原作者图床，建议逐步替换。
- `source/privacy/index.md`：隐私政策按你的实际服务调整。

## 写新文章 / 发随笔

```bash
npx hexo new post "文章标题"   # 长文章：生成到 source/_posts/，编辑后推送
bash note.sh 随笔内容          # 一句话动态：自动加时间戳并推送上线
bash note.sh --dry 随笔内容    # 预览模式，只看不发
# 随笔数据在 source/_data/brevity.yml，想配图/音乐可手动编辑该文件
```
