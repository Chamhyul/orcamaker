import { useState, useEffect, useRef, useCallback, DragEvent } from 'react'
import { DataEditor } from './components/editor/DataEditor'
import { CardCanvas, CardCanvasRef } from './components/preview/CardCanvas'
import { ImageCropModal } from './components/ui/ImageCropModal'
import { useCardStore } from './store/useCardStore'

import { Moon, Sun } from 'lucide-react'

const CARD_W = 400
const CARD_H = 584
const MAX_DELTA = 300 // 이 픽셀만큼 스크롤해야 50% 축소 완료

function App() {
  const store = useCardStore()
  const [cardWidth, setCardWidth] = useState(CARD_W)
  const [isMobile, setIsMobile] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const accumRef = useRef(0)
  const shrinkDoneRef = useRef(false)

  // ── 이미지 크롭 모달 ──
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCropImageUrl(url)
    e.target.value = '' // 동일 파일 재선택 허용
  }

  // ── 드래그 앤 드롭 ──
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setCropImageUrl(url)
  }

  const cardCanvasRef = useRef<CardCanvasRef>(null)

  // ── 반응형 감지 ──
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        // PC 전환 시 초기화
        setCardWidth(CARD_W)
        accumRef.current = 0
        shrinkDoneRef.current = false
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── 스크롤 델타 누적 → 카드 크기 갱신 ──
  const applyDelta = useCallback((delta: number) => {
    const container = contentRef.current
    if (!container) return false

    // 만약 이미 다 줄어든 상태에서 아래로 스크롤(delta > 0)한다면 브라우저 스크롤 허용
    if (shrinkDoneRef.current && delta > 0) return false

    // 다 줄어든 상태에서 위로 스크롤(delta < 0)하는데 하단 내용이 아직 맨 위가 아니라면 브라우저 스크롤 허용
    if (shrinkDoneRef.current && delta < 0 && container.scrollTop > 0) return false

    // 다 줄어든 상태에서 최상단인데 계속 위로 스크롤하면, 다시 카드 크기를 키우는 페이즈로 전환
    if (shrinkDoneRef.current && delta < 0 && container.scrollTop <= 0) {
      shrinkDoneRef.current = false
    }

    // 델타 상하한치 누적 (0 ~ MAX_DELTA)
    accumRef.current = Math.max(0, Math.min(MAX_DELTA, accumRef.current + delta))
    const progress = Math.min(accumRef.current / MAX_DELTA, 1)
    const newW = CARD_W - (CARD_W / 2) * progress
    setCardWidth(newW)

    if (progress >= 1) {
      shrinkDoneRef.current = true
    }
    return progress < 1 // true = 우리가 브라우저 스크롤 이벤트를 막고 직접 크기 조정 중
  }, [])

  // ── 마우스 휠 ──
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!isMobile) return
      const shouldBlock = applyDelta(e.deltaY)
      if (shouldBlock) e.preventDefault()
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [isMobile, applyDelta])

  // ── 터치 (모바일 실기기) ──
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    let lastY = 0
    const onStart = (e: TouchEvent) => { lastY = e.touches[0].clientY }
    const onMove = (e: TouchEvent) => {
      if (!isMobile) return
      const delta = lastY - e.touches[0].clientY
      lastY = e.touches[0].clientY
      const shouldBlock = applyDelta(delta)
      if (shouldBlock) e.preventDefault()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [isMobile, applyDelta])

  // ── 테마 동기화 ──
  useEffect(() => {
    if (store.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [store.theme])

  const cardHeight = (cardWidth / CARD_W) * CARD_H

  return (
    // wrapperRef: 이벤트 수신 전체 컨테이너. 그 자체의 overflow는 hidden 유지(브라우저 스크롤 차단)
    // PC의 데이터 입력 영역만 내부적으로 overflow-y-auto
    <div
      ref={wrapperRef}
      className="h-screen flex flex-col bg-bg-body text-text-primary overflow-hidden"
    >
      {/* ─── 헤더 ─── */}
      <header className="shrink-0 bg-bg-header border-b border-border px-5 py-3 flex justify-between items-center z-30">
        <h1 className="text-lg font-bold tracking-wider">YGO 오리지널 카드 메이커</h1>

        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={() => store.updateField('theme', store.theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded-md hover:bg-bg-sub transition-colors text-text-secondary"
            aria-label="Toggle theme"
          >
            {store.theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <select
            className="bg-bg-sub border border-border rounded px-3 py-1 text-sm outline-none cursor-pointer text-text-primary"
            value={store.language}
            onChange={(e) => store.updateField('language', e.target.value as any)}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      </header>

      {/* ─── 바디 ─── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ── 카드 미리보기 ── */}
        {/* flex-grow: 1 (같이 늘어남), flex-shrink: 10 (우선적으로 줄어듦), flex-basis: 480px */}
        <div
          className="md:flex-[1_10_480px] shrink-0 bg-bg-body flex flex-col items-center justify-start md:justify-center p-5 md:p-8 md:h-full relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 rounded-xl border-4 border-primary border-dashed bg-primary/5 m-4 pointer-events-none flex items-center justify-center">
              <div className="bg-bg-body px-6 py-3 rounded-lg shadow-lg font-bold text-primary">
                이미지 파일 놓기
              </div>
            </div>
          )}
          <div className="w-full flex flex-col items-center">
            {/* 카드 캔버스: width/height 직접 제어 (transition으로 부드럽게) */}
            <div
              id="card-preview-wrapper"
              style={{
                width: cardWidth,
                height: cardHeight,
                transition: 'width 0.03s linear, height 0.03s linear'
              }}
              className="relative flex items-center justify-center shrink-0"
            >
              {/* 그림자 레이어: 카드보다 1px 작아 박스는 안 보이고 그림자만 표시 */}
              <div className="absolute shadow-xl pointer-events-none" style={{ inset: 1 }} />
              <CardCanvas
                ref={cardCanvasRef}
                onIllustrationClick={() => imageInputRef.current?.click()}
              />
            </div>

            {/* 버튼 그룹 */}
            <div className="mt-4 flex flex-col gap-2 shrink-0 items-center">
              {/* 1줄: 이미지 선택 / 다운로드 */}
              <div className="flex gap-2">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="px-6 py-2 bg-bg-sub hover:bg-border text-text-primary text-sm rounded-md shadow transition"
                >
                  이미지 선택
                </button>
                <button
                  onClick={() => {
                    const fileName = store.cardName ? `${store.cardName}.png` : 'card.png';
                    cardCanvasRef.current?.download(fileName);
                  }}
                  className="px-6 py-2 bg-primary text-white hover:opacity-90 text-sm rounded-md shadow transition"
                >
                  이미지 다운로드
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ── 구분선 ── */}
        <div className="shrink-0 hidden md:block w-[1px] bg-border my-20" />
        <div className="shrink-0 md:hidden px-5">
          <div className="h-px bg-border max-w-2xl mx-auto" />
        </div>

        {/* ── 데이터 입력 ── */}
        {/* flex-grow: 1 (같이 늘어남), flex-shrink: 1 (나중에 줄어듦), flex-basis: 672px (max-w-2xl) */}
        <div ref={contentRef} className="md:flex-[1_1_672px] mt-4 md:mt-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto md:min-h-full flex flex-col pb-16">
            <DataEditor />
          </div>
        </div>

      </div>

      {/* ── 크롭 모달 ── */}
      {cropImageUrl && (
        <ImageCropModal
          imageUrl={cropImageUrl}
          onClose={() => {
            setCropImageUrl(null);
            if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
          }}
        />
      )}
    </div>
  )
}

export default App
