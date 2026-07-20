// src/manifest.js
// manifest.json 로드 + 연예인 선택 그리드 렌더.
import { assetUrl } from './config.js';

export async function loadManifest() {
  const res = await fetch('manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest.json 로드 실패 (' + res.status + ')');
  return res.json();
}

// 썸네일을 미리 백그라운드로 받아 캐시 → 선택화면에서 즉시 표시(첫 화면에서 미리 호출).
export function preloadThumbs(manifest) {
  ((manifest && manifest.celebrities) || []).forEach((cfg) => {
    if (cfg.thumb) {
      const im = new Image();
      im.src = assetUrl(cfg, cfg.thumb);
    }
  });
}

// container에 썸네일 카드 그리드를 그리고, 카드 클릭 시 onSelect(config) 호출
export function renderGrid(container, manifest, onSelect) {
  container.innerHTML = '';
  const list = (manifest && manifest.celebrities) || [];

  if (!list.length) {
    container.innerHTML =
      '<p class="empty">등록된 연예인이 없어요.<br>celebrities 폴더에 config 추가 후 <code>npm run build</code> 하세요.</p>';
    return;
  }

  list.forEach((cfg) => {
    const card = document.createElement('button');
    card.className = 'celeb-card';
    card.style.setProperty('--accent', (cfg.theme && cfg.theme.primary) || '#ff5e9c');

    // 썸네일(없으면 accent 배경 + 이름만)
    if (cfg.thumb) {
      const img = document.createElement('img');
      img.className = 'celeb-thumb';
      img.alt = cfg.displayName || cfg.id;
      img.onerror = () => { img.remove(); card.classList.add('no-thumb'); };
      img.src = assetUrl(cfg, cfg.thumb);
      card.appendChild(img);
    } else {
      card.classList.add('no-thumb');
    }

    const name = document.createElement('span');
    name.className = 'celeb-name';
    name.textContent = cfg.displayName || cfg.id;
    card.appendChild(name);

    card.addEventListener('click', () => onSelect(cfg));
    container.appendChild(card);
  });
}
