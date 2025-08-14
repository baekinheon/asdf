# 코인 차트 데모 (1시간봉 + 평단 라벨)

Vercel 같은 정적 호스팅에 바로 올릴 수 있는 **순수 HTML/JS** 버전입니다.  
**Binance 공개 API**에서 1시간봉 캔들을 불러와서 `lightweight-charts`로 차트를 그립니다.

## 기능
- 기본 **1시간봉** 캔들 차트
- **평단가(Avg) 라인 + 라벨** 표시 (우측 가격축에 `Avg: 값`으로 표시)
- 심볼 선택 (BTC/ETH/SOL/XRP/DOGE)
- 기간 버튼 (3일, 1주, 1달, 2달, 최대)
- 평단/수량 입력 → 브라우저 **로컬 저장소**에 심볼별 자동 저장
- 현재가/평단/수량/미실현손익(평가손익)/수익률 표시
- 옵션: 현재가 라인 on/off, 평단 라벨 on/off
- 모바일/데스크탑 반응형 UI

## 배포 방법 (Vercel)
1. 이 폴더를 그대로 업로드하거나 Git 리포지토리로 연결
2. **Framework Preset: None**
3. **Build Command: (비워둠)**
4. **Output Directory: root** (기본값)
5. 배포 후 접속하면 됩니다.

## 개발/수정
- 차트 라이브러리: [Lightweight Charts](https://github.com/tradingview/lightweight-charts)
- 데이터 소스: Binance Klines (1h)
- 필요 시 `app.js`에서 심볼 목록/버튼/기본 기간 등을 쉽게 수정할 수 있습니다.

## 주의
- 퍼블릭 API 특성상 가끔 요청 제한 또는 일시 오류가 있을 수 있습니다. 새로고침 버튼을 제공했습니다.
