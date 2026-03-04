"""
폰트 파일 내부 메타데이터를 싹 지우고, WOFF2 포맷으로 저장합니다.
기존 파일은 _original_fonts_backup 폴더에 보관됩니다.
"""
import os
import shutil
import json
from fontTools.ttLib import TTFont

# 스크립트 실행 기준 경로로 절대 경로 설정
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_DIR = os.path.join(SCRIPT_DIR, '..', 'public', 'assets', 'fonts')
BACKUP_DIR = os.path.join(SCRIPT_DIR, '..', '_original_fonts_backup')

# 처리할 파일들 (이미 복사해둔 새 이름 파일들만 처리)
TARGET_FILES = [
    'name_kr_alt.ttf',
    'name_kr_base.woff2',
    'text_jp.ttf',
    'name_jp.ttf',
    'race_en.ttf',
    'pen_scale.ttf',
    'text_en.ttf',
    'name_en.ttf',
    'lnk_no.otf',
    'race_kr.ttf',
    'text_kr.woff2',
    'code_nor.otf',
    'code_itl.ttf',
    'code_bold.otf',
]

# 지울 name 레코드 ID 목록 (저작권, 패밀리명, PostScript명, 제작자 정보 등)
METADATA_IDS_TO_CLEAR = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22}

def clear_metadata(font: TTFont):
    """폰트 name 테이블 내 식별 가능한 정보를 'F'로 덮어씌웁니다."""
    if 'name' not in font:
        return
    for record in font['name'].names:
        if record.nameID in METADATA_IDS_TO_CLEAR:
            try:
                record.string = 'F'.encode(record.getEncoding())
            except Exception:
                try:
                    record.string = 'F'.encode('utf-16-be')
                except Exception:
                    pass

def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)

    success_count = 0
    fail_count = 0

    for filename in TARGET_FILES:
        filepath = os.path.join(FONTS_DIR, filename)

        if not os.path.exists(filepath):
            print(f'[건너뜀] 파일 없음: {filename}')
            continue

        # 백업
        backup_path = os.path.join(BACKUP_DIR, filename)
        shutil.copy2(filepath, backup_path)

        try:
            font = TTFont(filepath)
            clear_metadata(font)

            # 항상 woff2 포맷으로 저장
            font.flavor = 'woff2'
            new_filename = os.path.splitext(filename)[0] + '.woff2'
            new_filepath = os.path.join(FONTS_DIR, new_filename)

            font.save(new_filepath)
            print(f'[완료] {filename} → {new_filename}')

            # 원본(복사본)이 다른 확장자면 삭제
            if new_filepath != filepath:
                os.remove(filepath)

            success_count += 1
        except Exception as e:
            print(f'[실패] {filename}: {e}')
            fail_count += 1

    print(f'\n변환 완료: 성공 {success_count}개, 실패 {fail_count}개')
    print(f'원본 백업 위치: {BACKUP_DIR}')

if __name__ == '__main__':
    main()
