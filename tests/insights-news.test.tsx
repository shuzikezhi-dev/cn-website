import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionRenderer } from '@/components/SectionRenderer';
import { ContentGrid } from '@/components/sections/ContentGrid';
import type {
  ContentGridData,
  InsightEntryData,
  NewsData,
  SectionData,
  StrapiPage,
} from '@/types/strapi';
import insights from '../../content-seed/content/insights.json';

/**
 * 主测试缝：04 号工单 /insights 页 + News 集合（fixture 单一源 =
 * content-seed/content/insights.json，站内态 News 因 seed 全外链而自造 fixture）。
 * 覆盖：content-grid 四 kind 分支（2.0 增 insightList）、research 布局、
 * externalUrl 二态、/news/[slug] 最简模板、enrichSections 的 newsLimit 管道。
 */
vi.mock('@/lib/strapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/strapi')>();
  // getSiteConfigMain：09 号起 news generateMetadata 走 OG 回退链，一并 mock 保持封闭
  return {
    ...actual,
    getLatestNews: vi.fn(),
    getInsightEntries: vi.fn(),
    getNews: vi.fn(),
    getSiteConfigMain: vi.fn(),
  };
});

const page = insights.pages[0] as unknown as StrapiPage;
const seedNews = insights.news as unknown as NewsData[];
const seedInsights = insights.insightEntries as unknown as InsightEntryData[];

/** 站内态（externalUrl 空）自造实例：seed 三条全外链，详情页只有此态可渲染 */
const internalNews: NewsData = {
  id: 99,
  documentId: 'doc-internal',
  title: '站内新闻测试',
  slug: 'internal-news',
  category: 'report',
  excerpt: '站内新闻摘要文本',
  body: '<p>正文第一段。</p><p>正文第二段。</p>',
  externalUrl: null,
  displayDate: null,
  publishDate: '2026-05-01T00:00:00.000Z',
};

/** 模拟页面层 enrichSections 后的 sections（news/insightList 区块已注入列表数据） */
const enrichedSections = page.sections.map((section) => {
  if (
    section.__component === 'sections.content-grid' &&
    (section as ContentGridData).kind === 'news'
  ) {
    return { ...section, news: [...seedNews, internalNews].slice(0, 3) } as SectionData;
  }
  if (
    section.__component === 'sections.content-grid' &&
    (section as ContentGridData).kind === 'insightList'
  ) {
    return { ...section, insights: seedInsights } as SectionData;
  }
  return section as SectionData;
});

function renderInsights() {
  render(<SectionRenderer sections={enrichedSections} formUrl="https://global-form" />);
}

describe('/insights 页三形态齐（hero + 研究机制 + 六方向 + 手动卡 + 新闻列表）', () => {
  it('hero govCard 四要素：标签+标题+简介+「点击查看」尾链（布局参考联盟事件卡、无封面无清单）', () => {
    renderInsights();
    expect(document.querySelector('section.hero')?.className).toContain('content-hero');
    // 布局对齐 alliance hero 事件卡但去封面：eyebrow→h3→p 尾链，checks 清单与 image 均不参与
    const card = document.querySelector('.hero .gov-card');
    expect(card?.querySelector('span')?.textContent).toBe('研究体系');
    expect(card?.querySelector('h3')?.textContent).toBe('研究为服务项目提供方法与判断依据');
    expect(card?.querySelector('p')?.textContent).toContain('白皮书与产业报告');
    expect(card?.querySelector('ul')).toBeNull();
    expect(card?.querySelector('img')).toBeNull();
    // 尾链指本页洞察内容锚点（站内同窗）；同名「点击查看 →」与下方列表卡重复，容器限定取
    const tail = card?.querySelector('a');
    expect(tail?.getAttribute('href')).toBe('#insights');
    expect(tail?.getAttribute('target')).toBeNull();
    expect(tail?.textContent).toBe('点击查看 →');
  });

  it('research 布局：navy 背景区 + 六方向卡 + 序号 aria-hidden 前端渲染', () => {
    renderInsights();
    const section = document.querySelector('section.research-section');
    expect(section?.className).toBe('section navy research-section');
    const cards = section?.querySelectorAll('article.research-card');
    expect(cards).toHaveLength(6);
    const first = cards?.[0];
    expect(first?.querySelector('.research-index')?.getAttribute('aria-hidden')).toBe('true');
    expect(first?.querySelector('.research-index')?.textContent).toBe('01');
    expect(cards?.[5]?.querySelector('.research-index')?.textContent).toBe('06');
    expect(first?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(screen.getByText('IDC 数据中心发展').tagName).toBe('H3');
  });

  it('手动洞察卡：featured 首卡类 + tag + cta 尾行（无链接 article）', () => {
    renderInsights();
    const featured = document.querySelector('article.insight-card.featured');
    expect(featured).toBeTruthy();
    expect(featured?.querySelector('span')?.textContent).toBe('WHITE PAPER');
    expect(featured?.querySelector('b')?.textContent).toBe('联合研究伙伴征集中');
    expect(document.querySelectorAll('.insight-cards article')).toHaveLength(3);
    expect(document.querySelectorAll('.insight-cards a.insight-card')).toHaveLength(0);
  });

  it('新闻列表按 publishDate 倒序渲染（enrich 注入序即展示序）', () => {
    renderInsights();
    const titles = [...document.querySelectorAll('.news-grid article h3')].map(
      (h3) => h3.textContent,
    );
    expect(titles).toEqual([
      '联合承办中国智算产业生态发展年会',
      '算力海洋全球伙伴共同体正式启动',
      '联合实验室、测评与报告共创',
    ]);
    const times = [...document.querySelectorAll('.news-grid time')].map((t) => t.textContent);
    // 2.0 PRD 7.1：time 槽「时间 · 地点」（seed 三条均带 location）
    expect(times).toEqual([
      '2026 年 6 月 30 日 · 深圳',
      '2026 年 6 月 30 日 · 深圳',
      '研究合作开放中 · 北京',
    ]);
  });

  it('location 空时 time 槽仅日期（旧数据兼容，自造无地点条目）', () => {
    render(
      <ContentGrid
        data={
          {
            __component: 'sections.content-grid',
            kind: 'news',
            news: [internalNews],
          } as unknown as ContentGridData
        }
      />,
    );
    expect(screen.getByText('2026 年 5 月 1 日').tagName).toBe('TIME');
  });
});

describe('externalUrl 二态链接行为', () => {
  it('有值：卡尾链接直跳外链并开新窗', () => {
    renderInsights();
    const c114 = [...document.querySelectorAll('.news-grid a')].find((a) =>
      a.getAttribute('href')?.includes('c114'),
    );
    expect(c114?.getAttribute('target')).toBe('_blank');
    expect(c114?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(c114?.textContent).toBe('查看报道 →');
  });

  it('无值：卡尾链接进站内 /news/[slug]，不开新窗', () => {
    render(
      <ContentGrid
        data={
          {
            __component: 'sections.content-grid',
            kind: 'news',
            newsLimit: 3,
            news: [internalNews],
          } as unknown as ContentGridData
        }
      />,
    );
    const link = screen.getByRole('link', { name: '阅读全文 →' });
    expect(link.getAttribute('href')).toBe('/news/internal-news');
    expect(link.getAttribute('target')).toBeNull();
    // 无 displayDate 时由 publishDate 格式化为中式日期
    expect(screen.getByText('2026 年 5 月 1 日').tagName).toBe('TIME');
  });
});

describe('content-grid kind=publication（与 insight 同构，06 号白皮书页消费）', () => {
  it('渲染 insight-card 结构', () => {
    render(
      <ContentGrid
        data={
          {
            __component: 'sections.content-grid',
            kind: 'publication',
            cards: [{ tag: 'REPORT', heading: '测评报告', body: '方法与结论。', ctaText: '下载 →' }],
          } as unknown as ContentGridData
        }
      />,
    );
    const card = document.querySelector('article.insight-card');
    expect(card?.querySelector('span')?.textContent).toBe('REPORT');
    expect(card?.querySelector('h3')?.textContent).toBe('测评报告');
    expect(card?.querySelector('b')?.textContent).toBe('下载 →');
  });
});

describe('enrichSections（newsLimit 配置管道）', () => {
  it('kind=news 区块按 newsLimit 拉取并注入 data.news', async () => {
    const { getLatestNews } = await import('@/lib/strapi');
    const { enrichSections } = await import('@/lib/enrich');
    vi.mocked(getLatestNews).mockResolvedValue([internalNews]);
    const out = await enrichSections([
      { __component: 'sections.content-grid', kind: 'news', newsLimit: 5 } as SectionData,
    ]);
    expect(getLatestNews).toHaveBeenCalledWith(5);
    expect((out[0] as ContentGridData).news).toEqual([internalNews]);
  });

  it('newsLimit 缺省为 3；无 news 区块零请求', async () => {
    const { getLatestNews } = await import('@/lib/strapi');
    const { enrichSections } = await import('@/lib/enrich');
    vi.mocked(getLatestNews).mockClear();
    await enrichSections([
      { __component: 'sections.content-grid', kind: 'news' } as SectionData,
    ]);
    expect(getLatestNews).toHaveBeenCalledWith(3);
    vi.mocked(getLatestNews).mockClear();
    const input = enrichedSections.slice(0, 1); // 仅 hero（零注入区块，引用透传前提）
    const untouched = await enrichSections(input);
    expect(untouched).toBe(input); // 原数组引用透传
    expect(getLatestNews).not.toHaveBeenCalled();
  });
});

describe('content-grid kind=insightList（2.0 PRD 6.1/6.3 洞察内容列表）', () => {
  it('hero 后第一位渲染四类中文标签 + 标题 + 简介 + 尾链；id=insights 为 hero 尾链锚点落点', () => {
    renderInsights();
    const list = document.querySelector('.insight-list');
    expect(list).toBeTruthy();
    expect(document.getElementById('insights')?.className).toBe('section tint insight-list-section');
    const articles = list?.querySelectorAll('article');
    expect(articles).toHaveLength(4);
    // 四类中文标签全数展示（CMS ASCII 枚举 → 前台映射）
    const tags = [...(list?.querySelectorAll('article > span') ?? [])].map((s) => s.textContent);
    expect(tags).toEqual(['白皮书/产业报告', '市场研究', '服务标准', '测评认证']);
    expect(screen.getByText('中国算力出海产业白皮书').tagName).toBe('H3');
    expect(screen.getByText('梳理中国算力与 AI 应用出海的产业格局、区域路径与合作机制，联合产业机构发布。')).toBeTruthy();
  });

  it('链接二态：站内 /whitepaper 同窗、外链 https 新窗（自造外链条目）', () => {
    render(
      <ContentGrid
        data={
          {
            __component: 'sections.content-grid',
            kind: 'insightList',
            insights: [
              ...seedInsights.slice(0, 1),
              { ...seedInsights[1], link: 'https://example.com/report.pdf' },
            ],
          } as unknown as ContentGridData
        }
      />,
    );
    const links = [...document.querySelectorAll('.insight-list a')];
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/whitepaper');
    // 专题落地页入口新标签打开（2026-09-23：/whitepaper 前缀走 lib/link-target）
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[1].getAttribute('href')).toBe('https://example.com/report.pdf');
    expect(links[1].getAttribute('target')).toBe('_blank');
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0].textContent).toBe('点击查看 →');
  });

  it('enrichSections：kind=insightList 按 newsLimit 调 getInsightEntries 注入', async () => {
    const { getInsightEntries } = await import('@/lib/strapi');
    const { enrichSections } = await import('@/lib/enrich');
    vi.mocked(getInsightEntries).mockResolvedValue(seedInsights);
    const out = await enrichSections([
      { __component: 'sections.content-grid', kind: 'insightList', newsLimit: 8 } as SectionData,
    ]);
    expect(getInsightEntries).toHaveBeenCalledWith(8);
    expect((out[0] as ContentGridData).insights).toEqual(seedInsights);
  });
});

describe('/insights/all 洞察全量列表页（2026-09-24 立项，样式参考 /news）', () => {
  it('全量渲染行式卡（一行一条通栏，卡内纵排 标签→标题→简介→尾链）；独立承接页不高亮主导航', async () => {
    const { getInsightEntries } = await import('@/lib/strapi');
    vi.mocked(getInsightEntries).mockResolvedValue(seedInsights);
    const { default: InsightListPage } = await import('@/app/insights/all/page');
    render(await InsightListPage());
    // 全量：getInsightEntries(100)（现量 4 条全数渲染）
    expect(getInsightEntries).toHaveBeenCalledWith(100);
    // 本页无 hero，区块标题升页面级 H1（对齐 /news QA T-106 先例）
    expect(screen.getByText('洞察内容').tagName).toBe('H1');
    // 行式列表复用 .news-rows 形态（网格 .insight-list 留给 CMS 预览区块）
    expect(document.querySelector('.news-rows')).toBeTruthy();
    expect(document.querySelector('.insight-list')).toBeNull();
    const cards = document.querySelectorAll('.news-rows article');
    expect(cards).toHaveLength(seedInsights.length);
    // 卡内纵排：span（分类标签）→ h3 → p → a 顺序（参考 /news 的 time→h3→p→a）
    const first = cards[0];
    expect(first?.firstElementChild?.tagName).toBe('SPAN');
    expect(first?.children[1]?.tagName).toBe('H3');
    expect(first?.lastElementChild?.tagName).toBe('A');
    // 不传 currentSlug：导航无 active 项（承接页与栏目门户 /insights 区分）
    expect(document.querySelector('.site-nav-menu nav a.active')).toBeNull();
    expect(document.querySelector('.site-nav-menu summary.active')).toBeNull();
  });

  it('insightList 区块 moreLabel/moreUrl 尾链（/insights 页「查看全部洞察」入口，.news-more 同构）', () => {
    render(
      <ContentGrid
        data={
          {
            __component: 'sections.content-grid',
            kind: 'insightList',
            insights: seedInsights.slice(0, 1),
            moreLabel: '查看全部洞察 →',
            moreUrl: '/insights/all',
          } as unknown as ContentGridData
        }
      />,
    );
    const more = document.querySelector('.news-more a');
    expect(more?.getAttribute('href')).toBe('/insights/all');
    // 站内路径同窗打开（lib/link-target 收口）
    expect(more?.getAttribute('target')).toBeNull();
    expect(more?.textContent).toBe('查看全部洞察 →');
    // 未配 more 的区块（CMS 缺省）零尾链渲染
    expect(document.querySelectorAll('.news-more')).toHaveLength(1);
  });
});

describe('/news 列表页（2.0 PRD 7.1「查看全部动态」承接页）', () => {
  it('全量渲染 externalUrl 二态卡（一行一条行式）；动态独立栏目不高亮主导航（与研究洞察区分）', async () => {
    const { getLatestNews } = await import('@/lib/strapi');
    vi.mocked(getLatestNews).mockResolvedValue([...seedNews, internalNews]);
    const { default: NewsListPage } = await import('@/app/news/page');
    render(await NewsListPage());
    // head 渲染（SectionHead heading）：本页无 hero，区块标题升页面级 H1（QA T-106）
    expect(screen.getByText('新闻动态').tagName).toBe('H1');
    // 列表页一行一条：容器 .news-rows（三卡网格形态留给 CMS 预览区块）
    expect(document.querySelector('.news-rows')).toBeTruthy();
    expect(document.querySelector('.news-grid')).toBeNull();
    const cards = document.querySelectorAll('.news-rows article');
    expect(cards).toHaveLength(4);
    // 卡内纵排：time → h3 → p → a 顺序（2026-09-21 用户指定）
    const first = cards[0];
    expect(first?.firstElementChild?.tagName).toBe('TIME');
    expect(first?.children[1]?.tagName).toBe('H3');
    expect(first?.lastElementChild?.tagName).toBe('A');
    // 外链态 + 站内态并存
    const external = [...document.querySelectorAll('.news-rows a')].find((a) =>
      a.getAttribute('href')?.includes('c114'),
    );
    expect(external?.getAttribute('target')).toBe('_blank');
    const internal = screen.getByRole('link', { name: '阅读全文 →' });
    expect(internal.getAttribute('href')).toBe('/news/internal-news');
    // 不传 currentSlug：导航无 active 项（此前误挂「研究与洞察」高亮）
    expect(document.querySelector('.site-nav-menu nav a.active')).toBeNull();
    expect(document.querySelector('.site-nav-menu summary.active')).toBeNull();
  });
});

describe('/news/[slug] 最简详情模板（当前零站内实例，fixture 验证）', () => {
  it('站内态：标题/日期/正文/返回锚点', async () => {
    const { getNews } = await import('@/lib/strapi');
    vi.mocked(getNews).mockResolvedValue(internalNews);
    const { default: NewsDetailPage } = await import('@/app/news/[slug]/page');
    const ui = await NewsDetailPage({ params: Promise.resolve({ slug: 'internal-news' }) });
    render(ui);
    expect(screen.getByRole('heading', { level: 1, name: '站内新闻测试' })).toBeTruthy();
    expect(screen.getByText('2026 年 5 月 1 日').tagName).toBe('TIME');
    expect(screen.getByText('正文第一段。')).toBeTruthy();
    expect(screen.getByText('正文第二段。')).toBeTruthy();
    const back = screen.getByRole('link', { name: '← 返回动态列表' });
    expect(back.getAttribute('href')).toBe('/news');
  });

  it('外链态与不存在条目一律 notFound（无假详情页）', async () => {
    const { getNews } = await import('@/lib/strapi');
    const { default: NewsDetailPage } = await import('@/app/news/[slug]/page');
    vi.mocked(getNews).mockResolvedValue(seedNews[0]); // externalUrl 有值
    await expect(
      NewsDetailPage({ params: Promise.resolve({ slug: 'smart-computing-annual-conference' }) }),
    ).rejects.toThrow();
    vi.mocked(getNews).mockResolvedValue(null);
    await expect(
      NewsDetailPage({ params: Promise.resolve({ slug: 'nope' }) }),
    ).rejects.toThrow();
  });

  it('generateMetadata：站内态 title 拼站名、description 取 excerpt', async () => {
    const { getNews } = await import('@/lib/strapi');
    vi.mocked(getNews).mockResolvedValue(internalNews);
    const { generateMetadata } = await import('@/app/news/[slug]/page');
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'internal-news' }) });
    expect(meta.title).toBe('站内新闻测试｜算力海洋');
    expect(meta.description).toBe('站内新闻摘要文本');
    vi.mocked(getNews).mockResolvedValue(null);
    const empty = await generateMetadata({ params: Promise.resolve({ slug: 'nope' }) });
    expect(empty).toEqual({});
  });
});
