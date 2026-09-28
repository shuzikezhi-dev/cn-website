// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { GET as GET_CLOUD } from '@/app/huaqiao/cloud/route';
import { GET as GET_ENTERPRISE } from '@/app/huaqiao/enterprise/route';
import { GET as GET_GLOBAL } from '@/app/huaqiao/global/route';

/**
 * 华侨数港新版二级页（/huaqiao/cloud|enterprise|global 静态单文件页，暂不走 CMS）：
 * 设计侧导出的单文件 HTML 构建期内嵌（scripts/build-hq-static-pages.mjs 生成），
 * 静态段 route 遮蔽同名 [slug] CMS 页。断言：
 * 文档响应头正确、base64 主视觉已外置为 public 图、互链改写站内干净路径、
 * 回主站链接为站内 /（2026-09-22 与门户统一，绝对地址不残留）、外部表单原样；
 * 导航 4 项与门户 CMS 派生一致（2026-09-28 落地页废弃去「首页」）+ 页头品牌槽
 * 为 /logo/logo_icon.svg 方标。
 */
const PAGES = [
  {
    slug: 'cloud',
    GET: GET_CLOUD,
    titlePrefix: '云平台｜',
    others: ['enterprise', 'global'],
  },
  {
    slug: 'enterprise',
    GET: GET_ENTERPRISE,
    titlePrefix: '企业落地服务｜',
    others: ['cloud', 'global'],
  },
  {
    slug: 'global',
    GET: GET_GLOBAL,
    titlePrefix: '海外服务｜',
    others: ['cloud', 'enterprise'],
  },
] as const;

describe('/huaqiao 新版静态二级页（单文件内嵌，暂不走 CMS）', () => {
  for (const { slug, GET, titlePrefix, others } of PAGES) {
    it(`/huaqiao/${slug}：text/html 文档 + 标题在场 + 主视觉外置 public 图`, async () => {
      const res = GET();
      expect(res).toBeInstanceOf(Response);
      expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
      const html = await res.text();
      expect(html).toContain(`<title>${titlePrefix}`);
      expect(html).toContain('｜华侨数港</title>');
      // head 带 favicon link（2026-09-24）：无 icon link 时浏览器标签页回退
      // 默认图标（硬导航后需盲探 /favicon.ico，期间显示占位图标）
      expect(html).toContain('<link rel="icon" href="/favicon.ico" />');
      // 主视觉引用 public 静态图（构建期已从 base64 外置）
      expect(html).toContain(`url('/huaqiao/${slug}-hero.jpg')`);
      // 1.4MB base64 位图不回流（防再次导入未替换 data URI）
      expect(html.includes('data:image')).toBe(false);
    });

    it(`/huaqiao/${slug}：互链改写站内干净路径（hq-*.html 相对链不残留）`, async () => {
      const html = await GET().text();
      expect(html.match(/href="hq-[a-z]+\.html"/)).toBeNull();
      for (const other of others) {
        expect(html).toContain(`href="/huaqiao/${other}"`);
      }
      // 回主站链接改站内路径 /（2026-09-22 与门户统一），绝对地址不残留
      expect(html).toContain('<a href="/">算力海洋主站</a>');
      expect(html.includes('suanlihaiyang.com')).toBe(false);
      // 外部咨询表单保持原样
      expect(html).toContain('https://kezhishuzi.cn/share/');
    });

    it(`/huaqiao/${slug}：导航 4 项（落地页废弃去「首页」）+ 品牌槽方标 logo_icon`, async () => {
      const html = await GET().text();
      const nav = html.match(/<nav class="hq-nav">[\s\S]*?<\/nav>/)?.[0] ?? '';
      // 导航统一 4 项（企业落地服务/云平台/海外服务/生态合作），active 按当前页
      expect((nav.match(/<a /g) ?? []).length).toBe(4);
      expect(nav).not.toContain('href="/huaqiao"');
      expect(nav).toContain('href="/huaqiao/enterprise"');
      expect(nav).toContain('href="/huaqiao/ecosystem"');
      expect(nav).toContain(`<a class="active" href="/huaqiao/${slug}">`);
      // 品牌槽 = 方标 logo_icon.svg（44×44，2026-09-22 起与门户页头统一）
      expect(html).toContain('src="/logo/logo_icon.svg"');
    });
  }
});
