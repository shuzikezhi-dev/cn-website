import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SectionRenderer } from '@/components/SectionRenderer';
import { HqChrome } from '@/components/chrome/HqChrome';
import type { HqNavItem, SectionData, SiteConfigHqData, StrapiPage } from '@/types/strapi';
import huaqiao from '../../content-seed/content/huaqiao.json';

/**
 * 05 号工单主测试缝：华侨数港子站 5 页（fixture 单一源 = content-seed/content/huaqiao.json）。
 * 覆盖：ADR-0008 映射（门户 hero/signal/benefit/双栏合规/steps，partner）、
 * site-config-hq 驱动的全局件（政务顶条返回主站、页脚 disclaimer 按页渲染、
 * nav active）、皮肤零分支与 12 组遗留样式缺席。
 * cloud/enterprise/global 三页自 2026-09 起为静态单文件页（sections 空壳，
 * 内容主体由前端内嵌渲染，见 hq-static-pages）——本文件只测其种子形态与全局件。
 */
const bySlug = Object.fromEntries(
  huaqiao.pages.map((p) => [p.slug, p]),
) as unknown as Record<string, StrapiPage>;
const slugs = ['home', 'cloud', 'enterprise', 'global', 'ecosystem'];

const config = huaqiao.siteConfigHq as unknown as SiteConfigHqData;
const nav: HqNavItem[] = [...huaqiao.pages]
  // 落地页废弃（.scratch/huaqiao-redirect/）：getHqNavPages 前端过滤 home
  //（见 tests/hq-nav.test.ts），fixture 对齐生产链路的 4 项形态
  .filter((p) => p.slug !== 'home')
  .sort((a, b) => a.navOrder - b.navOrder)
  .map((p) => ({ slug: p.slug, navTitle: p.navTitle ?? p.title }));

const GLOBAL_FORM_URL = config.formUrl ?? '';

function renderSections(slug: string) {
  render(
    <SectionRenderer sections={bySlug[slug].sections as SectionData[]} formUrl={GLOBAL_FORM_URL} />,
  );
}

function renderChrome(slug: string) {
  render(
    <HqChrome config={config} page={bySlug[slug]} nav={nav}>
      <SectionRenderer sections={bySlug[slug].sections as SectionData[]} formUrl={GLOBAL_FORM_URL} />
    </HqChrome>,
  );
}

describe('seed 骨架：url-plan 定稿的 slug/site/navOrder', () => {
  it('5 页 slug 单级、site=hq、navOrder 首页起 0-4 连续', () => {
    expect(slugs).toEqual(['home', 'cloud', 'enterprise', 'global', 'ecosystem']);
    for (const p of huaqiao.pages) {
      expect(p.site).toBe('hq');
      expect(p.disclaimer).toBeTruthy(); // 页面级免责是子站刚性内容
    }
    expect(huaqiao.pages.map((p) => p.navOrder).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('门户 hero heading 富文本含 em 副题（gov 皮肤块级渐变渲染源）', () => {
    const hero = bySlug.home.sections[0] as { heading?: string };
    expect(hero.heading).toContain('<br />');
    expect(hero.heading).toContain('<em>来数加工 · 算力服务 · 全球连接</em>');
  });
});

describe('/huaqiao 门户：hero + value-strip + benefit + 双栏合规 + steps', () => {
  it('service-hero 形态：home-hero 类、胶囊徽章 4 枚、外链主按钮', () => {
    renderSections('home');
    const hero = document.querySelector('section.hero');
    expect(hero?.className).toContain('home-hero');
    expect(document.querySelectorAll('.trust span')).toHaveLength(4);
    const formLink = screen.getByRole('link', { name: '提交企业需求' });
    expect(formLink.getAttribute('href')).toBe(GLOBAL_FORM_URL);
    expect(formLink.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: '生态合作' }).getAttribute('href')).toBe(
      '/huaqiao/ecosystem',
    );
  });

  it('signal-band 三联承诺 + benefit 三卡（单字图标/结果行/内页链接）', () => {
    renderSections('home');
    expect(document.querySelectorAll('.signal div')).toHaveLength(3);
    const benefit = document.querySelector('.benefit-grid');
    expect(benefit?.querySelectorAll('article')).toHaveLength(3);
    expect(screen.getByText('企').tagName).toBe('I');
    expect(screen.getByText('结果：形成可经营的本地主体与服务入口').tagName).toBe('STRONG');
    expect(screen.getByText('了解企业落地服务 →').getAttribute('href')).toBe(
      '/huaqiao/enterprise',
    );
  });

  it('双栏：左 numbered 受众 4 项（词条粗体）+ 右 compliance 米黄卡 4 原则', () => {
    renderSections('home');
    const numbered = document.querySelectorAll('ul.numbered li');
    expect(numbered).toHaveLength(4);
    expect(screen.getByText('中国出海企业').tagName).toBe('B');
    const card = document.querySelector('.compliance-card');
    expect(card).toBeTruthy();
    expect(card?.querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByText('业务真实').tagName).toBe('B');
  });

  it('process-flow 横向 4 步（中文数字序号由 gov 皮肤 CSS 渲染，不入库）', () => {
    renderSections('home');
    const flow = document.querySelector('.method-flow');
    expect(flow?.querySelectorAll('article')).toHaveLength(4);
    // 组件渲染的 b 是阿拉伯序号文本，gov CSS 以 nth-child ::before 重绘中文数字
    expect(flow?.querySelector('article b')?.textContent).toBe('01');
    expect(screen.getByText('跟进交付').tagName).toBe('H3');
  });
});

describe('/huaqiao/cloud|enterprise|global：静态单文件页（内容主体不经 CMS 区块维护）', () => {
  it('三页种子 sections 为空数组——前台由内嵌静态 HTML 渲染（hq-static route 遮蔽 [slug]）', () => {
    // 2026-09 新版二级页：设计侧单文件导出，CMS 条目仅承载页面级信息
    // （title/navTitle/ctaLabel/seo 可管理），区块组件不参与维护
    for (const slug of ['cloud', 'enterprise', 'global']) {
      expect(bySlug[slug].sections).toEqual([]);
    }
  });

  it('三页页面级元数据对齐新版：标题/导航/CTA/SEO 与单文件页一致', () => {
    expect(bySlug.cloud.title).toBe('云平台');
    expect(bySlug.cloud.navTitle).toBe('云平台');
    expect(bySlug.cloud.ctaLabel).toBe('申请评估');
    expect(bySlug.cloud.seo?.title).toBe('云平台｜云主机 · 带宽 · 网络标准服务包｜华侨数港');
    expect(bySlug.enterprise.ctaLabel).toBe('提交落地需求');
    expect(bySlug.enterprise.seo?.title).toBe('企业落地服务｜工商注册与一站式落地代办｜华侨数港');
    expect(bySlug.global.ctaLabel).toBe('提交海外需求');
    expect(bySlug.global.seo?.title).toBe('海外服务｜全球节点 · 算力协同 · 商务网络｜华侨数港');
  });
});

describe('/huaqiao/ecosystem：partner 最简卡', () => {
  it('6 张 h3+p 卡（无图标/序号/链接）', () => {
    renderSections('ecosystem');
    const partners = document.querySelectorAll('.partner-types article');
    expect(partners).toHaveLength(6);
    expect(partners[0]?.querySelector('h3')?.textContent).toBe('企业落地服务伙伴');
    expect(partners[0]?.querySelector('i')).toBeNull();
  });
});

describe('全局件（site-config-hq 驱动）', () => {
  it('皮肤壳挂 data-skin=gov；政务顶条返回主站链接有效', () => {
    renderChrome('home');
    expect(document.querySelector('[data-skin="gov"]')).toBeTruthy();
    const back = screen.getByRole('link', { name: '算力海洋主站' });
    expect(back.getAttribute('href')).toBe('/');
    // 顶条左槽为「站名 · 标语」
    expect(document.querySelector('.official-bar span')?.textContent).toBe(
      '华侨数港 · 来数加工与算力服务门户',
    );
  });

  it('nav 4 项派生自 Page 集合（落地页废弃去「首页」），当前页 active；顶条 CTA 逐页文案引全局表单', () => {
    renderChrome('cloud');
    const links = document.querySelectorAll('.hq-menu nav a');
    expect(links).toHaveLength(4);
    expect(links[0].getAttribute('href')).toBe('/huaqiao/enterprise');
    expect(links[1].className).toBe('active');
    const cta = document.querySelector('.hq-action');
    expect(cta?.textContent).toBe('申请评估');
    expect(cta?.getAttribute('href')).toBe(GLOBAL_FORM_URL);
  });

  it('品牌 logo 直指 /huaqiao/enterprise（门户废弃后不回 /huaqiao 吃 301）', () => {
    renderChrome('cloud');
    expect(document.querySelector('a.hq-brand')?.getAttribute('href')).toBe(
      '/huaqiao/enterprise',
    );
  });

  it('页脚 disclaimer 按页渲染 + 公司全称署名 + 链接组', () => {
    renderChrome('enterprise');
    const notice = screen.getByText('重要说明').closest('div')?.querySelector('p');
    expect(notice?.textContent).toBe('服务申请不代表审批通过；具体办理由相应专业机构按规定实施。');
    expect(document.querySelector('.hq-footer > small')?.textContent).toBe(
      '汕头华侨数港算力科技有限公司',
    );
    const footer = document.querySelector('.hq-footer') as HTMLElement;
    expect(within(footer).getByRole('link', { name: '海外服务' }).getAttribute('href')).toBe(
      '/huaqiao/global',
    );
  });
});

describe('皮肤零分支与遗留样式缺席（验收 checklist 2/5）', () => {
  // vitest 运行 cwd = web/（jsdom 环境 import.meta.url 非 file 协议，故用 cwd 相对）
  const webRoot = process.cwd();

  it('内容区块/元素组件源码无皮肤感知（无 data-skin / gov 字样）', () => {
    for (const dir of ['sections', 'elements']) {
      for (const f of readdirSync(path.join(webRoot, 'src/components', dir))) {
        const source = readFileSync(path.join(webRoot, 'src/components', dir, f), 'utf-8');
        expect(source.includes('data-skin'), `${dir}/${f} 不应感知皮肤属性`).toBe(false);
        expect(source.includes("'gov'"), `${dir}/${f} 不应有 gov 分支`).toBe(false);
      }
    }
  });

  it('globals.css 未迁入 12 组 v0.1/v0.2 遗留政务样式', () => {
    const css = readFileSync(path.join(webRoot, 'src/app/globals.css'), 'utf-8');
    const legacyClasses = [
      'form-section',
      'policy-grid',
      'policy-main',
      'policy-label',
      'duty-grid',
      'process-panel',
      'hq-hero',
      'hq-copy',
      'hq-visual',
      'hq-authority',
      'image-note',
      'hq-contact',
      'conversion',
    ];
    for (const cls of legacyClasses) {
      expect(css.includes(cls), `遗留类 .${cls} 不应出现在新仓样式`).toBe(false);
    }
  });
});
