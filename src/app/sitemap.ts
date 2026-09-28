import type { MetadataRoute } from 'next';
import {
  getPublishedLandingPages,
  getPublishedNews,
  getPublishedPages,
} from '@/lib/strapi';
import { absoluteUrl, buildSitemapEntries } from '@/lib/seo';

/**
 * sitemap.xml（09 号工单，url-plan.md §4 定稿）：
 * published Page（main 直根 + hq 加 /huaqiao 前缀）+ landing（白皮书等外投
 * 落地页按排除清单不进，跟随现网行为）+ 站内态 News（externalUrl 有值无
 * 站内详情页，不进）。lastmod：Page/landing 用 publishedAt（最后发布时刻），
 * News 用 publishDate（内容日期，publishedAt 是 seed 操作时刻会漂移）。
 * 取数 force-cache + tag 'strapi'，revalidate 链路发布即失效重生成。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, landings, news] = await Promise.all([
    getPublishedPages(),
    getPublishedLandingPages(),
    getPublishedNews(),
  ]);
  // 常驻列表页固定收录：/news（2026-09-23 推翻「不进 sitemap」旧决策，QA T-105）、
  // /insights/all（2026-09-24 洞察全量列表页，对等处理）
  return [
    { url: absoluteUrl('/insights/all') },
    { url: absoluteUrl('/news') },
    ...buildSitemapEntries(pages, landings, news),
  ];
}
