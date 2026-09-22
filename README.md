# dsh-wsl-media

> **语言：** **中文**（本页） · [English](./README.en.md)

本地媒体/文档管线：ffprobe、抽音轨、缩略图、PDF、ASR、pandoc、OCR、exif。

| | |
|---|---|
| 版本 | **0.2.0** |
| 套件 | [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit) **可选**，不在 `install.sh` |

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-media
# 或本机 path：
# dsh plugin --profile web add /mnt/c/Users/YOU/Desktop/AIFullStackDevelopment/dsh-wsl-media
```

kit 批量链接（可选）：`bash dsh-wsl-kit/scripts/link-linux-plugins.sh`

## 工具

| 工具 | 作用 |
|------|------|
| `media_status` | CLI 探测 |
| `media_probe` | ffprobe |
| `media_extract_audio` | 抽音轨 |
| `media_thumbnail` | 缩略图 |
| `media_pdf_text` | PDF 文本 |
| `media_asr` | whisper ASR |
| `media_pandoc` | 格式转换 |
| `media_ocr` | tesseract OCR |
| `media_exif` | exiftool |

## 配置要点

`allowRoots / timeoutMs / maxPdfChars`

路径必须在 allowRoots（默认含家目录、`/tmp`、`/mnt/c|d`）。

## License

MIT
