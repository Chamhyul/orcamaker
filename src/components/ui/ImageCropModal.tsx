import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Area } from 'react-easy-crop';
import getCroppedImg from '../../utils/getCroppedImg';
import { useCardStore } from '../../store/useCardStore';

interface ImageCropModalProps {
    imageUrl: string;
    onClose: () => void;
}

export function ImageCropModal({ imageUrl, onClose }: ImageCropModalProps) {
    const store = useCardStore();
    const isPendulum = store.isPendulum;
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const cropRef = useRef(crop);
    const interactionStartCrop = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        cropRef.current = crop;
    }, [crop]);

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = useCallback(async () => {
        if (!croppedAreaPixels) return;
        setIsSaving(true);
        try {
            const croppedImageBase64 = await getCroppedImg(imageUrl, croppedAreaPixels, 0);
            store.updateField('cardImage', croppedImageBase64);
            onClose();
        } catch (e) {
            console.error('Error cropping image:', e);
            alert('이미지를 크롭하는 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    }, [croppedAreaPixels, imageUrl, onClose, store]);

    const handleCropChange = useCallback((newCrop: { x: number; y: number }) => {
        if (isShiftPressed && interactionStartCrop.current) {
            const start = interactionStartCrop.current;
            const dx = Math.abs(newCrop.x - start.x);
            const dy = Math.abs(newCrop.y - start.y);
            if (dx > dy) {
                setCrop({ x: newCrop.x, y: start.y });
            } else {
                setCrop({ x: start.x, y: newCrop.y });
            }
        } else {
            setCrop(newCrop);
        }
    }, [isShiftPressed]);

    const handleInteractionStart = useCallback(() => {
        interactionStartCrop.current = { ...cropRef.current };
    }, []);

    const handleInteractionEnd = useCallback(() => {
        interactionStartCrop.current = null;
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
            if (e.key === 'Shift') {
                setIsShiftPressed(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftPressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleSave]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] md:h-auto md:max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <h2 className="text-text-primary font-bold text-lg">기본 일러스트 설정</h2>
                    <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary transition-colors bg-bg-sub hover:bg-bg-header rounded-md">
                        ✕
                    </button>
                </div>

                <div className="relative flex-1 bg-black min-h-[50vh]">
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        // 펜듈럼 비율 715:661 (실제 렌더링 넓이(715)와 높이(661) 반영), 일반은 1:1
                        aspect={isPendulum ? 715 / 661 : 1}
                        onCropChange={handleCropChange}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        onInteractionStart={handleInteractionStart}
                        onInteractionEnd={handleInteractionEnd}
                    />
                </div>

                <div className="p-5 bg-bg-surface space-y-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-text-secondary font-medium shrink-0">확대/축소</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.01}
                            aria-labelledby="Zoom"
                            onChange={(e) => {
                                setZoom(Number(e.target.value));
                            }}
                            className="flex-1 accent-primary bg-bg-sub rounded-lg h-2 appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-bg-sub hover:bg-bg-header text-text-primary rounded-xl font-bold transition-colors border border-border shadow flex items-center gap-2"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-primary hover:opacity-90 text-white rounded-xl font-bold transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? '저장 중...' : '확인'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
