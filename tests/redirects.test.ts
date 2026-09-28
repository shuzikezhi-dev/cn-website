// @vitest-environment node
import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

/**
 * 华侨数港落地页废弃（.scratch/huaqiao-redirect/）：/huaqiao 301 →
 * /huaqiao/enterprise。next.config redirects 是三部署形态（CF OpenNext /
 * Docker standalone / nginx 反代）唯一通吃的代码位置——url-plan §3 的 nginx
 * 先例只覆盖其中一形态。状态码与 nginx legacy map 先例统一取 301
 * （permanent: true 输出 308）。redirects 先于文件系统路由，天然遮蔽
 * huaqiao/page.tsx（该页随后续工单删除）。
 */
describe('redirects: /huaqiao 落地页废弃', () => {
  it('/huaqiao 301 → /huaqiao/enterprise（spec 验收 1）', async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/huaqiao',
          destination: '/huaqiao/enterprise',
          statusCode: 301,
        }),
      ]),
    );
  });
});
