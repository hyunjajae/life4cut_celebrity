// src/filters.js
// 색보정 필터 프리셋. config.theme.filter 이름으로 골라 씀.
// 값은 canvas 2D의 ctx.filter(=CSS filter 문자열)로 그대로 적용.

export const FILTER_PRESETS = {
  none: 'none',
  warm: 'saturate(1.15) sepia(0.14) contrast(1.03) brightness(1.02)',
  cool: 'saturate(1.06) hue-rotate(-8deg) brightness(1.04) contrast(1.02)',
  soft: 'saturate(1.05) brightness(1.06) contrast(0.96)',
  bw:   'grayscale(1) contrast(1.06)',
};

export function filterString(name) {
  return FILTER_PRESETS[name] || 'none';
}
