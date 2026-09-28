import type { Metadata } from 'next';
import { getInsightEntries, getMainNavPages, getSiteConfigMain } from '@/lib/strapi';
import { buildMetadata } from '@/lib/seo';
import { MainChrome } from '@/components/chrome/MainChrome';
import { ContentGrid } from '@/components/sections/ContentGrid';
import type { ContentGridData } from '@/types/strapi';

/**
 * 洞察内容全量列表页（2026-09-24 立项，/news「查看全部动态」承接页对等先例）：
 * 全量 insight-entry 按 publishDate 倒序（getInsightEntries(100) 首版上限，
 * 现量远低于此）；行式列表参考 /news（newsLayout=rows 运行时开关注入，
 * CMS schema 不加字段）。条目「点击查看 →」仍直跳自身 link（白皮书专题/
 * 外链），无站内详情页（PRD 6.1/6.3 既有设计）。
 * 代码固定路由不建 CMS Page 条目：不占导航派生；/insights/all 静态段
 * 优先于 [slug] 动态段，与 /insights 栏目门户页共存；常驻进 sitemap
 * （对齐 QA T-105/106 的 /news 处理）。
 * 不传 currentSlug：承接页与「研究与洞察」栏目是两个入口，不高亮主导航。
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfigMain();
  return buildMetadata({
    path: '/insights/all',
    title: '洞察内容全览：白皮书、市场研究与测评认证｜算力海洋',
    description:
      '算力海洋洞察内容全列表：产业白皮书、市场研究、服务标准与测评认证成果，了解中国算力与 AI 应用出海的研究体系与产业洞察。',
    defaultOgImage: config?.ogImageDefault,
  });
}

export default async function InsightListPage() {
  const [insights, config, nav] = await Promise.all([
    getInsightEntries(100),
    getSiteConfigMain(),
    getMainNavPages(),
  ]);
  return (
    <MainChrome config={config} nav={nav}>
      <ContentGrid
        headLevel="h1"
        data={
          {
            __component: 'sections.content-grid',
            kind: 'insightList',
            newsLayout: 'rows',
            insights,
            head: { eyebrow: 'INSIGHTS', heading: '洞察内容' },
          } as ContentGridData
        }
      />
    </MainChrome>
  );
}
