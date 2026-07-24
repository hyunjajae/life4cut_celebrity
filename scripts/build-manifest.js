// scripts/build-manifest.js
// ─────────────────────────────────────────────────────────────
// /celebrities 폴더를 훑어 manifest.json 자동 생성. 실행: npm run build
//
// 구조:
//  - celebrities/<id>/config.json 하나 = 멤버 1명.
//  - config.published === false → 목록 제외(작업중/비공개).
//  - config.group 이 있고 celebrities/groups.json 에 그 그룹이 정의돼 있으면 → 그룹으로 묶임.
//    (그룹 안에서는 멤버 config.order 순으로 정렬)
//  - group 없으면 → 최상위에 단독 멤버로 표시.
//  - celebrities/groups.json: { "<groupId>": { "displayName", "thumb"(celebrities 루트 기준), "order" } }
//
// 출력(manifest.json):
//  { generatedAt, count(멤버 총수), items: [ {type:'group', id, displayName, thumb, order, members:[...]}
//                                          | {type:'member', ...멤버config} ] }  (최상위 order순 정렬)
// 순수 Node(fs)만 사용.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const celebDir = path.join(root, 'celebrities');

function loadGroups() {
  const p = path.join(celebDir, 'groups.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('groups.json 파싱 오류:', e.message);
    return {};
  }
}

const byOrder = (a, b) => {
  const ao = typeof a.order === 'number' ? a.order : Infinity;
  const bo = typeof b.order === 'number' ? b.order : Infinity;
  if (ao !== bo) return ao - bo;
  return String(a.displayName || a.id).localeCompare(String(b.displayName || b.id), 'ko');
};

function build() {
  if (!fs.existsSync(celebDir)) {
    console.error('celebrities 폴더가 없습니다:', celebDir);
    process.exit(1);
  }

  const groupsMeta = loadGroups();
  const groupBuckets = {}; // groupId -> [member config]
  const soloMembers = [];  // member config (group 없음)
  let memberCount = 0;

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
      console.log(`  건너뜀(비공개): ${id}`);
      continue;
    }

    cfg.id = cfg.id || id;
    memberCount += 1;

    if (cfg.group && groupsMeta[cfg.group]) {
      (groupBuckets[cfg.group] = groupBuckets[cfg.group] || []).push(cfg);
      console.log(`  ✓ [${cfg.group}] ${cfg.id} (${cfg.displayName || ''})`);
    } else {
      if (cfg.group) console.warn(`  ⚠ 그룹 '${cfg.group}' 정의 없음(groups.json) → 단독 처리: ${cfg.id}`);
      soloMembers.push(cfg);
      console.log(`  ✓ [단독] ${cfg.id} (${cfg.displayName || ''})`);
    }
  }

  const items = [];

  // 그룹 아이템(공개 멤버 1명 이상인 그룹만)
  for (const gid of Object.keys(groupsMeta)) {
    const members = (groupBuckets[gid] || []).slice().sort(byOrder);
    if (!members.length) continue;
    const meta = groupsMeta[gid];
    items.push({
      type: 'group',
      id: gid,
      displayName: meta.displayName || gid,
      thumb: meta.thumb || null,
      order: typeof meta.order === 'number' ? meta.order : Infinity,
      members,
    });
  }

  // 단독 멤버 아이템
  soloMembers.forEach((m) => items.push(Object.assign({ type: 'member' }, m)));

  // 최상위 정렬(그룹/단독 섞어서 order순)
  items.sort(byOrder);

  const manifest = { generatedAt: new Date().toISOString(), count: memberCount, items };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const groupCount = items.filter((i) => i.type === 'group').length;
  console.log(`\nmanifest.json 생성 완료 — 최상위 ${items.length}개(그룹 ${groupCount} + 단독 ${items.length - groupCount}), 멤버 총 ${memberCount}명`);
}

build();
