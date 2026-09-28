import type { Metadata } from 'next';
import type {
  NewsData,
  SiteConfigHqData,
  SiteConfigMainData,
  StrapiMedia,
} from '@/types/strapi';
import { strapiMediaUrl } from '@/lib/strapi';

/**
 * SEO 生成层（09 号工单，映射表 docs/design/seo-asset-migration.md §2）：
 * canonical / og:url / og 常量 / twitter 卡 / og:image 回退链 / JSON-LD 两段
 * / sitemap 条目全部由代码统一生成，CMS 只存页面级差异（seo 四字段 + 站点默认图）。
 */

/**
 * 站点绝对 URL 根：canonical、og:url、og:image、sitemap、JSON-LD @id 共用。
 * 计算与注入纪律见 lib/site-url.ts（next.config.ts 共用同源，正式站必须
 * 显式注入 SITE_URL=https://suanlihaiyang.com）。
 */
import { SITE_URL } from '@/lib/site-url';
export { SITE_URL };

/** og 全站常量（映射表 §2：不入库，代码写死；v0.3 实测 13 页同值） */
export const OG_SITE_NAME = '算力海洋';
const OG_LOCALE = 'zh_CN';
const TWITTER_CARD = 'summary_large_image';

/** 干净 URL 形态的页面绝对 URL（canonical/og:url 同源同值——自引用） */
export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean === '/' ? `${SITE_URL}/` : `${SITE_URL}${clean}`;
}

/**
 * og:image 解析（回退链：页面配图 → 站点默认图）。
 * - 绝对 URL：媒体走 Strapi uploads（strapiMediaUrl 拼 STRAPI_URL）
 * - 社交双格式（legacy-cleanup-plan §2）：社交卡不认 WebP，og:image 引用
 *   PNG/JPG 版；当前 media library 仅 PNG 原图，后续页内图转 WebP 时
 *   seed 纪律约定 ogImage 字段必须配 PNG 版本（同一图两版进库）
 * - 页面与站点默认都未配：不输出 og:image（极简 head，不造假 URL）
 */
export function resolveOgImageUrl(
  pageImage?: StrapiMedia | null,
  siteDefault?: StrapiMedia | null,
): string {
  return strapiMediaUrl(pageImage) || strapiMediaUrl(siteDefault);
}

export interface BuildMetadataInput {
  /** 页面规范路径（干净 URL，根为 '/'，无尾斜杠） */
  path: string;
  title: string;
  description?: string | null;
  /** 页面级配图（shared.seo.ogImage / News cover） */
  ogImage?: StrapiMedia | null;
  /** 站点默认图（site-config *.ogImageDefault，main/hq 各一张） */
  defaultOgImage?: StrapiMedia | null;
  /** noindex 透传（映射表新增能力，现网未用；专题页/临时页可控） */
  noindex?: boolean | null;
}

/**
 * 页面 metadata 全要素（五个页面路由 + /whitepaper 共用）：
 * title/description + canonical + og:type/locale/site_name/title/description/
 * url/image + twitter:card/title/description/image + robots(noindex)。
 * og:title/og:description 与 title/description 同值（v0.3 现网规律，映射表 §2）。
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const url = absoluteUrl(input.path);
  const ogImage = resolveOgImageUrl(input.ogImage, input.defaultOgImage);
  const description = input.description ?? undefined;
  return {
    title: input.title,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    openGraph: {
      type: 'website' as const,
      locale: OG_LOCALE,
      siteName: OG_SITE_NAME,
      title: input.title,
      ...(description ? { description } : {}),
      url,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: TWITTER_CARD,
      title: input.title,
      ...(description ? { description } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD 两段（映射表 §2：Next 代码模板，数据来自 site-config）        */
/* ------------------------------------------------------------------ */

/**
 * JSON-LD script 标签体序列化：`<` 一律转义为 \u003c（对齐 Next 官方 payload
 * 做法），阻断 CMS 富字段里的 `</script>` 序列提前闭合标签把后续标记放进
 * 文档流；U+2028/2029（JS 行/段分隔符）一并转义。返回值只进
 * dangerouslySetInnerHTML，勿作他用。
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * 首页 @graph：Organization（算力海洋/Token Ocean，logo/email/定位来自
 * site-config-main——siteTagline 定位、contactEmails 首邮箱）+ WebSite
 * （publisher 回指 organization @id）。结构对照 v0.3/index.html 实测 head。
 * alternateName「Token Ocean」与品牌 logo 静态路径为站点身份常量
 * （site-config 无对应字段，v0.3 head 同值搬运）。
 */
export function buildHomeJsonLd(config: SiteConfigMainData | null) {
  const siteName = config?.siteName ?? OG_SITE_NAME;
  const email = config?.contactEmails?.[0]?.email;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: siteName,
        alternateName: 'Token Ocean',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/logo/logo_cn_en.svg`,
        ...(email ? { email } : {}),
        ...(config?.siteTagline ? { description: config.siteTagline } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: siteName,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'zh-CN',
      },
    ],
  };
}

/**
 * News 详情 Article 结构化数据（映射表 §2：新增能力，现网无此页）：
 * title/excerpt/cover/date 四要素 + mainEntityOfPage 自引用。
 */
export function buildNewsArticleJsonLd(news: NewsData) {
  const image = strapiMediaUrl(news.cover);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: news.title,
    ...(news.excerpt ? { description: news.excerpt } : {}),
    ...(image ? { image } : {}),
    ...(news.publishDate ? { datePublished: news.publishDate } : {}),
    mainEntityOfPage: absoluteUrl(`/news/${news.slug}`),
    inLanguage: 'zh-CN',
  };
}

/* ------------------------------------------------------------------ */
/* sitemap 条目（url-plan.md §4：published Page + landing + 站内态 News） */
/* ------------------------------------------------------------------ */

/** sitemap 取数的最小字段投影（页面路由与 seed fixture 共用形状） */
export interface SitemapPageSource {
  slug: string;
  site: 'main' | 'hq';
  /** lastmod 语义：Page 为 publishedAt（最后一次发布时刻，草稿编辑不生效） */
  publishedAt?: string | null;
}

export interface SitemapLandingSource {
  slug: string;
  site: 'main' | 'hq';
  publishedAt?: string | null;
}

export interface SitemapNewsSource {
  slug: string;
  /** 站内态判定：externalUrl 有值无站内详情页，不进 sitemap */
  externalUrl?: string | null;
  /** lastmod 语义：News 为 publishDate（内容日期；publishedAt 是 seed 操作时刻会漂移） */
  publishDate?: string | null;
}

/**
 * 不进 sitemap 的 landing slug（url-plan §4：白皮书页跟随现网行为——
 * 现 sitemap.xml 未收录 index-v1.html；外投落地页允许自然收录但不主动提交，
 * 也不加 noindex）。未来同类营销 landing 在此追加。
 */
const LANDING_SLUGS_EXCLUDED = ['whitepaper'];

/** Page/landing slug → 干净 URL（main 直根、hq 加 /huaqiao 前缀、home 即站点根） */
export function pagePath(site: 'main' | 'hq', slug: string): string {
  if (site === 'hq') return slug === 'home' ? '/huaqiao' : `/huaqiao/${slug}`;
  return slug === 'home' ? '/' : `/${slug}`;
}

/**
 * sitemap 条目集合（纯函数：app/sitemap.ts 拉数后调用，测试用 seed fixture 直灌）。
 * landing 排除清单外的照常收录；news 只收站内态（externalUrl 空）。
 */
export function buildSitemapEntries(
  pages: SitemapPageSource[],
  landings: SitemapLandingSource[],
  news: SitemapNewsSource[],
): { url: string; lastModified?: string }[] {
  const entries: { url: string; lastModified?: string }[] = [];
  for (const p of pages) {
    // 落地页废弃（.scratch/huaqiao-redirect/）：/huaqiao 已 301 →
    // /huaqiao/enterprise，hq home 条目不进 sitemap（后台条目留存，前端收口）
    if (p.site === 'hq' && p.slug === 'home') continue;
    entries.push({
      url: absoluteUrl(pagePath(p.site, p.slug)),
      ...(p.publishedAt ? { lastModified: p.publishedAt } : {}),
    });
  }
  for (const lp of landings) {
    if (LANDING_SLUGS_EXCLUDED.includes(lp.slug)) continue;
    entries.push({
      url: absoluteUrl(pagePath(lp.site, lp.slug)),
      ...(lp.publishedAt ? { lastModified: lp.publishedAt } : {}),
    });
  }
  for (const n of news) {
    if (n.externalUrl) continue; // 外链态：无站内详情页，不进 sitemap
    entries.push({
      url: absoluteUrl(`/news/${n.slug}`),
      ...(n.publishDate ? { lastModified: n.publishDate } : {}),
    });
  }
  return entries;
}
