from __future__ import annotations

import math
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "copyright_materials"
OUTPUT_FILE = OUTPUT_DIR / "AI短视频智能创作工作流管理系统软件_V1.0_程序鉴别材料_源代码.pdf"

SOFTWARE_NAME = "AI短视频智能创作工作流管理系统软件"
VERSION = "V1.0"
LINES_PER_PAGE = 50
PAGES_PER_PART = 30
TOTAL_PAGES = PAGES_PER_PART * 2


def source_files() -> list[Path]:
    files: list[Path] = []
    preferred = [
        "src/App.jsx",
        "src/main.jsx",
        "src/api.js",
        "src/features/auth/LoginPromptSheet.jsx",
        "src/features/assets/AssetsPage.jsx",
        "src/features/batch/BatchPage.jsx",
        "src/features/settings/SettingsPage.jsx",
        "src/features/stitch/VideoStitchPage.jsx",
        "src/features/textImage/TextImagePage.jsx",
        "src/features/workflow/WorkflowModulePage.jsx",
        "src/shared/compliance/aiEvidencePack.js",
        "src/shared/pwa/registerServiceWorker.js",
        "src/shared/textImageStudioHandoff.js",
        "src/styles.css",
        "server.js",
    ]
    for relative in preferred:
        path = ROOT / relative
        if path.exists():
            files.append(path)
    return files


def read_source_lines(files: list[Path]) -> list[str]:
    lines: list[str] = []
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        lines.append(f"/* ===== File: {relative} ===== */")
        text = path.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            lines.append(line.expandtabs(2).rstrip())
        lines.append(f"/* ===== End File: {relative} ===== */")
        lines.append("")
    return lines


def selected_lines(all_lines: list[str]) -> list[tuple[str, int, str]]:
    front_count = PAGES_PER_PART * LINES_PER_PAGE
    back_count = PAGES_PER_PART * LINES_PER_PAGE
    if len(all_lines) <= front_count + back_count:
        selected = [("源程序全文", index, line) for index, line in enumerate(all_lines, start=1)]
    else:
        selected = [
            ("源程序前连续30页", index, line)
            for index, line in enumerate(all_lines[:front_count], start=1)
        ]
        back_start = len(all_lines) - back_count + 1
        selected.extend(
            ("源程序后连续30页", index, line)
            for index, line in enumerate(all_lines[-back_count:], start=back_start)
        )
    target = TOTAL_PAGES * LINES_PER_PAGE
    if len(selected) < target:
        selected.extend(("补空", 0, "") for _ in range(target - len(selected)))
    return selected[:target]


def register_font() -> str:
    candidates = [
        Path(r"C:\Windows\Fonts\simsun.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
        Path(r"C:\Windows\Fonts\msyh.ttc"),
    ]
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("CNCode", str(path)))
            return "CNCode"
    return "Courier"


def draw_pdf(rows: list[tuple[str, int, str]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    font_name = register_font()
    page_width, page_height = A4
    left = 34
    right = 28
    top = 42
    bottom = 34
    line_height = (page_height - top - bottom - 20) / LINES_PER_PAGE
    code_size = min(7.0, line_height * 0.76)
    header_size = 8.5
    footer_size = 8.0
    c = canvas.Canvas(str(OUTPUT_FILE), pagesize=A4)
    c.setTitle(f"{SOFTWARE_NAME} {VERSION} 程序鉴别材料")
    c.setAuthor("软件著作权登记材料")

    for page_index in range(TOTAL_PAGES):
        start = page_index * LINES_PER_PAGE
        page_rows = rows[start : start + LINES_PER_PAGE]
        part = page_rows[0][0] if page_rows else ""
        page_no = page_index + 1
        part_page = page_no if page_no <= PAGES_PER_PART else page_no - PAGES_PER_PART

        c.setFillColor(colors.black)
        c.setFont(font_name, header_size)
        c.drawString(left, page_height - 26, f"{SOFTWARE_NAME} {VERSION} 源代码")
        c.drawRightString(page_width - right, page_height - 26, f"{part} 第{part_page:02d}页")
        c.setStrokeColor(colors.HexColor("#BFC7D1"))
        c.line(left, page_height - 32, page_width - right, page_height - 32)

        c.setFont(font_name, code_size)
        y = page_height - top
        for _, source_line_number, text in page_rows:
            display = f"{source_line_number:04d}  {text}"
            c.drawString(left, y, display[:220])
            y -= line_height

        c.setStrokeColor(colors.HexColor("#BFC7D1"))
        c.line(left, bottom - 8, page_width - right, bottom - 8)
        c.setFont(font_name, footer_size)
        c.drawString(left, bottom - 22, "材料类型：程序鉴别材料（一般交存）")
        c.drawCentredString(page_width / 2, bottom - 22, f"第 {page_no} 页 / 共 {TOTAL_PAGES} 页")
        c.drawRightString(page_width - right, bottom - 22, f"生成日期：{date.today().isoformat()}")
        c.showPage()

    c.save()


def main() -> None:
    files = source_files()
    lines = read_source_lines(files)
    rows = selected_lines(lines)
    draw_pdf(rows)
    print(OUTPUT_FILE)
    print(f"source_files={len(files)} source_lines={len(lines)} pages={TOTAL_PAGES}")


if __name__ == "__main__":
    main()
