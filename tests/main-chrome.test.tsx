import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MainChrome } from '@/components/chrome/MainChrome';
import { HqChrome } from '@/components/chrome/HqChrome';
import { SectionRenderer } from '@/components/SectionRenderer';
import { buildMainNavTree, mainPageUrl } from '@/lib/nav';
import type {
  MainNavItem,
  SectionData,
  SiteConfigHqData,
  SiteConfigMainData,
  StrapiPage,
} from '@/types/strapi';
import home from '../../content-seed/content/home.json';
import government from '../../content-seed/content/government.json';
import industry from '../../content-seed/content/industry.json';
import services from '../../content-seed/content/services.json';
import resources from '../../content-seed/content/resources.json';
import insights from '../../content-seed/content/insights.json';
import alliance from '../../content-seed/content/alliance.json';
import huaqiao from '../../content-seed/content/huaqiao.json';
import whitepaper from '../../content-seed/content/whitepaper.json';

/**
 * 08 号工单主测试缝：主站全局件（MainChrome = 导航 + 逐页 CTA + 页脚）
 * 与导航派生纯函数 buildMainNavTree。
 * fixture 双源：content-seed 主站 7 页（nav 顺序/CTA/footer 对照 v0.3 逐字）
 * + 内联 navParent/navHidden 场景（seed 忠实 v0.3 全平铺，二级与降级
 * 用内联 fixture 驱动——运行时验证走 API 造页冒烟）。
 */
const mainSeedPages = [
  home.pages[0],
  government.pages[0],
  industry.pages[0],
  services.pages[0],
  resources.pages[0],
  insights.pages[0],
  alliance.pages[0],
] as unknown as Array<{
  slug: string;
  navTitle?: string;
  title: string;
  navOrder: number;
  ctaLabel?: string;
  ctaUrl?: string;
}>;

/** seed → getMainNavPages 返回形态（navTitle 回退 title 的映射源） */
function navFromSeed(): MainNavItem[] {
  return [...mainSeedPages]
    .sort((a, b) => a.navOrder - b.navOrder)
    .map((p) => ({ slug: p.slug, navTitle: p.navTitle || p.title, navOrder: p.navOrder }));
}

const config = home.siteConfigMain as unknown as SiteConfigMainData;

function renderChrome(opts?: {
  nav?: MainNavItem[];
  currentSlug?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  return render(
    <MainChrome
      config={config}
      nav={opts?.nav ?? navFromSeed()}
      currentSlug={opts?.currentSlug ?? 'home'}
      ctaLabel={opts?.ctaLabel}
      ctaUrl={opts?.ctaUrl}
    >
      <p>content</p>
    </MainChrome>,
  );
}

describe('buildMainNavTree：排序 / 分组 / 孤儿降级（验收 1/3）', () => {
  it('seed 主站 7 页按 navOrder 排序，home 即根路径', () => {
    const tree = buildMainNavTree(navFromSeed());
    expect(tree.map((n) => n.slug)).toEqual([
      'home',
      'government',
      'industry',
      'services',
      'resources',
      'insights',
      'alliance',
    ]);
    expect(tree[0].url).toBe('/');
    expect(tree[1].url).toBe('/government');
    expect(mainPageUrl('home')).toBe('/');
  });

  it('navParent 指向可见页 → 挂二级；一级顺序保持、二级按 navOrder', () => {
    const items: MainNavItem[] = [
      { slug: 'home', navTitle: '首页', navOrder: 0 },
      { slug: 'resources', navTitle: '全球资源', navOrder: 1 },
      { slug: 'idc', navTitle: 'IDC 检索', navOrder: 5, navParentSlug: 'resources' },
      { slug: 'cloud', navTitle: '云平台', navOrder: 4, navParentSlug: 'resources' },
    ];
    const tree = buildMainNavTree(items);
    expect(tree.map((n) => n.slug)).toEqual(['home', 'resources']);
    expect(tree[1].children.map((n) => n.slug)).toEqual(['cloud', 'idc']);
  });

  it('父页被删 / navHidden / 未发布（不在可见集合）→ 子项降级一级（验收 3）', () => {
    const items: MainNavItem[] = [
      { slug: 'home', navTitle: '首页', navOrder: 0 },
      { slug: 'orphan', navTitle: '孤儿', navOrder: 3, navParentSlug: 'deleted-parent' },
      { slug: 'hidden-parent-child', navTitle: '隐父子项', navOrder: 4, navParentSlug: 'hidden' },
    ];
    const tree = buildMainNavTree(items);
    // 查询层已过滤 navHidden（本函数入参即可见集合），父不在集合统一降级
    expect(tree.map((n) => n.slug)).toEqual(['home', 'orphan', 'hidden-parent-child']);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('降级子项并入一级后按自身 navOrder 重排（不坠队尾）', () => {
    const items: MainNavItem[] = [
      { slug: 'home', navTitle: '首页', navOrder: 0 },
      { slug: 'last', navTitle: '末位', navOrder: 9 },
      { slug: 'demoted', navTitle: '降级项', navOrder: 1, navParentSlug: 'gone' },
    ];
    expect(buildMainNavTree(items).map((n) => n.slug)).toEqual(['home', 'demoted', 'last']);
  });

  it('自引用 navParent 按一级处理（schema 无环约束的防御）', () => {
    const items: MainNavItem[] = [
      { slug: 'self', navTitle: '自环', navOrder: 0, navParentSlug: 'self' },
    ];
    const tree = buildMainNavTree(items);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(0);
  });

  it('互指环（A.navParent=B 且 B.navParent=A）：环成员均降级一级，不静默消失', () => {
    const items: MainNavItem[] = [
      { slug: 'home', navTitle: '首页', navOrder: 0 },
      { slug: 'a', navTitle: '甲', navOrder: 1, navParentSlug: 'b' },
      { slug: 'b', navTitle: '乙', navOrder: 2, navParentSlug: 'a' },
    ];
    const tree = buildMainNavTree(items);
    expect(tree.map((n) => n.slug)).toEqual(['home', 'a', 'b']);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('三元环 + 挂环成员的页：环成员全降一级，挂载页正常作二级', () => {
    const items: MainNavItem[] = [
      { slug: 'x', navTitle: 'X', navOrder: 0, navParentSlug: 'y' },
      { slug: 'y', navTitle: 'Y', navOrder: 1, navParentSlug: 'z' },
      { slug: 'z', navTitle: 'Z', navOrder: 2, navParentSlug: 'x' },
      { slug: 'leaf', navTitle: '叶', navOrder: 3, navParentSlug: 'x' },
    ];
    const tree = buildMainNavTree(items);
    expect(tree.map((n) => n.slug)).toEqual(['x', 'y', 'z']);
    expect(tree[0].children.map((n) => n.slug)).toEqual(['leaf']);
  });

  it('三级链（A←B←C）：C 截断上提到顶级 A 之下，不静默消失（渲染仅两级）', () => {
    const items: MainNavItem[] = [
      { slug: 'home', navTitle: '首页', navOrder: 0 },
      { slug: 'a', navTitle: '一级', navOrder: 1 },
      { slug: 'b', navTitle: '二级', navOrder: 2, navParentSlug: 'a' },
      { slug: 'c', navTitle: '三级', navOrder: 3, navParentSlug: 'b' },
      { slug: 'd', navTitle: '四级', navOrder: 4, navParentSlug: 'c' },
    ];
    const tree = buildMainNavTree(items);
    expect(tree.map((n) => n.slug)).toEqual(['home', 'a']);
    expect(tree[1].children.map((n) => n.slug)).toEqual(['b', 'c', 'd']);
  });

  it('navOrder null 与正数混排：null 按 0 参与排序（?? 0 语义锁定）', () => {
    const items: MainNavItem[] = [
      { slug: 'tail', navTitle: '末位', navOrder: 5 },
      { slug: 'null-order', navTitle: '空序', navOrder: null },
      { slug: 'zero', navTitle: '零序', navOrder: 0 },
      { slug: 'two', navTitle: '二序', navOrder: 2 },
    ];
    const tree = buildMainNavTree(items);
    // null 与 0 并列稳定序（入参序在前），均在正数之前
    expect(tree.map((n) => n.slug)).toEqual(['null-order', 'zero', 'two', 'tail']);
  });
});

describe('MainChrome 导航渲染（验收 1/2）', () => {
  it('7 项平铺一级、当前页 active；二级 fixture 渲染 details 下拉', () => {
    renderChrome({ currentSlug: 'services' });
    // 桌面常显导航（2026-09-29 双渲染）：一级项住在独立 .site-nav-desktop
    const links = document.querySelectorAll('.site-nav-desktop > a');
    expect(links).toHaveLength(7);
    expect(links[0].getAttribute('href')).toBe('/');
    expect(links[3].className).toBe('active');
    expect(document.querySelector('.site-nav-drop')).toBeNull();
  });

  it('二级下拉：summary 内嵌父页链接、sub 只含子项；子页 active 父也亮', () => {
    const nav: MainNavItem[] = [
      { slug: 'home', navTitle: '首页', navOrder: 0 },
      { slug: 'resources', navTitle: '全球资源', navOrder: 1 },
      { slug: 'idc', navTitle: 'IDC 检索', navOrder: 2, navParentSlug: 'resources' },
    ];
    renderChrome({ nav, currentSlug: 'idc' });
    const drop = document.querySelector('.site-nav-drop');
    expect(drop?.querySelector('summary')?.textContent).toBe('全球资源');
    expect(drop?.querySelector('summary')?.className).toContain('active');
    // 父页入口住在 summary 里（桌面点击直达 /resources），sub 不再重复父级
    expect(drop?.querySelector('summary a')?.getAttribute('href')).toBe('/resources');
    const sub = drop?.querySelector('.site-nav-sub');
    expect(sub?.querySelectorAll('a')).toHaveLength(1);
    expect(within(sub as HTMLElement).getByText('IDC 检索').className).toBe('active');
  });

  it('白皮书 landing 挂 insights 二级（seed 驱动）：下拉含「词元工厂发展白皮书」且 href=/whitepaper', () => {
    const wp = whitepaper.landingPages[0] as {
      slug: string;
      navTitle: string;
      navOrder: number;
      navParentSlug: string;
    };
    const nav: MainNavItem[] = [
      ...navFromSeed(),
      // getMainNavPages 的 landing 合并形态（navTitle/navOrder/navParentSlug 同构）
      { slug: wp.slug, navTitle: wp.navTitle, navOrder: wp.navOrder, navParentSlug: wp.navParentSlug },
    ];
    renderChrome({ nav, currentSlug: 'insights' });
    const drop = document.querySelector('.site-nav-drop');
    expect(drop?.querySelector('summary')?.textContent).toBe('研究与洞察');
    // 父页入口在 summary 内嵌链接，sub 只有白皮书子项
    expect(drop?.querySelector('summary a')?.getAttribute('href')).toBe('/insights');
    const sub = drop?.querySelector('.site-nav-sub');
    expect(sub?.querySelectorAll('a')).toHaveLength(1);
    const wpLink = within(sub as HTMLElement).getByRole('link', { name: '词元工厂发展白皮书' });
    expect(wpLink.getAttribute('href')).toBe('/whitepaper');
    // 导航子项指向专题落地页也新开（2026-09-23：lib/link-target，线上即此形态）；
    // 父页 /insights 是主站内容页，同窗
    expect(wpLink.getAttribute('target')).toBe('_blank');
    expect(drop?.querySelector('summary a')?.getAttribute('target')).toBeNull();
  });

  it('navHidden 页不在导航（取数层过滤，seed 侧无此页），URL 直访由路由层保证', () => {
    // 取数过滤在 getMainNavPages 的 filters[navHidden][$eq]=false——源码扫描兜底
    const source = readFileSync(path.join(process.cwd(), 'src/lib/strapi.ts'), 'utf-8');
    expect(source).toContain("'filters[navHidden][$eq]': 'false'");
    expect(source).toContain("'populate[navParent][fields][0]': 'slug'");
    expect(source).toContain('p.navTitle || p.title'); // navTitle 空回退 title（验收 1）
    // landing 并入导航派生（白皮书二级）：同款过滤 + slug 撞名防御（Page 优先）
    expect(source).toContain('/api/landing-pages?');
    expect(source).toContain('!seen.has(i.slug)');
  });
});

describe('逐页 CTA 回退链（验收 4）', () => {
  it('页面级 ctaLabel/ctaUrl 优先：government 的「合作咨询」页内锚', () => {
    renderChrome({ currentSlug: 'government', ctaLabel: '合作咨询', ctaUrl: '#cooperate' });
    const cta = document.querySelector('.site-nav-cta') as HTMLAnchorElement;
    expect(cta.textContent).toBe('合作咨询');
    expect(cta.getAttribute('href')).toBe('#cooperate');
    expect(cta.getAttribute('target')).toBeNull();
  });

  it('页面未配置 → site-config formCtaLabel/formUrl；外链新窗', () => {
    renderChrome({ currentSlug: 'services' });
    const cta = document.querySelector('.site-nav-cta') as HTMLAnchorElement;
    expect(cta.textContent).toBe('合作咨询');
    expect(cta.getAttribute('href')).toBe(config.formUrl);
    expect(cta.getAttribute('target')).toBe('_blank');
    expect(cta.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('config 亦空 → 固定文案兜底', () => {
    render(
      <MainChrome config={null} nav={navFromSeed()} currentSlug="home">
        <p>content</p>
      </MainChrome>,
    );
    const cta = document.querySelector('.site-nav-cta') as HTMLAnchorElement;
    expect(cta.textContent).toBe('合作咨询');
    expect(cta.getAttribute('href')).toBe('#');
  });

  it('seed 逐页 CTA：全局 formCtaLabel=合作咨询收口，主站页面级清空（2026-09-23 全站统一）', () => {
    const bySlug = Object.fromEntries(mainSeedPages.map((p) => [p.slug, p]));
    // 2026-09-23 主站全站统一：头部 CTA 文字一律走全局 formCtaLabel（后台一处
    // 改全站生效），页面级 ctaLabel 全清（insights 的「研究合作」并入全局）；
    // 锚点 ctaUrl 仍逐页保留；白皮书 landing 的「获取白皮书」是专题转化文案不在此列
    expect(bySlug.home.ctaLabel).toBeUndefined();
    expect(bySlug.home.ctaUrl).toBe('#contact');
    expect(bySlug.government.ctaLabel).toBeUndefined();
    expect(bySlug.government.ctaUrl).toBe('#cooperate');
    expect(bySlug.industry.ctaLabel).toBeUndefined();
    expect(bySlug.industry.ctaUrl).toBe('#contact');
    expect(bySlug.insights.ctaLabel).toBeUndefined();
    expect(bySlug.insights.ctaUrl).toBe('#cooperate');
    // v0.3 services/resources/alliance 无 nav-cta：seed 留空走全局回退
    expect(bySlug.services.ctaLabel).toBeUndefined();
    expect(bySlug.resources.ctaLabel).toBeUndefined();
    expect(bySlug.alliance.ctaLabel).toBeUndefined();
  });
});

describe('主站页脚（验收 5：site-config-main 对照 v0.3 footer 逐元素）', () => {
  it('品牌区：siteTagline + footerTagline + 反白 logo（皮肤资产静态路径）', () => {
    renderChrome();
    const brand = document.querySelector('.site-foot-brand') as HTMLElement;
    expect(within(brand).getByText('中国算力与AI应用出海服务平台').tagName).toBe('P');
    expect(within(brand).getByText('连接资源，运营能力，推动 AI 规模化落地。').tagName).toBe('SPAN');
    expect(brand.querySelector('img')?.getAttribute('src')).toBe('/logo/logo_cn_en.svg');
  });

  it('联系我们：3 个 mailto 链接（v0.3 footer-contact 逐字）', () => {
    renderChrome();
    const contact = document.querySelector('.site-foot-contact') as HTMLElement;
    expect(within(contact).getByText('联系我们').tagName).toBe('B');
    const mails = contact.querySelectorAll('a');
    expect(mails).toHaveLength(3);
    expect(mails[0].getAttribute('href')).toBe('mailto:partner@suanlihaiyang.com');
    expect(mails[1].textContent).toBe('bd@tokenocean.net');
    expect(mails[2].textContent).toBe('cs@tokenocean.net');
  });

  it('快速入口：url 空渲染纯文本占位项，有值渲染链接', () => {
    renderChrome();
    const links = document.querySelector('.site-foot-links') as HTMLElement;
    expect(within(links).getByText('快速入口').tagName).toBe('B');
    expect(within(links).getByText('客户入口（即将开放）').tagName).toBe('SPAN');
    expect(within(links).getByRole('link', { name: '研究与洞察' }).getAttribute('href')).toBe(
      '/insights',
    );
    expect(within(links).getByRole('link', { name: '联盟生态' }).getAttribute('href')).toBe(
      '/alliance',
    );
  });

  it('备案行：公司全称 + ICP 号链工信部备案站（新窗）+ 免责默认文案', () => {
    renderChrome();
    const record = document.querySelector('.site-foot-record') as HTMLElement;
    expect(within(record).getByText('北京算力海技术有限公司').tagName).toBe('SPAN');
    const icp = within(record).getByRole('link', { name: '京ICP备13013182号-17' });
    expect(icp.getAttribute('href')).toBe('https://beian.miit.gov.cn/');
    expect(icp.getAttribute('target')).toBe('_blank');
    expect(within(record).getByText('资源节点、指标和可用性以伙伴确认及正式协议为准。').tagName).toBe('SMALL');
  });
});

describe('main/hq 两组配置不串染（验收 5）', () => {
  it('MainChrome 无 gov 皮肤标记；HqChrome 无主站页脚标记', () => {
    const { unmount } = renderChrome();
    expect(document.querySelector('[data-skin="gov"]')).toBeNull();
    expect(document.querySelector('.official-bar')).toBeNull();
    expect(document.querySelector('.hq-footer')).toBeNull();
    unmount();

    const hqPage = huaqiao.pages[0] as unknown as StrapiPage;
    render(
      <HqChrome
        config={huaqiao.siteConfigHq as unknown as SiteConfigHqData}
        page={hqPage}
        nav={[]}
      >
        <SectionRenderer
          sections={hqPage.sections as SectionData[]}
          formUrl={huaqiao.siteConfigHq.formUrl}
        />
      </HqChrome>,
    );
    expect(document.querySelector('.site-foot')).toBeNull();
    expect(document.querySelector('.site-nav')).toBeNull();
    // hq 页脚公司署名走 site-config-hq 自己的 companyName
    expect(document.querySelector('.hq-footer > small')?.textContent).toBe(
      '汕头华侨数港算力科技有限公司',
    );
  });

  it('v0.3 shantou 系页脚无 ICP/邮箱结构——hq 侧不补（对照核查结论）', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf-8');
    // hq 皮肤段不引入主站页脚新类（.site-foot-* 限定主站，不入 [data-skin='gov']）
    expect(css.includes("[data-skin='gov'] .site-foot")).toBe(false);
  });
});

describe('MainChrome 零皮肤分支与 404 页（验收 6）', () => {
  it('chrome 组件源码无皮肤感知（无 data-skin / gov / landing）', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/chrome/MainChrome.tsx'),
      'utf-8',
    );
    expect(source.includes('data-skin')).toBe(false);
    expect(source.includes("'gov'")).toBe(false);
    expect(source.includes('landing')).toBe(false);
  });

  it('404 页存在且带返回首页入口（not-found.tsx 源码扫描，next/link 不入 jsdom）', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/not-found.tsx'), 'utf-8');
    expect(source).toContain('export default function NotFound');
    expect(source).toContain('href="/"');
    expect(source).toContain('返回首页');
    expect(source).toContain('404');
  });
});
