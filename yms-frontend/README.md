# YMS Frontend

YMS 프론트엔드는 React, TypeScript와 Vite로 작성합니다. 운영 배포 시에는 Node.js 개발 서버를 공개하지 않고 `npm run build`로 생성한 정적 파일을 웹 서버 또는 CDN에서 제공합니다.

## 개발 환경

- Node.js `24.22.1` 이상, `25.0.0` 미만
- npm 11 이상

저장소 루트의 `.node-version`은 검증된 Node.js 버전을 고정합니다. 사용하는 버전 관리자가 해당 파일을 지원하지 않으면 같은 버전을 직접 설치합니다.

~~~powershell
node --version
npm --version
~~~

`yms-frontend/.npmrc`의 `engine-strict=true` 설정으로 지원 범위를 벗어난 Node.js에서 의존성 설치를 차단합니다. `@types/node`와 `package-lock.json`은 실제 Node.js 실행 파일을 갱신하지 않으므로, 보안 업데이트 시에는 개발 PC와 CI·컨테이너의 런타임도 별도로 업데이트해야 합니다.

## 설치와 검증

~~~powershell
cd yms-frontend
npm ci
npm run lint
npm run build
~~~

개발 서버는 다음 명령으로 실행합니다.

~~~powershell
npm run dev
~~~

`npm run preview`는 빌드 결과의 로컬 확인 용도이며 운영 서버로 사용하지 않습니다.

## Node.js 보안 업데이트 정책

- 운영 및 개발 도구 체인에서는 지원 중인 Node.js LTS 계열만 사용합니다.
- 현재 기준선은 Node.js 24 LTS이며 최소 보안 패치 버전은 `24.22.1`입니다.
- Node.js 보안 릴리스가 나오면 개발 PC, CI, 컨테이너와 관리형 호스팅의 실제 런타임 버전을 함께 확인합니다.
- 패치 버전을 올린 뒤 `npm ci`, `npm run lint`와 `npm run build`를 다시 실행합니다.
- Node.js 메이저 버전 변경은 Vite와 네이티브 의존성 호환성을 별도로 확인한 뒤 진행합니다.

## 배포 및 향후 서버 기능

현재 프론트엔드는 정적 빌드를 전제로 합니다. CI나 Docker를 도입하면 `.node-version` 및 `package.json`의 `engines.node`와 같은 Node.js 24 LTS 패치 버전을 사용합니다.

향후 SSR, BFF, API 또는 WebSocket 서버를 Node.js로 도입할 때는 다음 항목을 배포 전 보안 검토에 포함합니다.

- 요청 본문, 업로드 파일과 외부 HTTP 응답 등 비신뢰 데이터의 압축 해제 여부
- Brotli 등 압축 입력의 크기 제한과 오류 처리
- Node.js 프로세스 권한 최소화
- 외부 URL과 TLS 인증서 검증 경계
- 지원 중인 LTS 최신 보안 패치 적용 여부
