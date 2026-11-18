import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：构建产物可以放在任意子目录（例如 GitHub Pages 的 /仓库名/）
  base: './',
  // 所有静态资源都在 ./assets 下并由代码引用，不使用 public 目录
  publicDir: false,
  build: {
    // 资源一律输出为独立文件，不内联成 base64
    assetsInlineLimit: 0,
    // 兼容较旧的 iOS Safari
    target: ['es2019', 'safari13'],
  },
});
