import { useState, useCallback } from 'react';
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

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
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
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] md:h-auto md:max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
                    <h2 className="text-white font-bold text-lg">기본 일러스트 설정</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 rounded-md">
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
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>

                <div className="p-5 bg-gray-900 space-y-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400 font-medium shrink-0">확대/축소</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => {
                                setZoom(Number(e.target.value));
                            }}
                            className="flex-1 accent-blue-500 bg-gray-700 rounded-lg h-2 appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors border border-gray-700 shadow flex items-center gap-2"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? '저장 중...' : '확인'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
