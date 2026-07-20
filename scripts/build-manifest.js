// scripts/build-manifest.js
// ─────────────────────────────────────────────────────────────
// /celebrities 폴더를 훑어 각 config.json을 모아 manifest.json을 자동 생성.
// 실행: npm run build  (내부적으로 node scripts/build-manifest.js)
//
// 규칙:
//  - celebrities/<id>/config.json 이 있어야 인식.
//  - config.published === false 이면 건너뜀(스캐폴드/작업중).
//  - id가 비어있으면 폴더명으로 채움.
// 순수 Node(fs)만 사용 — 설치할 의존성 없음.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const celebDir = path.join(root, 'celebrities');

function build() {
  const celebrities = [];

  if (!fs.existsSync(celebDir)) {
    console.error('celebrities 폴더가 없습니다:', celebDir);
    process.exit(1);
  }

  for (const id of fs.readdirSync(celebDir)) {
    const dir = path.join(celebDir, id);
    if (!fs.statSync(dir).isDirectory()) continue;

    const cfgPath = path.join(dir, 'config.json');
    if (!fs.existsSync(cfgPath)) {
      console.warn(`  건너뜀(config.json 없음): ${id}`);
      continue;
    }

    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch (e) {
      console.error(`  건너뜀(JSON 오류): ${id} — ${e.message}`);
      continue;
    }

    if (cfg.published === false) {
      console.log(`  건너뜀(published:false): ${id}`);
      continue;
    }

    cfg.id = cfg.id || id;
    celebrities.push(cfg);
    console.log(`  ✓ 포함: ${cfg.id} (${cfg.displayName || '이름없음'})`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: celebrities.length,
    celebrities,
  };

  const outPath = path.join(root, 'manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\nmanifest.json 생성 완료 — 연예인 ${celebrities.length}명`);
}

build();
