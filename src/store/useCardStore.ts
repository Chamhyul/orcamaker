import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CardType = '몬스터' | '마법' | '함정' | '토큰'
export type MonsterClass = '일반' | '효과' | '특수 소환' | '융합' | '의식' | '싱크로' | '엑시즈' | '링크'
export type SpellClass = '일반' | '장착' | '필드' | '지속' | '속공'
export type TrapClass = '일반' | '지속' | '카운터'
export type TokenClass = '일반' | '스탯X'

export type CardClass = MonsterClass | SpellClass | TrapClass | TokenClass | ''
export type CardAttribute = '빛' | '어둠' | '신' | '물' | '화염' | '바람' | '땅' | '마법' | '함정' | ''

export type MonsterRace = '드래곤족' | '언데드족' | '악마족' | '화염족' | '해룡족' | '암석족' | '기계족' | '어류족' | '공룡족' | '곤충족' | '야수족' | '야수전사족' | '식물족' | '물족' | '전사족' | '비행야수족' | '천사족' | '마법사족' | '번개족' | '파충류족' | '환신야수족' | '창조신족' | '환룡족' | '사이버스족' | '환상마족' | '직접 입력' | ''

export type EffectType = '일반' | '효과'
export type OtherAttribute = '리버스' | '유니온' | '튜너' | '스피릿' | '듀얼' | '툰'

export type Language = 'ko' | 'en' | 'ja'

export interface CardState {
    // 0. 전역 설정
    theme: 'light' | 'dark'
    language: Language

    // 1. 공통 정보
    cardType: CardType
    cardClass: CardClass
    cardName: string
    cardNameFont: 'name_kr_base' | 'name_kr_alt'
    cardNameColor: 'default' | '#000000' | '#ffffff' | '#ff0000' | '#0000ff' | '#00c184' | '#c800ff' | '#ffce3c'

    // 2. 몬스터 / 토큰(일반) 전용 특성
    attribute: CardAttribute
    level: string
    rank: string
    race: MonsterRace
    customRace: string // 직접 입력 시 값
    effectType: EffectType // 일반/효과 세그먼트
    otherAttributes: string[] // 리버스, 튜너 등 다중 선택
    isTunerForToken: boolean // 토큰(일반) 전용 튜너 스위치

    // 3. 펜듈럼 (몬스터 한정)
    isPendulum: boolean
    pendulumText: string
    pendulumScaleLeft: string
    pendulumScaleRight: string

    // 4. 텍스트 & 스탯
    cardText: string
    atk: string
    def: string
    isAtkUnknown: boolean // ? 토글
    isDefUnknown: boolean // ? 토글
    linkMarkers: Record<number, boolean> // 1~8 방위 활성화 여부

    // 5. 부가 정보 (Footer Info)
    serialNumber: string
    showSerialNumber: boolean
    setNumber: string
    showSetNumber: boolean
    showHoloMark: boolean
    showCopyright: boolean
    copyrightType: 1 | 2
    cardImage: string | null

    // --- Setter Actions ---
    updateField: <K extends keyof Omit<CardState, 'updateField'>>(field: K, value: CardState[K]) => void
}

export const useCardStore = create<CardState>()(
    persist(
        (set) => ({
            theme: 'dark', // default to dark
            language: 'ko',
            cardType: '몬스터',
            cardClass: '', // 초기 placeholder 처리를 위해 빈 문자열
            cardName: '',
            cardNameFont: 'name_kr_base',
            cardNameColor: 'default',

            race: '',
            customRace: '',
            attribute: '',
            level: '',
            rank: '',
            effectType: '효과',
            otherAttributes: [],
            isTunerForToken: false,

            isPendulum: false,
            pendulumText: '',
            pendulumScaleLeft: '',
            pendulumScaleRight: '',

            cardText: '',
            atk: '',
            def: '',
            isAtkUnknown: false,
            isDefUnknown: false,
            linkMarkers: {},

            serialNumber: '',
            showSerialNumber: false,
            setNumber: '',
            showSetNumber: false,
            showHoloMark: false,
            showCopyright: false,
            copyrightType: 2,
            cardImage: null,

            updateField: (field, value) => set((state) => ({ ...state, [field]: value })),
        }),
        {
            name: 'cardmaker-state', // localStorage 키 이름
            partialize: (state) => {
                // updateField 함수는 직렬화 불가이므로 제외하고 나머지 데이터만 저장
                const { updateField: _, ...rest } = state
                return rest
            },
        }
    )
)
