// src/config.js
// 앱 전역 기본값(연예인 config에 값이 없을 때 쓰는 폴백 + 연출 상수)

export const APP = {
  captureScale: 2,          // 컷 셀 대비 캡처 배율(화질). 셀 640×460 → 1280×920로 캡처
  defaultCountdown: 8,      // config.countdown 없을 때
  previewMs: 1200,          // 한 컷 찍은 뒤 미리보기(정지) 시간(ms)
  flashMs: 200,             // 플래시(흰 화면) 시간(ms)

  defaultCaption: 'fromis_9 x gimhyungyu', // 프레임 하단 기본 문구(앱에서 수정 가능)

  // ── 영상(타임랩스) ──
  // 저장 영상 길이는 고정값이 아니라, 가장 긴 컷의 버퍼 프레임 수 기준으로 video.js가 자동 계산함.
  clipW: 320,               // 촬영 중 버퍼 프레임 가로(세로는 비율 자동)
  clipIntervalMs: 110,      // 버퍼 샘플 간격(ms). 버퍼 길이는 booth.js가 카운트다운(cdSec) 전체를 담도록 자동 계산
};

// 연예인 폴더 내 에셋 경로 만들기: assetUrl(config, 'frame.png') → celebrities/<id>/frame.png
export function assetUrl(config, file) {
  return `celebrities/${config.id}/${file}`;
}
