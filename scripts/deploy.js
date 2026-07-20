// scripts/deploy.js
// 한 번에 배포: manifest 재생성 → 변경사항 커밋 → GitHub push (→ GitHub Pages 자동 재배포)
//
// 사용법:
//   npm run deploy                    (커밋 메시지 자동)
//   npm run deploy -- "백지헌 추가"     (커밋 메시지 직접 지정)

const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd) => {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit', cwd: root });
};

try {
  // 1) 연예인 폴더를 훑어 manifest.json 갱신
  run('node scripts/build-manifest.js');

  // 2) 바뀐 게 있는지 확인(없으면 그냥 종료)
  const dirty = execSync('git status --porcelain', { cwd: root }).toString().trim();
  if (!dirty) {
    console.log('\n변경사항이 없어요. 배포할 게 없습니다.');
    process.exit(0);
  }
  console.log('\n변경된 파일:');
  console.log(dirty);

  // 3) 커밋 메시지(인자로 주면 그걸, 없으면 날짜시간)
  const argMsg = process.argv.slice(2).join(' ').trim();
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const msg = argMsg || `update ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;

  // 4) 커밋 + 푸시
  run('git add -A');
  run(`git commit -m "${msg.replace(/"/g, "'")}"`);
  run('git push');

  console.log('\n배포 완료! 1~2분 뒤 사이트에 반영됩니다.');
  console.log('https://hyunjajae.github.io/life4cut_celebrity/');
} catch (e) {
  console.error('\n배포 중 실패했습니다. 위 메시지를 확인해주세요.');
  process.exit(1);
}
