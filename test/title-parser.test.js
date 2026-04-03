import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseTitle, getDisplayName } = require('../src/title-parser');

describe('parseTitle', () => {
  describe('빈 입력 처리', () => {
    it('windowTitle이 빈 문자열이면 "(제목 없음)" 반환', () => {
      expect(parseTitle('chrome', '')).toBe('(제목 없음)');
    });

    it('windowTitle이 null이면 "(제목 없음)" 반환', () => {
      expect(parseTitle('chrome', null)).toBe('(제목 없음)');
    });

    it('windowTitle이 undefined이면 "(제목 없음)" 반환', () => {
      expect(parseTitle('chrome', undefined)).toBe('(제목 없음)');
    });
  });

  describe('Chrome 브라우저', () => {
    it('표준 Chrome 타이틀에서 " - Google Chrome" 제거', () => {
      expect(parseTitle('chrome', 'GitHub - PR #42 - Google Chrome'))
        .toBe('GitHub - PR #42');
    });

    it('한글 타이틀 정상 처리', () => {
      expect(parseTitle('chrome', 'AX 워크샵 사전설문 - Google Sheets - Google Chrome'))
        .toBe('AX 워크샵 사전설문 - Google Sheets');
    });

    it('접미사 없는 Chrome 타이틀은 마지막 " - " 기준 분리', () => {
      expect(parseTitle('chrome', 'YouTube - SomeTab'))
        .toBe('YouTube');
    });

    it('.exe 확장자 포함된 프로세스명 처리', () => {
      expect(parseTitle('chrome.exe', 'Notion - Google Chrome'))
        .toBe('Notion');
    });

    it('" - " 없는 단순 타이틀은 그대로 반환', () => {
      expect(parseTitle('chrome', 'NewTab'))
        .toBe('NewTab');
    });
  });

  describe('Microsoft Edge', () => {
    it('Edge 타이틀에서 " - Microsoft Edge" 제거', () => {
      expect(parseTitle('msedge', 'Bing - Microsoft Edge'))
        .toBe('Bing');
    });

    it('msedge.exe 처리', () => {
      expect(parseTitle('msedge.exe', '설정 - Microsoft Edge'))
        .toBe('설정');
    });
  });

  describe('Firefox', () => {
    it('Firefox 타이틀에서 접미사 제거', () => {
      expect(parseTitle('firefox', 'MDN Web Docs - Mozilla Firefox'))
        .toBe('MDN Web Docs');
    });
  });

  describe('VS Code', () => {
    it('VS Code 타이틀에서 접미사 제거', () => {
      expect(parseTitle('Code', 'main.js - haru-haru - Visual Studio Code'))
        .toBe('main.js - haru-haru');
    });

    it('접미사가 다른 경우 마지막 " - " 기준 분리', () => {
      expect(parseTitle('Code', 'index.html - project - Code'))
        .toBe('index.html - project');
    });
  });

  describe('Slack', () => {
    it('Slack 타이틀에서 접미사 제거', () => {
      expect(parseTitle('slack', '#general - 팀채널 - Slack'))
        .toBe('#general - 팀채널');
    });
  });

  describe('Notion', () => {
    it('Notion 타이틀에서 " | Notion" 제거', () => {
      expect(parseTitle('notion', '프로젝트 기획서 | Notion'))
        .toBe('프로젝트 기획서');
    });
  });

  describe('터미널', () => {
    it('WindowsTerminal은 타이틀을 그대로 반환', () => {
      expect(parseTitle('WindowsTerminal', 'MINGW64:/c/Users/user/project'))
        .toBe('MINGW64:/c/Users/user/project');
    });

    it('powershell은 타이틀을 그대로 반환', () => {
      expect(parseTitle('powershell', 'PS C:\\Users\\user> npm start'))
        .toBe('PS C:\\Users\\user> npm start');
    });

    it('cmd도 그대로 반환', () => {
      expect(parseTitle('cmd', 'C:\\Windows\\System32\\cmd.exe'))
        .toBe('C:\\Windows\\System32\\cmd.exe');
    });

    it('bash도 그대로 반환', () => {
      expect(parseTitle('bash', '~/projects/haru'))
        .toBe('~/projects/haru');
    });
  });

  describe('메신저', () => {
    it('KakaoWork 채팅 타이틀에서 날짜/시간 제거', () => {
      expect(parseTitle('KakaoWork', 'max.0420 (이호경) - 4월 3일 (금) 오전 11:15'))
        .toBe('max.0420 (이호경)');
    });

    it('KakaoWork 채팅 오후 시간도 정상 처리', () => {
      expect(parseTitle('KakaoWork', 'jake.219 (이승국) - 4월 3일 (금) 오후 2:30'))
        .toBe('jake.219 (이승국)');
    });

    it('KakaoWork 메인 창 타이틀은 그대로', () => {
      expect(parseTitle('KakaoWork', '카카오워크'))
        .toBe('카카오워크');
    });

    it('KakaoWork 조직도 등 비 대화창은 그대로', () => {
      expect(parseTitle('KakaoWork', '카카오 공동체 조직도'))
        .toBe('카카오 공동체 조직도');
    });

    it('KakaoTalk 대화방 이름은 그대로', () => {
      expect(parseTitle('KakaoTalk', '스페인식당'))
        .toBe('스페인식당');
    });
  });

  describe('기타 앱', () => {
    it('알 수 없는 앱은 마지막 " - " 뒤를 제거', () => {
      expect(parseTitle('notepad', '메모장.txt - 메모장'))
        .toBe('메모장.txt');
    });

    it('" - "가 타이틀 앞쪽(30% 이하)에 있으면 제거하지 않음', () => {
      expect(parseTitle('unknown', 'A - This is a very long window title that keeps going'))
        .toBe('A - This is a very long window title that keeps going');
    });

    it('" - "가 없으면 그대로 반환', () => {
      expect(parseTitle('calc', '계산기'))
        .toBe('계산기');
    });
  });
});

describe('getDisplayName', () => {
  it('Code → Visual Studio Code', () => {
    expect(getDisplayName('Code')).toBe('Visual Studio Code');
  });

  it('explorer → 파일 탐색기', () => {
    expect(getDisplayName('explorer')).toBe('파일 탐색기');
  });

  it('ShellExperienceHost → Windows 앱 (계산기 등)', () => {
    expect(getDisplayName('ShellExperienceHost')).toBe('Windows 앱 (계산기 등)');
  });

  it('KakaoWork → 카카오워크', () => {
    expect(getDisplayName('KakaoWork')).toBe('카카오워크');
  });

  it('chrome → Chrome', () => {
    expect(getDisplayName('chrome')).toBe('Chrome');
  });

  it('WindowsTerminal → 터미널', () => {
    expect(getDisplayName('WindowsTerminal')).toBe('터미널');
  });

  it('매핑에 없는 프로세스명은 원본 그대로 반환', () => {
    expect(getDisplayName('SomeUnknownApp')).toBe('SomeUnknownApp');
  });
});
