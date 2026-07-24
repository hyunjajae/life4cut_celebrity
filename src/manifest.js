// src/manifest.js
// manifest.json 로드 + 선택화면(그룹→멤버 2단계) 렌더.
import { assetUrl } from './config.js';

export async function loadManifest() {
  const res = await fetch('manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest.json 로드 실패 (' + res.status + ')');
  return res.json();
}

// 그룹 썸네일은 celebrities/ 루트에 있음(멤버 폴더 안이 아님)
const groupThumbUrl = (file) => `celebrities/${file}`;

// 썸네일 미리 받아 캐시 → 선택화면 즉시 표시(첫 화면에서 호출).
export function preloadThumbs(manifest) {
  const load = (url) => { if (url) { const im = new Image(); im.src = url; } };
  (manifest && manifest.items || []).forEach((item) => {
    if (item.type === 'group') {
      load(item.thumb ? groupThumbUrl(item.thumb) : null);
      (item.members || []).forEach((m) => load(m.thumb ? assetUrl(m, m.thumb) : null));
    } else {
      load(item.thumb ? assetUrl(item, item.thumb) : null);
    }
  });
}

// 카드 하나 생성(썸네일 없으면 accent 배경 + 이름)
function makeCard({ thumbUrl, name, sub, accent }) {
  const card = document.createElement('button');
  card.className = 'celeb-card';
  card.style.setProperty('--accent', accent || '#ff5e9c');

  if (thumbUrl) {
    const img = document.createElement('img');
    img.className = 'celeb-thumb';
    img.alt = name;
    img.onerror = () => { img.remove(); card.classList.add('no-thumb'); };
    img.src = thumbUrl;
    card.appendChild(img);
  } else {
    card.classList.add('no-thumb');
  }

  const label = document.createElement('span');
  label.className = 'celeb-name';
  label.textContent = name;
  if (sub) {
    const s = document.createElement('small');
    s.className = 'celeb-sub';
    s.textContent = sub;
    label.appendChild(s);
  }
  card.appendChild(label);
  return card;
}

// 선택화면 렌더. 그룹 카드 클릭 → 그 그룹 멤버들 + 뒤로가기. 멤버 클릭 → onSelect(멤버config).
export function renderGrid(container, manifest, onSelect) {
  const items = (manifest && manifest.items) || [];

  if (!items.length) {
    container.innerHTML =
      '<p class="empty">등록된 연예인이 없어요.<br>celebrities 폴더에 config 추가 후 <code>npm run build</code> 하세요.</p>';
    return;
  }

  function memberCard(m) {
    const card = makeCard({
      thumbUrl: m.thumb ? assetUrl(m, m.thumb) : '',
      name: m.displayName || m.id,
      accent: m.theme && m.theme.primary,
    });
    card.addEventListener('click', () => onSelect(m));
    return card;
  }

  function renderTop() {
    container.innerHTML = '';
    items.forEach((item) => {
      if (item.type === 'group') {
        const card = makeCard({
          thumbUrl: item.thumb ? groupThumbUrl(item.thumb) : '',
          name: item.displayName,
          sub: `멤버 ${item.members.length}명 ›`,
        });
        card.addEventListener('click', () => renderGroup(item));
        container.appendChild(card);
      } else {
        container.appendChild(memberCard(item));
      }
    });
  }

  function renderGroup(group) {
    container.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'celeb-back';
    back.textContent = '← 뒤로';
    back.addEventListener('click', renderTop);
    container.appendChild(back);
    group.members.forEach((m) => container.appendChild(memberCard(m)));
  }

  renderTop();
}
