function renderHelp(container) {
  container.innerHTML = `
    <h2 style="margin-bottom: 24px">하루하루 사용 가이드</h2>

    <div class="help-card">
      <h3>☀️ 아침 브리핑</h3>
      <p>전날의 활동 데이터를 바탕으로 하루를 시작할 때 참고할 수 있는 요약을 보여줍니다.</p>
      <ul>
        <li><strong>집중 점수</strong> — 개발/문서 작업에 15분 이상 연속 집중한 비율 (0~100점)</li>
        <li><strong>카테고리별 시간</strong> — 개발, 문서, 커뮤니케이션, SNS 등으로 분류된 시간 배분</li>
        <li><strong>주간 흐름</strong> — 최근 7일간 집중 점수 변화</li>
      </ul>
    </div>

    <div class="help-card">
      <h3>📊 대시보드</h3>
      <p>오늘 사용한 앱과 웹사이트의 시간을 자동으로 추적하여 보여줍니다.</p>
      <ul>
        <li><strong>앱별 사용 시간</strong> — 차트와 목록으로 확인. 항목을 클릭하면 세부 내역(탭, 파일 등)을 펼쳐볼 수 있습니다.</li>
        <li><strong>직접 입력</strong> — 자동 추적되지 않는 활동(회의, 티타임 등)을 수동으로 기록할 수 있습니다.</li>
        <li><strong>자리비움</strong> — 설정한 시간 이상 컴퓨터를 사용하지 않은 구간을 표시합니다.</li>
      </ul>
    </div>

    <div class="help-card">
      <h3>📝 업무 일지</h3>
      <p>하루의 계획과 회고를 기록하는 공간입니다.</p>
      <ul>
        <li><strong>오늘의 할 일</strong> — 체크리스트로 할 일을 관리합니다. Enter로 추가, 체크박스로 완료 표시, 텍스트를 지우면 삭제됩니다.</li>
        <li><strong>하루 회고</strong> — 자유롭게 메모를 남길 수 있습니다. 입력하면 자동 저장됩니다.</li>
      </ul>
    </div>

    <div class="help-card">
      <h3>📈 트렌드</h3>
      <p>주간 단위로 집중 점수의 변화 추이를 차트로 확인합니다. 이전 주/다음 주로 이동할 수 있습니다.</p>
    </div>

    <div class="help-card">
      <h3>⚙️ 설정</h3>
      <ul>
        <li><strong>폴링 간격</strong> — 활성 창을 확인하는 주기 (기본 3초)</li>
        <li><strong>유휴 감지</strong> — 이 시간 동안 변화 없으면 자리비움으로 처리 (기본 5분)</li>
        <li><strong>데이터 초기화</strong> — 모든 활동 기록을 삭제합니다. 설정값은 유지됩니다.</li>
      </ul>
    </div>

    <div class="help-card">
      <h3>⌨️ 단축키</h3>
      <ul>
        <li><strong>Ctrl + =</strong> — 화면 확대</li>
        <li><strong>Ctrl + -</strong> — 화면 축소</li>
        <li><strong>Ctrl + 0</strong> — 화면 크기 초기화</li>
      </ul>
    </div>

    <div class="help-card">
      <h3>💡 알아두면 좋은 점</h3>
      <ul>
        <li>창을 닫아도 시스템 트레이에서 백그라운드 추적이 계속됩니다.</li>
        <li>트레이 아이콘을 더블클릭하면 다시 열 수 있습니다.</li>
        <li>트레이 우클릭 메뉴에서 추적 일시정지/재개가 가능합니다.</li>
        <li>날짜 이동( &lt; &gt; )으로 과거 기록을 조회할 수 있습니다.</li>
      </ul>
    </div>
  `;
}
