import type {
  HqNavItem,
  InsightEntryData,
  LandingPageData,
  MainNavItem,
  NewsData,
  SiteConfigHqData,
  SiteConfigMainData,
  StrapiMedia,
  StrapiPage,
} from '@/types/strapi';
import { getPreviewToken } from '@/lib/preview';
import type {
  SitemapLandingSource,
  SitemapNewsSource,
  SitemapPageSource,
} from '@/lib/seo';

export const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1338';

/**
 * 浏览器可访问的 Strapi 公网根地址。SSR 取数可以用容器内 STRAPI_URL，
 * 但 /uploads 必须输出公网地址，否则 HTML 会泄漏 http://strapi:1337。
 */
export const STRAPI_PUBLIC_URL = (
  process.env.STRAPI_PUBLIC_URL ?? ''
).replace(/\/+$/, '');

/**
 * 发布态取数的网络异常容错（10 号复审采 (b)）：
 * fetch reject（连接拒绝/DNS 失败）返回 null，调用方按「取不到」降级
 * （页面 notFound / 列表空集）——next build 期 SSG/sitemap 取数遇 Strapi
 * 不在线不再构建失败，「Strapi 可达」从构建硬前提降为软前提（镜像可先行
 * 构建，部署日运行期首请求/revalidate 自愈）。
 * HTTP 层 !res.ok 的既有语义保留（服务在线但 4xx/5xx 应按原约定跳过或
 * fail-fast 暴露）。
 */
async function fetchOrNull(url: string, init?: RequestInit): Promise<Response | null> {
  return fetch(url, init).catch(() => null);
}

/** D&P 内容类型草稿取数的公共选项（07 号工单预览链路） */
export type DraftOptions = { draft?: boolean };

/**
 * 草稿/发布两态的 fetch init（07 号工单）：
 * - 发布态（默认）：force-cache + tag 'strapi'，发布链路全站失效约定不变
 * - 草稿态：status=draft 由调用方写入 params；带只读 token 的 Authorization；
 *   不传任何 cache 选项（no-store 语义）——预览必须绕过 ISR/Data 缓存
 */
function fetchInit(draft?: boolean): RequestInit {
  if (draft) {
    const token = getPreviewToken();
    if (!token) {
      throw new Error(
        '预览取数需要 Strapi 只读 token：设置 STRAPI_PREVIEW_TOKEN 或确保 ../cn-strapi/.preview-token 存在',
      );
    }
    return { headers: { Authorization: `Bearer ${token}` } };
  }
  return { cache: 'force-cache', next: { tags: ['strapi'] } };
}

/** Strapi 媒体相对 URL → 绝对 URL（Strapi 5 返回 /uploads/xxx） */
export function strapiMediaUrl(media: StrapiMedia | null | undefined): string {
  if (!media?.url) return '';
  const publicBase = STRAPI_PUBLIC_URL || STRAPI_URL;
  return media.url.startsWith('http') ? media.url : `${publicBase}${media.url}`;
}

/**
 * 动态区 sections 全量 populate（page 与 landing-page 共用）。
 * v5 动态区 populate：`*` 只展开一层、不穿透组件内的 media 与嵌套组件，
 * 故各区块组件逐字段显式列出（全对象化，避免字符串与嵌套对象同 key 冲突），
 * 媒体面板 / 卡片再下一层取 image / kvRows / miniItems / checks.items / icon。
 * 后续工单逐区块追加 on 条目。
 */
function appendSectionsPopulate(params: URLSearchParams) {
  // hero.head / signal-band.head 已随 cn-strapi 死字段清理从 schema 删除，
  // 不可再 populate——Strapi 5 对未知键整条查询 400（2026-09-24 全站 500 根因）
  params.set('populate[sections][on][sections.hero][populate][metaRows]', 'true');
  params.set('populate[sections][on][sections.hero][populate][actions]', 'true');
  params.set('populate[sections][on][sections.hero][populate][badges]', 'true');
  params.set('populate[sections][on][sections.hero][populate][rightPanel][populate][image]', 'true');
  // 2.0 PRD 1.2/5.1：carousel 面板 slides（elements.slide 内 image 媒体）
  params.set('populate[sections][on][sections.hero][populate][rightPanel][populate][slides][populate][image]', 'true');
  params.set('populate[sections][on][sections.hero][populate][rightPanel][populate][kvRows]', 'true');
  params.set('populate[sections][on][sections.hero][populate][rightPanel][populate][miniItems]', 'true');
  params.set('populate[sections][on][sections.hero][populate][rightPanel][populate][checks][populate][items][populate][icon]', 'true');
  params.set('populate[sections][on][sections.card-grid][populate][head]', 'true');
  params.set('populate[sections][on][sections.card-grid][populate][cards][populate][icon]', 'true');
  params.set('populate[sections][on][sections.card-grid][populate][cards][populate][list][populate][items]', 'true');
  // 2.0 PRD 4.1：网格下方尾按钮（elements.action）
  params.set('populate[sections][on][sections.card-grid][populate][footerAction]', 'true');
  params.set('populate[sections][on][sections.signal-band][populate][items]', 'true');
  params.set('populate[sections][on][sections.process-flow][populate][head]', 'true');
  params.set('populate[sections][on][sections.process-flow][populate][steps][populate][icon]', 'true');
  params.set('populate[sections][on][sections.process-flow][populate][steps][populate][list][populate][items]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][head]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][checks][populate][items][populate][icon]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][actions]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][rightPanel][populate][image]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][rightPanel][populate][slides][populate][image]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][rightPanel][populate][kvRows]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][rightPanel][populate][miniItems]', 'true');
  params.set('populate[sections][on][sections.split-media][populate][rightPanel][populate][checks][populate][items][populate][icon]', 'true');
  params.set('populate[sections][on][sections.content-grid][populate][head]', 'true');
  params.set('populate[sections][on][sections.content-grid][populate][cards][populate][icon]', 'true');
  params.set('populate[sections][on][sections.content-grid][populate][cards][populate][list][populate][items]', 'true');
  params.set('populate[sections][on][sections.stat-strip][populate][head]', 'true');
  params.set('populate[sections][on][sections.stat-strip][populate][stats]', 'true');
  params.set('populate[sections][on][sections.cta-band][populate][head]', 'true');
  params.set('populate[sections][on][sections.cta-band][populate][buttons]', 'true');
  // 3.3 设计稿：Logo 墙（head 标题 + groups → logos → image 媒体）
  params.set('populate[sections][on][sections.logo-wall][populate][head]', 'true');
  params.set('populate[sections][on][sections.logo-wall][populate][groups][populate][logos][populate][image]', 'true');
  // 2.0 PRD 7.2：解决方案折叠列表（solutions 内 logo/cover 两媒体）
  params.set('populate[sections][on][sections.solution-list][populate][head]', 'true');
  params.set('populate[sections][on][sections.solution-list][populate][solutions][populate][logo]', 'true');
  params.set('populate[sections][on][sections.solution-list][populate][solutions][populate][cover]', 'true');
}

/**
 * 取单个页面（默认已发布；draft:true 取草稿，07 号工单预览链路）。
 * 缓存策略（发布链路核心约定）：
 * - force-cache + tag 'strapi'：全站 Strapi 数据共享一个失效标签，
 *   发布/取消发布/媒体变更 → /api/revalidate → revalidateTag('strapi')
 * - draft 分支：status=draft + 只读 token + 不缓存，仅预览态可达，
 *   访客路径（无 draft cookie）永远走发布态，缓存行为零变化
 * - 09/10 号工单再细化页面级粒度
 */
export async function getPage(
  slug: string,
  site: 'main' | 'hq' = 'main',
  opts: DraftOptions = {},
): Promise<StrapiPage | null> {
  const params = new URLSearchParams({
    'filters[slug]': slug,
    'filters[site]': site,
    'locale': 'zh-Hans',
    'populate[seo][populate]': '*',
  });
  appendSectionsPopulate(params);
  if (opts.draft) params.set('status', 'draft');
  const res = await fetchOrNull(
    `${STRAPI_URL}/api/pages?${params.toString()}`,
    fetchInit(opts.draft),
  );
  // 网络异常/404 → null 走 notFound；其余 !ok 保留 fail-fast（服务在线但异常
  // 应在构建期暴露，而非静默 404）
  if (!res || res.status === 404) return null;
  if (!res.ok) throw new Error(`Strapi request failed: ${res.status}`);
  const json = (await res.json()) as { data: StrapiPage[] };
  return json.data[0] ?? null;
}

/**
 * 取单个专题落地页（06 号工单，/whitepaper；draft:true 取草稿，07 号预览链路）。
 * 缓存策略与 getPage 一致（force-cache + tag 'strapi'，发布/取消发布触发
 * 全站失效；draft 分支 status=draft + 只读 token + 不缓存）；navLinks 为
 * repeatable 组件需显式 populate，sections populate 与 page 全量共用。
 * slug+site 双过滤同 getPage：schema 许可跨站同名 slug（unique:false），
 * 单键查询会命中不确定条目。
 */
export async function getLandingPage(
  slug: string,
  site: 'main' | 'hq' = 'main',
  opts: DraftOptions = {},
): Promise<LandingPageData | null> {
  const params = new URLSearchParams({
    'filters[slug]': slug,
    'filters[site]': site,
    'locale': 'zh-Hans',
    'populate[seo][populate]': '*',
    'populate[navLinks]': 'true',
  });
  appendSectionsPopulate(params);
  if (opts.draft) params.set('status', 'draft');
  const res = await fetchOrNull(
    `${STRAPI_URL}/api/landing-pages?${params.toString()}`,
    fetchInit(opts.draft),
  );
  if (!res || res.status === 404) return null;
  if (!res.ok) throw new Error(`Strapi request failed: ${res.status}`);
  const json = (await res.json()) as { data: LandingPageData[] };
  return json.data[0] ?? null;
}

/**
 * 主站全局配置（cta-band 按钮默认引用的 formUrl 来源；08 号工单扩页脚
 * 链接组/邮箱/备案等渲染源）。
 * 不缓存（区别于 getPage 的 force-cache）：site-config-main 是 draftAndPublish:false
 * 的 single type，后台保存只发 entry.update，而 revalidate 链路只认
 * publish/unpublish/delete——缓存了就永远等不到失效，formUrl 改动必须实时生效。
 * contactEmails/footerLinks 为 repeatable 组件需显式 populate（同 site-config-hq）。
 * 09 号工单扩 populate ogImageDefault（metadata 层 OG 回退链 + 首页 JSON-LD）。
 */
export async function getSiteConfigMain(): Promise<SiteConfigMainData | null> {
  const params = new URLSearchParams({
    locale: 'zh-Hans',
    'populate[contactEmails]': 'true',
    'populate[footerLinks]': 'true',
    'populate[ogImageDefault]': 'true',
  });
  const res = await fetchOrNull(`${STRAPI_URL}/api/site-config-main?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res || !res.ok) return null;
  const json = (await res.json()) as { data: SiteConfigMainData | null };
  return json.data ?? null;
}

/**
 * 华侨数港子站全局配置（05 号工单）。缓存策略与 site-config-main 相同
 * （single type + draftAndPublish:false，后台保存只发 entry.update，
 * 缓存了等不到失效）——no-store 实时取。logo/footerLinks 组件需显式 populate；
 * 09 号工单扩 populate ogImageDefault（子站页 OG 回退链）。
 */
export async function getSiteConfigHq(): Promise<SiteConfigHqData | null> {
  const params = new URLSearchParams({
    locale: 'zh-Hans',
    'populate[logo]': 'true',
    'populate[footerLinks]': 'true',
    'populate[ogImageDefault]': 'true',
  });
  const res = await fetchOrNull(`${STRAPI_URL}/api/site-config-hq?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!res || !res.ok) return null;
  const json = (await res.json()) as { data: SiteConfigHqData | null };
  return json.data ?? null;
}

/**
 * 主站导航平铺集合（08 号工单；白皮书二级菜单起合并 landing）：
 * Page 与 landing-page 两源并集——均按 site=main、已发布、navHidden 非真、
 * navOrder 排序；populate navParent 的 slug 供渲染层 buildMainNavTree
 * 判定一级/二级（父不在可见集合即降级一级——删父页与隐藏父页同路径；
 * landing 的 navParent 恒指 Page，一级导航由 Page 承载）。
 * navTitle 空回退 title（验收 1）；缓存与 getHqNavPages 一致
 * （force-cache + tag 'strapi'，页面增删改发布触发全站失效）。
 * landing 项的 URL 沿 mainPageUrl(slug) 约定——landing slug 与自身路由
 * 同名（url-plan §1：whitepaper → /whitepaper），且不得与 Page slug 撞名
 * （撞名时 Page 优先、landing 项丢弃，防 Map 键覆盖错挂）。
 */
export async function getMainNavPages(): Promise<MainNavItem[]> {
  const navQuery = new URLSearchParams({
    'filters[site]': 'main',
    'filters[navHidden][$eq]': 'false',
    'sort': 'navOrder:asc',
    'locale': 'zh-Hans',
    'fields[0]': 'slug',
    'fields[1]': 'navTitle',
    'fields[2]': 'title',
    'fields[3]': 'navOrder',
    'populate[navParent][fields][0]': 'slug',
  });
  type NavRow = {
    slug: string;
    navTitle: string | null;
    title: string;
    navOrder: number | null;
    navParent: { slug: string } | null;
  };
  const toItems = (rows: NavRow[]) =>
    rows.map((p) => ({
      slug: p.slug,
      navTitle: p.navTitle || p.title,
      navOrder: p.navOrder,
      navParentSlug: p.navParent?.slug ?? null,
    }));
  const [pagesRes, landingsRes] = await Promise.all([
    fetchOrNull(`${STRAPI_URL}/api/pages?${navQuery.toString()}`, {
      cache: 'force-cache',
      next: { tags: ['strapi'] },
    }),
    fetchOrNull(`${STRAPI_URL}/api/landing-pages?${navQuery.toString()}`, {
      cache: 'force-cache',
      next: { tags: ['strapi'] },
    }),
  ]);
  if (!pagesRes || !pagesRes.ok) return [];
  const pagesJson = (await pagesRes.json()) as { data: NavRow[] };
  const items = toItems(pagesJson.data ?? []);
  if (!landingsRes || !landingsRes.ok) return items;
  const landingsJson = (await landingsRes.json()) as { data: NavRow[] };
  const seen = new Set(items.map((i) => i.slug));
  return [...items, ...toItems(landingsJson.data ?? []).filter((i) => !seen.has(i.slug))];
}

/**
 * 子站导航项（site=hq 已发布页按 navOrder 派生，ADR-0002 导航派生约定）。
 * 只取派生所需三字段；slug home 即 /huaqiao 根（url-plan.md 定稿）。
 * 缓存与 getPage 一致：force-cache + tag 'strapi'（页面增删改发布触发全站失效）。
 */
export async function getHqNavPages(): Promise<HqNavItem[]> {
  const params = new URLSearchParams({
    'filters[site]': 'hq',
    'filters[navHidden][$eq]': 'false',
    'sort': 'navOrder:asc',
    'locale': 'zh-Hans',
    'fields[0]': 'slug',
    'fields[1]': 'navTitle',
    'fields[2]': 'title',
  });
  const res = await fetchOrNull(`${STRAPI_URL}/api/pages?${params.toString()}`, {
    cache: 'force-cache',
    next: { tags: ['strapi'] },
  });
  if (!res || !res.ok) return [];
  const json = (await res.json()) as {
    data: { slug: string; navTitle: string | null; title: string }[];
  };
  // 落地页废弃（.scratch/huaqiao-redirect/）：后台 home 条目留存（不动
  // Strapi），导航在前端收口——home 不入子站导航（/huaqiao 已 301 →
  // /huaqiao/enterprise，「首页」项整体下线）
  return (json.data ?? [])
    .filter((p) => p.slug !== 'home')
    .map((p) => ({ slug: p.slug, navTitle: p.navTitle || p.title }));
}

/**
 * News 集合最新 N 条（content-grid kind=news 数据源，按 publishDate 倒序）。
 * 缓存策略与 getPage 一致（force-cache + tag 'strapi'）：News 自 2026-09-22 起
 * 为 draftAndPublish:true，公共 API 只回已发布条目，发布/取消发布/删除经
 * entry.publish/unpublish/delete 事件全站失效（与 page/landing 同链路）。
 */
export async function getLatestNews(limit = 3): Promise<NewsData[]> {
  const params = new URLSearchParams({
    'sort': 'publishDate:desc',
    'pagination[pageSize]': String(limit),
    'locale': 'zh-Hans',
    'populate[cover]': 'true',
  });
  const res = await fetchOrNull(`${STRAPI_URL}/api/news?${params.toString()}`, {
    cache: 'force-cache',
    next: { tags: ['strapi'] },
  });
  if (!res || !res.ok) return [];
  const json = (await res.json()) as { data: NewsData[] };
  return json.data ?? [];
}

/**
 * 单条新闻（/news/[slug] 详情；draft:true 实时取，07 号预览链路）。
 * news-item 自 2026-09-22 起为 draftAndPublish:true（草稿/发布与 page 一致），
 * 正常态走 force-cache 只取已发布；预览态 status=draft + 只读 token + 不缓存。
 */
export async function getNews(slug: string, opts: DraftOptions = {}): Promise<NewsData | null> {
  const params = new URLSearchParams({
    'filters[slug]': slug,
    'locale': 'zh-Hans',
    'populate[cover]': 'true',
  });
  if (opts.draft) params.set('status', 'draft');
  const res = await fetchOrNull(`${STRAPI_URL}/api/news?${params.toString()}`, fetchInit(opts.draft));
  if (!res || res.status === 404) return null;
  if (!res.ok) throw new Error(`Strapi request failed: ${res.status}`);
  const json = (await res.json()) as { data: NewsData[] };
  return json.data[0] ?? null;
}

/**
 * 洞察内容集合（2.0 PRD 6.1，content-grid kind=insightList 数据源）：
 * 按 publishDate 倒序。缓存策略与 getLatestNews 一致——insight-entry 为
 * draftAndPublish:false，保存只发 entry.update/create，前台失效依赖
 * revalidate 路由 INSTANT_UIDS 登记（本类型已登记，保存即失效）。
 */
export async function getInsightEntries(limit = 8): Promise<InsightEntryData[]> {
  const params = new URLSearchParams({
    'sort': 'publishDate:desc',
    'pagination[pageSize]': String(limit),
    'locale': 'zh-Hans',
  });
  const res = await fetchOrNull(`${STRAPI_URL}/api/insight-entries?${params.toString()}`, {
    cache: 'force-cache',
    next: { tags: ['strapi'] },
  });
  if (!res || !res.ok) return [];
  const json = (await res.json()) as { data: InsightEntryData[] };
  return json.data ?? [];
}

/* ------------------------------------------------------------------ */
/* sitemap 取数（09 号工单，url-plan.md §4；条目拼装见 lib/seo.ts）      */
/* ------------------------------------------------------------------ */

/**
 * sitemap 取数公共通道（10 号复审容错）：
 * - fetch reject（连接拒绝/DNS 失败等网络异常）与 !res.ok 同语义吞掉返回 []——
 *   next build 期执行 sitemap 生成（09 号注记：无动态 API、build 期固化），
 *   若网络异常上抛则 Strapi 不可达直接构建失败；容错为空集后 Strapi 可达从
 *   构建硬前提降为软前提（镜像可先于 Strapi 部署构建）
 * - sitemap 走 force-cache + tag 'strapi'：空集只在「构建期从未可达」时固化，
 *   运行期首请求/revalidate 链路自愈
 * - 页面取数（getPage 等）同样经 fetchOrNull 容错网络异常（→ null 走 notFound，
 *   与 getPage docblock「彻底无缓存则 404」的既有意图一致）；!res.ok 保留
 *   fail-fast（服务在线但异常仍在构建期暴露）
 */
async function fetchSitemapList<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const res = await fetchOrNull(`${STRAPI_URL}${path}?${params.toString()}`, {
    cache: 'force-cache',
    next: { tags: ['strapi'] },
  });
  if (!res || !res.ok) return [];
  const json = (await res.json()) as { data: T[] };
  return json.data ?? [];
}

/**
 * 全量已发布 Page（sitemap 用，最小字段投影）：REST 默认只返回 published 条目，
 * main 直根 / hq 加 /huaqiao 前缀由 pagePath 在条目层拼装。
 * 缓存与 getPage 一致（force-cache + tag 'strapi'，发布/取消发布触发全站失效）。
 */
export async function getPublishedPages(): Promise<SitemapPageSource[]> {
  return fetchSitemapList<SitemapPageSource>('/api/pages', publishedProjection());
}

/** 全量已发布 landing-page（sitemap 用；白皮书等外投页在条目层按排除清单滤除） */
export async function getPublishedLandingPages(): Promise<SitemapLandingSource[]> {
  return fetchSitemapList<SitemapLandingSource>('/api/landing-pages', publishedProjection());
}

/** 全量 News（sitemap 用）：externalUrl 判站内态、publishDate 作 lastmod（与 Page 投影不同构） */
export async function getPublishedNews(): Promise<SitemapNewsSource[]> {
  return fetchSitemapList<SitemapNewsSource>(
    '/api/news',
    new URLSearchParams({
      'fields[0]': 'slug',
      'fields[1]': 'externalUrl',
      'fields[2]': 'publishDate',
      'locale': 'zh-Hans',
    }),
  );
}

/** Page/landing-page 共用的最小字段投影（slug/site/publishedAt 三字段） */
function publishedProjection(): URLSearchParams {
  return new URLSearchParams({
    'fields[0]': 'slug',
    'fields[1]': 'site',
    'fields[2]': 'publishedAt',
    'locale': 'zh-Hans',
  });
}
