#!/usr/bin/env node
/**
 * 华侨数港新版二级页单文件导入（/huaqiao/cloud|enterprise|global，暂不走 CMS）。
 *
 * 用法：node scripts/build-hq-static-pages.mjs <slug>=<原始单文件.html> [...]
 *
 * 输入为设计侧导出的自包含 HTML（互链用 hq-<name>.html 相对路径、主视觉为
 * base64 内嵌背景图）。脚本做以下改写后生成构建期内嵌字符串模块：
 *  1. base64 主视觉 → /huaqiao/<slug>-hero.jpg（图片本体由导入流程另行压缩
 *     至 web/public/huaqiao/，不进 JS 包）
 *  2. href="hq-<name>.html" → /huaqiao/<name>（站内干净路径，与 url-plan 一致）；
 *     互引 hero 的 assets/hero-*.jpg 相对路径 → /huaqiao/<name>-hero.jpg
 *  3. hq-emblem 字符徽标（云/侨/球）→ /logo/logo_icon.svg 方标 logo
 *     （44×44 圆角；2026-09-22 起与门户页头统一用方标，非横版）
 *  4. 回主站绝对地址（official-bar / 页脚「关于」区）→ 站内路径 /
 *  5. 导航统一 5 项（首页/企业落地服务/云平台/海外服务/生态合作，与门户
 *     CMS site=hq 页面集 navOrder 派生一致，2026-09-22；active 按当前页）
 *  6. 产物写 src/lib/hq-static/<slug>.ts（JSON 转义字符串，route.ts 直接 import）
 *
 * 重复导入即覆盖更新（同名 slug 幂等）；slug 必须属于 HQ_SLUGS 白名单。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(webDir, 'src', 'lib', 'hq-static');
const HQ_SLUGS = ['cloud', 'enterprise', 'global'];

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('用法: node scripts/build-hq-static-pages.mjs <slug>=<原始单文件.html> [...]');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const arg of args) {
  const eq = arg.indexOf('=');
  if (eq < 0) throw new Error(`参数格式应为 <slug>=<文件>，收到: ${arg}`);
  const slug = arg.slice(0, eq);
  const input = arg.slice(eq + 1);
  if (!HQ_SLUGS.includes(slug)) throw new Error(`slug "${slug}" 不在白名单 ${HQ_SLUGS.join('/')} 内`);

  let html = readFileSync(input, 'utf8');

  // 1. 内嵌 base64 主视觉 → public 静态图（图片本体另行压缩存放）
  const dataUri = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g;
  if (!dataUri.test(html)) throw new Error(`${slug}: 未找到内嵌 base64 图片，确认输入为单文件版导出`);
  html = html.replace(dataUri, `/huaqiao/${slug}-hero.jpg`);

  // 2. 页间互链相对路径 → 站内干净路径；互引 hero 的 assets 相对路径同映射
  html = html.replace(/href="hq-([a-z]+)\.html"/g, (_, name) => {
    if (!HQ_SLUGS.includes(name)) throw new Error(`${slug}: 互链 hq-${name}.html 不在白名单内`);
    return `href="/huaqiao/${name}"`;
  });
  const HERO_MAP = {
    'assets/hero-ent-port.jpg': '/huaqiao/enterprise-hero.jpg',
    'assets/hero-cloud-dc.jpg': '/huaqiao/cloud-hero.jpg',
    'assets/hero-global-net.jpg': '/huaqiao/global-hero.jpg',
  };
  for (const [from, to] of Object.entries(HERO_MAP)) html = html.split(from).join(to);

  // 3. hq-emblem 字符徽标（云/侨/球）→ 方标 logo + 样式适配
  //    （logo_icon.svg 1200×1164 方图 → 44×44 圆角；渐变方块样式改纯图展示）
  html = html.replace(
    /<span class="hq-emblem">[^<]*<\/span>/g,
    '<img class="hq-emblem" src="/logo/logo_icon.svg" alt="算力海洋" width="44" height="44">',
  );
  html = html.replace(
    '.hq-emblem{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--navy-2));color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px;box-shadow:0 6px 14px rgba(20,125,240,.35)}',
    '.hq-emblem{height:44px;width:44px;display:block;flex:0 0 auto;border-radius:10px}',
  );

  // 4. 回主站绝对地址 → 站内路径 /（official-bar 带 ↗ 与页脚「关于」区两处）
  html = html.replace(
    /<a href="https?:\/\/[^"]*" target="_blank" rel="noopener">算力海洋主站 ↗<\/a>/,
    '<a href="/">算力海洋主站</a>',
  );
  html = html.replace(
    /<a href="https:\/\/suanlihaiyang\.com\/?" target="_blank" rel="noopener">算力海洋主站<\/a>/,
    '<a href="/">算力海洋主站</a>',
  );

  // 5. 导航统一 4 项（与门户 CMS site=hq 页面集 navOrder 派生一致，2026-09-22；
  //    2026-09-28 落地页废弃去「首页」项——与 getHqNavPages 前端过滤同步）
  const NAV_ITEMS = [
    ['/huaqiao/enterprise', '企业落地服务', 'enterprise'],
    ['/huaqiao/cloud', '云平台', 'cloud'],
    ['/huaqiao/global', '海外服务', 'global'],
    ['/huaqiao/ecosystem', '生态合作', 'ecosystem'],
  ];
  html = html.replace(
    /<nav class="hq-nav">[\s\S]*?<\/nav>/,
    `      <nav class="hq-nav">\n` +
      NAV_ITEMS.map(
        ([url, title, s]) =>
          `        <a${s === slug ? ' class="active"' : ''} href="${url}">${title}</a>`,
      ).join('\n') +
      `\n      </nav>`,
  );

  // 6. head 注入 favicon + canonical + OG/Twitter（QA T-108，2026-09-23）：
  //    URL 根用 __SITE_URL__ 占位，route.ts 构建期 replaceAll 为 lib/site-url 的
  //    SITE_URL——域名配置与全站同源（测试站/正式站免重导出）。
  //    favicon link（2026-09-24）：原始导出 head 无 icon 声明，浏览器硬导航
  //    进页后须盲探 /favicon.ico，期间标签页显示默认占位图标
  const titleM = html.match(/<title>([^<]+)<\/title>/);
  const descM = html.match(/<meta name="description" content="([^"]*)" \/>/);
  if (!titleM || !descM) throw new Error(`${slug}: title/description 缺失，head 注入失败`);
  html = html.replace(
    /<\/title>/,
    `</title>\n` +
      `<link rel="icon" href="/favicon.ico" />\n` +
      `<link rel="canonical" href="__SITE_URL__/huaqiao/${slug}" />\n` +
      `<meta property="og:type" content="website" />\n` +
      `<meta property="og:locale" content="zh_CN" />\n` +
      `<meta property="og:site_name" content="算力海洋" />\n` +
      `<meta property="og:title" content="${titleM[1]}" />\n` +
      `<meta property="og:description" content="${descM[1]}" />\n` +
      `<meta property="og:url" content="__SITE_URL__/huaqiao/${slug}" />\n` +
      `<meta name="twitter:card" content="summary_large_image" />\n` +
      `<meta name="twitter:title" content="${titleM[1]}" />\n` +
      `<meta name="twitter:description" content="${descM[1]}" />`,
  );

  // 7. 残留检查：不再有 base64、.html/assets 相对链、字符徽标与回主站绝对地址
  if (/data:image\/[a-z+]+;base64,/.test(html)) throw new Error(`${slug}: base64 清理不彻底`);
  if (/href="[^"]*\.html"/.test(html)) throw new Error(`${slug}: 仍有 .html 相对链残留`);
  if (/assets\//.test(html)) throw new Error(`${slug}: 仍有 assets/ 相对路径残留`);
  if (/<span class="hq-emblem">/.test(html)) throw new Error(`${slug}: hq-emblem 字符徽标替换失败`);
  if (/https?:\/\/suanlihaiyang\.com/.test(html)) throw new Error(`${slug}: 仍有回主站绝对地址残留`);

  const symbol = `HQ_${slug.replace(/([A-Z])/g, '_$1').toUpperCase()}_PAGE_HTML`;
  const banner = `/**
 * 华侨数港 /huaqiao/${slug} 静态单文件页本体（设计侧导出，暂不走 CMS）。
 * 由 scripts/build-hq-static-pages.mjs 生成——勿手改；主视觉在
 * /huaqiao/${slug}-hero.jpg（web/public/huaqiao/），互链已改写站内干净路径，
 * 页头品牌槽为 /logo/logo_icon.svg 方标，导航统一 4 项（与门户 CMS 派生一致，
 * 2026-09-28 落地页废弃去「首页」），official-bar 回主站为站内路径 /。
 */
export const ${symbol} = `;

  const outFile = path.join(outDir, `${slug}.ts`);
  writeFileSync(outFile, banner + JSON.stringify(html) + ';\n', 'utf8');
  console.log(`[hq-static] ${slug}: ${(html.length / 1024).toFixed(1)}KB HTML → ${path.relative(webDir, outFile)}`);
}
