# GitHub Pages 部署指南

## 问题修复总结

### 原问题
- 导出 Excel 功能指向 `/api/export.csv` 后端 API
- GitHub Pages 是静态网站，无法运行后端服务
- 导致 404 错误，无法导出表格

### 解决方案
1. ✅ 将导出链接从 API 改为客户端 JavaScript 实现
2. ✅ 添加 `exportToExcel()` 函数直接导出任务数据为 CSV 文件
3. ✅ 创建 `.nojekyll` 文件确保 GitHub 正确处理

## 部署步骤

### 第一步：提交代码到 Git
```bash
cd /Users/sunzecheng/Desktop/worklist2.0
git add .
git commit -m "Fix: Replace API export with client-side Excel export"
git push origin main
```

### 第二步：验证 GitHub Pages 设置
1. 访问 https://github.com/sszc0918/fuguiyishengworklist
2. 进入 Settings → Pages
3. 确保：
   - Source 设置为 "Deploy from a branch"
   - Branch 选择 "main" (或你推送的分支)
   - Folder 选择 "/ (root)"
4. 保存后等待部署完成（通常 1-2 分钟）

### 第三步：测试应用
- 访问 https://sszc0918.github.io/fuguiyishengworklist/
- 确保页面正常加载
- 点击 "Export Excel" 按钮测试导出功能

## 导出功能说明

**导出的内容包括：**
- Task ID
- 任务标题
- 部门
- 品牌
- 任务类型
- 优先级
- 开始日期
- 截止日期
- 备注
- 状态（已完成/已归档/活跃）

**导出文件名格式：** `tasks_YYYY-MM-DD.csv`

## 常见问题

### Q: 页面仍显示 404
**A:** 
1. 清除浏览器缓存 (Cmd+Shift+Delete)
2. 检查 GitHub Pages 部署状态：
   - 访问仓库的 Actions 标签
   - 查看最新的部署日志
3. 等待 GitHub 完成部署（最长可能需要 5 分钟）

### Q: 导出时没有数据
**A:**
1. 确保已加载任务数据（Firebase 需要正确配置）
2. 检查浏览器控制台 (F12) 查看错误信息
3. 如果 Firebase 离线，应用会显示离线提示

### Q: 导出的文件打不开
**A:**
- 确保用正确的应用打开 CSV 文件
- 用 Excel、Google Sheets 或文本编辑器都可以打开
- 如果在 Excel 中乱码，改为 UTF-8 编码打开

## 后续改进建议

1. **增加 Excel 格式支持** - 生成 .xlsx 文件而不仅是 CSV
2. **自定义导出范围** - 按日期、部门、状态等过滤导出
3. **增加导入功能** - 从 CSV 导入任务
4. **模板导出** - 添加格式化、颜色、公式等

