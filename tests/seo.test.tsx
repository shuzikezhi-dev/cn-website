import { describe, it, expect, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NewsData, StrapiMedia } from '@/types/strapi';
import home from '../../content-seed/content/home.json';
import huaqiao from '../../content-seed/content/huaqiao.json';
import services from '../../content-seed/content/services.json';
import industry from '../../content-seed/content/industry.json';
import resources from '../../content-seed/content/resources.json';
import alliance from '../../content-seed/content/alliance.json';
import government from '../../content-seed/content/government.json';
import insightsNews from '../../content-seed/content/insights.json';
import whitepaper from '../../content-seed/content/whitepaper.json';

/**
 * 09 号工单主测试缝：SEO 生成层（lib/seo.ts + app/sitemap.ts + app/robots.ts
 * + 三处 JSON-LD 注入 + favicon 文件约定）。fixture 单一源 =
 * content-seed/content/*.json；站内态 News 因 seed 全外链而自造 fixture。
 * 期望值统一以导出的 SITE_URL 拼（环境无关，断言与实现同基准）。
 */
vi.mock('@/lib/strapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/strapi')>();
  return {
    ...actual,
    getPage: vi.fn(),
    getLandingPage: vi.fn(),
    getNews: vi.fn(),
    getSiteConfigMain: vi.fn(),
    getSiteConfigHq: vi.fn(),
    getMainNavPages: vi.fn(),
    getHqNavPages: vi.fn(),
    getLatestNews: vi.fn(),
    getPublishedPages: vi.fn(),
    getPublishedLandingPages: vi.fn(),
    getPublishedNews: vi.fn(),
  };
});

import {
  SITE_URL,
  absoluteUrl,
  buildMetadata,
  buildHomeJsonLd,
  buildNewsArticleJsonLd,
  buildSitemapEntries,
  pagePath,
  resolveOgImageUrl,
} from '@/lib/seo';

const mainOg = { url: '/uploads/china-global-network.png', mime: 'image/png' } as StrapiMedia;
const hqOg = { url: '/uploads/huaqiao-intro.png', mime: 'image/png' } as StrapiMedia;
const pageOg = { url: '/uploads/page-specific.png', mime: 'image/png' } as StrapiMedia;

/** Next Metadata 的 openGraph/twitter 是判别联合，测试侧按需收窄取值 */
type OgLike = {
  type?: string;
  locale?: string;
  siteName?: string;
  url?: string;
  title?: string;
  description?: string;
  images?: { url: string }[];
};
const ogOf = (meta: { openGraph?: unknown }) => meta.openGraph as OgLike;
const imagesOf = (meta: { openGraph?: unknown }) => ogOf(meta).images ?? [];
const twImagesOf = (meta: { twitter?: unknown }) =>
  (meta.twitter as { images?: string[] }).images ?? [];

/** sitemap 投影 fixture：12 页（7 main + 5 hq）+ 白皮书 landing + 3 外链 news */
const sitemapPages = [
  ...[home, services, industry, resources, alliance, government, insightsNews].flatMap((s) =>
    s.pages.map((p) => ({
      slug: p.slug,
      site: p.site as 'main' | 'hq',
      publishedAt: '2026-09-01T00:00:00.000Z',
    })),
  ),
  ...huaqiao.pages.map((p) => ({
    slug: p.slug,
    site: 'hq' as const,
    publishedAt: '2026-09-02T00:00:00.000Z',
  })),
];
const sitemapLandings = [
  {
    slug: whitepaper.landingPages[0].slug,
    site: whitepaper.landingPages[0].site as 'main' | 'hq',
    publishedAt: '2026-09-03T00:00:00.000Z',
  },
];
const sitemapNews = [
  ...insightsNews.news.map((n) => ({
    slug: n.slug,
    externalUrl: n.externalUrl ?? null,
    publishDate: n.publishDate ?? null,
  })),
  { slug: 'internal-news', externalUrl: null, publishDate: '2026-05-01T00:00:00.000Z' },
];

describe('canonical / og:url 自动生成（干净 URL 自引用绝对地址）', () => {
  it('根路径拼站点根、内页拼路径（无尾斜杠、无 .html）', () => {
    expect(absoluteUrl('/')).toBe(`${SITE_URL}/`);
    expect(absoluteUrl('/services')).toBe(`${SITE_URL}/services`);
    expect(absoluteUrl('/huaqiao/cloud')).toBe(`${SITE_URL}/huaqiao/cloud`);
    expect(absoluteUrl('/news/slug')).toBe(`${SITE_URL}/news/slug`);
  });

  it('buildMetadata 产出 canonical 与 og:url 同值自引用 + og/twitter 全要素', () => {
    const meta = buildMetadata({
      path: '/huaqiao/cloud',
      title: '云平台｜云主机 · 带宽 · 网络标准服务包｜华侨数港',
      description: '云空间描述',
      defaultOgImage: hqOg,
    });
    const url = `${SITE_URL}/huaqiao/cloud`;
    const og = ogOf(meta);
    expect(meta.alternates?.canonical).toBe(url);
    expect(og.url).toBe(url);
    expect(og.type).toBe('website');
    expect(og.locale).toBe('zh_CN');
    expect(og.siteName).toBe('算力海洋');
    expect(og.title).toBe('云平台｜云主机 · 带宽 · 网络标准服务包｜华侨数港');
    expect(og.description).toBe('云空间描述');
    expect((meta.twitter as { card?: string }).card).toBe('summary_large_image');
    expect((meta.twitter as { title?: string }).title).toBe('云平台｜云主机 · 带宽 · 网络标准服务包｜华侨数港');
  });

  it('noindex 透传：置位输出 robots noindex，缺省不输出 robots', () => {
    const noindex = buildMetadata({ path: '/', title: 't', noindex: true });
    expect(noindex.robots).toEqual({ index: false, follow: false });
    const normal = buildMetadata({ path: '/', title: 't' });
    expect(normal.robots).toBeUndefined();
  });
});

describe('og:image 回退链（页面配图 → 站点默认图 main/hq 各一张）', () => {
  it('页面配图优先，绝对 URL（Strapi 相对路径拼 STRAPI_URL）', () => {
    const url = resolveOgImageUrl(pageOg, mainOg);
    expect(url).toContain('/uploads/page-specific.png');
    const meta = buildMetadata({ path: '/services', title: 't', ogImage: pageOg, defaultOgImage: mainOg });
    expect(imagesOf(meta)[0].url).toBe(url);
    expect(twImagesOf(meta)[0]).toBe(url);
  });

  it('未配页面图回退站点默认图（main 与 hq 两张各自生效）', () => {
    const main = buildMetadata({ path: '/services', title: 't', defaultOgImage: mainOg });
    expect(imagesOf(main)[0].url).toContain('/uploads/china-global-network.png');
    const hq = buildMetadata({ path: '/huaqiao', title: 't', defaultOgImage: hqOg });
    expect(imagesOf(hq)[0].url).toContain('/uploads/huaqiao-intro.png');
  });

  it('两级皆空不输出 images（不造假 URL）', () => {
    const meta = buildMetadata({ path: '/', title: 't' });
    expect(ogOf(meta).images).toBeUndefined();
    expect(twImagesOf(meta)).toEqual([]);
  });
});

describe('sitemap（11 页 + hq 前缀 + 白皮书不在 + 站内态规则 + lastmod 语义）', () => {
  const entries = buildSitemapEntries(sitemapPages, sitemapLandings, sitemapNews);
  const urls = entries.map((e) => e.url);

  it('收录 11 页：main 7 页直根（home 即 /）+ hq 4 页带 /huaqiao 前缀（门户废弃不收 /huaqiao）', () => {
    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/`,
        `${SITE_URL}/services`,
        `${SITE_URL}/industry`,
        `${SITE_URL}/resources`,
        `${SITE_URL}/insights`,
        `${SITE_URL}/alliance`,
        `${SITE_URL}/government`,
        `${SITE_URL}/huaqiao/cloud`,
        `${SITE_URL}/huaqiao/enterprise`,
        `${SITE_URL}/huaqiao/global`,
        `${SITE_URL}/huaqiao/ecosystem`,
      ]),
    );
    // 落地页废弃（.scratch/huaqiao-redirect/）：/huaqiao 301 → enterprise，
    // sitemap 不列重定向目标
    expect(urls).not.toContain(`${SITE_URL}/huaqiao`);
    expect(entries).toHaveLength(12); // 11 页 + 1 条站内态 news
  });

  it('白皮书页不进 sitemap（url-plan §4：外投落地页跟随现网行为）', () => {
    expect(urls.some((u) => u.includes('whitepaper'))).toBe(false);
  });

  it('3 条外链态 news 全部排除；站内态 news 收录为 /news/[slug]', () => {
    for (const n of insightsNews.news) {
      expect(urls.some((u) => u.endsWith(`/news/${n.slug}`))).toBe(false);
    }
    expect(urls).toContain(`${SITE_URL}/news/internal-news`);
  });

  it('lastmod：Page 用 publishedAt、News 用 publishDate（内容日期语义）', () => {
    const page = entries.find((e) => e.url === `${SITE_URL}/services`);
    expect(page?.lastModified).toBe('2026-09-01T00:00:00.000Z');
    const hq = entries.find((e) => e.url === `${SITE_URL}/huaqiao/cloud`);
    expect(hq?.lastModified).toBe('2026-09-02T00:00:00.000Z');
    const news = entries.find((e) => e.url === `${SITE_URL}/news/internal-news`);
    expect(news?.lastModified).toBe('2026-05-01T00:00:00.000Z');
  });

  it('pagePath：home 双站映射站点根，其余按站加前缀', () => {
    expect(pagePath('main', 'home')).toBe('/');
    expect(pagePath('main', 'services')).toBe('/services');
    expect(pagePath('hq', 'home')).toBe('/huaqiao');
    expect(pagePath('hq', 'cloud')).toBe('/huaqiao/cloud');
  });

  it('app/sitemap.ts 路由：三路取数后走同一拼装管道 + /news 常驻列表页', async () => {
    const { getPublishedPages, getPublishedLandingPages, getPublishedNews } = await import(
      '@/lib/strapi'
    );
    vi.mocked(getPublishedPages).mockResolvedValue(sitemapPages);
    vi.mocked(getPublishedLandingPages).mockResolvedValue(sitemapLandings);
    vi.mocked(getPublishedNews).mockResolvedValue(sitemapNews);
    const { default: sitemap } = await import('@/app/sitemap');
    const out = await sitemap();
    // 2026-09-23 QA T-105：/news 常驻列表页固定收录（推翻旧「不进」决策）；
    // 2026-09-24：/insights/all 洞察全量列表页并列常驻
    expect(out.map((e) => e.url)).toEqual([
      `${SITE_URL}/insights/all`,
      `${SITE_URL}/news`,
      ...urls,
    ]);
  });
});

describe('robots（Allow / + Disallow /api/ + sitemap 绝对 URL）', () => {
  it('规则与 sitemap 指引齐备', async () => {
    const { default: robots } = await import('@/app/robots');
    const out = robots();
    expect(out.rules).toEqual([{ userAgent: '*', allow: '/', disallow: ['/api/'] }]);
    expect(out.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe('JSON-LD 两段结构', () => {
  it('jsonLdScript 转义：<（含 </script> 序列）不逃出 script 标签体', async () => {
    const { jsonLdScript } = await import('@/lib/seo');
    const out = jsonLdScript({ name: 'x</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<img');
    // JSON 合法性保持：转义是 JSON 字符串内的 <，parse 还原原值
    expect(JSON.parse(out).name).toBe('x</script><img src=x onerror=alert(1)>');
  });

  it('首页 @graph：Organization（site-config-main 数据）+ WebSite（publisher 回指）', () => {
    const config = {
      ...home.siteConfigMain,
      contactEmails: [{ email: 'partner@suanlihaiyang.com' }],
    } as unknown as Parameters<typeof buildHomeJsonLd>[0];
    const ld = buildHomeJsonLd(config) as { '@graph': Record<string, unknown>[] };
    const [org, website] = ld['@graph'];
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('算力海洋');
    expect(org.alternateName).toBe('Token Ocean');
    expect(org.url).toBe(`${SITE_URL}/`);
    expect(org.logo).toBe(`${SITE_URL}/logo/logo_cn_en.svg`);
    expect(org.email).toBe('partner@suanlihaiyang.com');
    expect(org.description).toBe('中国算力与AI应用出海服务平台');
    expect(website['@type']).toBe('WebSite');
    expect((website.publisher as Record<string, unknown>)['@id']).toBe(org['@id']);
  });

  it('News 详情 Article：title/excerpt/cover/date 四要素 + 自引用', () => {
    const news = {
      id: 99,
      documentId: 'd',
      title: '站内新闻测试',
      slug: 'internal-news',
      excerpt: '站内新闻摘要',
      cover: { url: '/uploads/cover.png', mime: 'image/png' } as StrapiMedia,
      externalUrl: null,
      publishDate: '2026-05-01T00:00:00.000Z',
    } as NewsData;
    const ld = buildNewsArticleJsonLd(news);
    expect(ld['@type']).toBe('Article');
    expect(ld.headline).toBe('站内新闻测试');
    expect(ld.description).toBe('站内新闻摘要');
    expect(ld.image).toContain('/uploads/cover.png');
    expect(ld.datePublished).toBe('2026-05-01T00:00:00.000Z');
    expect(ld.mainEntityOfPage).toBe(`${SITE_URL}/news/internal-news`);
  });

  it('页面渲染注入：首页 @graph / 新闻 Article', async () => {
    const strapi = await import('@/lib/strapi');
    const readLd = () => {
      const el = document.querySelector('script[type="application/ld+json"]');
      return el ? JSON.parse(el.textContent ?? '{}') : null;
    };

    vi.mocked(strapi.getPage).mockResolvedValue(home.pages[0] as never);
    vi.mocked(strapi.getSiteConfigMain).mockResolvedValue({
      ...home.siteConfigMain,
      contactEmails: [{ email: 'partner@suanlihaiyang.com' }],
    } as never);
    vi.mocked(strapi.getMainNavPages).mockResolvedValue([]);
    const { default: HomePage } = await import('@/app/page');
    render(await HomePage());
    const homeLd = readLd();
    expect(homeLd['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual([
      'Organization',
      'WebSite',
    ]);

    cleanup(); // 同一用例内连渲，逐页清场避免 JSON-LD 节点串扰
    vi.mocked(strapi.getNews).mockResolvedValue({
      id: 99,
      documentId: 'd',
      title: '站内新闻测试',
      slug: 'internal-news',
      excerpt: '站内新闻摘要',
      body: '<p>正文。</p>',
      externalUrl: null,
      publishDate: '2026-05-01T00:00:00.000Z',
    } as never);
    const { default: NewsDetailPage } = await import('@/app/news/[slug]/page');
    render(await NewsDetailPage({ params: Promise.resolve({ slug: 'internal-news' }) }));
    expect(readLd()?.['@type']).toBe('Article');
  });

  it('generateMetadata 集成：/whitepaper 全套（description seed 已配 + canonical + OG 回退）', async () => {
    const strapi = await import('@/lib/strapi');
    vi.mocked(strapi.getLandingPage).mockResolvedValue(whitepaper.landingPages[0] as never);
    vi.mocked(strapi.getSiteConfigMain).mockResolvedValue({
      ogImageDefault: mainOg,
    } as never);
    const { generateMetadata } = await import('@/app/whitepaper/page');
    const meta = await generateMetadata();
    expect(meta.description).toBe(whitepaper.landingPages[0].seo.description);
    expect(meta.alternates?.canonical).toBe(`${SITE_URL}/whitepaper`);
    expect(imagesOf(meta)[0].url).toContain('/uploads/china-global-network.png');
  });
});

describe('favicon 组（Next 15 文件约定：icon.svg 主 + ICO/苹果兜底）', () => {
  // 2026-09-20 方向反转（用户拍板照抄 v0.3）：icon.svg 用 logo_icon.svg
  // （内嵌位图已降采样 256px + 256 色量化至 16KB，浏览器自缩放渲染），
  // 注入的 link 带内容 hash 破缓存；
  // favicon.ico 留作 Safari 桌面兜底（不支持 SVG favicon）、apple-icon 留作
  // iOS 主屏。icon2.png 删除（64px 档职责由 SVG 覆盖）。
  // 体积守护（icon.svg <1MB、ICO/PNG <30KB）见 tests/asset-budget.test.ts
  it('app/ 组齐：icon.svg / favicon.ico / apple-icon.png，icon2.png 不回流', () => {
    const appDir = path.resolve(__dirname, '../src/app');
    for (const f of ['icon.svg', 'favicon.ico', 'apple-icon.png']) {
      expect(existsSync(path.join(appDir, f)), f).toBe(true);
    }
    expect(existsSync(path.join(appDir, 'icon2.png'))).toBe(false);
  });
});
