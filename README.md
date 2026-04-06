# 🐻 지금이니 백엔드 (RightNow Backend)

> **지금이니 앱의 장소 검색, 대중교통 경로 탐색, 날씨 조회, 신발 사진 판정, 약속 저장을 담당하는 Express 기반 API 서버**

`지금이니 백엔드`는 모바일 앱이 직접 다루기 어려운 외부 API 연동과 데이터 저장을 한곳에서 처리합니다.  
앱에서 약속을 만들면 서버는 장소/경로/날씨/사진 판정 API를 중계하고, 설치 정보와 약속 데이터, 외부 API 호출 기록을 PostgreSQL에 저장합니다.

---

## ✨ 핵심 기능

### 1) 설치 식별자 저장
- 앱 설치별 `installId`와 디바이스 정보를 저장합니다.
- 같은 `installId`가 다시 들어오면 플랫폼, OS 버전, 디바이스 모델, 마지막 접속 시각을 갱신합니다.

### 2) 약속 생성/수정/삭제 저장
- 프런트엔드에서 생성한 약속 제목, 약속 시각, 출발지, 도착지를 DB에 저장합니다.
- 수정/삭제 API를 통해 앱의 로컬 약속 상태와 서버 저장 데이터를 맞출 수 있습니다.

### 3) 장소 검색 + 지도 선택 주소 변환
- Kakao Local API를 이용해 키워드 검색과 주소 검색을 동시에 수행합니다.
- 검색 결과는 좌표 기준으로 중복 제거 후 앱에서 쓰기 쉬운 `Place` 형태로 반환합니다.
- 지도에서 선택한 좌표는 reverse geocode로 주소/장소명 형태로 변환합니다.

### 4) 대중교통 경로 탐색
- TMAP 대중교통 API를 호출해 출발지와 도착지 사이의 경로 후보를 조회합니다.
- 서버에서 총 이동 시간, 도보 시간, 요금, 환승 횟수, 구간별 이동 정보를 정리해 반환합니다.
- 환승 3회 이상 경로는 뒤로 보내고, 나머지는 이동 시간이 짧은 순으로 정렬합니다.

### 5) 목적지 날씨 조회
- OpenWeather API를 이용해 목적지 좌표 기준 현재 날씨를 조회합니다.
- 앱에서 바로 표시할 수 있도록 온도, 체감 온도, 습도, 풍속, 날씨 설명, 아이콘 값을 정리합니다.

### 6) 신발 사진 판정
- `multipart/form-data`로 받은 이미지를 메모리에서 처리합니다.
- Gemini 모델에 이미지를 전달해 실제 신발이 명확히 보이는지 JSON 형태로 판정합니다.
- Zod 스키마로 응답을 검증한 뒤 `isShoe`, `confidence`, `reason`과 선택적인 `labels`를 반환합니다.

### 7) 외부 API 호출 기록
- 일부 외부 API 요청은 `installId`, API 이름, 상태 코드를 `api_requests` 테이블에 저장합니다.
- 장소 검색, 지도 reverse geocode, 경로 탐색 호출 상태를 추적할 수 있습니다.

---

## 🧠 서버 동작 흐름 (요약)

1. 앱 시작 시 `POST /api/save/install`로 설치 식별자와 디바이스 정보를 저장합니다.
2. 사용자가 장소를 검색하면 `GET /api/places/search`가 Kakao 키워드/주소 검색 결과를 병합합니다.
3. 지도에서 위치를 고르면 `GET /api/places/map-pick`이 좌표를 주소로 변환합니다.
4. 약속 생성 화면에서 경로를 요청하면 `POST /api/direction/find`가 TMAP 대중교통 경로를 조회하고 정렬합니다.
5. 약속 저장/수정/삭제 시 `POST`, `PUT`, `DELETE /api/save/meeting` 계열 API가 DB를 갱신합니다.
6. 홈 화면 날씨 영역은 `GET /api/weather`로 목적지 현재 날씨를 조회합니다.
7. 출발 인증 화면은 `POST /api/photoVerdict`로 촬영 이미지를 보내 신발 여부를 판정합니다.

---

## 🏗️ 기술 스택

- **Runtime**: Node.js
- **Framework**: Express 5
- **Language**: TypeScript, ESM
- **Database**: PostgreSQL (`pg`)
- **Network**: axios
- **Validation**: zod, zod-to-json-schema
- **File upload**: multer memory storage
- **AI/Vision**: Google Gemini (`@google/genai`)
- **Environment**: dotenv
- **Dev runner**: tsx watch

---

## 📁 프로젝트 구조

```text
src/
  index.ts                  # Express 서버 진입점, 라우터 마운트, 전역 에러 로그
  db.ts                     # PostgreSQL Pool 생성, DATABASE_URL 기반 연결
  routes/
    dbSave.ts               # 설치 정보/약속 저장/수정/삭제, API 호출 로그 저장
    directionSearch.ts      # TMAP 대중교통 경로 탐색 및 route DTO 변환
    placeSearch.ts          # Kakao 장소 검색, 주소 검색, reverse geocode
    weatherSearch.ts        # OpenWeather 현재 날씨 조회
    photoVerdict.ts         # Gemini 기반 신발 이미지 판정
```

---

## 🌐 API 엔드포인트

### 설치 정보 저장

```http
POST /api/save/install
```

요청 body:

```json
{
  "installId": "device-install-id",
  "platform": "ios",
  "osVersion": "17.0",
  "deviceModel": "iPhone"
}
```

응답:

```json
{ "ok": true }
```

---

### 약속 저장

```http
POST /api/save/meeting
```

요청 body:

```json
{
  "installId": "device-install-id",
  "title": "친구 만나기",
  "meetingAt": "2026-04-06T10:00:00.000Z",
  "originPlace": {
    "name": "우리집",
    "address": "서울 ...",
    "lat": 37.5665,
    "lng": 126.978
  },
  "destPlace": {
    "name": "강남역",
    "address": "서울 강남구 ...",
    "lat": 37.4979,
    "lng": 127.0276
  }
}
```

응답:

```json
{ "id": 1 }
```

---

### 약속 수정/삭제

```http
PUT /api/save/meeting/:id
DELETE /api/save/meeting/:id
```

- `PUT`은 `title`, `meetingAt`, `originPlace`, `destPlace`를 받아 기존 약속을 갱신합니다.
- `DELETE`는 `id` 기준으로 약속을 삭제합니다.

---

### 장소 검색

```http
GET /api/places/search?q=강남역
```

선택 헤더:

```http
x-install-id: device-install-id
```

응답:

```json
{
  "places": [
    {
      "name": "강남역",
      "address": "서울 강남구 강남대로 ...",
      "lat": 37.4979,
      "lng": 127.0276,
      "source": "keyword"
    }
  ]
}
```

---

### 지도 좌표 주소 변환

```http
GET /api/places/map-pick?lat=37.5665&lng=126.9780
```

응답:

```json
{
  "place": {
    "name": "세종대로",
    "address": "서울 중구 ...",
    "buildingName": "건물명",
    "lat": 37.5665,
    "lng": 126.978
  }
}
```

---

### 대중교통 경로 탐색

```http
POST /api/direction/find
```

선택 헤더:

```http
x-install-id: device-install-id
```

요청 body:

```json
{
  "startX": 126.978,
  "startY": 37.5665,
  "endX": 127.0276,
  "endY": 37.4979
}
```

응답:

```json
{
  "routesCount": 1,
  "routes": [
    {
      "index": 0,
      "summary": {
        "totalTimeMin": 42,
        "totalTimeText": "42분",
        "totalWalkTimeMin": 8,
        "totalWalkTimeText": "8분",
        "totalFare": 1500,
        "transferCount": 1,
        "totalDistanceM": 12345,
        "totalWalkDistanceM": 650,
        "pathType": 1
      },
      "segments": [
        {
          "type": "WALK",
          "timeMin": 5,
          "timeText": "5분",
          "distanceM": 350,
          "from": "출발지",
          "to": "정류장"
        }
      ]
    }
  ]
}
```

---

### 날씨 조회

```http
GET /api/weather?lat=37.4979&lon=127.0276
```

응답:

```json
{
  "weather": {
    "coord": { "lat": 37.4979, "lon": 127.0276 },
    "name": "Seoul",
    "temp": 16.5,
    "feelsLike": 15.9,
    "humidity": 55,
    "windSpeed": 2.1,
    "main": "Clouds",
    "description": "흐림",
    "icon": "04d",
    "dt": 1775450000
  }
}
```

---

### 신발 사진 판정

```http
POST /api/photoVerdict
Content-Type: multipart/form-data
```

form-data:

```text
image: jpeg/png/webp 파일, 최대 5MB
```

응답:

```json
{
  "isShoe": true,
  "confidence": 0.87,
  "reason": "The image clearly shows sneakers.",
  "labels": ["sneaker", "footwear"]
}
```

---

## 🧾 데이터 저장 개요

서버는 PostgreSQL을 사용하며 `DATABASE_URL`에서 연결 정보를 읽습니다.

- `installs`: 설치 식별자, 플랫폼, OS 버전, 디바이스 모델, 마지막 접속 시각 저장
- `appointments`: 약속 제목, 약속 시각, 출발지/도착지 이름·주소·좌표 저장
- `api_requests`: 설치 식별자별 외부 API 이름과 응답 상태 코드 저장

> 현재 저장소에는 별도의 migration 파일이 없으므로, 배포/로컬 DB 구성 시 실제 테이블 스키마를 먼저 준비해야 합니다.

---

## ⚙️ 환경 변수

`.env`에 아래 값을 설정합니다.

```env
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
KAKAO_REST_API_KEY=your-kakao-rest-api-key
TMAP_API_KEY=your-tmap-api-key
OPENWEATHER_API_KEY=your-openweather-api-key
GEMINI_API_KEY=your-gemini-api-key
```

환경 변수 역할:

- `PORT`: 서버 포트, 기본값은 `4000`
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `KAKAO_REST_API_KEY`: 장소 검색/주소 검색/reverse geocode용 Kakao REST API 키
- `TMAP_API_KEY`: 대중교통 경로 탐색용 TMAP API 키
- `OPENWEATHER_API_KEY`: 현재 날씨 조회용 OpenWeather API 키
- `GEMINI_API_KEY`: 신발 사진 판정용 Gemini API 키

---

## 🚀 로컬 실행 방법

### 1) 의존성 설치

```bash
npm install
```

### 2) 환경 변수 설정

위의 환경 변수 목록을 참고해 프로젝트 루트에 `.env`를 생성합니다.

### 3) 개발 서버 실행

```bash
npm run dev
```

서버는 기본적으로 모든 인터페이스에서 접속 가능하도록 `0.0.0.0`에 바인딩됩니다.

```text
http://0.0.0.0:4000
```

> 실제 모바일 기기에서 테스트할 때는 프런트엔드의 `API_BASE_URL`에 PC의 로컬 네트워크 IP와 포트를 넣어야 합니다.

---

## 🔐 요청/보안 메모

- 외부 API 키는 반드시 서버 `.env`에만 보관합니다.
- 앱은 일부 요청에 `x-install-id` 헤더를 보내 API 호출 기록을 남길 수 있습니다.
- 사진 판정 API는 이미지를 디스크에 저장하지 않고 `multer.memoryStorage()`로 메모리에서 처리합니다.
- 업로드 가능한 이미지는 `image/jpeg`, `image/png`, `image/webp`이며 최대 크기는 5MB입니다.
- DB 연결은 `DATABASE_URL`을 파싱해 PostgreSQL Pool을 만들고 SSL 옵션을 사용합니다.

---

## 🛠️ 트러블슈팅

### Q1. 서버가 바로 종료돼요
- `DATABASE_URL`이 없으면 서버 시작 시 에러가 발생합니다.
- `.env`가 프로젝트 루트에 있는지, 연결 문자열 형식이 올바른지 확인합니다.

### Q2. 장소 검색이 실패해요
- `KAKAO_REST_API_KEY`가 설정되어 있는지 확인합니다.
- 요청 쿼리의 `q` 값이 비어 있으면 `400` 응답이 반환됩니다.

### Q3. 경로 탐색이 실패해요
- `TMAP_API_KEY`가 설정되어 있는지 확인합니다.
- `startX`, `startY`, `endX`, `endY`가 모두 필요합니다.
- 너무 가까운 거리이거나 대중교통 경로가 없는 경우 경로 결과가 없을 수 있습니다.

### Q4. 날씨가 안 나와요
- `OPENWEATHER_API_KEY`를 확인합니다.
- `lat`은 -90~90, `lon`은 -180~180 범위의 숫자여야 합니다.

### Q5. 사진 판정이 실패해요
- `GEMINI_API_KEY`가 설정되어 있는지 확인합니다.
- 업로드 필드 이름은 반드시 `image`여야 합니다.
- jpeg/png/webp 외의 파일이거나 5MB를 초과하면 요청이 거절됩니다.

---

## 📌 참고

- 이 서버는 TypeScript strict 모드와 NodeNext 모듈 해석을 사용합니다.
- `npm run dev`는 `tsx watch src/index.ts`로 실행됩니다.
- 현재 별도 health check 라우트는 구현되어 있지 않습니다.

