import type { ReactNode } from 'react';
import type { MainNavItem, MainNavNode, SiteConfigMainData } from '@/types/strapi';
import { buildMainNavTree } from '@/lib/nav';
import { newTabProps, openInNewTab } from '@/lib/link-target';

/**
 * 主站全局件（08 号工单，v0.3/index.html header.top + footer.main-footer 骨架）：
 * site-nav（品牌 logo + nav + 逐页 CTA）→ main（页面 Dynamic Zone）→
 * site-foot（品牌 / 联系我们邮箱组 / 快速入口链接组 / 备案行）。
 *
 * 样式自成 .site-nav/.site-foot 前缀类名段（globals.css 尾部），
 * 不动皮肤切换与专题页既有体系——组件零皮肤分支原则不变。
 * 移动端菜单用 details/summary 零 JS 开合（同 HqChrome 模式）；
 * 二级下拉 v0.3 无源（主站导航全平铺），按 schema navParent 能力自设计：
 * 纯 CSS hover 展开桌面态 + [open] 兜底键盘可达，移动端子项平铺恒显
 * （2026-09-23 定稿：父项点击直达，二级无须逐个点开）。
 *
 * logo 为品牌皮肤资产走 web/public 静态（同 LandingChrome 先例）；
 * CTA 回退链：page.ctaLabel/ctaUrl → config.formCtaLabel/formUrl → 固定文案。
 */
export function MainChrome({
  config,
  nav,
  currentSlug,
  ctaLabel,
  ctaUrl,
  children,
}: {
  config: SiteConfigMainData | null;
  nav: MainNavItem[];
  /** 当前页 slug（active 判定；/news 动态列表不传——独立栏目不高亮主导航） */
  currentSlug?: string | null;
  /** 逐页 CTA（Page.ctaLabel/ctaUrl），空回退 site-config 默认 */
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  children: ReactNode;
}) {
  const tree = buildMainNavTree(nav);
  const siteName = config?.siteName ?? '算力海洋';
  const resolvedCtaLabel = ctaLabel || config?.formCtaLabel || '合作咨询';
  const resolvedCtaUrl = ctaUrl || config?.formUrl || '#';
  const externalCta = openInNewTab(resolvedCtaUrl);

  const isActive = (top: MainNavNode) =>
    top.slug === currentSlug || top.children.some((c) => c.slug === currentSlug);

  // 导航树渲染一份 JSX、两处消费（2026-09-29 双渲染）：桌面常显住独立
  // .site-nav-desktop——关闭态 details 的内容隐藏在 Firefox 等引擎上不可
  // 穿透且无 ::details-content 钩子，原单 details 结构线上塌 0×0；details
  // 版保留为移动端汉堡（open 态各引擎正常渲染）
  const navTree = tree.map((top) =>
              top.children.length > 0 ? (
                <details className="site-nav-drop" key={top.slug}>
                  <summary className={isActive(top) ? 'active' : undefined}>
                    {/* 父页入口内嵌 summary：summary 内 interactive content 点击
                        只导航不触发 toggle——桌面移动一致直达父页；移动端二级
                        平铺恒显（CSS display:block，2026-09-23 定稿），sub 内
                        只放子项不重复父级。导航项链向分站/专题时新开窗
                        （2026-09-23：后台已把白皮书配为「研究与洞察」子项） */}
                    <a href={top.url} {...newTabProps(top.url)}>
                      {top.navTitle}
                    </a>
                  </summary>
                  <div className="site-nav-sub">
                    {top.children.map((child) => (
                      <a
                        key={child.slug}
                        className={child.slug === currentSlug ? 'active' : undefined}
                        href={child.url}
                        {...newTabProps(child.url)}
                      >
                        {child.navTitle}
                      </a>
                    ))}
                  </div>
                </details>
              ) : (
                <a
                  key={top.slug}
                  className={top.slug === currentSlug ? 'active' : undefined}
                  href={top.url}
                  {...newTabProps(top.url)}
                >
                  {top.navTitle}
                </a>
              ),
            );

  return (
    <>
      <header className="site-nav">
        <a className="site-nav-brand" href="/" aria-label={`${siteName}首页`}>
          <img src="/logo/logo_cn_en.svg" alt={`${siteName} Token Ocean`} />
        </a>
        <nav className="site-nav-desktop" aria-label="主导航">{navTree}</nav>
        <details className="site-nav-menu">
          <summary aria-label="菜单">☰</summary>
          <nav>{navTree}</nav>
        </details>
        <a
          className="site-nav-cta"
          href={resolvedCtaUrl}
          {...(externalCta
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          {resolvedCtaLabel}
        </a>
      </header>

      <main>{children}</main>

      <footer className="site-foot">
        <div className="site-foot-brand">
          <img src="/logo/logo_cn_en.svg" alt={`${siteName} Token Ocean`} />
          <p>{config?.siteTagline ?? ''}</p>
          {config?.footerTagline ? <span>{config.footerTagline}</span> : null}
        </div>
        <div className="site-foot-contact">
          <b>联系我们</b>
          {(config?.contactEmails ?? []).map((entry, i) => (
            <a key={entry.id ?? i} href={`mailto:${entry.email}`}>
              {entry.email}
            </a>
          ))}
        </div>
        <div className="site-foot-links">
          <b>快速入口</b>
          {(config?.footerLinks ?? []).map((link, i) =>
            link.url ? (
              <a
                key={link.id ?? i}
                href={link.url}
                {...(openInNewTab(link.url)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {link.label}
              </a>
            ) : (
              // url 空 = 纯文本占位项（v0.3「客户入口（即将开放）」）
              <span key={link.id ?? i}>{link.label}</span>
            ),
          )}
        </div>
        <div className="site-foot-record">
          {config?.companyName ? <span>{config.companyName}</span> : null}
          {config?.icpBeian ? (
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
              {config.icpBeian}
            </a>
          ) : null}
          {config?.footerNoticeDefault ? <small>{config.footerNoticeDefault}</small> : null}
        </div>
      </footer>
    </>
  );
}
