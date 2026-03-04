import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useCardStore } from '../../store/useCardStore';

const CANVAS_WIDTH = 813;
const CANVAS_HEIGHT = 1185;

interface CardCanvasProps { }

// 폰트 로딩 완료 여부 (최초 1회만 수행)
let fontsReady = false;
const ensureFontsLoaded = async () => {
    if (fontsReady) return;
    try {
        await Promise.all([
            document.fonts.load('60px "name_en"'),
            document.fonts.load('60px "name_jp"'),
            document.fonts.load('60px "name_kr_alt"'),
            document.fonts.load('60px "name_kr_base"'),
            document.fonts.load('bold 32px "race_en"'),
            document.fonts.load('32px "text_jp"'),
            document.fonts.load('bold 32px "race_kr"'),
            document.fonts.load('28px "text_en"'),
            document.fonts.load('28px "text_jp"'),
            document.fonts.load('24px "text_kr"'),
            document.fonts.load('bold 36px "race_en"'),
            document.fonts.load('bold 75px "pen_scale"'),
            document.fonts.load('26px "text_kr"'),
            document.fonts.load('26px "text_en"'),
            document.fonts.load('26px "text_jp"'),
            document.fonts.load('bold 24px "code"'),
            document.fonts.load('bold 24px "lnk_no"'),
        ]);
        await document.fonts.ready;
    } catch (error) {
        console.warn('폰트 로드 중 일부 문제가 발생했습니다. 기본 폰트로 렌더링을 시도합니다.', error);
    }
    fontsReady = true;
};

export interface CardCanvasRef {
    download: (fileName: string) => void;
}

export const CardCanvas = forwardRef<CardCanvasRef, CardCanvasProps>((_, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
        download: (fileName: string) => {
            if (!canvasRef.current) return;
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        }
    }), []);
    const store = useCardStore();
    // 진행 중인 렌더 취소용 플래그
    const renderIdRef = useRef(0);

    const render = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 이번 렌더의 고유 ID — 새 렌더가 시작되면 이전 렌더는 중간에 blit하지 않음
        const myId = ++renderIdRef.current;

        // 폰트 로딩 (최초 1회)
        await ensureFontsLoaded();
        if (myId !== renderIdRef.current) return; // 더 새로운 렌더가 시작됐으면 포기

        // ── 오프스크린 캔버스에 모두 그린 뒤 메인 캔버스에 한 번에 blit ──
        const offscreen = document.createElement('canvas');
        offscreen.width = CANVAS_WIDTH;
        offscreen.height = CANVAS_HEIGHT;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;

        // 1. Clear Canvas (오프스크린)
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 1.5 Draw Card Image (Illustration) under the frame
        if (store.cardImage) {
            try {
                const cardImg = await loadImage(store.cardImage);
                if (store.isPendulum) {
                    // 펜듈럼 카드 렌더링 (비율 715:661, 텍스트 칸 뒤쪽까지 커버)
                    // X = 49, Y = 213, Width = 715, Height = 661 (비율과 위치 조정 완료)
                    ctx.drawImage(cardImg, 49, 213, 715, 661);
                } else {
                    // 일반 카드 렌더링 (비율 1:1)
                    // X = 86, Y = 194, Width = 642, Height = 642 (기존 설정값)
                    ctx.drawImage(cardImg, 86, 194, 642, 642);
                }
            } catch (e) {
                console.warn('일러스트 렌더링 실패', e);
            }
        }

        // 2. Load and Draw Background Frame
        const frameSrc = getFrameSource(store.cardType, store.cardClass, store.isPendulum);
        const frameImg = await loadImage(`/assets/images/${frameSrc}`);
        ctx.drawImage(frameImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 3. Draw Attribute (몬스터 / 일반 토큰에 표시)
        if (store.attribute && (store.cardType === '몬스터' || (store.cardType === '토큰' && store.cardClass === '일반'))) {
            const attrSrc = getAttributeSource(store.attribute);
            const attrImg = await loadImage(`/assets/images/${attrSrc}`);
            ctx.drawImage(attrImg, 680, 57, 74, 74);
        }

        // 4. Draw Name
        // ── 폰트별 이름 크기 상수 (여기서 조절하세요) ──
        const NAME_FONT_SIZES: Record<string, number> = {
            name_en: 60,       // 영어
            name_jp: 58,       // 일본어
            name_kr_base: 45,  // 한국어 한자체
            name_kr_alt: 59,   // 한국어 인쇄체
        };
        const nameFont = store.language === 'en' ? 'name_en' : store.language === 'ja' ? 'name_jp' : store.cardNameFont;
        const nameFontSize = NAME_FONT_SIZES[nameFont] ?? 60;
        ctx.font = `${nameFontSize}px "${nameFont}", sans-serif`;

        // 이름 색상: 엑시즈 / 링크 / 마법 / 함정은 희색
        let nameFillColor = (
            store.cardClass === '엑시즈' ||
            store.cardClass === '링크' ||
            store.cardType === '마법' ||
            store.cardType === '함정'
        ) ? 'white' : 'black';
        if (store.cardNameColor !== 'default') nameFillColor = store.cardNameColor;
        ctx.fillStyle = nameFillColor;

        // 이름 최대 너비: 속성 아이콘 유무에 따라 조정 (긴 이름은 자동으로 자폭 축소)
        const nameMaxWidth = store.attribute ? 606 : 720;
        ctx.textBaseline = 'middle';
        ctx.fillText(store.cardName, 63, 94, nameMaxWidth);
        ctx.textBaseline = 'alphabetic';

        // 5. Draw Level/Rank (링크 제외 모스터에만 표시)
        if ((store.cardType === '몬스터' || (store.cardType === '토큰' && store.cardClass === '일반')) && store.cardClass !== '링크') {
            const starImg = await loadImage(`/assets/images/${store.cardClass === '엑시즈' ? 'level_eyz.webp' : 'level.webp'}`);
            const count = parseInt(store.cardClass === '엑시즈' ? store.rank : store.level) || 0;
            for (let i = 0; i < count; i++) {
                if (store.cardClass === '엑시즈') {
                    // Rank: guideline2(21%=105dp) 기준, 카드 내 left=(105-78)×2.37=64px → margin 2dp → 69px
                    ctx.drawImage(starImg, 86 + i * 54, 145, 50, 50);
                } else {
                    // Level: guideline5(79.5%) right edge → (392.5-78)×2.37=745px, size=22.67dp×2.37=54px
                    ctx.drawImage(starImg, 677.5 - i * 53.8, 144.5, 50, 50);
                }
            }
        }

        // 5.5 Draw Pendulum Scale & Text
        if (store.isPendulum) {
            // Pendulum Scale (Left & Right)
            ctx.font = 'bold 73px "pen_scale", sans-serif';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            // Left Scale: guideline33(20%)~guideline37(25.3%) 중앙 → ((100+126.5)/2-78)×2.37=83px
            ctx.fillText(store.pendulumScaleLeft || '', 87, 852);
            // Right Scale: guideline38(74.6%)~guideline35(80%) 중앙 → ((373+400)/2-78)×2.37=731px
            ctx.fillText(store.pendulumScaleRight || '', 729, 852);
            ctx.textAlign = 'left'; // Reset

            // Pendulum Effect Text: guideline37(25.3%)~guideline38(74.6%), guideline40(62.5%)~guideline36(74%)
            // X: (126.5+6-78)×2.37=129px, maxWidth: (373-6-78)×2.37 - 129 = 556px
            // Y: guideline40(62.5%)×1185+margin = 741+12=753px, maxHeight: guideline36(74%)×1185-7-753=117px
            const pTextFont = store.language === 'en' ? 'text_en' : store.language === 'ja' ? 'text_jp' : 'text_kr';
            ctx.font = `26px "${pTextFont}", sans-serif`;
            ctx.fillStyle = 'black';
            const pTextX = 129;
            const pTextY = 773;
            const pMaxWidth = 556;
            const pMaxHeight = 117;
            drawAutoSizedText(ctx, store.pendulumText, pTextX, pTextY, pMaxWidth, pMaxHeight, store.language, 26);
        }

        // 6. Draw Race/Type [Race / Class / Effect]
        if (store.cardType === '몬스터' || (store.cardType === '토큰' && store.cardClass === '일반')) {
            const typeFontInfo = store.language === 'en' ? 'bold 32px "race_en"' : store.language === 'ja' ? '32px "text_jp"' : 'bold 28.6px "race_kr"';
            ctx.font = `${typeFontInfo}, sans-serif`;
            ctx.fillStyle = 'black';
            const typeText = getMonsterTypeText(store);
            // guideline9(75.5%) → Y = 0.755×1185 = 895px
            ctx.fillText(typeText, 63.5, 918);
        }

        // 7. Draw Card Text (Effect / Flavor)
        // ── 카드 텍스트 기본 폰트 크기 (여기서 조절하세요) ──
        const CARD_TEXT_DEFAULT_FONT_SIZE = 21;
        const textX = 64;
        const textY = 945;
        const maxWidth = 684;
        const maxHeight = 151;
        ctx.fillStyle = 'black';
        drawAutoSizedText(ctx, store.cardText, textX, textY, maxWidth, maxHeight, store.language, CARD_TEXT_DEFAULT_FONT_SIZE);

        // 8. Draw ATK / DEF
        if (store.cardType === '몬스터' || (store.cardType === '토큰' && store.cardClass === '일반')) {
            ctx.font = '43px "name_en", sans-serif';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'right';
            // ATK
            const xScale = 1.05;
            const atkText = store.isAtkUnknown ? '?' : (store.atk || '0');
            ctx.save();
            ctx.scale(xScale, 1);
            ctx.fillText(atkText, 579 / xScale, 1106);
            ctx.restore();

            // DEF (Except Link): guideline5(79.5%-5dp)=(392.5-78)×2.37=745px
            if (store.cardClass !== '링크') {
                const defText = store.isDefUnknown ? '?' : (store.def || '0');
                ctx.save();
                ctx.scale(xScale, 1);
                ctx.fillText(defText, 744 / xScale, 1106);
                ctx.restore();
            } else {
                // LINK Rating
                const activeLinks = Object.values(store.linkMarkers).filter(Boolean).length;
                if (activeLinks > 0) {
                    ctx.font = 'bold 28px "lnk_no", sans-serif';
                    ctx.fillText(`${activeLinks}`, 743, 1106);
                }
            }
            ctx.textAlign = 'left'; // Reset
        }

        // 9. Draw Link Markers
        if (store.cardClass === '링크') {
            const markerSize = {
                corners: { w: 72, h: 72 },
                sides: { w: 142, h: 43 },
                topbot: { w: 43, h: 142 }
            };

            // Approximate Link marker positions based on center and edges of illustration
            // Center of illustration is approx (X: 406, Y: 525)
            const markers = [
                { id: 1, x: 71, y: 188, w: markerSize.corners.w, h: markerSize.corners.h, src: 'link_arrow_1.webp' }, // Top-Left
                { id: 2, x: 337, y: 175, w: markerSize.sides.w, h: markerSize.sides.h, src: 'link_arrow_2.webp' },     // Top-Center
                { id: 3, x: 671, y: 188, w: markerSize.corners.w, h: markerSize.corners.h, src: 'link_arrow_3.webp' }, // Top-Right
                { id: 4, x: 56, y: 455, w: markerSize.topbot.w, h: markerSize.topbot.h, src: 'link_arrow_4.webp' },   // Mid-Left
                { id: 6, x: 714, y: 455, w: markerSize.topbot.w, h: markerSize.topbot.h, src: 'link_arrow_6.webp' },   // Mid-Right
                { id: 7, x: 71, y: 789, w: markerSize.corners.w, h: markerSize.corners.h, src: 'link_arrow_7.webp' }, // Bot-Left
                { id: 8, x: 337, y: 833, w: markerSize.sides.w, h: markerSize.sides.h, src: 'link_arrow_8.webp' },     // Bot-Center
                { id: 9, x: 671, y: 789, w: markerSize.corners.w, h: markerSize.corners.h, src: 'link_arrow_9.webp' }, // Bot-Right
            ];

            for (const m of markers) {
                if (store.linkMarkers[m.id]) {
                    const mImg = await loadImage(`/assets/images/${m.src}`);
                    ctx.drawImage(mImg, m.x, m.y, m.w, m.h);
                }
            }
        }

        // 10. Footer info (Set Code, Serial Number, Hologram, Copyright)
        // ── 글자 크기 상수 (여기서 조절하세요) ──
        const SET_NUMBER_FONT_SIZE = 24;    // 카드 번호
        const SERIAL_NUMBER_FONT_SIZE = 21; // 시리얼 번호
        ctx.fillStyle = 'black';

        // Set Number: 토글 켜져 있을 때만 표시
        if (store.showSetNumber && store.setNumber) {
            ctx.font = `${SET_NUMBER_FONT_SIZE}px "code", sans-serif`;
            if (store.cardClass === '링크') {
                // 링크 카드: 텍스트 박스 좌측 상단
                ctx.fillText(store.setNumber, 567, 870);
            } else if (store.isPendulum) {
                // 펜듈럼 카드: 텍스트 박스 상단 좌측 별도 위치
                ctx.fillText(store.setNumber, 70, 1104);
            } else {
                // 일반 카드: 일러스트 박스 우측 하단 (우측 정렬)
                ctx.textAlign = 'right';
                ctx.fillText(store.setNumber, 726, 870);
                ctx.textAlign = 'left';
            }
        }

        // Serial Number: 토글 켜져 있을 때만 표시
        if (store.showSerialNumber && store.serialNumber) {
            ctx.font = `${SERIAL_NUMBER_FONT_SIZE}px "code", sans-serif`;
            ctx.fillText(store.serialNumber, 40, 1147);
        }

        // Copyright
        if (store.showCopyright) {
            const creatorImg = await loadImage(`/assets/images/creator.webp`);
            // Width 118, Height 10 -> scaled up appropriately for 813x1185 canvas (approx x2.3)
            ctx.drawImage(creatorImg, 420, 1133, 236, 20);
        }

        // Hologram (Eye of Anubis)
        if (store.showHoloMark) {
            const holoImg = await loadImage(`/assets/images/holosticker.webp`);
            // Width/Height: Approx 35x35 based on layout
            ctx.drawImage(holoImg, 750, 1119, 36, 36);
        }
        // 모든 드로잉 완료 후, 아직 최신 렌더라면 메인 캔버스에 한 번에 복사 (더블 버퍼링)
        if (myId !== renderIdRef.current) return;
        const mainCtx = canvas.getContext('2d');
        if (!mainCtx) return;
        mainCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        mainCtx.drawImage(offscreen, 0, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store]);

    useEffect(() => {
        render();
    }, [render]);

    return (
        <div className="relative w-full h-full">
            {/* Hidden DOM to force browser font loading for Canvas */}
            <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
                <span style={{ fontFamily: 'race_en', fontWeight: 'bold' }}>폰트 로드</span>
                <span style={{ fontFamily: 'pen_scale', fontWeight: 'bold' }}>폰트 로드</span>
                <span style={{ fontFamily: 'name_en', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'text_en', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'name_kr_base', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'name_kr_alt', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'race_kr', fontWeight: 'bold' }}>폰트 로드</span>
                <span style={{ fontFamily: 'text_kr', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'name_jp', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'text_jp', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'code', fontWeight: 'normal' }}>폰트 로드</span>
                <span style={{ fontFamily: 'code', fontWeight: 'bold' }}>폰트 로드</span>
                <span style={{ fontFamily: 'lnk_no', fontWeight: 'bold' }}>폰트 로드</span>
            </div>
            <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full h-full object-contain"
            />




        </div>
    );
});

// --- Helpers ---

// 이미지 캐시: 동일 src는 한 번만 로드하고 재사용
const imageCache = new Map<string, HTMLImageElement>();
const loadImage = (src: string): Promise<HTMLImageElement> => {
    if (imageCache.has(src)) {
        return Promise.resolve(imageCache.get(src)!);
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = reject;
    });
};

const getFrameSource = (type: string, cls: string, isPendulum: boolean): string => {
    if (isPendulum) {
        if (cls === '융합') return 'pendulum_fusion.webp';
        if (cls === '의식') return 'pendulum_ritual.webp';
        if (cls === '싱크로') return 'pendulum_synchro.webp';
        if (cls === '엑시즈') return 'pendulum_xyz.webp';
        if (cls === '일반') return 'pendulum_normal.webp';
        return 'pendulum_effect.webp';
    }

    if (type === '마법') return 'magic.webp';
    if (type === '함정') return 'trap.webp';
    if (type === '토큰') return (cls === '일반' ? 'token.webp' : 'token_no_stats.webp');

    switch (cls) {
        case '융합': return 'fusion.webp';
        case '의식': return 'ritual.webp';
        case '싱크로': return 'synchro.webp';
        case '엑시즈': return 'xyz.webp';
        case '링크': return 'link.webp';
        case '일반': return 'nomal.webp'; // Note: mapping might need 'nomal' vs 'normal'
        default: return 'effect.webp';
    }
};

const getAttributeSource = (attr: string): string => {
    switch (attr) {
        case '빛': return 'light.webp';
        case '어둠': return 'dark.webp';
        case '화염': return 'fire.webp';
        case '물': return 'water.webp';
        case '바람': return 'wind.webp';
        case '땅': return 'earth.webp';
        case '신': return 'divine.webp';
        case '마법': return 'magic_atr.webp';
        case '함정': return 'trap_atr.webp';
        default: return 'dark.webp';
    }
};

const getMonsterTypeText = (store: any) => {
    const typeArr = [];
    const race = store.race === '직접 입력' ? store.customRace : store.race;
    if (race) typeArr.push(race);

    if (store.cardType === '토큰' && store.cardClass === '일반') {
        if (store.isTunerForToken) typeArr.push('튜너');
        typeArr.push('일반');
    } else {
        // Normal Monster Logic
        if (store.cardClass !== '일반' && store.cardClass !== '효과') {
            typeArr.push(store.cardClass);
        }
        if (store.isPendulum) typeArr.push('펜듈럼');

        // Other attributes (Tuner, etc.)
        store.otherAttributes.forEach((attr: string) => typeArr.push(attr));

        if (store.cardClass === '일반') typeArr.push('일반');
        else if (store.cardClass === '효과' || store.cardClass === '특수 소환') typeArr.push('효과');
        else if (store.effectType === '효과') typeArr.push('효과');
    }

    // 언어에 따라 구분자 변경 (일본어 등은 전각 슬래시(／), 한국어/영어는 반각 문자열 조합 ( / ))
    const separator = store.language === 'ja' ? ' ／ ' : ' / ';
    const leftBracket = store.language === 'ja' ? '【' : '[';
    const rightBracket = store.language === 'ja' ? '】' : ']';
    return `${leftBracket}${typeArr.join(separator)}${rightBracket}`;
};

const drawAutoSizedText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, maxHeight: number, lang: string, defaultFontSize: number = 28) => {
    if (!text) return;
    let fontSize = defaultFontSize;
    const textFont = lang === 'en' ? 'text_en' : lang === 'ja' ? 'text_jp' : 'text_kr';
    ctx.font = `${fontSize}px "${textFont}", sans-serif`;

    // Auto-scaling logic: simple version
    let lines = wrapText(ctx, text, maxWidth);
    while (lines.length * (fontSize * 1.2) > maxHeight && fontSize > 10) {
        fontSize -= 1;
        ctx.font = `${fontSize}px "${textFont}", sans-serif`;
        lines = wrapText(ctx, text, maxWidth);
    }

    lines.forEach((lineObj, i) => {
        const lineText = lineObj.text;
        // 다음 줄이 빈 줄이거나 사용자가 직접 \n으로 끊은 줄인 경우 양쪽 정렬(justify) 예외 처리
        const isLastLine = i === lines.length - 1 || lineObj.isExplicitBreak || lines[i + 1].text === '';

        if (isLastLine || lineText.trim() === '') {
            ctx.fillText(lineText, x, y + i * (fontSize * 1.2));
            return;
        }

        // 양쪽 맞춤 정렬 로직 (Justified Text)
        const words = lineText.trim().split(' ');
        if (words.length <= 1) {
            ctx.fillText(lineText, x, y + i * (fontSize * 1.2));
            return;
        }

        const totalWidth = ctx.measureText(lineText.replace(/\s/g, '')).width;
        const spaceRemaining = maxWidth - totalWidth;
        const spaceWidth = spaceRemaining / (words.length - 1);

        let currentX = x;
        words.forEach((word) => {
            ctx.fillText(word, currentX, y + i * (fontSize * 1.2));
            currentX += ctx.measureText(word).width + spaceWidth;
        });
    });
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const lines: { text: string; isExplicitBreak: boolean }[] = [];

    // 1. First split by explicit line breaks (\n)
    const explicitLines = text.split('\n');

    for (let j = 0; j < explicitLines.length; j++) {
        const explicitLine = explicitLines[j];
        // If it's an empty line, just preserve the empty space
        if (explicitLine.trim() === '') {
            lines.push({ text: '', isExplicitBreak: true });
            continue;
        }

        // 2. Then apply the word wrapping logic to each explicit line
        const words = explicitLine.split(/(\s+)/);
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine.trim().length > 0) {
                // If the word itself is longer than maxWidth, we might need a different handling, 
                // but for now, push current and start new
                // This break happened due to wrapping, NOT explicit \n
                lines.push({ text: currentLine, isExplicitBreak: false });
                currentLine = words[i].trim();
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine.length > 0) {
            // This is the end of an explicit line block (i.e. followed by \n implicitly or EOF)
            lines.push({ text: currentLine, isExplicitBreak: true });
        }
    }

    return lines;
};
