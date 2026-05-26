# PWA 配置说明 - Firebase 离线支持

## 🔧 已修复的核心问题

### 1. ✅ manifest.json 独立化
**问题**：原来 manifest 是内联 base64，无法正确缓存
**解决**：
- 分离为独立文件 `manifest.json`
- 添加 `scope: "./"` 明确作用域
- 修改 `start_url: "./index.html"` 使用相对路径（GitHub Pages 兼容）

### 2. ✅ Service Worker 创建
**问题**：没有 SW，无法离线缓存和同步
**解决**：创建 `sw.js` 实现：
- **预缓存策略**：首次加载时缓存核心资源
- **Firebase 优先网络策略**：Firebase API 优先走网络，失败时使用缓存
- **本地资源缓存优先**：静态资源优先用缓存，加快启动
- **IndexedDB 支持**：为 Firebase 离线数据暂存做准备

### 3. ✅ index.html 现代化
**修改项**：
- 替换内联 manifest 为 `<link rel="manifest" href="./manifest.json">`
- 添加 iOS PWA 元标签：`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`
- 在文件末尾添加 Service Worker 注册代码
- 监听在线/离线事件

## 📱 部署流程（GitHub Pages）

### 第一步：提交到 GitHub
```bash
cd /Users/sunzecheng/Desktop/worklist2.0
git init
git add .
git commit -m "PWA 完整配置：manifest、Service Worker、离线支持"
git remote add origin https://github.com/YOUR_USERNAME/worklist2.0.git
git branch -M main
git push -u origin main
```

### 第二步：启用 GitHub Pages
1. 进入仓库 Settings
2. 找到 Pages
3. 选择 Deploy from a branch
4. 选择 main 分支，/root 目录

### 第三步：访问和安装
1. 打开 `https://your-username.github.io/worklist2.0/`
2. 浏览器地址栏点击"安装"或"添加到主屏"
3. 确保离线时仍然可以使用

## 🐛 常见问题排查

### Q1: 安装后显示"无法连接到服务器"
**原因**：Service Worker 作用域错误或资源路径错误
**检查**：
```javascript
// 在浏览器控制台运行
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('SW 注册信息:', regs);
  regs.forEach(reg => console.log('Scope:', reg.scope));
});
```

### Q2: 离线时 Firebase 数据无法同步
**原因**：这是正常的！Firebase 需要网络连接
**解决方案**：
1. 使用 Firebase 提供的离线持久化
2. 在主页面中添加：
```javascript
firebase.firestore().enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('离线持久化不可用');
    } else if (err.code == 'unimplemented') {
      console.log('浏览器不支持');
    }
  });
```

### Q3: 更新后旧版本仍在运行
**解决**：Service Worker 会自动检测更新，但需要手动触发：
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.controller?.postMessage({
    type: 'SKIP_WAITING'
  });
  // 刷新页面
  window.location.reload();
}
```

## 📊 离线工作流程

```
用户操作
  ↓
本地 IndexedDB 存储 ← Service Worker 拦截请求
  ↓
Firebase (在线时同步)
  ↓
数据持久化
```

## 🔐 安全建议

1. **HTTPS 必须**：PWA 只在 HTTPS 下运行（localhost 除外）
2. **origin 验证**：Firebase 规则检查请求来源
3. **缓存版本**：修改 `sw.js` 中的 `CACHE_VERSION` 强制清除旧缓存

## 📚 测试清单

- [ ] 在线访问应用正常
- [ ] 应用可以添加到主屏
- [ ] 离线时应用可打开
- [ ] Service Worker 已注册（F12 → Application → Service Workers）
- [ ] 缓存正常（F12 → Application → Cache Storage）
- [ ] IndexedDB 有数据（F12 → Application → IndexedDB）
- [ ] 返回在线时数据同步

---

**最后一点**：真正的离线 Firebase 需要：
- Firebase 9+ SDK
- 启用 Firestore 离线持久化
- Service Worker 做资源缓存
- PWA 做应用容器

这三层缺一不可！
