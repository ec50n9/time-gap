# time-gap

极简时间差与下班倒计时工具。

> 现在距离 **明天 08:30** 还有 **14:32:07**。

## 特性

- 选一个目标时间，看现在到它还有多久
- 「时间凑整」按 15 / 30 / 60 分钟取整，并提示稍微提前或推迟到几点结束
- 自动判断今天/明天，也可手动强制在今天、明天、后天
- 长按倒计时复制到剪贴板
- 设置持久化在 localStorage，刷新即恢复

## 开发

依赖 [Bun](https://bun.sh)。

```bash
bun install
bun run dev       # 本地开发，端口 3000
bun run build     # 生产构建
bun run preview   # 预览构建产物
bun run lint      # 类型检查
```

## 部署

`main` 分支推送后由 GitHub Actions 自动部署到 GitHub Pages，访问路径前缀为 `/time-gap/`（见 `vite.config.ts`）。

## 技术栈

React 19 · Vite 6 · Tailwind CSS v4 · Motion · TypeScript
