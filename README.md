# 인생네컷 부스 (life4cut-booth)

config 기반 **다중 연예인 인생네컷 웹앱**. 연예인마다 새 사이트를 만들 필요 없이, `celebrities/` 폴더에 사진+설정만 추가하면 선택화면에 자동으로 등장합니다. 100% 클라이언트 사이드(백엔드 없음) → GitHub Pages 같은 정적 호스팅에서 그대로 동작.

> 저장소 이름(=고정 URL)은 아직 미정. 폴더명 `life4cut-booth`는 작업용이며 나중에 바꿔도 됩니다.

## 흐름
랜딩 → 카메라 권한 → **연예인 선택** → 촬영(`shotCount`컷, 카운트다운/스페이스바) → **원하는 컷 선택** → `cutLayout`에 합성 + `frameOverlay` + 필터 + **스티커 꾸미기** → **PNG 저장**

## 로컬 실행
```bash
# 1) 연예인 목록(manifest.json) 생성  ※ celebrities 폴더 바꿀 때마다
npm run build          # = node scripts/build-manifest.js

# 2) 로컬 서버 (ES 모듈은 file://로 못 열어서 서버 필요)
python -m http.server 8000
#  → 브라우저에서 http://localhost:8000
```
카메라는 `localhost` 또는 `https`에서만 열립니다(브라우저 보안 정책).

## 연예인 추가하는 법
1. `celebrities/<id>/` 폴더 생성 (`<id>`는 영문 소문자, 예: `leenagyung`).
2. 그 안에 `config.json` + 에셋 넣기:
   - `frame_1x4.png`, `frame_2x2.png` : 레이아웃별 투명 배경 프레임 오버레이 (각 `canvasSize` 크기)
   - `thumb.png` : 선택화면 썸네일
   - `stickers/*.png` : (선택) 커스텀 스티커
3. `npm run build` → `manifest.json` 갱신 → 선택화면에 자동 등장.

에셋이 아직 없어도 앱은 **placeholder**로 동작합니다(썸네일=색 카드, 프레임=임시 테두리).

### config.json 스키마
```jsonc
{
  "id": "leenagyung",              // 폴더명과 동일
  "displayName": "이나경",          // 화면 표시 이름
  "published": true,               // false면 목록에서 숨김(작업중 스캐폴드)
  "theme": { "primary": "#8FB3E0", "filter": "cool" },  // filter: none|warm|cool|soft|bw
  "thumb": "thumb.png",
  "shotCount": 8,                  // 촬영 장수 (이 중에서 컷 수만큼 선택)
  "countdown": 8,                  // 컷당 카운트다운 초
  "stickers": ["heart.png"],       // (선택) stickers/ 안의 커스텀 스티커 파일명
  "layouts": [                     // 촬영 후 사용자가 고를 수 있는 레이아웃들
    {
      "id": "1x4",
      "name": "세로 1×4",
      "frameOverlay": "frame_1x4.png",       // 이 레이아웃 전용 프레임
      "canvasSize": { "w": 720, "h": 2160 }, // 최종 결과물 크기
      "cutLayout": [                          // 컷 위치/크기(픽셀)
        { "x": 40, "y": 60,   "w": 640, "h": 460 },
        { "x": 40, "y": 560,  "w": 640, "h": 460 },
        { "x": 40, "y": 1060, "w": 640, "h": 460 },
        { "x": 40, "y": 1560, "w": 640, "h": 460 }
      ]
    },
    {
      "id": "2x2",
      "name": "2×2",
      "frameOverlay": "frame_2x2.png",
      "canvasSize": { "w": 1400, "h": 1120 },
      "cutLayout": [
        { "x": 40,  "y": 40,  "w": 640, "h": 460 },
        { "x": 720, "y": 40,  "w": 640, "h": 460 },
        { "x": 40,  "y": 540, "w": 640, "h": 460 },
        { "x": 720, "y": 540, "w": 640, "h": 460 }
      ]
    }
  ]
}
```
> 규칙: **모든 레이아웃의 컷 비율(w:h)은 동일**해야 합니다(촬영은 한 번, 어느 레이아웃에도 들어가야 하므로). 지금은 전부 640×460.
> **각 `cutLayout`은 그 레이아웃 `frameOverlay`의 사진 창 위치에 맞춰야** 합니다 — 실제 프레임 PNG가 오면 좌표를 조정하세요.

## 스티커
- 기본 스티커(이모지)는 에셋 파일 없이 항상 제공됩니다.
- 연예인별 커스텀 스티커는 `stickers/` 폴더에 PNG를 넣고 config `stickers`에 파일명을 적으면 됩니다.

## 배포 (예정: GitHub Pages)
정적 파일이라 그대로 올리면 됩니다. `npm run build`로 manifest 갱신 → 커밋/푸시 → `https://<user>.github.io/<repo>/`. **연예인을 추가해도 URL은 그대로.** (자세한 배포 설정은 이후 단계에서.)

## 파일 구조
```
index.html · style.css
src/
  main.js       진입점 + 화면 라우터 + 4컷 선택
  manifest.js   manifest 로드 + 선택 그리드
  booth.js      촬영(카메라/카운트다운/셔터)
  compose.js    4컷 합성 + 스티커 편집 + PNG 저장
  filters.js    색보정 프리셋
  stickers.js   기본 이모지 스티커
  config.js     앱 기본값
celebrities/<id>/config.json + 에셋
scripts/build-manifest.js
manifest.json   (자동 생성)
```

## 로드맵
- [x] 1차: config 기반 사진 부스 + 스티커 꾸미기 + PNG 저장
- [ ] 영상 저장(**타임랩스**: 컷 과정을 빠르게 압축) — WebM
- [ ] AR 상호작용(입→불, 손→왕관)을 **공용 트리거 라이브러리**로 (연예인은 config로 on/off + 에셋 지정)
- [ ] GitHub Pages 배포 자동화
