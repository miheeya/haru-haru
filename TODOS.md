# TODOS

## sql.js → better-sqlite3 마이그레이션
- **When:** DB 크기가 50MB+ 도달 시 (약 6개월 사용 후)
- **Why:** sql.js는 전체 DB를 메모리에 로드하고 flush 시 전체 ArrayBuffer를 직렬화. 100MB+에서 multi-second UI 프리즈 가능.
- **What:** better-sqlite3로 전환. native 바인딩이라 incremental I/O 지원. Electron에서 rebuild 필요 (electron-rebuild).
- **How:** db.js의 sql.js 래퍼를 better-sqlite3 API로 교체. 쿼리 인터페이스(queryAll/queryOne)는 유지하면 나머지 코드 변경 최소.
- **Risk:** Electron native module 빌드 환경 설정 필요.
