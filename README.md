# dsh-wsl-media

Local media helpers for dsh on WSL: **ffprobe**, **pdftotext**, optional **whisper** ASR.

Not in `install.sh`. Paths must stay under allowlisted roots (home, `~/.dsh`, `/tmp`, `/mnt/c|d` by default).

[中文 → README.zh.md](./README.zh.md)

## Install

```sh
# Debian/Ubuntu example: ffmpeg (ffprobe), poppler-utils (pdftotext)
dsh plugin --profile web add github:173787247/dsh-wsl-media
```

## Tools

| Tool | Role |
|------|------|
| `media_status` | Binaries on PATH |
| `media_probe` | ffprobe metadata |
| `media_pdf_text` | PDF text extract |
| `media_asr` | Speech-to-text (whisper) |

## License

MIT
