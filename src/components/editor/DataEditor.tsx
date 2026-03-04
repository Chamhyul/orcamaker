import { useState, useRef, useEffect } from 'react'
import { useCardStore, CardAttribute, CardType, CardClass, MonsterRace, EffectType } from '../../store/useCardStore'
import { FormRow, SegmentControl, Select, Input, ToggleSwitch } from '../ui/Controls'

// 카드 종류에 따른 분류 드롭다운 옵션 매핑
const CLASS_OPTIONS = {
    몬스터: ['일반', '효과', '특수 소환', '융합', '의식', '싱크로', '엑시즈', '링크'],
    마법: ['일반', '장착', '필드', '지속', '속공'],
    함정: ['일반', '지속', '카운터'],
    토큰: ['일반', '스탯X'],
}

// 명세서 상의 종족 순서
const MONSTER_RACES: MonsterRace[] = [
    '드래곤족', '언데드족', '악마족', '화염족', '해룡족', '암석족', '기계족', '어류족', '공룡족', '곤충족', '야수족', '야수전사족', '식물족', '물족', '전사족', '비행야수족', '천사족', '마법사족', '번개족', '파충류족', '환신야수족', '창조신족', '환룡족', '사이버스족', '환상마족', '직접 입력'
]

export function DataEditor() {
    const store = useCardStore()
    const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false)
    const [isNameSettingsOpen, setIsNameSettingsOpen] = useState(false)
    const [maxSpacerHeight, setMaxSpacerHeight] = useState<number | undefined>(undefined)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const pendulumTextareaRef = useRef<HTMLTextAreaElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const popoverButtonRef = useRef<HTMLButtonElement>(null)
    const [lastFocusedTextarea, setLastFocusedTextarea] = useState<'cardText' | 'pendulumText'>('cardText')

    useEffect(() => {
        const updateLayout = () => {
            if (window.innerWidth < 768) {
                setMaxSpacerHeight(undefined);
                return;
            }
            const previewEl = document.getElementById('card-preview-wrapper');
            const stickyEl = document.getElementById('data-editor-sticky');

            if (previewEl && stickyEl) {
                const previewTop = previewEl.getBoundingClientRect().top;
                const stickyBottom = stickyEl.getBoundingClientRect().bottom;
                // padding-top in md is p-8 = 32px
                const paddingOffsets = 32;
                // We want the content's top to not fall below previewTop
                const limit = Math.floor(Math.max(0, previewTop - stickyBottom - paddingOffsets));
                setMaxSpacerHeight(limit);
            }
        };

        updateLayout();
        window.addEventListener('resize', updateLayout);

        // Polling briefly to catch any layout shifts from fonts or image loads
        const interval = setInterval(updateLayout, 100);
        const timeout = setTimeout(() => clearInterval(interval), 1000);

        return () => {
            window.removeEventListener('resize', updateLayout);
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    // 팝오버 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isLinkPopoverOpen &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                popoverButtonRef.current &&
                !popoverButtonRef.current.contains(event.target as Node)
            ) {
                setIsLinkPopoverOpen(false);
            }
        };

        if (isLinkPopoverOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isLinkPopoverOpen]);

    // 동그라미 숫자 삽입 함수
    const insertNumber = (char: string) => {
        const isPendulum = lastFocusedTextarea === 'pendulumText'
        const el = isPendulum ? pendulumTextareaRef.current : textareaRef.current
        const fieldName = isPendulum ? 'pendulumText' : 'cardText'
        const currentText = isPendulum ? store.pendulumText : store.cardText

        if (!el) {
            store.updateField(fieldName, currentText + char)
            return
        }
        const start = el.selectionStart
        const end = el.selectionEnd
        const newText = currentText.substring(0, start) + char + currentText.substring(end)
        store.updateField(fieldName, newText)

        setTimeout(() => {
            if (el) {
                el.selectionStart = el.selectionEnd = start + char.length
                el.focus()
            }
        }, 0)
    }

    // 안전한 카드 분류 목록 가져오기 및 초기화 로직 보조
    const currentClassOptions = CLASS_OPTIONS[store.cardType].map(c => ({ label: c, value: c }))

    // 카드 종류 변경 이벤트
    const handleTypeChange = (newType: CardType) => {
        store.updateField('cardType', newType)
        // 분류 초기화
        store.updateField('cardClass', '')
    }

    // 특성 속성 다중 선택 이벤트 (리버스, 유니온 등)
    const toggleAttribute = (attr: string) => {
        const isAdding = !store.otherAttributes.includes(attr)
        if (isAdding) {
            store.updateField('otherAttributes', [...store.otherAttributes, attr])
        } else {
            store.updateField('otherAttributes', store.otherAttributes.filter(a => a !== attr))
        }
    }

    return (
        <div className="flex flex-col flex-1 w-full h-full min-h-full">

            {/* 1. 기본 설정 (종류, 분류) */}
            <section id="data-editor-sticky" className="sticky top-0 z-20 bg-gray-900 pt-5 md:pt-8 px-5 md:px-8">
                <div className="space-y-5 pb-6 border-b border-gray-700">
                    <FormRow>
                        <SegmentControl
                            options={['몬스터', '마법', '함정', '토큰']}
                            value={store.cardType}
                            onChange={handleTypeChange}
                        />
                    </FormRow>

                    <FormRow>
                        <div className="flex bg-gray-800 border border-gray-700 rounded-md focus-within:border-blue-500 transition-colors overflow-hidden h-10">
                            <div className="flex-1 min-w-0">
                                <Select
                                    className="border-none bg-transparent h-full"
                                    value={store.cardClass}
                                    onChange={(e) => {
                                        const newClass = e.target.value as CardClass;
                                        store.updateField('cardClass', newClass);
                                        // 링크 선택 시 펜듈럼 강제 종료
                                        if (newClass === '링크') {
                                            store.updateField('isPendulum', false);
                                        }
                                    }}
                                    options={[
                                        { label: '카드 분류', value: '' }, // Placeholder
                                        ...currentClassOptions
                                    ]}
                                />
                            </div>
                            {store.cardType === '몬스터' && (
                                <>
                                    <div className="w-[1px] bg-gray-700 my-2" />
                                    <div className={`flex items-center px-3 gap-2 bg-gray-800/50 ${store.cardClass === '링크' ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                        <span className="text-sm font-medium text-gray-400">펜듈럼</span>
                                        <ToggleSwitch
                                            checked={store.isPendulum}
                                            onChange={(c) => { if (store.cardClass !== '링크') store.updateField('isPendulum', c) }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </FormRow>
                </div>
            </section>

            <div className="flex-1 flex flex-col p-5 md:p-8 pb-0">

                {/* 데스크톱 모드 전용 상단 스페이서 (수직 정렬용 & 제한 적용) */}
                <div
                    className="hidden md:block transition-all duration-75"
                    style={{ flexGrow: 1, maxHeight: maxSpacerHeight !== undefined ? maxSpacerHeight : undefined, minHeight: 0 }}
                />

                <div className="space-y-8 shrink-0">

                    {/* 2. 이름, 레벨/랭크/링크, 속성, 종족 */}
                    <section className="space-y-5">

                        {/* Row 1: 카드 이름 */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="w-full">
                                <FormRow>
                                    <div className="flex flex-col gap-2">
                                        <div className="relative flex items-center group">
                                            <Input
                                                type="text"
                                                placeholder="카드 이름"
                                                value={store.cardName}
                                                onChange={(e) => store.updateField('cardName', e.target.value)}
                                                className="pr-10"
                                            />
                                            <button
                                                onClick={() => setIsNameSettingsOpen(!isNameSettingsOpen)}
                                                className={`absolute right-3 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all duration-200 ${isNameSettingsOpen ? 'rotate-180 bg-white/5' : ''}`}
                                                title="확장 설정 열기"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                        {isNameSettingsOpen && (
                                            <div className="bg-gray-800/80 border border-gray-700/80 rounded-lg p-4 mt-1 animate-in slide-in-from-top-2 fade-in duration-200 shadow-lg space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">폰트</label>
                                                    <SegmentControl
                                                        options={['폰트1', '폰트2']}
                                                        value={store.cardNameFont === 'name_kr_base' ? '폰트1' : '폰트2'}
                                                        onChange={(val: any) => store.updateField('cardNameFont', val === '폰트1' ? 'name_kr_base' : 'name_kr_alt')}
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">이름 색상</label>
                                                    <div className="flex flex-wrap gap-2.5">
                                                        {(() => {
                                                            const defaultColor = (store.cardClass === '엑시즈' || store.cardType === '마법' || store.cardType === '함정') ? '#ffffff' : '#000000';
                                                            const colorOptions = [
                                                                { label: '기본', value: 'default', hint: '카드 타입 기본색' },
                                                                { label: '블랙', value: '#000000', hint: '일반/마법/함정 등' },
                                                                { label: '화이트', value: '#ffffff', hint: '엑시즈/링크 등' },
                                                                { label: '레드', value: '#ff0000', hint: '레드' },
                                                                { label: '블루', value: '#0000ff', hint: '블루' },
                                                                { label: '퍼플', value: '#c800ff', hint: '퍼플' },
                                                                { label: '에메랄드', value: '#00c184', hint: '에메랄드' },
                                                                { label: '골드', value: '#ffce3c', hint: '골드' },
                                                            ].filter(c => c.value === 'default' || c.value !== defaultColor);

                                                            return colorOptions.map(color => (
                                                                <button
                                                                    key={color.value}
                                                                    onClick={() => store.updateField('cardNameColor', color.value as any)}
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${store.cardNameColor === color.value ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800 scale-110' : 'hover:scale-110 hover:ring-2 hover:ring-gray-500 hover:ring-offset-1 hover:ring-offset-gray-800'}`}
                                                                    style={{
                                                                        backgroundColor: color.value === 'default' ? '#4b5563' : color.value,
                                                                        border: color.value === '#000000' ? '1px solid #4b5563' : 'none',
                                                                        background: color.value === 'default' ? 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' : color.value
                                                                    }}
                                                                    title={color.hint}
                                                                >
                                                                    {color.value === 'default' && (
                                                                        <span className="text-[10px] font-bold text-gray-300">기본</span>
                                                                    )}
                                                                </button>
                                                            ))
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </FormRow>
                            </div>
                        </div>

                        {(store.cardType === '몬스터' || (store.cardType === '토큰' && store.cardClass === '일반')) && (
                            <>
                                {/* Row 2: 레벨/랭크/링크 | 속성 | 종족 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <FormRow>
                                            {store.cardClass === '링크' ? (
                                                <div className="relative">
                                                    <button
                                                        ref={popoverButtonRef}
                                                        onClick={() => setIsLinkPopoverOpen(!isLinkPopoverOpen)}
                                                        className="w-full h-10 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        LNK-{Object.values(store.linkMarkers).filter(Boolean).length} 설정
                                                    </button>

                                                    {/* 링크 마커 팝오버 (말풍선 스타일) */}
                                                    {isLinkPopoverOpen && (
                                                        <div
                                                            ref={popoverRef}
                                                            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 animate-in fade-in zoom-in slide-in-from-top-2 duration-200"
                                                        >
                                                            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-5 w-52 relative border-t-2 border-t-blue-500/30">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <h3 className="text-white font-bold text-sm">링크 마커</h3>
                                                                    <span className="bg-blue-900/40 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                                        LNK-{Object.values(store.linkMarkers).filter(Boolean).length}
                                                                    </span>
                                                                </div>

                                                                <div className="grid grid-cols-3 gap-2 w-full aspect-square mx-auto p-1.5 bg-gray-800 rounded-xl border border-gray-700 shadow-inner">
                                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
                                                                        if (i === 5) return <div key={i} className="bg-gray-900/30 rounded-lg"></div>
                                                                        const active = store.linkMarkers[i] || false
                                                                        return (
                                                                            <button
                                                                                key={i}
                                                                                onClick={() => store.updateField('linkMarkers', { ...store.linkMarkers, [i]: !active })}
                                                                                className={`transition-all rounded-lg transform active:scale-90 ${active ? 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.4)]' : 'bg-gray-700 hover:bg-gray-600'}`}
                                                                            />
                                                                        )
                                                                    })}
                                                                </div>

                                                                {/* 말풍선 꼬리 (위쪽) */}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-gray-700">
                                                                    <div className="absolute top-[1px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[7px] border-b-gray-900"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={store.cardClass === '엑시즈' ? 13 : 12}
                                                    placeholder={store.cardClass === '엑시즈' ? '랭크' : '레벨'}
                                                    value={store.cardClass === '엑시즈' ? store.rank : store.level}
                                                    onChange={(e) => {
                                                        const max = store.cardClass === '엑시즈' ? 13 : 12;
                                                        const val = parseInt(e.target.value);
                                                        if (isNaN(val)) {
                                                            store.updateField(store.cardClass === '엑시즈' ? 'rank' : 'level', '');
                                                        } else {
                                                            store.updateField(store.cardClass === '엑시즈' ? 'rank' : 'level', Math.min(val, max).toString());
                                                        }
                                                    }}
                                                />
                                            )}
                                        </FormRow>
                                    </div>
                                    <div>
                                        <FormRow>
                                            <Select
                                                value={store.attribute}
                                                onChange={(e) => store.updateField('attribute', e.target.value as CardAttribute)}
                                                options={[
                                                    { label: '속성', value: '' },
                                                    { label: '빛', value: '빛' },
                                                    { label: '어둠', value: '어둠' },
                                                    { label: '신', value: '신' },
                                                    { label: '물', value: '물' },
                                                    { label: '화염', value: '화염' },
                                                    { label: '바람', value: '바람' },
                                                    { label: '땅', value: '땅' },
                                                ]}
                                            />
                                        </FormRow>
                                    </div>

                                    <div>
                                        <FormRow>
                                            {store.race === '직접 입력' ? (
                                                <div className="relative flex items-center group">
                                                    <Input
                                                        placeholder="커스텀 종족"
                                                        autoFocus
                                                        className="pr-10"
                                                        value={store.customRace}
                                                        onChange={(e) => store.updateField('customRace', e.target.value)}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            store.updateField('race', '');
                                                            store.updateField('customRace', '');
                                                        }}
                                                        className="absolute right-3 p-1 text-gray-500 hover:text-white transition-colors"
                                                        title="목록으로 돌아가기"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ) : (
                                                <Select
                                                    value={store.race}
                                                    onChange={(e) => store.updateField('race', e.target.value as MonsterRace)}
                                                    options={[
                                                        { label: '종족', value: '' },
                                                        ...MONSTER_RACES.map(race => ({ label: race, value: race }))
                                                    ]}
                                                />
                                            )}
                                        </FormRow>
                                    </div>
                                </div>

                            </>
                        )}
                    </section>

                    {/* 3. 카드 텍스트 요소 영역 (일반/효과/튜너 설정 포함) */}
                    <section className="space-y-5">
                        {/* 펜듈럼 입력창: 카드 텍스트 바로 위로 이동 */}
                        {store.isPendulum && store.cardType === '몬스터' && (
                            <div className="flex bg-gray-800 border border-gray-700 rounded-md focus-within:border-blue-500 transition-colors overflow-hidden h-24 mb-4">
                                {/* 좌측 스케일 */}
                                <div className="w-20 relative bg-gray-800/30 flex items-center justify-center">
                                    {!store.pendulumScaleLeft && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] leading-tight text-gray-500 pointer-events-none select-none">
                                            <span>스케일</span>
                                            <span>(좌)</span>
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        className="w-full h-full bg-transparent text-center text-xl font-bold text-blue-400 outline-none relative z-10"
                                        value={store.pendulumScaleLeft}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            store.updateField('pendulumScaleLeft', val);
                                        }}
                                    />
                                </div>

                                <div className="w-[1px] bg-gray-700 h-full" />

                                {/* 중앙 펜듈럼 텍스트 */}
                                <textarea
                                    ref={pendulumTextareaRef}
                                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200 placeholder-gray-500 resize-none h-full"
                                    placeholder="펜듈럼 텍스트"
                                    value={store.pendulumText}
                                    onChange={(e) => store.updateField('pendulumText', e.target.value)}
                                    onFocus={() => setLastFocusedTextarea('pendulumText')}
                                />

                                <div className="w-[1px] bg-gray-700 h-full" />

                                {/* 우측 스케일 */}
                                <div className="w-20 relative bg-gray-800/30 flex items-center justify-center">
                                    {!store.pendulumScaleRight && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] leading-tight text-gray-500 pointer-events-none select-none">
                                            <span>스케일</span>
                                            <span>(우)</span>
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        className="w-full h-full bg-transparent text-center text-xl font-bold text-blue-400 outline-none relative z-10"
                                        value={store.pendulumScaleRight}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            store.updateField('pendulumScaleRight', val);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <FormRow>
                            <textarea
                                ref={textareaRef}
                                className="w-full h-32 bg-gray-800 border border-gray-700 text-gray-200 text-sm p-3 rounded-md resize-y outline-none focus:border-blue-500"
                                placeholder="카드 텍스트"
                                value={store.cardText}
                                onChange={(e) => store.updateField('cardText', e.target.value)}
                                onFocus={() => setLastFocusedTextarea('cardText')}
                            />
                        </FormRow>

                        {/* 넘버링 툴바 (카드 텍스트와 일반/효과 세그먼트 사이) */}
                        <FormRow>
                            <div className="grid grid-cols-6 gap-2 w-full">
                                {['①', '②', '③', '④', '⑤', '●'].map(char => (
                                    <button
                                        key={char}
                                        onClick={() => insertNumber(char)}
                                        className="h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md text-sm font-bold border border-gray-700 transition-colors"
                                    >
                                        {char}
                                    </button>
                                ))}
                            </div>
                        </FormRow>

                        {/* 일반/효과 세그먼트: 카드 텍스트 바로 아래로 이동 */}
                        {store.cardType === '몬스터' && !['일반', '효과', '특수 소환'].includes(store.cardClass) && (
                            <FormRow>
                                <SegmentControl
                                    options={['일반', '효과']}
                                    value={store.effectType}
                                    onChange={(val: EffectType) => store.updateField('effectType', val)}
                                />
                            </FormRow>
                        )}

                        {/* 기타 특성 선택 (타이틀 제거 및 하단 배치) */}
                        {store.cardType === '몬스터' && (
                            <FormRow>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full">
                                    {['리버스', '유니온', '튜너', '스피릿', '듀얼', '툰'].map(attr => {
                                        const active = store.otherAttributes.includes(attr)
                                        return (
                                            <button
                                                key={attr}
                                                onClick={() => toggleAttribute(attr)}
                                                className={`py-1.5 text-xs font-bold rounded-md border transition-all w-full ${active
                                                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                                    : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-500'
                                                    }`}
                                            >
                                                {attr}
                                            </button>
                                        )
                                    })}
                                </div>
                            </FormRow>
                        )}

                        {/* 토큰(일반) 전용: 튜너 토글 */}
                        {store.cardType === '토큰' && store.cardClass === '일반' && (
                            <FormRow>
                                <ToggleSwitch
                                    label="튜너 설정"
                                    checked={store.isTunerForToken}
                                    onChange={(c) => store.updateField('isTunerForToken', c)}
                                />
                            </FormRow>
                        )}
                    </section>

                    {/* 5. 스탯 정보 영역 (토큰(스탯X) 제외) */}
                    {store.cardType !== '마법' && store.cardType !== '함정' && !(store.cardType === '토큰' && store.cardClass === '스탯X') && (
                        <section className="space-y-5 border-t border-gray-700 pt-6 mt-6">
                            <div className="grid grid-cols-2 gap-4">
                                {/* 공격력 */}
                                <div className="min-w-0">
                                    <FormRow>
                                        <div className="flex bg-gray-800 border border-gray-700 rounded-md focus-within:border-blue-500 transition-colors overflow-hidden h-10">
                                            <input
                                                type="text"
                                                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200 placeholder-gray-500 min-w-0"
                                                placeholder="공격력 (ATK)"
                                                value={store.isAtkUnknown ? '?' : store.atk}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                    store.updateField('atk', val);
                                                }}
                                                disabled={store.isAtkUnknown}
                                            />
                                            <div className="w-[1px] bg-gray-700 my-2" />
                                            <div className="flex items-center px-3 gap-2 bg-gray-800/50">
                                                <span className="text-sm font-medium text-gray-400">?</span>
                                                <ToggleSwitch
                                                    checked={store.isAtkUnknown}
                                                    onChange={(c) => store.updateField('isAtkUnknown', c)}
                                                />
                                            </div>
                                        </div>
                                    </FormRow>
                                </div>

                                {/* 수비력 (링크 몬스터는 가림) */}
                                {store.cardClass !== '링크' ? (
                                    <div className="min-w-0">
                                        <FormRow>
                                            <div className="flex bg-gray-800 border border-gray-700 rounded-md focus-within:border-blue-500 transition-colors overflow-hidden h-10">
                                                <input
                                                    type="text"
                                                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200 placeholder-gray-500 min-w-0"
                                                    placeholder="수비력 (DEF)"
                                                    value={store.isDefUnknown ? '?' : store.def}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        store.updateField('def', val);
                                                    }}
                                                    disabled={store.isDefUnknown}
                                                />
                                                <div className="w-[1px] bg-gray-700 my-2" />
                                                <div className="flex items-center px-3 gap-2 bg-gray-800/50">
                                                    <span className="text-sm font-medium text-gray-400">?</span>
                                                    <ToggleSwitch
                                                        checked={store.isDefUnknown}
                                                        onChange={(c) => store.updateField('isDefUnknown', c)}
                                                    />
                                                </div>
                                            </div>
                                        </FormRow>
                                    </div>
                                ) : (
                                    <div /> // 링크 몬스터일 때 빈 공간을 채워 그리드 유지
                                )}
                            </div>
                        </section>
                    )}

                    <section className="space-y-5 border-t border-gray-700 pt-6 mt-6">
                        <div className="grid grid-cols-2 gap-4">
                            {/* 일련번호 */}
                            <FormRow>
                                <div className="flex bg-gray-800 border border-gray-700 rounded-md focus-within:border-blue-500 transition-colors overflow-hidden h-10 w-full">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200 placeholder-gray-500 min-w-0"
                                        placeholder="일련번호 (8자리)"
                                        value={store.serialNumber}
                                        maxLength={8}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            store.updateField('serialNumber', val);
                                        }}
                                    />
                                    <div className="flex items-center px-3 bg-gray-800/50">
                                        <ToggleSwitch
                                            checked={store.showSerialNumber}
                                            onChange={(c) => store.updateField('showSerialNumber', c)}
                                        />
                                    </div>
                                </div>
                            </FormRow>

                            {/* 카드 번호 */}
                            <FormRow>
                                <div className="flex bg-gray-800 border border-gray-700 rounded-md focus-within:border-blue-500 transition-colors overflow-hidden h-10 w-full">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200 placeholder-gray-500 min-w-0"
                                        placeholder="카드 번호"
                                        value={store.setNumber}
                                        onChange={(e) => store.updateField('setNumber', e.target.value)}
                                    />
                                    <div className="flex items-center px-3 bg-gray-800/50">
                                        <ToggleSwitch
                                            checked={store.showSetNumber}
                                            onChange={(c) => store.updateField('showSetNumber', c)}
                                        />
                                    </div>
                                </div>
                            </FormRow>

                            {/* 홀로그램 마크 */}
                            <div className="flex items-center justify-between bg-gray-800/30 px-3 py-2 rounded-md border border-gray-700/50">
                                <span className="text-sm text-gray-400">홀로그램 마크</span>
                                <ToggleSwitch checked={store.showHoloMark} onChange={(c) => store.updateField('showHoloMark', c)} />
                            </div>

                            {/* 저작권자 텍스트 */}
                            <div className="flex items-center justify-between bg-gray-800/30 px-3 py-2 rounded-md border border-gray-700/50">
                                <span className="text-sm text-gray-400">저작권자 텍스트</span>
                                <ToggleSwitch checked={store.showCopyright} onChange={(c) => store.updateField('showCopyright', c)} />
                            </div>
                        </div>
                    </section>

                </div>

                {/* 데스크톱 모드 전용 하단 스페이서 (수직 정렬용) */}
                <div className="hidden md:block" style={{ flexGrow: 1, minHeight: 0 }} />

            </div>

            {/* 링크 마커 모달 제거됨 (팝오버로 대체) */}

        </div>
    )
}
