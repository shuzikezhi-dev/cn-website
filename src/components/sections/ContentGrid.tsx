import type { ContentGridData, InsightEntryData } from '@/types/strapi';
import { SectionHead } from '@/components/elements/SectionHead';
import { newsDisplayDate } from '@/lib/format';
import { openInNewTab } from '@/lib/link-target';

/** 2.0 PRD 6.1 四类洞察：CMS ASCII 枚举 → 前台中文标签 */
const INSIGHT_CATEGORY_LABELS: Record<NonNullable<InsightEntryData['category']>, string> = {
  whitepaper: '白皮书/产业报告',
  market: '市场研究',
  standard: '服务标准',
  certification: '测评认证',
};

/**
 * 内容卡网格（kind 四态，04 号工单调通、2.0 增 insightList）：
 * - insight / publication：section.section.insights-preview > .insight-cards >
 *   .insight-card（span tag + h3 + p + b ctaText）。linkCards=true 且卡有 link 时
 *   整卡为链接（v0.3 首页三卡均为 a）；featured=true 时首卡加 .featured 类
 *   （v0.3 CSS 无差异化规则，仅 DOM 钩子）；publication 与 insight 同构（06 号白皮书页消费）。
 * - news：section.section.tint#news > .news-grid > article（time + h3 + p + a），
 *   数据来自页面层 enrichSections 注入的 data.news（News 集合最新 newsLimit 条、
 *   publishDate 倒序）。externalUrl 二态：有值卡尾链接直跳外链（新窗口），
 *   无值进 /news/[slug]；id=news 是详情页「返回列表」的锚点（v0.3 无此 id，增量钩子）。
 *   newsLayout=rows（运行时开关）容器换 .news-rows——/news 列表页一行一条
 *   通栏行卡（卡内纵排 time→标题→摘要→尾链）；CMS 区块缺省 grid 三卡不变。
 * - insightList（2.0 PRD 6.1/6.3）：.insight-list > article（中文分类标签 + h3 +
 *   p 简介 + 「点击查看 →」尾链，外链/分站/专题新开窗判定收口 lib/link-target
 *   （2026-09-23：洞察条目 link 指向 /whitepaper 白皮书专题，点击新标签打开），
 *   数据来自 enrichSections 注入的 data.insights（Insight 集合 publishDate 倒序）。
 *   类名独立于 .insight-cards（insights-news.test 对其有数量断言）。
 *   id=insights 是本页 hero govCard「点击查看」尾链的锚点落点（同 id=news 增量钩子先例）。
 *   newsLayout=rows（2026-09-24 运行时开关，/insights/all 全量列表页注入）容器换
 *   .news-rows——一行一条通栏行卡（参考 /news，CMS schema 不加字段）；
 *   moreLabel/moreUrl 尾链 .news-more 同构（kind 无关字段，/insights 页
 *   「查看全部洞察」入口）。
 */
export function ContentGrid({
  data,
  headLevel = 'h2',
}: {
  data: ContentGridData;
  /** 页面级 H1 场景（/news 列表页区块标题升 H1），缺省 h2 */
  headLevel?: 'h1' | 'h2';
}) {
  if (data.kind === 'insightList') {
    const entries = data.insights ?? [];
    return (
      <section className="section tint insight-list-section" id="insights">
        {data.head ? <SectionHead data={data.head} headingAs={headLevel} /> : null}
        <div className={data.newsLayout === 'rows' ? 'news-rows' : 'insight-list'}>
          {entries.map((item) => (
            <article key={item.id}>
              <span>{INSIGHT_CATEGORY_LABELS[item.category ?? 'whitepaper']}</span>
              <h3>{item.title}</h3>
              {item.excerpt ? <p>{item.excerpt}</p> : null}
              <a
                href={item.link ?? '#'}
                {...(openInNewTab(item.link)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                点击查看 →
              </a>
            </article>
          ))}
        </div>
        {data.moreLabel ? (
          <div className="news-more">
            <a
              href={data.moreUrl ?? '#'}
              {...(openInNewTab(data.moreUrl)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {data.moreLabel}
            </a>
          </div>
        ) : null}
      </section>
    );
  }

  if (data.kind === 'news') {
    const news = data.news ?? [];
    return (
      <section className="section tint" id="news">
        {data.head ? <SectionHead data={data.head} headingAs={headLevel} /> : null}
        <div className={data.newsLayout === 'rows' ? 'news-rows' : 'news-grid'}>
          {news.map((item) => {
            const external = Boolean(item.externalUrl);
            const href = external ? item.externalUrl! : `/news/${item.slug}`;
            // 2.0 PRD 7.1：time 槽扩展「时间 · 地点」（location 空时仅日期，旧数据兼容）
            const when = item.location
              ? `${newsDisplayDate(item)} · ${item.location}`
              : newsDisplayDate(item);
            return (
              <article key={item.id}>
                <time>{when}</time>
                <h3>{item.title}</h3>
                {item.excerpt ? <p>{item.excerpt}</p> : null}
                <a
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noopener noreferrer' : undefined}
                >
                  {external ? '查看报道 →' : '阅读全文 →'}
                </a>
              </article>
            );
          })}
        </div>
        {data.moreLabel ? (
          <div className="news-more">
            <a
              href={data.moreUrl ?? '#'}
              {...(openInNewTab(data.moreUrl)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {data.moreLabel}
            </a>
          </div>
        ) : null}
      </section>
    );
  }

  const cards = data.cards ?? [];
  return (
    <section className="section insights-preview">
      {data.head ? <SectionHead data={data.head} /> : null}
      <div className="insight-cards">
        {cards.map((card, i) => {
          const className = ['insight-card', data.featured && i === 0 ? 'featured' : '']
            .filter(Boolean)
            .join(' ');
          const inner = (
            <>
              {card.tag ? <span>{card.tag}</span> : null}
              <h3>{card.heading}</h3>
              {card.body ? <p>{card.body}</p> : null}
              {card.ctaText ? <b>{card.ctaText}</b> : null}
            </>
          );
          return data.linkCards && card.link ? (
            <a
              className={className}
              href={card.link}
              key={card.id ?? i}
              {...(openInNewTab(card.link)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {inner}
            </a>
          ) : (
            <article className={className} key={card.id ?? i}>
              {inner}
            </article>
          );
        })}
      </div>
    </section>
  );
}
