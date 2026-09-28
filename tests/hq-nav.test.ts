// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHqNavPages } from '@/lib/strapi';

/**
 * 落地页废弃后（.scratch/huaqiao-redirect/）：后台 home 条目留存（不动
 * Strapi），子站导航去「首页」在前端收口——getHqNavPages 不再返回
 * slug=home。fixture 含 home 模拟后台未清理的真实响应。
 */
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        { slug: 'home', navTitle: '首页', title: '门户' },
        { slug: 'enterprise', navTitle: '企业落地服务', title: '企业落地服务' },
        { slug: 'cloud', navTitle: null, title: '云平台' },
      ],
    }),
  });
});

describe('getHqNavPages：落地页废弃后过滤 home', () => {
  it('不返回 slug=home（后台条目留存，导航前端收口）', async () => {
    const nav = await getHqNavPages();
    expect(nav.map((n) => n.slug)).toEqual(['enterprise', 'cloud']);
  });

  it('navTitle 空回退 title 的既有行为不受过滤影响', async () => {
    const nav = await getHqNavPages();
    expect(nav[1]?.navTitle).toBe('云平台');
  });
});
