import type { NextConfig } from 'next';
import { ROBOTS_NOINDEX } from './src/lib/site-url';

const nextConfig: NextConfig = {
  // 测试站防收录（QA T-104）：非正式域名部署（SITE_URL 未指向
  // suanlihaiyang.com）全站加 X-Robots-Tag: noindex——与正式环境隔离收录。
  // X-Robots-Tag 而非 robots.txt Disallow：Disallow 会阻止爬虫读到 noindex
  // 信号，URL 仍可能以外链形式被索引。正式站配 SITE_URL 后本头自动消失。
  ...(ROBOTS_NOINDEX
    ? {
        async headers() {
          return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
        },
      }
    : {}),
  // 华侨数港落地页废弃（.scratch/huaqiao-redirect/）：/huaqiao 301 →
  // /huaqiao/enterprise。放 next.config 而非 nginx：三种部署形态（CF OpenNext /
  // Docker standalone / nginx 反代）唯一通吃的代码位置；statusCode 301 与 nginx
  // legacy map 先例统一（permanent: true 输出 308）。redirects 先于文件系统
  // 路由，遮蔽 huaqiao/page.tsx（门户页已废弃删除）。
  async redirects() {
    return [{ source: '/huaqiao', destination: '/huaqiao/enterprise', statusCode: 301 }];
  },
  // 双部署路径：Docker（10 号工单）需要 standalone 自包含产物；Cloudflare OpenNext
  // 打包用 Next 默认产物、standalone 须关闭——build:cf 脚本注入 DEPLOY_TARGET=cloudflare
  output: process.env.DEPLOY_TARGET === 'cloudflare' ? undefined : 'standalone',
  images: {
    // Strapi 媒体直链（01 票先用 <img>，09/11 票评估 next/image 远程优化）
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '1338' },
      // Cloudflare 路径：Strapi 公网地址（测试环境 nginx 反代）
      { protocol: 'https', hostname: 'top-slhy.fintechquan.cn' },
      // 生产 Strapi 媒体域名
      { protocol: 'https', hostname: 'admin.suanlihaiyang.com' },
    ],
    // CF 分支关图片优化：Workers 跑不了 sharp 原生模块（OpenNext 打包即报
    // No loader is configured for ".node" files）；本站图片均 <img> 直链，零影响
    ...(process.env.DEPLOY_TARGET === 'cloudflare' ? { unoptimized: true } : {}),
  },
};

export default nextConfig;
