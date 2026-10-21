import type { Locale } from "./index.ts";

/** CodeMirror's built-in phrases use its own English strings as keys. */
export const editorPhrases = {
	en: {},
	ko: {
		Find: "찾기",
		Replace: "바꾸기",
		next: "다음",
		previous: "이전",
		all: "모두 선택",
		"match case": "대소문자 구분",
		regexp: "정규식",
		"by word": "단어 단위",
		replace: "바꾸기",
		"replace all": "모두 바꾸기",
		close: "닫기",
		"Go to line": "줄 이동",
		go: "이동",
		"replaced match on line $": "$번째 줄의 일치 항목을 바꿨습니다",
		"replaced $ matches": "$개의 일치 항목을 바꿨습니다",
		"current match": "현재 일치 항목",
		"on line": "줄 번호",
		to: "부터",
		"folded code": "접힌 코드",
		unfold: "펼치기",
		"Fold line": "줄 접기",
		"Unfold line": "줄 펼치기",
		"Control character": "제어 문자",
		Completions: "자동 완성",
		Diagnostics: "진단",
		"No diagnostics": "진단 없음",
	},
} satisfies Record<Locale, Readonly<Record<string, string>>>;
