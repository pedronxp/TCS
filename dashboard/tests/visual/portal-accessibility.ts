import { expect, type Page } from '@playwright/test';
import axe from 'axe-core';

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  targets: string[][];
};

export async function expectPortalAccessibility(page: Page, context: string) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const injectedAxe = (window as unknown as {
      axe: {
        run: (
          root: Document,
          options: Record<string, unknown>,
        ) => Promise<{
          violations: Array<{
            id: string;
            impact: string | null;
            help: string;
            nodes: Array<{ target: string[] }>;
          }>;
        }>;
      };
    }).axe;
    const result = await injectedAxe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target),
    }));
  }) as AxeViolation[];

  expect(violations, `Violações de acessibilidade em ${context}`).toEqual([]);
}

export async function expectPortalScreenReaderStructure(page: Page, context: string) {
  const structure = await page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    return {
      mainCount: document.querySelectorAll('main').length,
      h1Count: document.querySelectorAll('h1').length,
      duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
    };
  });

  expect(structure.mainCount, `Quantidade de regiões main em ${context}`).toBe(1);
  expect(structure.h1Count, `Quantidade de títulos h1 em ${context}`).toBe(1);
  expect(structure.duplicateIds, `IDs duplicados em ${context}`).toEqual([]);
}

export async function expectPortalReducedMotion(page: Page, context: string) {
  const motion = await page.evaluate(() => {
    function durationInMilliseconds(value: string) {
      return value.split(',').reduce((maximum, entry) => {
        const duration = Number.parseFloat(entry);
        if (!Number.isFinite(duration)) return maximum;
        return Math.max(maximum, entry.trim().endsWith('ms') ? duration : duration * 1_000);
      }, 0);
    }

    return {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      offenders: [...document.querySelectorAll<HTMLElement>('body *')]
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            tag: element.tagName.toLowerCase(),
            animationMs: durationInMilliseconds(style.animationDuration),
            transitionMs: durationInMilliseconds(style.transitionDuration),
          };
        })
        .filter((element) => element.animationMs > 0.1 || element.transitionMs > 0.1)
        .slice(0, 8),
    };
  });

  expect(motion.reducedMotion, `Preferência de movimento reduzido ausente em ${context}`).toBe(true);
  expect(motion.offenders, `Movimento não reduzido em ${context}`).toEqual([]);
}

export async function expectPortalTextZoom(page: Page, context: string) {
  await page.evaluate(() => {
    const controls = 'button, input, select, textarea';
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      const hasDirectText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
      );
      if (!hasDirectText && !element.matches(controls)) continue;
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      const lineHeight = Number.parseFloat(style.lineHeight);
      if (Number.isFinite(fontSize)) element.style.fontSize = `${fontSize * 2}px`;
      if (Number.isFinite(lineHeight)) element.style.lineHeight = `${lineHeight * 2}px`;
    }
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          text: element.textContent?.trim().slice(0, 80) ?? '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      })
      .filter((element) =>
        element.left < -1
        || element.right > window.innerWidth + 1
        || element.scrollWidth > element.clientWidth + 1)
      .slice(0, 20),
  }));
  expect(
    geometry.scrollWidth,
    `Overflow horizontal com texto ampliado em ${context}: ${JSON.stringify(geometry.overflowing)}`,
  ).toBeLessThanOrEqual(geometry.viewport + 1);
}
