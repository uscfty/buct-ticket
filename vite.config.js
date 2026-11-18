import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：构建产物可以放在任意子目录（例如 GitHub Pages 的 /仓库名/）
  base: './',
  // public 中的文件保留原文件名，供静态截图等固定链接使用
  publicDir: "public",
  build: {
    // 资源一律输出为独立文件，不内联成 base64
    assetsInlineLimit: 0,
    // 兼容较旧的 iOS Safari
    target: ['es2019', 'safari13'],
  },
});
