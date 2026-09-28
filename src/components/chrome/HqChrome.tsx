import type { ReactNode } from 'react';
import type { HqNavItem, SiteConfigHqData, StrapiPage } from '@/types/strapi';
import { strapiMediaUrl } from '@/lib/strapi';

/**
 * 华侨数港子站全局件（05 号工单）：official-bar（顶条：站名标语 + 返回主站）
 * → hq-header（品牌 + nav + 顶条 CTA）→ main（页面 Dynamic Zone）→
 * hq-footer（品牌 / 链接组 / 重要说明=页面级 disclaimer 按页渲染 / 公司全称署名）。
 * 页头已对齐二级页 2026-09 新版设计（深海军蓝顶条 + 白底卡位 header +
 * .wrap 居中容器 + 横版 logo 品牌槽 hq-emblem，形态见 gov 皮肤 CSS 段）。
 *
 * 皮肤挂载：本组件根节点 data-skin="gov"——根布局保持 data-skin="main"，
 * CSS 自定义属性在 gov 子树内整片切换，内容区块组件零皮肤分支
 * （[data-skin='gov'] 形态重绘全在 globals.css）。
 *
 * 导航为 Page 集合派生（site=hq + navOrder，ADR-0002），slug home 即
 * /huaqiao 根（url-plan.md 定稿）；移动端菜单用 details/summary 零 JS 开合。
 */
export function hqPageUrl(slug: string) {
  return slug === 'home' ? '/huaqiao' : `/huaqiao/${slug}`;
}

export function HqChrome({
  config,
  page,
  nav,
  children,
}: {
  config: SiteConfigHqData | null;
  page: StrapiPage;
  nav: HqNavItem[];
  children: ReactNode;
}) {
  const logoUrl = strapiMediaUrl(config?.logo);
  const ctaLabel = page.ctaLabel || config?.formCtaLabel || '提交需求';
  const ctaUrl = page.ctaUrl || config?.formUrl || '#';
  const externalForm = /^https?:\/\//.test(ctaUrl);
  const backUrl = config?.backUrl ?? '/';
  const externalBack = /^https?:\/\//.test(backUrl);

  return (
    <div data-skin="gov">
      <div className="official-bar">
        <div className="wrap">
          <span>
            <b>{config?.siteName ?? '华侨数港'}</b>
            {config?.siteTagline ? ` · ${config.siteTagline}` : ''}
          </span>
          <a
            href={backUrl}
            {...(externalBack ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {config?.backLabel ?? '算力海洋主站'}
            {externalBack ? ' ↗' : ''}
          </a>
        </div>
      </div>

      <header className="hq-header">
        <div className="wrap">
          {/* 门户废弃（.scratch/huaqiao-redirect/）：品牌直指 enterprise，不回 /huaqiao 吃一跳 301 */}
          <a className="hq-brand" href="/huaqiao/enterprise">
            {logoUrl ? (
              <img
                className="hq-emblem"
                src={logoUrl}
                alt={config?.siteName ?? '华侨数港'}
                width={44}
                height={44}
              />
            ) : null}
            <span>
              <b>{config?.siteName ?? '华侨数港'}</b>
              {config?.companyName ? <small>{config.companyName}</small> : null}
            </span>
          </a>
          <details className="hq-menu">
            <summary aria-label="菜单">☰</summary>
            <nav>
              {nav.map((item) => (
                <a
                  key={item.slug}
                  className={item.slug === page.slug ? 'active' : undefined}
                  href={hqPageUrl(item.slug)}
                >
                  {item.navTitle}
                </a>
              ))}
            </nav>
          </details>
          <a
            className="hq-action"
            href={ctaUrl}
            {...(externalForm ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {ctaLabel}
          </a>
        </div>
      </header>

      <main>{children}</main>

      <footer className="hq-footer">
        <div className="hq-footer-brand">
          {logoUrl ? (
            <span className="hq-brand-icon white">
              <img
                src={logoUrl}
                alt={config?.siteName ?? '华侨数港'}
                width={config?.logo?.width}
                height={config?.logo?.height}
              />
            </span>
          ) : null}
          <span>
            <b>{config?.siteName ?? '华侨数港'}</b>
            <p>
              {page.slug === 'home'
                ? (config?.siteTagline ?? '')
                : (page.navTitle || page.title)}
            </p>
          </span>
        </div>
        <div>
          <b>服务入口</b>
          {(config?.footerLinks ?? []).map((link, i) =>
            link.url ? (
              <a
                key={link.id ?? i}
                href={link.url}
                {...(/^https?:\/\//.test(link.url)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {link.label}
              </a>
            ) : (
              // url 空 = 纯文本占位项（08 号 footer-link url 转非必填；hq seed 现全有 url）
              <span key={link.id ?? i}>{link.label}</span>
            ),
          )}
        </div>
        <div>
          <b>重要说明</b>
          <p>{page.disclaimer ?? config?.footerNoticeDefault ?? ''}</p>
        </div>
        <small>{config?.companyName ?? ''}</small>
      </footer>
    </div>
  );
}
