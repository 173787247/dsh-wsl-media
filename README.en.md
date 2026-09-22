# dsh-wsl-media

> **Languages:** [中文（首页）](./README.md) · **English** (this file)

Local media/doc pipeline: probe, extract, thumbnail, PDF, ASR, pandoc, OCR, exif.

| | |
|---|---|
| Version | **0.2.0** |
| Kit | Optional companion to [dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit); not in `install.sh` |

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-media
```

Batch link (optional): `bash dsh-wsl-kit/scripts/link-linux-plugins.sh`

## Tools

| Tool | Role |
|------|------|
| `media_status` | CLI probe |
| `media_probe` | ffprobe |
| `media_extract_audio` | extract audio |
| `media_thumbnail` | thumbnail |
| `media_pdf_text` | PDF text |
| `media_asr` | whisper ASR |
| `media_pandoc` | pandoc convert |
| `media_ocr` | tesseract OCR |
| `media_exif` | exiftool |

## Config

`allowRoots / timeoutMs / maxPdfChars`

Paths must stay under allowRoots (home, `/tmp`, `/mnt/c|d` by default).

## License

MIT
