# 小黄鸡表情

收集各种小黄鸡表情。浏览、搜索、预览和随机挑选请打开网页图库：

**[👉 打开网页图库](https://esrrhs.github.io/xiaohuangji/)**

https://esrrhs.github.io/xiaohuangji/

# 版权

内容收集自网络，如侵权请联系删除。

The content is collected from the Internet, if infringement, please contact me to delete.

# 使用

clone 下载项目后，表情原图在 `data/` 目录，文件名是内容的 MD5。请不要直接改名或删除原图。日常查看请用上面的 [网页图库](https://esrrhs.github.io/xiaohuangji/)，README 不再内嵌表情预览。

# 网页图库

图库是纯静态页面，无第三方库、无后端、无 API。页面里的图片路径仍是原来的 `data/<哈希>.<扩展名>`。

- **搜索**：匹配已标注的中文标题、标签及其别名，也可搜格式（如 `gif`）或完整哈希文件名。哈希文件名本身没有语义，不能靠文件名做中文语义搜索。
- **分类**：全部素材都可按格式（GIF / PNG / JPG）筛选；也可筛选「已标注 / 未标注」，以及已出现的语义标签（多选为或关系）。
- **预览**：点击缩略图查看大图或 GIF。`Esc` 关闭，左右方向键上一张 / 下一张，`Home` / `End` 跳到当前结果的首尾。
- **随机**：在**当前筛选结果**中随机挑选一张并打开预览。
- **其它**：空结果提示、清单加载失败提示、图片懒加载；地址栏会带上当前筛选，便于分享。

当前语义标签已覆盖经实际查看确认的几乎全部图片；仅个别无法确认含义的条目仍为「未标注」。不要根据哈希文件名臆造含义。

# 本地预览

在仓库根目录启动一个静态服务器（直接用浏览器打开 `index.html` 会因 `fetch` 清单而失败）：

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

然后访问 http://127.0.0.1:8765/ 。

# 更新素材和标签

1. 把新表情放进 `data/`，不要改已有文件名。需要统一成 MD5 文件名时，请先备份再审慎使用 `rename.sh`（它会重命名并删除同哈希重复文件）。
2. 在 `gallery/tags.json` 里为**看过并确认**的图片补充中文标签和可选标题。标签必须先出现在该文件的 `vocabulary` 中，可为标签设置 `aliases` 以便搜索。未写入 `items` 的文件会保持未标注；不要给看不清含义的图片硬编标签。
3. 重新生成清单：

```bash
python3 scripts/build_manifest.py
```

4. 跑校验（可选，但提交前建议执行）：

```bash
python3 scripts/check_gallery.py
python3 tests/test_gallery.py
node tests/test_search.js
```

若已在本地启动预览服务，还可以做无界面浏览器测试：

```bash
tests/run_browser_tests.sh 8765
```

# GitHub Pages 部署

图库已发布在 https://esrrhs.github.io/xiaohuangji/ 。向默认分支 `master` 推送后，Pages 会按仓库根目录自动更新。

备选方式是把 Pages Source 设为 GitHub Actions，再手动运行 `.github/workflows/pages.yml`（默认只在 `workflow_dispatch` 触发）。`.github/workflows/gallery-check.yml` 会在推送和 PR 时校验清单、标签和搜索逻辑。

# 我有新表情？

欢迎提 PR，或者 issues。
